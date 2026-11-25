"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTerminalStore } from "@/lib/store/terminal";
import { getEngine, getLiveEngine, getSimulationEngine, fetchProposal } from "./engines";
import { symbolMeta } from "@/lib/deriv/symbols";
import { evaluatePreTrade, registerTradeOpen } from "@/lib/risk/risk-manager";
import { raiseAlert } from "@/lib/alerts";
import { recordSignal, resolveSignal } from "@/lib/signals";
import { DERIV_CONFIG } from "@/lib/deriv/config";
import type { BuyResult, ClosedContract, OpenContract, ProposalRequest } from "@/lib/deriv/types";

const TOKEN_KEY = "vortex-session-token";

function readSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeSessionToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sessionStorage can be blocked */
  }
}

export function closeContractRecord(contract: OpenContract): ClosedContract {
  return {
    contractId: contract.contractId,
    symbol: contract.symbol,
    contractType: contract.contractType,
    buyPrice: contract.buyPrice,
    sellPrice: Math.max(0, contract.buyPrice + contract.profit),
    payout: contract.payout,
    profit: contract.profit,
    purchaseTime: contract.purchaseTime,
    sellTime: Math.floor(Date.now() / 1000),
    entrySpot: contract.entrySpot,
    exitSpot: contract.currentSpot,
    isSimulated: contract.isSimulated,
  };
}

