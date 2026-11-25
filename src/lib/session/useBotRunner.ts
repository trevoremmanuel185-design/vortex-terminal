"use client";

import { useEffect } from "react";
import { useTerminalStore } from "@/lib/store/terminal";
import { botById } from "@/lib/bots/strategies";
import { evaluatePreTrade } from "@/lib/risk/risk-manager";
import { symbolMeta } from "@/lib/deriv/symbols";
import { raiseAlert } from "@/lib/alerts";
import { getEngine, fetchProposal } from "./engines";
import { closeContractRecord } from "./useTradingSession";
import { recordSignal, resolveSignal } from "@/lib/signals";
import type { OpenContract } from "@/lib/deriv/types";

const CHECK_INTERVAL_MS = 2_500;

/**
 * Foreground-only bot runner. It is intentionally *not* a background worker:
 * closing the tab stops automation, which is the safest default for a browser
 * trading terminal. Every purchase is gated by the shared risk manager.
 */
export function useBotRunner() {
  const status = useTerminalStore((state) => state.bot.status);
  const strategyId = useTerminalStore((state) => state.bot.strategyId);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const onVisibility = () => {
        const store = useTerminalStore.getState();
        if (document.hidden && store.bot.status === "running") {
          store.setBotStatus("paused", "Tab backgrounded — automation paused");
          store.pushBotLog("warn", "Tab is hidden: bot paused. Close the tab only after stopping the bot.");
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () => document.removeEventListener("visibilitychange", onVisibility);
    }
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    let cancelled = false;
    let inFlight = false;

    const execute = async () => {
      if (cancelled || inFlight) return;
      const store = useTerminalStore.getState();
      if (store.emergencyStop) {
        store.setBotStatus("halted", "EMERGENCY STOP engaged");
        return;
      }
      if (store.status !== "connected") {
        store.pushBotLog("warn", "Waiting for an active Deriv connection…");
        return;
      }
      const definition = botById(store.bot.strategyId);
      const { snapshot, digits, confluence, previousQuote, symbol } = store;
      if (!snapshot || !digits || !confluence) return;

      const decision = definition.evaluate(
        {
          snapshot,
          digits,
          confluence,
          symbol,
          previousPrice: previousQuote,
          symbolName: symbolMeta(symbol).displayName,
        },
        { ...store.bot.params, stake: store.bot.currentStake },
      );
      if (!decision) return;

      const stake = Number(store.bot.currentStake.toFixed(2));
      const risk = evaluatePreTrade(store.riskState, store.riskLimits, {
        stake,
        isReal: store.accountType === "real",
        emergencyStopped: store.emergencyStop,
      });
      if (!risk.allowed) {
        if (risk.halt) {
          useTerminalStore.getState().setBotStatus("halted", risk.reason);
          useTerminalStore.getState().pushBotLog("error", `HALTED BY RISK · ${risk.reason}`);
          useTerminalStore.getState().setHaltedReason(risk.reason);
          raiseAlert("Bot halted by risk manager", risk.reason, "error");
        } else {
          useTerminalStore.getState().pushBotLog("warn", `Trade skipped · ${risk.reason}`);
        }
        return;
      }
      if (store.accountType === "real" && !store.bot.realApproved) {
        useTerminalStore.getState().pushBotLog("warn", "Real-account automation needs explicit confirmation.");
        return;
      }

      inFlight = true;
      const engine = getEngine(store.engineKind);
      try {
        const request = {
          symbol,
          contractType: decision.contractType,
          stake,
          duration: decision.duration,
          durationUnit: decision.durationUnit,
          barrier: decision.barrier,
          currency: store.account?.currency ?? "USD",
        };
        let proposalId: string | undefined;
        if (store.engineKind === "live") {
          const fresh = await fetchProposal(engine, request);
          if (!fresh.proposal) throw new Error(fresh.error ?? "Proposal unavailable");
          proposalId = fresh.proposal.id;
        }
        const result = await engine.buy({ ...request, proposalId });
        const open: OpenContract = {
          contractId: result.contractId,
          transactionId: result.transactionId,
          symbol,
          contractType: decision.contractType,
          buyPrice: result.buyPrice,
          payout: result.payout,
          entrySpot: result.entrySpot,
          currentSpot: result.entrySpot,
          profit: 0,
          profitPct: 0,
          longcode: result.longcode || decision.rationale,
          purchaseTime: result.purchaseTime,
          expiryTime: result.expiryTime,
          isSimulated: result.isSimulated,
          status: "open",
        };
        useTerminalStore.getState().upsertOpenContract(open);
        const latest = useTerminalStore.getState();
        latest.patchRiskState({
          balance: result.balanceAfter || latest.riskState.balance,
          openPositions: latest.riskState.openPositions + 1,
          tradesToday: latest.riskState.tradesToday + 1,
          lastTradeAt: Date.now(),
        });
        latest.pushBotLog(
          "trade",
          `${decision.contractType} @ ${stake.toFixed(2)} · ${decision.rationale}${result.isSimulated ? " · SIMULATED" : ""}`,
        );
        const signalId = await recordSignal({
          symbol,
          direction: decision.contractType,
          score: confluence.score,
          label: confluence.label,
          price: result.entrySpot,
          source: "bot",
          simulated: result.isSimulated,
          components: confluence.components.map((component) => ({
            id: component.id,
            contribution: Number(component.contribution.toFixed(2)),
          })),
        });

        // Await settlement without polling the REST layer.
        await new Promise<void>((resolve) => {
          let unsubscribe: () => void = () => undefined;
          const timeout = setTimeout(() => {
            unsubscribe();
            resolve();
          }, 15 * 60 * 1000);
          unsubscribe = engine.subscribeContract(result.contractId, (contract) => {
            if (!contract) return;
            useTerminalStore.getState().upsertOpenContract(contract);
            if (contract.status === "open") return;
            clearTimeout(timeout);
            unsubscribe();
            const closed = closeContractRecord(contract);
            const now = useTerminalStore.getState();
            now.addClosedContract(closed);
            now.patchRiskState({
              openPositions: Math.max(0, now.riskState.openPositions - 1),
              consecutiveLosses: closed.profit < 0 ? now.riskState.consecutiveLosses + 1 : 0,
            });
            now.bumpBotResult(closed.profit > 0);
            const params = now.bot.params;
            let step = now.bot.martingaleStep;
            let nextStakeValue = now.bot.currentStake;
            if (closed.profit > 0) {
              step = 0;
              nextStakeValue = params.stake;
            } else if (store.bot.strategyId === "smart-martingale") {
              step = Math.min(step + 1, params.martingaleCap);
              nextStakeValue =
                step >= params.martingaleCap ? params.stake : Number((params.stake * params.multiplier ** step).toFixed(2));
            }
            now.setMartingale(step, nextStakeValue);
            now.pushBotLog(
              closed.profit > 0 ? "trade" : "info",
              `#${closed.contractId} settled ${closed.profit > 0 ? "WIN" : "LOSS"} ${closed.profit >= 0 ? "+" : ""}${closed.profit.toFixed(2)} · next stake ${nextStakeValue.toFixed(2)}`,
            );
            if (signalId) void resolveSignal(signalId, closed.profit > 0 ? "hit" : "miss");
            resolve();
          });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bot order failed";
        useTerminalStore.getState().pushBotLog("error", message);
        if (/connection|disconnected|not connected/i.test(message)) {
          useTerminalStore.getState().setBotStatus("paused", "Connectivity lost — bot paused");
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(() => void execute(), CHECK_INTERVAL_MS);
    void execute();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, strategyId]);

  // Warn before closing the tab while automation is live.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (useTerminalStore.getState().bot.status === "running") {
        event.preventDefault();
        event.returnValue = "A bot is running. Closing this tab stops it.";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
