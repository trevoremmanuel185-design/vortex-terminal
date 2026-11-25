import { describe, expect, it } from "vitest";
import {
  DEFAULT_RISK_LIMITS,
  DEFAULT_RISK_STATE,
  applyTradeResult,
  evaluatePreTrade,
  martingaleLadder,
  registerTradeOpen,
  riskUtilisation,
  type RiskLimits,
  type RiskState,
} from "./risk-manager";

const limits: RiskLimits = { ...DEFAULT_RISK_LIMITS };
const state: RiskState = { ...DEFAULT_RISK_STATE, startingBalanceToday: 1000, balance: 1000 };

describe("evaluatePreTrade", () => {
  it("allows a normal trade", () => {
    expect(evaluatePreTrade(state, limits, { stake: 5, now: 10_000_000 }).allowed).toBe(true);
  });

  it("blocks trades above the max stake", () => {
    const result = evaluatePreTrade(state, limits, { stake: 25 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("MAX_STAKE");
  });

  it("halts on max daily loss", () => {
    const result = evaluatePreTrade({ ...state, balance: 940 }, limits, { stake: 1 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("MAX_DAILY_LOSS");
      expect(result.halt).toBe(true);
    }
  });

  it("halts on max consecutive losses", () => {
    const result = evaluatePreTrade({ ...state, consecutiveLosses: 3 }, limits, { stake: 1 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("MAX_CONSECUTIVE_LOSSES");
  });

  it("enforces the cooldown window", () => {
    const result = evaluatePreTrade(
      { ...state, lastTradeAt: 1_000 },
      { ...limits, cooldownSeconds: 30 },
      { stake: 1, now: 1_000 + 5_000 },
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("COOLDOWN");
  });

  it("halts when take-profit is reached", () => {
    const result = evaluatePreTrade({ ...state, balance: 1200 }, limits, { stake: 1 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("TAKE_PROFIT_REACHED");
  });

  it("honours emergency stop", () => {
    const result = evaluatePreTrade(state, limits, { stake: 1, emergencyStopped: true });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("EMERGENCY_STOP");
  });

  it("blocks real-account automation when configured", () => {
    const result = evaluatePreTrade(state, limits, { stake: 1, isReal: true });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("REAL_ACCOUNT_BLOCKED");
  });

  it("blocks a third open position", () => {
    const result = evaluatePreTrade({ ...state, openPositions: 2 }, limits, { stake: 1 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("MAX_OPEN_POSITIONS");
  });

  it("blocks stakes above available balance", () => {
    const result = evaluatePreTrade(
      { ...state, balance: 2, startingBalanceToday: 2 },
      { ...limits, maxStake: 100 },
      { stake: 5 },
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("INSUFFICIENT_BALANCE");
  });
});

describe("state transitions", () => {
  it("increments loss streak and resets on a win", () => {
    const lost = applyTradeResult(state, -5);
    expect(lost.consecutiveLosses).toBe(1);
    expect(lost.balance).toBe(995);
    const won = applyTradeResult(lost, 4);
    expect(won.consecutiveLosses).toBe(0);
  });

  it("tracks open positions and payout on close", () => {
    const opened = registerTradeOpen(state, 5, 1_000);
    expect(opened.openPositions).toBe(1);
    expect(opened.balance).toBe(995);
    const closed = registerTradeCloseForTest(opened, 10.5, 5.5);
    expect(closed.openPositions).toBe(0);
    expect(closed.balance).toBe(1005.5);
  });
});

function registerTradeCloseForTest(stateIn: RiskState, payout: number, profit: number): RiskState {
  return {
    ...stateIn,
    balance: Number((stateIn.balance + payout).toFixed(2)),
    openPositions: Math.max(0, stateIn.openPositions - 1),
    consecutiveLosses: profit < 0 ? stateIn.consecutiveLosses + 1 : 0,
  };
}

describe("martingale ladder", () => {
  it("caps the ladder length", () => {
    const ladder = martingaleLadder(1, 2, 4);
    expect(ladder.stakes).toEqual([1, 2, 4, 8]);
    expect(ladder.cumulative).toBe(15);
    expect(ladder.topStake).toBe(8);
  });

  it("respects the max stake guard", () => {
    const ladder = martingaleLadder(5, 2.1, 5, 12);
    expect(ladder.capped).toBe(true);
    expect(Math.max(...ladder.stakes)).toBeLessThanOrEqual(12);
  });

  it("clamps absurd parameters", () => {
    const ladder = martingaleLadder(1, 99, 99);
    expect(ladder.stakes.length).toBeLessThanOrEqual(12);
    expect(Math.max(...ladder.stakes)).toBeLessThanOrEqual(1 * 4 ** 11);
  });
});

describe("risk utilisation", () => {
  it("never exceeds 100%", () => {
    const utilisation = riskUtilisation(
      { ...state, balance: 1, consecutiveLosses: 99, tradesToday: 9999 },
      limits,
    );
    expect(utilisation.lossPct).toBeLessThanOrEqual(100);
    expect(utilisation.tradePct).toBeLessThanOrEqual(100);
    expect(utilisation.lossChainPct).toBeLessThanOrEqual(100);
  });
});
