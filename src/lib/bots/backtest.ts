import { lastDigit, type TradeStats, computeStats } from "@/lib/utils";
import type { ContractType, Tick } from "@/lib/deriv/types";
import { returnRate } from "@/lib/deriv/payouts";
import { EMA, MACD, RSI } from "@/lib/indicators";
import { digitStats } from "@/lib/indicators/digits";
import { computeConfluence } from "@/lib/indicators/confluence";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type { BotParams } from "./strategies";

export interface BacktestConfig {
  strategyId: "smart-martingale" | "rsi-ema-sniper" | "digit-differential" | "spike-catcher";
  params: BotParams;
  pipSize: number;
  startingBalance: number;
  spreadPct: number;
  durationTicks: number;
}

export interface BacktestTrade {
  index: number;
  time: number;
  contractType: ContractType;
  stake: number;
  profit: number;
  won: boolean;
  entryQuote: number;
  exitQuote: number;
  rationale: string;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  stats: TradeStats;
  ticks: number;
  startingBalance: number;
  endingBalance: number;
  disclaimer: string;
}

function snapshotFrom(ema9: EMA, ema21: EMA, ema50: EMA, ema200: EMA, rsi: RSI, macd: MACD, price: number): IndicatorSnapshot {
  return {
    price,
    ema9: ema9.current,
    ema21: ema21.current,
    ema50: ema50.current,
    ema200: ema200.current,
    rsi: rsi.current,
    bb: null,
    macd: macd.current,
    atr: null,
    stochastic: null,
    sampleCount: ema200.samples,
  };
}

/**
 * Deterministic replay of the built-in rule sets over historical ticks.
 * Payouts are modelled from the same indicative rates as Simulation Mode and a
 * spread is deducted so results are deliberately conservative.
 */