export function useTradingSession() {
  const started = useRef(false);
  const trackedContracts = useRef<Set<number>>(new Set());

  const engineKind = useTerminalStore((state) => state.engineKind);
  const symbol = useTerminalStore((state) => state.symbol);

  useEffect(() => {
    useTerminalStore.persist.rehydrate();
  }, []);

  // ── status + latency telemetry ────────────────────────────────
  useEffect(() => {
    const engine = getEngine(engineKind);
    const offStatus = engine.onStatus((status, detail) => {
      useTerminalStore.getState().setStatus(status, detail);
    });
    const offLatency = engine.onLatency((ms) => useTerminalStore.getState().setLatency(ms));
    return () => {
      offStatus();
      offLatency();
    };
  }, [engineKind]);

  // ── connect, load symbols, balance subscription ───────────────
  useEffect(() => {
    const engine = getEngine(engineKind);
    let cancelled = false;
    const store = useTerminalStore.getState();
    void (async () => {
      try {
        await engine.connect();
        if (cancelled) return;
        const symbols = await engine.getActiveSymbols();
        if (cancelled) return;
        useTerminalStore.getState().setSymbols(symbols);
        const current = useTerminalStore.getState().symbol;
        if (!symbols.some((entry) => entry.symbol === current) && symbols[0]) {
          useTerminalStore.getState().selectSymbol(symbols[0].symbol);
        }
        useTerminalStore.getState().setConnectionError(null);
      } catch (error) {
        if (cancelled) return;
        useTerminalStore
          .getState()
          .setConnectionError(error instanceof Error ? error.message : "Unable to reach Deriv");
      }
    })();

    const offBalance = engine.subscribeBalance((balance, currency) => {
      const state = useTerminalStore.getState();
      const base = state.account;
      if (!base) {
        state.setAccount({
          loginid: store.engineKind === "simulation" ? "VRTC-SIM-4912" : "—",
          currency,
          balance,
          isVirtual: true,
          scopes: ["read", "trade", "trading_information"],
          missingScopes: [],
          highRiskScopes: [],
        });
      } else {
        state.setAccount({ ...base, balance, currency });
      }
      const risk = useTerminalStore.getState().riskState;
      if (Math.abs(risk.balance - balance) > 0.001) {
        useTerminalStore.getState().patchRiskState({ balance });
      }
    });
    return () => {
      cancelled = true;
      offBalance();
    };
  }, [engineKind]);

  // ── tick history + live tick subscription ────────────────────
  useEffect(() => {
    const engine = getEngine(engineKind);
    let cancelled = false;
    useTerminalStore.getState().setTicks([]);
    useTerminalStore.getState().setProposal(null);
    void (async () => {
      try {
        const history = await engine.getTicks(symbol, 900);
        if (!cancelled) useTerminalStore.getState().setTicks(history);
      } catch {
        /* history is optional — stream still works */
      }
    })();
    const offTicks = engine.subscribeTicks(symbol, (tick) => useTerminalStore.getState().pushTick(tick));
    return () => {
      cancelled = true;
      offTicks();
    };
  }, [engineKind, symbol]);

  // ── proposal subscription follows every parameter change ─────
  const tradeForm = useTerminalStore((state) => state.tradeForm);
  const accountCurrency = useTerminalStore((state) => state.account?.currency ?? "USD");
  const status = useTerminalStore((state) => state.status);

  useEffect(() => {
    if (status !== "connected") return;
    const engine = getEngine(engineKind);
    const state = useTerminalStore.getState();
    const request: ProposalRequest = {
      symbol: state.symbol,
      contractType: state.tradeForm.contractType,
      stake: state.tradeForm.stake,
      duration: state.tradeForm.duration,
      durationUnit: state.tradeForm.durationUnit,
      barrier: state.tradeForm.barrier,
      currency: accountCurrency,
    };
    const off = engine.subscribeProposal(request, (proposal, error) => {
      const live = useTerminalStore.getState();
      if (error) live.setProposalError(error);
      else if (proposal) {
        live.setProposal(proposal);
        live.setProposalError(null);
      }
    });
    return () => off();
  }, [
    engineKind,
    status,
    symbol,
    tradeForm.contractType,
    tradeForm.stake,
    tradeForm.duration,
    tradeForm.durationUnit,
    tradeForm.barrier,
    accountCurrency,
  ]);

  /** Attach to a contract and mirror its lifecycle into the ledger. */
  const trackContract = useCallback((contractId: number, signalId?: number | null) => {
    if (trackedContracts.current.has(contractId)) return;
    trackedContracts.current.add(contractId);
    const engine = getEngine(useTerminalStore.getState().engineKind);
    let unsubscribe: () => void = () => undefined;
    let settled = false;
    unsubscribe = engine.subscribeContract(contractId, (contract) => {
      if (!contract || settled) return;
      const store = useTerminalStore.getState();
      store.upsertOpenContract(contract);
      if (contract.status !== "open") {
        settled = true;
        unsubscribe();
        trackedContracts.current.delete(contractId);
        const closed = closeContractRecord(contract);
        store.addClosedContract(closed);
        store.patchRiskState({
          openPositions: Math.max(0, store.riskState.openPositions - 1),
          consecutiveLosses:
            closed.profit < 0 ? store.riskState.consecutiveLosses + 1 : 0,
        });
        store.pushBotLog(
          closed.profit >= 0 ? "trade" : "info",
          `#${closed.contractId} settled ${closed.profit >= 0 ? "WIN" : "LOSS"} ${closed.profit >= 0 ? "+" : ""}${closed.profit.toFixed(2)} ${contract.isSimulated ? "(simulated)" : ""}`,
        );
        if (signalId) {
          void resolveSignal(signalId, closed.profit > 0 ? "hit" : "miss");
        }
        raiseAlert(
          closed.profit >= 0 ? "Trade won" : "Trade closed in loss",
          `#${closed.contractId} ${contract.symbol} · ${closed.profit >= 0 ? "+" : ""}${closed.profit.toFixed(2)}`,
          closed.profit >= 0 ? "success" : "warning",
          { sound: false, notify: true },
        );
      }
    });
  }, []);

  const buyNow = useCallback(
    async (options: { source: "manual" | "bot"; stake?: number } = { source: "manual" }): Promise<BuyResult> => {
      const state = useTerminalStore.getState();
      if (state.status !== "connected") throw new Error("Connection is not ready — trading is disabled.");
      if (state.engineKind === "live" && !state.account) throw new Error("Authorize a Deriv account first.");
      const stake = options.stake ?? state.tradeForm.stake;
      const isReal = state.accountType === "real";
      const decision = evaluatePreTrade(state.riskState, state.riskLimits, {
        stake,
        isReal: isReal && state.riskLimits.stopOnRealAccount && options.source === "bot",
        emergencyStopped: state.emergencyStop,
      });
      if (!decision.allowed) {
        state.setProposalError(decision.reason);
        throw new Error(decision.reason);
      }
      if (state.engineKind === "live") {
        if (!state.proposal) throw new Error("No valid proposal — wait for a live quote.");
        if (Date.now() - state.proposal.receivedAt > DERIV_CONFIG.proposalStaleMs) {
          throw new Error("Proposal is stale (>5s). Wait for the next quote and retry.");
        }
        if (Math.abs(state.proposal.askPrice - stake) > 0.001) {
          throw new Error("Proposal does not match the current stake — wait for the refreshed quote.");
        }
      }
      const request: ProposalRequest = {
        symbol: state.symbol,
        contractType: state.tradeForm.contractType,
        stake,
        duration: state.tradeForm.duration,
        durationUnit: state.tradeForm.durationUnit,
        barrier: state.tradeForm.barrier,
        currency: state.account?.currency ?? "USD",
      };
      let proposalId = state.proposal?.id;
      if (state.engineKind === "live" && options.source === "bot") {
        const fresh = await fetchProposal(getEngine("live"), request);
        if (!fresh.proposal) throw new Error(fresh.error ?? "Could not obtain a proposal");
        proposalId = fresh.proposal.id;
      }
      state.setBuying(true);
      try {
        const result = await getEngine(state.engineKind).buy({ ...request, proposalId });
        const meta = symbolMeta(state.symbol);
        const open: OpenContract = {
          contractId: result.contractId,
          transactionId: result.transactionId,
          symbol: state.symbol,
          contractType: state.tradeForm.contractType,
          buyPrice: result.buyPrice,
          payout: result.payout,
          entrySpot: result.entrySpot,
          currentSpot: result.entrySpot,
          profit: 0,
          profitPct: 0,
          longcode: result.longcode || `${state.tradeForm.contractType} ${meta.displayName}`,
          purchaseTime: result.purchaseTime,
          expiryTime: result.expiryTime,
          isSimulated: result.isSimulated,
          status: "open",
        };
        useTerminalStore.getState().upsertOpenContract(open);
        useTerminalStore.setState({
          riskState: registerTradeOpen(useTerminalStore.getState().riskState, stake),
        });
        useTerminalStore.getState().patchRiskState({ balance: result.balanceAfter || useTerminalStore.getState().riskState.balance });
        const signalId = await recordSignal({
          symbol: state.symbol,
          direction: state.tradeForm.contractType,
          score: state.confluence?.score ?? 50,
          label: state.confluence?.label ?? "NEUTRAL",
          price: result.entrySpot,
          source: options.source,
          simulated: result.isSimulated,
          components: state.confluence?.components.map((c) => ({
            id: c.id,
            contribution: Number(c.contribution.toFixed(2)),
          })) ?? [],
        });
        trackedContracts.current.delete(result.contractId);
        trackContract(result.contractId, signalId);
        useTerminalStore.getState().pushBotLog(
          "trade",
          `${options.source === "bot" ? "Bot" : "Manual"} buy ${state.tradeForm.contractType} ${meta.displayName} @ ${result.buyPrice.toFixed(2)}${result.isSimulated ? " (simulated)" : ""}`,
        );
        return result;
      } finally {
        useTerminalStore.getState().setBuying(false);
      }
    },
    [trackContract],
  );

  const sellContract = useCallback(async (contractId: number) => {
    const state = useTerminalStore.getState();
    try {
      const result = await getEngine(state.engineKind).sell(contractId);
      state.patchRiskState({ balance: result.balanceAfter || state.riskState.balance });
      state.pushBotLog("info", `Sold #${contractId} for ${result.soldFor.toFixed(2)}`);
      state.removeOpenContract(contractId);
      return result;
    } catch (error) {
      state.pushBotLog("error", error instanceof Error ? error.message : "Sell failed");
      throw error;
    }
  }, []);

  const connectWithToken = useCallback(async (token: string, remember: boolean) => {
    const store = useTerminalStore.getState();
    store.setConnectionError(null);
    try {
      getSimulationEngine().disconnect();
      const engine = getLiveEngine();
      useTerminalStore.getState().setEngineKind("live");
      const result = await engine.authorize(token);
      useTerminalStore.getState().setAccount(result.account);
      useTerminalStore.getState().setAccountType(result.account.isVirtual ? "demo" : "real");
      useTerminalStore.getState().setRealConfirmed(result.account.isVirtual);
      useTerminalStore.getState().setRememberToken(remember);
      writeSessionToken(remember ? token : null);
      if (result.account.missingScopes.length > 0) {
        useTerminalStore
          .getState()
          .setProtocolNotice(`Token is missing scopes: ${result.account.missingScopes.join(", ")}. Some actions will fail.`);
      } else if (result.account.highRiskScopes.length > 0) {
        useTerminalStore
          .getState()
          .setProtocolNotice("Use a token with only Read + Trade + Trading Information.");
      }
      useTerminalStore.getState().patchRiskState({
        balance: result.account.balance,
        startingBalanceToday: result.account.balance,
        openPositions: 0,
        consecutiveLosses: 0,
        tradesToday: 0,
        lastTradeAt: null,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authorization failed";
      useTerminalStore.getState().setConnectionError(message);
      // Security: never retain a failed token, and return to the sandbox feed.
      getLiveEngine().disconnect();
      useTerminalStore.getState().setEngineKind("simulation");
      void getSimulationEngine().connect();
      throw error;
    }
  }, []);

  const disconnectAndWipe = useCallback(() => {
    getLiveEngine().disconnect();
    writeSessionToken(null);
    const store = useTerminalStore.getState();
    store.setAccount(null);
    store.setAccountType("demo");
    store.setRealConfirmed(false);
    store.setRememberToken(false);
    store.setProtocolNotice(null);
    store.setConnectionError(null);
    store.setEngineKind("simulation");
    store.clearLedger();
    raiseAlert("Credentials wiped", "Token removed from memory and sessionStorage.", "info", { notify: false });
    void getSimulationEngine().connect();
  }, []);

  /** Restore a "remember me" token from sessionStorage on first mount. */
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = readSessionToken();
    if (!token) return;
    void connectWithToken(token, true).catch(() => writeSessionToken(null));
  }, [connectWithToken]);

  return { buyNow, sellContract, connectWithToken, disconnectAndWipe };
}
