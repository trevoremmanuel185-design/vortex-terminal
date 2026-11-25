/**
 * Mandatory risk layer. No strategy can trade without passing `evaluatePreTrade`
 * and every fill must be reported through `applyTradeResult`. Limits are pure
 * data so they can be persisted and unit tested.
 */
export interface RiskLimits {
  maxDailyLoss: number;
  takeProfitTarget: number;
  maxConsecutiveLosses: number;
  maxStake: number;
  maxOpenPositions: number;
  cooldownSeconds: number;
  maxMultiplier: number;
  maxTradesPerSession: number;
  stopOnRealAccount: boolean;
}

export interface RiskState {
  startingBalanceToday: number;
  balance: number;
  consecutiveLosses: number;
  openPositions: number;
  tradesToday: number;
  lastTradeAt: number | null;
  sessionStartedAt: number;
}

export type RiskHaltCode =
  | "MAX_DAILY_LOSS"
  | "TAKE_PROFIT_REACHED"
  | "MAX_CONSECUTIVE_LOSSES"
  | "MAX_STAKE"
  | "MAX_OPEN_POSITIONS"
  | "COOLDOWN"
  | "MAX_TRADES"
  | "REAL_ACCOUNT_BLOCKED"
  | "INSUFFICIENT_BALANCE"
  | "EMERGENCY_STOP";

export type RiskDecision =
  | { allowed: true }
  | { allowed: false; code: RiskHaltCode; reason: string; halt: boolean };

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxDailyLoss: 50,
  takeProfitTarget: 100,
  maxConsecutiveLosses: 3,
  maxStake: 10,
  maxOpenPositions: 2,
  cooldownSeconds: 10,
  maxMultiplier: 2.1,
  maxTradesPerSession: 40,
  stopOnRealAccount: true,
};

export const DEFAULT_RISK_STATE: RiskState = {
  startingBalanceToday: 10_000,
  balance: 10_000,
  consecutiveLosses: 0,
  openPositions: 0,
  tradesToday: 0,
  lastTradeAt: null,
  sessionStartedAt: Date.now(),
};

export function dailyPnl(state: RiskState): number {
  return Number((state.balance - state.startingBalanceToday).toFixed(2));
}

export interface TradeIntent {
  stake: number;
  isReal?: boolean;
  emergencyStopped?: boolean;
  now?: number;
}

export function evaluatePreTrade(
  state: RiskState,
  limits: RiskLimits,
  intent: TradeIntent,
): RiskDecision {
  const now = intent.now ?? Date.now();
  const pnl = dailyPnl(state);

  if (intent.emergencyStopped) {
    return {
      allowed: false,
      code: "EMERGENCY_STOP",
      reason: "Emergency stop is active. Reset it in the risk panel before trading.",
      halt: true,
    };
  }
  if (limits.stopOnRealAccount && intent.isReal) {
    return {
      allowed: false,
      code: "REAL_ACCOUNT_BLOCKED",
      reason: "Automated trading on a real account is disabled by your risk settings.",
      halt: true,
    };
  }
  if (pnl <= -Math.abs(limits.maxDailyLoss)) {
    return {
      allowed: false,
      code: "MAX_DAILY_LOSS",
      reason: `Daily loss limit reached (${pnl.toFixed(2)}). Trading halted until you reset the risk budget.`,
      halt: true,
    };
  }
  if (limits.takeProfitTarget > 0 && pnl >= limits.takeProfitTarget) {
    return {
      allowed: false,
      code: "TAKE_PROFIT_REACHED",
      reason: `Take-profit target reached (+${pnl.toFixed(2)}). Profit is protected; trading halted.`,
      halt: true,
    };
  }
  if (state.consecutiveLosses >= limits.maxConsecutiveLosses) {
    return {
      allowed: false,
      code: "MAX_CONSECUTIVE_LOSSES",
      reason: `${state.consecutiveLosses} consecutive losses — the limit is ${limits.maxConsecutiveLosses}.`,
      halt: true,
    };
  }
  if (intent.stake <= 0) {
    return { allowed: false, code: "MAX_STAKE", reason: "Stake must be greater than zero.", halt: false };
  }
  if (intent.stake > limits.maxStake) {
    return {
      allowed: false,
      code: "MAX_STAKE",
      reason: `Stake ${intent.stake.toFixed(2)} exceeds the maximum stake of ${limits.maxStake.toFixed(2)}.`,
      halt: false,
    };
  }
  if (state.openPositions >= limits.maxOpenPositions) {
    return {
      allowed: false,
      code: "MAX_OPEN_POSITIONS",
      reason: `${state.openPositions} open positions — maximum is ${limits.maxOpenPositions}.`,
      halt: false,
    };
  }
  if (state.lastTradeAt !== null && now - state.lastTradeAt < limits.cooldownSeconds * 1000) {
    return {
      allowed: false,
      code: "COOLDOWN",
      reason: `Cooldown active for another ${Math.ceil((limits.cooldownSeconds * 1000 - (now - state.lastTradeAt)) / 1000)}s.`,
      halt: false,
    };
  }
  if (state.tradesToday >= limits.maxTradesPerSession) {
    return {
      allowed: false,
      code: "MAX_TRADES",
      reason: `Session trade cap reached (${limits.maxTradesPerSession}).`,
      halt: true,
    };
  }
  if (intent.stake > state.balance) {
    return {
      allowed: false,
      code: "INSUFFICIENT_BALANCE",
      reason: "Stake exceeds the available balance.",
      halt: false,
    };
  }
  return { allowed: true };
}