export function runBacktest(ticks: Tick[], config: BacktestConfig): BacktestResult {
  const { params, strategyId, pipSize } = config;
  const ema9 = new EMA(9);
  const ema21 = new EMA(21);
  const ema50 = new EMA(50);
  const ema200 = new EMA(200);
  const rsi = new RSI(14);
  const macd = new MACD(12, 26, 9);
  const trades: BacktestTrade[] = [];
  let stake = params.stake;
  let consecutiveLosses = 0;
  let balance = config.startingBalance;
  const digitWindow: number[] = [];

  const warmup = Math.min(60, Math.floor(ticks.length / 3));
  for (let i = 0; i < ticks.length; i += 1) {
    const tick = ticks[i];
    ema9.next(tick.quote);
    ema21.next(tick.quote);
    ema50.next(tick.quote);
    ema200.next(tick.quote);
    rsi.next(tick.quote);
    macd.next(tick.quote);
    digitWindow.push(lastDigit(tick.quote, pipSize));
    if (digitWindow.length > 200) digitWindow.shift();
    if (i < warmup) continue;
    const exitIndex = i + config.durationTicks;
    if (exitIndex >= ticks.length) break;

    const snapshot = snapshotFrom(ema9, ema21, ema50, ema200, rsi, macd, tick.quote);
    const digits = digitStats(digitWindow, 5);
    const confluence = computeConfluence(snapshot, []);
    let decision: { contractType: ContractType; rationale: string } | null = null;

    if (strategyId === "smart-martingale") {
      if (snapshot.ema9 !== null && snapshot.ema21 !== null && snapshot.ema50 !== null) {
        if (snapshot.ema9 > snapshot.ema21 && snapshot.ema21 > snapshot.ema50) {
          decision = { contractType: "CALL", rationale: "Bullish EMA stack" };
        } else if (snapshot.ema9 < snapshot.ema21 && snapshot.ema21 < snapshot.ema50) {
          decision = { contractType: "PUT", rationale: "Bearish EMA stack" };
        }
      }
    } else if (strategyId === "rsi-ema-sniper") {
      if (snapshot.rsi !== null && snapshot.macd && snapshot.ema9 !== null && snapshot.ema21 !== null) {
        if (confluence.score >= Math.max(52, params.scoreThreshold)) {
          if (snapshot.rsi > 53 && snapshot.macd.histogram > 0 && snapshot.ema9 > snapshot.ema21) {
            decision = { contractType: "CALL", rationale: `RSI ${snapshot.rsi.toFixed(1)} + bullish MACD` };
          } else if (snapshot.rsi < 47 && snapshot.macd.histogram < 0 && snapshot.ema9 < snapshot.ema21) {
            decision = { contractType: "PUT", rationale: `RSI ${snapshot.rsi.toFixed(1)} + bearish MACD` };
          }
        }
      }
    } else if (strategyId === "digit-differential") {
      if (digits.sample >= 50) {
        const best = digits.counts.indexOf(Math.max(...digits.counts));
        if (Math.abs(digits.evenPct - 50) > 6) {
          decision = {
            contractType: digits.evenPct > 50 ? "DIGITODD" : "DIGITEVEN",
            rationale: `Fading ${digits.evenPct > 50 ? "even" : "odd"} skew`,
          };
        } else {
          decision = { contractType: "DIGITDIFF", rationale: `Differing from digit ${best}` };
        }
      }
    } else if (strategyId === "spike-catcher") {
      if (snapshot.ema9 !== null && snapshot.ema21 !== null) {
        if (snapshot.ema9 > snapshot.ema21) decision = { contractType: "CALL", rationale: "Upward EMA alignment" };
        else if (snapshot.ema9 < snapshot.ema21) decision = { contractType: "PUT", rationale: "Downward EMA alignment" };
      }
    }

    if (!decision) continue;

    const entry = tick.quote;
    const exit = ticks[exitIndex].quote;
    const exitDigit = lastDigit(exit, pipSize);
    const entryDigit = lastDigit(entry, pipSize);
    let won: boolean;
    const barrierDigit = Number(params.barrier) || 5;
    switch (decision.contractType) {
      case "CALL":
        won = exit > entry;
        break;
      case "PUT":
        won = exit < entry;
        break;
      case "DIGITMATCH":
        won = exitDigit === barrierDigit;
        break;
      case "DIGITDIFF":
        won = exitDigit !== barrierDigit;
        break;
      case "DIGITEVEN":
        won = exitDigit % 2 === 0;
        break;
      case "DIGITODD":
        won = exitDigit % 2 !== 0;
        break;
      case "DIGITOVER":
        won = exitDigit > barrierDigit;
        break;
      case "DIGITUNDER":
        won = exitDigit < barrierDigit;
        break;
      default:
        won = exit > entry;
    }
    const rate = returnRate(decision.contractType) - config.spreadPct / 100;
    const profit = won ? Number((stake * rate).toFixed(2)) : Number(-stake.toFixed(2));
    balance = Number((balance + profit).toFixed(2));
    trades.push({
      index: i,
      time: tick.epoch,
      contractType: decision.contractType,
      stake: Number(stake.toFixed(2)),
      profit,
      won,
      entryQuote: entry,
      exitQuote: exit,
      rationale: decision.rationale,
    });
    void entryDigit;

    consecutiveLosses = profit < 0 ? consecutiveLosses + 1 : 0;
    if (strategyId === "smart-martingale" || strategyId === "digit-differential") {
      if (profit < 0 && consecutiveLosses < params.martingaleCap) {
        stake = Math.min(Number((stake * params.multiplier).toFixed(2)), params.stake * params.multiplier ** params.martingaleCap);
      } else {
        stake = params.stake;
      }
    }
    if (balance <= 0) break;
  }

  return {
    trades,
    stats: computeStats(trades.map((trade) => ({ profit: trade.profit, sellTime: trade.time })), config.startingBalance),
    ticks: ticks.length,
    startingBalance: config.startingBalance,
    endingBalance: balance,
    disclaimer:
      "Backtest ≠ live results. Historical replay uses indicative payouts and cannot model latency, slippage, feed gaps or real tick ordering.",
  };
}
