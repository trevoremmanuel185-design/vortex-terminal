import { describe, expect, it } from "vitest";
import { lastDigit } from "@/lib/utils";
import { digitStats, digitsFromTicks, streakCounters } from "./digits";
import { candlesFromTicks, candlesFromTickGroups } from "./candles";
import { computeConfluence, labelForScore } from "./confluence";

describe("last digit extraction", () => {
  it("honours the instrument pip size", () => {
    expect(lastDigit(1234.5678, 0.0001)).toBe(8);
    expect(lastDigit(1234.567, 0.001)).toBe(7);
    expect(lastDigit(1234.56, 0.01)).toBe(6);
    expect(lastDigit(98765.4321, 0.0001)).toBe(1);
  });

  it("rounds at pip precision before extracting", () => {
    expect(lastDigit(1.23499, 0.01)).toBe(3);
    expect(lastDigit(0.6005, 0.0001)).toBe(5);
  });

  it("maps a quote series to digits", () => {
    expect(digitsFromTicks([1.1, 2.2, 3.3], 0.1)).toEqual([1, 2, 3]);
  });
});

describe("digit statistics", () => {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const stats = digitStats(digits, 5);

  it("counts each digit once", () => {
    expect(stats.counts).toEqual(Array(10).fill(1));
    expect(stats.sample).toBe(10);
    expect(stats.percentages).toEqual(Array(10).fill(10));
  });

  it("computes even/odd, over/under and matches/differs", () => {
    expect(stats.evenPct).toBeCloseTo(50, 6);
    expect(stats.oddPct).toBeCloseTo(50, 6);
    expect(stats.matchPct).toBeCloseTo(10, 6);
    expect(stats.differPct).toBeCloseTo(90, 6);
    expect(stats.overPct).toBeCloseTo(40, 6);
    expect(stats.underPct).toBeCloseTo(60, 6);
  });

  it("handles an empty sample without NaN", () => {
    const empty = digitStats([], 5);
    expect(empty.sample).toBe(0);
    expect(empty.evenPct).toBe(0);
    expect(empty.chiSquare).toBe(0);
  });

  it("tracks streaks", () => {
    const streaks = streakCounters([2, 4, 6, 5, 5, 5, 7], 5);
    expect(streaks.maxEven).toBe(3);
    expect(streaks.maxMatch).toBe(3);
  });
});

describe("candle aggregation", () => {
  it("buckets ticks into 60s candles", () => {
    const candles = candlesFromTicks(
      [
        { epoch: 1_700_000_000, quote: 100 },
        { epoch: 1_700_000_030, quote: 104 },
        { epoch: 1_700_000_045, quote: 99 },
        { epoch: 1_700_000_070, quote: 101 },
      ],
      60,
    );
    expect(candles).toHaveLength(2);
    expect(candles[0]).toMatchObject({ open: 100, high: 104, low: 100, close: 104 });
    expect(candles[1]).toMatchObject({ open: 99, low: 99, close: 101 });
  });

  it("groups ticks into N-tick candles", () => {
    const ticks = Array.from({ length: 10 }, (_, i) => ({
      symbol: "R_100",
      epoch: 1_700_000_000 + i,
      quote: 100 + i,
    }));
    const candles = candlesFromTickGroups(ticks, 5);
    expect(candles).toHaveLength(2);
    expect(candles[0].close).toBe(104);
  });
});

describe("confluence scoring", () => {
  it("clamps the score to 0–100 and labels it", () => {
    const result = computeConfluence(
      {
        price: 100,
        ema9: 101,
        ema21: 100,
        ema50: 99,
        ema200: 98,
        rsi: 65,
        bb: { upper: 102, middle: 100, lower: 98 },
        macd: { macd: 0.5, signal: 0.2, histogram: 0.3 },
        atr: 0.4,
        stochastic: { k: 70, d: 65 },
        sampleCount: 300,
      },
      [
        { tf: "1m", direction: 1 },
        { tf: "5m", direction: 1 },
        { tf: "15m", direction: 1 },
      ],
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.components).toHaveLength(4);
    expect(result.label).toBe(labelForScore(result.score));
    expect(result.caveat).toContain("do not predict");
  });

  it("scores a bearish stack below neutral", () => {
    const result = computeConfluence(
      {
        price: 100,
        ema9: 98,
        ema21: 99,
        ema50: 101,
        ema200: 103,
        rsi: 30,
        bb: { upper: 103, middle: 100, lower: 97 },
        macd: { macd: -0.6, signal: -0.2, histogram: -0.4 },
        atr: 0.5,
        stochastic: { k: 25, d: 30 },
        sampleCount: 300,
      },
      [
        { tf: "1m", direction: -1 },
        { tf: "5m", direction: -1 },
        { tf: "15m", direction: -1 },
      ],
    );
    expect(result.score).toBeLessThan(45);
    expect(result.label).toMatch(/SELL/);
  });
});
