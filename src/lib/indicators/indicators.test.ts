import { describe, expect, it } from "vitest";
import { ATR, BollingerBands, EMA, IndicatorEngine, MACD, RSI, Stochastic } from "./index";

describe("EMA", () => {
  it("matches the textbook 2/(n+1) recursion", () => {
    const ema = new EMA(3);
    const values = [1, 2, 3, 4, 5].map((v) => ema.next(v));
    expect(values[0]).toBe(1);
    expect(values[1]).toBeCloseTo(1.5, 10);
    expect(values[2]).toBeCloseTo(2.25, 10);
    expect(values[3]).toBeCloseTo(3.125, 10);
    expect(values[4]).toBeCloseTo(4.0625, 10);
  });

  it("is ready only after one period of samples", () => {
    const ema = new EMA(5);
    for (let i = 0; i < 4; i += 1) ema.next(10 + i);
    expect(ema.ready).toBe(false);
    ema.next(20);
    expect(ema.ready).toBe(true);
  });
});

describe("RSI (Wilder)", () => {
  it("seeds Wilder averages from the first period of changes", () => {
    const rsi = new RSI(3);
    const values = [10, 11, 10, 11].map((v) => rsi.next(v));
    expect(values[0]).toBeNull();
    expect(values[1]).toBeNull();
    expect(values[2]).toBeNull();
    expect(values[3]).toBeCloseTo(66.6667, 3);
  });

  it("rises when gains dominate the smoothed series", () => {
    const rsi = new RSI(3);
    const series = [10, 11, 10, 11, 12];
    let last: number | null = null;
    for (const price of series) last = rsi.next(price);
    expect(last).toBeCloseTo(77.7778, 3);
  });

  it("returns 100 for a monotone rally", () => {
    const rsi = new RSI(14);
    let last: number | null = null;
    for (let i = 0; i < 40; i += 1) last = rsi.next(100 + i);
    expect(last).toBe(100);
  });
});

describe("Bollinger Bands", () => {
  it("computes the reference mean and deviation", () => {
    const bb = new BollingerBands(8, 2);
    const series = [2, 4, 4, 4, 5, 5, 7, 9];
    let out: ReturnType<BollingerBands["next"]> = null;
    for (const value of series) out = bb.next(value);
    expect(out).not.toBeNull();
    expect(out?.middle).toBeCloseTo(5, 10);
    expect(out?.upper).toBeCloseTo(9, 10);
    expect(out?.lower).toBeCloseTo(1, 10);
  });

  it("stays null before the window fills", () => {
    const bb = new BollingerBands(20, 2);
    for (let i = 0; i < 19; i += 1) expect(bb.next(i + 1)).toBeNull();
    expect(bb.next(20)).not.toBeNull();
  });
});

describe("MACD", () => {
  it("converges to zero on a flat series", () => {
    const macd = new MACD(12, 26, 9);
    let out = macd.next(100);
    for (let i = 0; i < 300; i += 1) out = macd.next(100);
    expect(out.macd).toBeCloseTo(0, 8);
    expect(out.histogram).toBeCloseTo(0, 8);
  });

  it("turns positive in an uptrend", () => {
    const macd = new MACD(12, 26, 9);
    let out = macd.next(1);
    for (let i = 0; i < 120; i += 1) out = macd.next(1 + i * 0.5);
    expect(out.macd).toBeGreaterThan(0);
  });
});

describe("ATR", () => {
  it("averages true range with Wilder smoothing", () => {
    const atr = new ATR(2);
    const candle = { high: 10, low: 8, close: 9 };
    expect(atr.next(candle)).toBeNull();
    expect(atr.next(candle)).toBeCloseTo(2, 10);
    expect(atr.next(candle)).toBeCloseTo(2, 10);
  });
});

describe("Stochastic", () => {
  it("reports 50 on a zero-range window", () => {
    const stoch = new Stochastic(3, 3);
    let out: ReturnType<Stochastic["next"]> = null;
    for (let i = 0; i < 6; i += 1) out = stoch.next({ high: 10, low: 10, close: 10 });
    expect(out).not.toBeNull();
    expect(out?.k).toBeCloseTo(50, 8);
  });
});

describe("IndicatorEngine", () => {
  it("produces a snapshot with every requested series", () => {
    const engine = new IndicatorEngine();
    let snapshot = engine.snapshot();
    for (let i = 0; i < 260; i += 1) {
      const price = 100 + Math.sin(i / 6) * 4;
      snapshot = engine.update(price, { high: price + 1, low: price - 1, close: price });
    }
    expect(snapshot.ema9).not.toBeNull();
    expect(snapshot.ema200).not.toBeNull();
    expect(snapshot.rsi).toBeGreaterThan(0);
    expect(snapshot.bb).not.toBeNull();
    expect(snapshot.macd).not.toBeNull();
    expect(snapshot.atr).not.toBeNull();
    expect(snapshot.stochastic).not.toBeNull();
    expect(snapshot.sampleCount).toBe(260);
  });
});
