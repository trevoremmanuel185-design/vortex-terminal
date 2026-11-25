"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_SYMBOL, fallbackSymbols } from "@/lib/deriv/symbols";
import { DEFAULT_RISK_LIMITS, DEFAULT_RISK_STATE, type RiskLimits, type RiskState } from "@/lib/risk/risk-manager";
import { BOTS, type BotId, type BotParams } from "@/lib/bots/strategies";
import type { Timeframe } from "@/lib/indicators/candles";
import type {
  AccountInfo,
  AccountKind,
  ClosedContract,
  ConnectionStatus,
  ContractType,
  EngineKind,
  OpenContract,
  Proposal,
  SymbolInfo,
  Tick,
} from "@/lib/deriv/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type { DigitStats } from "@/lib/indicators/digits";
import type { ConfluenceResult } from "@/lib/indicators/confluence";

export type BotStatus = "idle" | "running" | "paused" | "halted";
export type MobileTab = "markets" | "chart" | "trade" | "bots" | "ledger";

export interface BotLog {
  id: string;
  at: number;
  level: "info" | "trade" | "warn" | "error";
  message: string;
}

export interface TradeForm {
  contractType: ContractType;
  stake: number;
  duration: number;
  durationUnit: "t" | "s" | "m";
  barrier: string;
}

export interface BotRuntime {
  status: BotStatus;
  strategyId: BotId;
  params: BotParams;
  logs: BotLog[];
  trades: number;
  wins: number;
  losses: number;
  haltedReason: string | null;
  startedAt: number | null;
  realApproved: boolean;
  martingaleStep: number;
  currentStake: number;
}

interface TerminalState {
  // connection
  engineKind: EngineKind;
  status: ConnectionStatus;
  latency: number;
  accountType: AccountKind;
  account: AccountInfo | null;
  connectionError: string | null;
  protocolNotice: string | null;
  realConfirmed: boolean;
  rememberToken: boolean;

  // market
  symbols: SymbolInfo[];
  symbol: string;
  favourites: string[];
  marketFilter: string;
  search: string;
  timeframe: Timeframe;
  ticks: Tick[];
  previousQuote: number | null;
  openOnly: boolean;

  // analytics
  snapshot: IndicatorSnapshot | null;
  digits: DigitStats | null;
  confluence: ConfluenceResult | null;

  // execution
  tradeForm: TradeForm;
  proposal: Proposal | null;
  proposalError: string | null;
  buying: boolean;
  openContracts: OpenContract[];
  closedContracts: ClosedContract[];

  // risk
  riskLimits: RiskLimits;
  riskState: RiskState;
  emergencyStop: boolean;
  haltedReason: string | null;

  // bots
  bot: BotRuntime;
  xmlNotice: string | null;
  xmlErrors: string[];

  // ui
  mobileTab: MobileTab;
  chartOverlay: { ema9: boolean; ema21: boolean; ema50: boolean; bollinger: boolean };
  showDigits: boolean;

  // actions
  setEngineKind: (kind: EngineKind) => void;
  setStatus: (status: ConnectionStatus, detail?: string) => void;
  setLatency: (ms: number) => void;
  setAccountType: (type: AccountKind) => void;
  setAccount: (account: AccountInfo | null) => void;
  setConnectionError: (error: string | null) => void;
  setProtocolNotice: (notice: string | null) => void;
  setRealConfirmed: (confirmed: boolean) => void;
  setRememberToken: (remember: boolean) => void;