export function applyTradeResult(state: RiskState, profit: number): RiskState {
  const balance = Number((state.balance + profit).toFixed(2));
  return {
    ...state,
    balance,
    consecutiveLosses: profit < 0 ? state.consecutiveLosses + 1 : 0,
  };
}

export function registerTradeOpen(state: RiskState, stake: number, now = Date.now()): RiskState {
  return {
    ...state,
    balance: Number((state.balance - stake).toFixed(2)),
    openPositions: state.openPositions + 1,
    tradesToday: state.tradesToday + 1,
    lastTradeAt: now,
  };
}

export function registerTradeClose(state: RiskState, payout: number, profit: number): RiskState {
  return {
    ...state,
    balance: Number((state.balance + payout).toFixed(2)),
    openPositions: Math.max(0, state.openPositions - 1),
    consecutiveLosses: profit < 0 ? state.consecutiveLosses + 1 : 0,
  };
}

export interface MartingaleLadder {
  stakes: number[];
  cumulative: number;
  topStake: number;
  capped: boolean;
}

/** Hard cap on recovery ladders; the UI must show `cumulative` pre-start. */
export function martingaleLadder(
  stake: number,
  multiplier: number,
  cap: number,
  maxStake = Infinity,
): MartingaleLadder {
  const safeCap = Math.max(1, Math.min(12, Math.floor(cap)));
  const safeMultiplier = Math.max(1, Math.min(4, multiplier));
  const stakes: number[] = [];
  let current = stake;
  let capped = false;
  for (let i = 0; i < safeCap; i += 1) {
    const trimmed = Number(current.toFixed(2));
    if (trimmed > maxStake) {
      capped = true;
      break;
    }
    stakes.push(trimmed);
    current *= safeMultiplier;
  }
  return {
    stakes,
    cumulative: Number(stakes.reduce((a, b) => a + b, 0).toFixed(2)),
    topStake: stakes[stakes.length - 1] ?? stake,
    capped: capped || stakes.length < safeCap,
  };
}

export function nextStake(
  currentStake: number,
  multiplier: number,
  cap: number,
  baseStake: number,
  step: number,
): { stake: number; reset: boolean } {
  if (step >= cap) return { stake: baseStake, reset: true };
  return { stake: Number(Math.min(currentStake * multiplier, baseStake * multiplier ** cap).toFixed(2)), reset: false };
}

export function riskUtilisation(state: RiskState, limits: RiskLimits) {
  const lossPct = Math.min(100, Math.max(0, (-dailyPnl(state) / Math.max(1, limits.maxDailyLoss)) * 100));
  const tradePct = Math.min(100, (state.tradesToday / Math.max(1, limits.maxTradesPerSession)) * 100);
  const lossChainPct = Math.min(
    100,
    (state.consecutiveLosses / Math.max(1, limits.maxConsecutiveLosses)) * 100,
  );
  return { lossPct, tradePct, lossChainPct };
}