  setSymbols: (symbols: SymbolInfo[]) => void;
  selectSymbol: (symbol: string) => void;
  toggleFavourite: (symbol: string) => void;
  setMarketFilter: (filter: string) => void;
  setSearch: (search: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setTicks: (ticks: Tick[]) => void;
  pushTick: (tick: Tick) => void;
  setOpenOnly: (openOnly: boolean) => void;

  setAnalytics: (payload: {
    snapshot: IndicatorSnapshot | null;
    digits: DigitStats | null;
    confluence: ConfluenceResult | null;
  }) => void;

  patchTradeForm: (patch: Partial<TradeForm>) => void;
  setProposal: (proposal: Proposal | null) => void;
  setProposalError: (error: string | null) => void;
  setBuying: (buying: boolean) => void;
  upsertOpenContract: (contract: OpenContract) => void;
  removeOpenContract: (contractId: number) => void;
  addClosedContract: (contract: ClosedContract) => void;
  setClosedContracts: (contracts: ClosedContract[]) => void;
  clearLedger: () => void;

  setRiskLimits: (limits: Partial<RiskLimits>) => void;
  setRiskState: (state: RiskState) => void;
  patchRiskState: (patch: Partial<RiskState>) => void;
  setEmergencyStop: (active: boolean, reason?: string | null) => void;
  setHaltedReason: (reason: string | null) => void;

  setBotStatus: (status: BotStatus, reason?: string | null) => void;
  setStrategyId: (id: BotId) => void;
  patchBotParams: (patch: Partial<BotParams>) => void;
  replaceBotParams: (params: BotParams) => void;
  pushBotLog: (level: BotLog["level"], message: string) => void;
  resetBotSession: () => void;
  bumpBotResult: (won: boolean) => void;
  setRealApproved: (approved: boolean) => void;
  setMartingale: (step: number, stake: number) => void;
  setXmlNotice: (notice: string | null, errors?: string[]) => void;

  setMobileTab: (tab: MobileTab) => void;
  toggleOverlay: (key: keyof TerminalState["chartOverlay"]) => void;
  setShowDigits: (show: boolean) => void;
}

const initialSymbols = fallbackSymbols();

function defaultBotRuntime(): BotRuntime {
  const definition = BOTS[0];
  return {
    status: "idle",
    strategyId: definition.id,
    params: { ...definition.params },
    logs: [],
    trades: 0,
    wins: 0,
    losses: 0,
    haltedReason: null,
    startedAt: null,
    realApproved: false,
    martingaleStep: 0,
    currentStake: definition.params.stake,
  };
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      engineKind: "simulation",
      status: "offline",
      latency: 0,
      accountType: "demo",
      account: null,
      connectionError: null,
      protocolNotice: null,
      realConfirmed: false,
      rememberToken: false,

      symbols: initialSymbols,
      symbol: DEFAULT_SYMBOL,
      favourites: ["1HZ75V", "R_100", "frxXAUUSD", "BOOM1000"],
      marketFilter: "all",
      search: "",
      timeframe: "1m",
      ticks: [],
      previousQuote: null,
      openOnly: false,

      snapshot: null,
      digits: null,
      confluence: null,

      tradeForm: {
        contractType: "CALL",
        stake: 1,
        duration: 5,
        durationUnit: "t",
        barrier: "5",
      },
      proposal: null,
      proposalError: null,
      buying: false,
      openContracts: [],
      closedContracts: [],

      riskLimits: { ...DEFAULT_RISK_LIMITS },
      riskState: { ...DEFAULT_RISK_STATE },
      emergencyStop: false,
      haltedReason: null,

      bot: defaultBotRuntime(),
      xmlNotice: null,
      xmlErrors: [],

      mobileTab: "chart",
      chartOverlay: { ema9: true, ema21: true, ema50: true, bollinger: false },
      showDigits: true,

      setEngineKind: (engineKind) => set({ engineKind }),
      setStatus: (status, detail) =>
        set({
          status,
          ...(status === "connected" ? { connectionError: null } : {}),
          ...(detail ? { protocolNotice: detail } : {}),
        }),
      setLatency: (latency) => set({ latency }),
      setAccountType: (accountType) => set({ accountType }),
      setAccount: (account) => set({ account }),
      setConnectionError: (connectionError) => set({ connectionError }),
      setProtocolNotice: (protocolNotice) => set({ protocolNotice }),
      setRealConfirmed: (realConfirmed) => set({ realConfirmed }),
      setRememberToken: (rememberToken) => set({ rememberToken }),

      setSymbols: (symbols) => set({ symbols }),
      selectSymbol: (symbol) =>
        set({
          symbol,
          ticks: [],
          previousQuote: null,
          proposal: null,
          proposalError: null,
        }),
      toggleFavourite: (symbol) => {
        const favourites = get().favourites;
        set({
          favourites: favourites.includes(symbol)
            ? favourites.filter((entry) => entry !== symbol)
            : [...favourites, symbol],
        });
      },
      setMarketFilter: (marketFilter) => set({ marketFilter }),
      setSearch: (search) => set({ search }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setTicks: (ticks) => set({ ticks }),
      pushTick: (tick) => {
        const { ticks, previousQuote } = get();
        const next = ticks.length >= 3_000 ? ticks.slice(ticks.length - 2_999) : ticks.slice();
        next.push(tick);
        set({ ticks: next, previousQuote: ticks.length ? ticks[ticks.length - 1].quote : previousQuote });
      },
      setOpenOnly: (openOnly) => set({ openOnly }),

      setAnalytics: ({ snapshot, digits, confluence }) => set({ snapshot, digits, confluence }),

      patchTradeForm: (patch) => set({ tradeForm: { ...get().tradeForm, ...patch } }),
      setProposal: (proposal) => set({ proposal, proposalError: proposal ? null : get().proposalError }),
      setProposalError: (proposalError) => set({ proposalError }),
      setBuying: (buying) => set({ buying }),
      upsertOpenContract: (contract) => {
        const open = get().openContracts;
        const index = open.findIndex((entry) => entry.contractId === contract.contractId);
        if (contract.status !== "open") {
          set({ openContracts: open.filter((entry) => entry.contractId !== contract.contractId) });
          return;
        }
        if (index === -1) set({ openContracts: [contract, ...open] });
        else {
          const next = open.slice();
          next[index] = contract;
          set({ openContracts: next });
        }
      },
      removeOpenContract: (contractId) =>
        set({ openContracts: get().openContracts.filter((entry) => entry.contractId !== contractId) }),
      addClosedContract: (contract) =>
        set({ closedContracts: [contract, ...get().closedContracts].slice(0, 300) }),
      setClosedContracts: (closedContracts) => set({ closedContracts }),
      clearLedger: () => set({ openContracts: [], closedContracts: [], bot: defaultBotRuntime() }),

      setRiskLimits: (limits) => set({ riskLimits: { ...get().riskLimits, ...limits } }),
      setRiskState: (riskState) => set({ riskState }),
      patchRiskState: (patch) => set({ riskState: { ...get().riskState, ...patch } }),
      setEmergencyStop: (emergencyStop, reason) =>
        set({
          emergencyStop,
          haltedReason: emergencyStop ? reason ?? "Emergency stop engaged" : null,
          bot: emergencyStop
            ? { ...get().bot, status: "halted", haltedReason: reason ?? "Emergency stop engaged" }
            : { ...get().bot, haltedReason: null },
        }),
      setHaltedReason: (haltedReason) => set({ haltedReason }),

      setBotStatus: (status, reason) =>
        set({
          bot: {
            ...get().bot,
            status,
            haltedReason: reason ?? null,
            startedAt: status === "running" ? get().bot.startedAt ?? Date.now() : get().bot.startedAt,
          },
        }),
      setStrategyId: (id) => {
        const definition = BOTS.find((bot) => bot.id === id) ?? BOTS[0];
        set({
          bot: {
            ...get().bot,
            strategyId: id,
            params: { ...definition.params },
            logs: [
              {
                id: `${Date.now()}-switch`,
                at: Date.now(),
                level: "info" as const,
                message: `Strategy set to ${definition.name}`,
              },
              ...get().bot.logs,
            ].slice(0, 200),
            martingaleStep: 0,
            currentStake: definition.params.stake,
          },
        });
      },
      patchBotParams: (patch) =>
        set({
          bot: {
            ...get().bot,
            params: { ...get().bot.params, ...patch },
            currentStake: patch.stake ?? get().bot.currentStake,
          },
        }),
      replaceBotParams: (params) => set({ bot: { ...get().bot, params } }),
      pushBotLog: (level, message) =>
        set({
          bot: {
            ...get().bot,
            logs: [
              { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), level, message },
              ...get().bot.logs,
            ].slice(0, 200),
          },
        }),
      resetBotSession: () =>
        set({
          bot: {
            ...defaultBotRuntime(),
            strategyId: get().bot.strategyId,
            params: get().bot.params,
          },
          haltedReason: null,
          emergencyStop: false,
        }),
      bumpBotResult: (won) =>
        set({
          bot: {
            ...get().bot,
            trades: get().bot.trades + 1,
            wins: get().bot.wins + (won ? 1 : 0),
            losses: get().bot.losses + (won ? 0 : 1),
          },
        }),
      setRealApproved: (realApproved) => set({ bot: { ...get().bot, realApproved } }),
      setMartingale: (martingaleStep, currentStake) =>
        set({ bot: { ...get().bot, martingaleStep, currentStake } }),
      setXmlNotice: (xmlNotice, xmlErrors = []) => set({ xmlNotice, xmlErrors }),

      setMobileTab: (mobileTab) => set({ mobileTab }),
      toggleOverlay: (key) =>
        set({ chartOverlay: { ...get().chartOverlay, [key]: !get().chartOverlay[key] } }),
      setShowDigits: (showDigits) => set({ showDigits }),
    }),
    {
      name: "vortex-terminal",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        symbol: state.symbol,
        timeframe: state.timeframe,
        favourites: state.favourites,
        riskLimits: state.riskLimits,
        bot: {
          strategyId: state.bot.strategyId,
          params: state.bot.params,
        },
        chartOverlay: state.chartOverlay,
        showDigits: state.showDigits,
        rememberToken: state.rememberToken,
      }),
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<TerminalState> & {
          bot?: { strategyId?: BotId; params?: BotParams };
        };
        return {
          ...current,
          ...incoming,
          bot: {
            ...current.bot,
            strategyId: incoming.bot?.strategyId ?? current.bot.strategyId,
            params: incoming.bot?.params ?? current.bot.params,
            currentStake: incoming.bot?.params?.stake ?? current.bot.currentStake,
          },
          riskLimits: { ...current.riskLimits, ...(incoming.riskLimits ?? {}) },
        } as TerminalState;
      },
    },
  ),
);

export function useSymbolMeta() {
  return useTerminalStore((state) => state.symbols.find((entry) => entry.symbol === state.symbol));
}
