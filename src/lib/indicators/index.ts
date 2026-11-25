/**
 * Incremental, O(1)-per-tick indicator engine.
 * Each class keeps rolling state so a 5,000-candle chart costs no extra work
 * per update. All formulas use Wilder smoothing where the reference
 * implementation does.
 */

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface CandleLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MACDOutput {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerOutput {
  upper: number;
  middle: number;
  lower: number;
}

export interface StochasticOutput {
  k: number;
  d: number;
}

/** Simple EMA with the standard 2/(n+1) alpha. Seeded by the first value. */
export class EMA {
  private value: number | null = null;
  private count = 0;
  readonly period: number;

  constructor(period: number) {
    if (period <= 0) throw new Error("EMA period must be positive");
    this.period = period;
  }

  next(price: number): number {
    this.count += 1;
    if (this.value === null) {
      this.value = price;
      return price;
    }
    const alpha = 2 / (this.period + 1);
    this.value = price * alpha + this.value * (1 - alpha);
    return this.value;
  }

  get current(): number | null {
    return this.value;
  }

  get samples(): number {
    return this.count;
  }

  get ready(): boolean {
    return this.count >= this.period;
  }

  reset(): void {
    this.value = null;
    this.count = 0;
  }
}

/** Wilder RSI(period). */
export class RSI {
  private averageGain = 0;
  private averageLoss = 0;
  private previous: number | null = null;
  private seeded: number[] = [];
  private warmedUp = false;
  readonly period: number;

  constructor(period = 14) {
    this.period = period;
  }

  next(price: number): number | null {
    if (this.previous === null) {
      this.previous = price;
      return null;
    }
    const change = price - this.previous;
    this.previous = price;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (!this.warmedUp) {
      this.seeded.push(change);
      if (this.seeded.length < this.period) return null;
      const gains = this.seeded.filter((c) => c > 0);
      const losses = this.seeded.filter((c) => c < 0).map(Math.abs);
      this.averageGain = gains.reduce((a, b) => a + b, 0) / this.period;
      this.averageLoss = losses.reduce((a, b) => a + b, 0) / this.period;
      this.warmedUp = true;
      return this.value();
    }
    this.averageGain = (this.averageGain * (this.period - 1) + gain) / this.period;
    this.averageLoss = (this.averageLoss * (this.period - 1) + loss) / this.period;
    return this.value();
  }

  private value(): number {
    if (this.averageLoss === 0) return 100;
    const rs = this.averageGain / this.averageLoss;
    return 100 - 100 / (1 + rs);
  }

  get current(): number | null {
    if (!this.warmedUp) return null;
    return this.value();
  }

  reset(): void {
    this.averageGain = 0;
    this.averageLoss = 0;
    this.previous = null;
    this.seeded = [];
    this.warmedUp = false;
  }
}

/** Bollinger Bands using a rolling window (O(period) per tick, tiny constant). */
export class BollingerBands {
  private window: number[] = [];
  readonly period: number;
  readonly deviation: number;

  constructor(period = 20, deviation = 2) {
    this.period = period;
    this.deviation = deviation;
  }

  next(price: number): BollingerOutput | null {
    this.window.push(price);
    if (this.window.length > this.period) this.window.shift();
    if (this.window.length < this.period) return null;
    const mean = this.window.reduce((a, b) => a + b, 0) / this.period;
    const variance = this.window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / this.period;
    const sd = Math.sqrt(variance);
    return {
      upper: mean + this.deviation * sd,
      middle: mean,
      lower: mean - this.deviation * sd,
    };
  }

  get current(): BollingerOutput | null {
    if (this.window.length < this.period) return null;
    const mean = this.window.reduce((a, b) => a + b, 0) / this.period;
    const variance = this.window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / this.period;
    const sd = Math.sqrt(variance);
    return {
      upper: mean + this.deviation * sd,
      middle: mean,
      lower: mean - this.deviation * sd,
    };
  }

  reset(): void {
    this.window = [];
  }
}

export class MACD {
  private fast: EMA;
  private slow: EMA;
  private signalEma: EMA;
  readonly fastPeriod: number;
  readonly slowPeriod: number;
  readonly signalPeriod: number;

  constructor(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    this.fast = new EMA(fastPeriod);
    this.slow = new EMA(slowPeriod);
    this.signalEma = new EMA(signalPeriod);
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.signalPeriod = signalPeriod;
  }

  next(price: number): MACDOutput {
    const fast = this.fast.next(price);
    const slow = this.slow.next(price);
    const macd = fast - slow;
    const signal = this.signalEma.next(macd);
    return { macd, signal, histogram: macd - signal };
  }

  get current(): MACDOutput | null {
    if (this.fast.current === null || this.slow.current === null) return null;
    const macd = this.fast.current - this.slow.current;
    const signal = this.signalEma.current ?? macd;
    return { macd, signal, histogram: macd - signal };
  }

  reset(): void {
    this.fast.reset();
    this.slow.reset();
    this.signalEma.reset();
  }
}

/** ATR(14) with Wilder smoothing. */
export class ATR {
  private previousClose: number | null = null;
  private value: number | null = null;
  private seed: number[] = [];
  readonly period: number;

  constructor(period = 14) {
    this.period = period;
  }

  next(candle: Pick<CandleLike, "high" | "low" | "close">): number | null {
    const tr =
      this.previousClose === null
        ? candle.high - candle.low
        : Math.max(
            candle.high - candle.low,
            Math.abs(candle.high - this.previousClose),
            Math.abs(candle.low - this.previousClose),
          );
    this.previousClose = candle.close;
    if (this.value === null) {
      this.seed.push(tr);
      if (this.seed.length < this.period) return null;
      this.value = this.seed.reduce((a, b) => a + b, 0) / this.period;
      return this.value;
    }
    this.value = (this.value * (this.period - 1) + tr) / this.period;
    return this.value;
  }

  get current(): number | null {
    return this.value;
  }

  reset(): void {
    this.previousClose = null;
    this.value = null;
    this.seed = [];
  }
}

export class Stochastic {
  private highs: number[] = [];
  private lows: number[] = [];
  private kEma: EMA;
  private dEma: EMA;
  private output: StochasticOutput | null = null;
  readonly period: number;
  readonly smoothing: number;

  constructor(period = 14, smoothing = 3) {
    this.period = period;
    this.smoothing = smoothing;
    this.kEma = new EMA(smoothing);
    this.dEma = new EMA(smoothing);
  }

  next(candle: Pick<CandleLike, "high" | "low" | "close">): StochasticOutput | null {
    this.highs.push(candle.high);
    this.lows.push(candle.low);
    if (this.highs.length > this.period) this.highs.shift();
    if (this.lows.length > this.period) this.lows.shift();
    if (this.highs.length < this.period) return null;
    const highest = Math.max(...this.highs);
    const lowest = Math.min(...this.lows);
    const range = highest - lowest;
    const rawK = range === 0 ? 50 : ((candle.close - lowest) / range) * 100;
    const k = this.kEma.next(rawK);
    const d = this.dEma.next(k);
    this.output = { k, d };
    return this.output;
  }

  get current(): StochasticOutput | null {
    return this.output;
  }

  reset(): void {
    this.highs = [];
    this.lows = [];
    this.output = null;
    this.kEma.reset();
    this.dEma.reset();
  }
}

export interface IndicatorSnapshot {
  price: number;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  bb: BollingerOutput | null;
  macd: MACDOutput | null;
  atr: number | null;
  stochastic: StochasticOutput | null;
  sampleCount: number;
}

/** Recomputes an indicator series from scratch for chart overlays. */
export function emaSeries(candles: CandleLike[], period: number): IndicatorPoint[] {
  const ema = new EMA(period);
  return candles.map((candle) => ({ time: candle.time, value: ema.next(candle.close) }));
}

export function rsiSeries(candles: CandleLike[], period = 14): IndicatorPoint[] {
  const rsi = new RSI(period);
  const out: IndicatorPoint[] = [];
  for (const candle of candles) {
    const value = rsi.next(candle.close);
    if (value !== null) out.push({ time: candle.time, value });
  }
  return out;
}

export function bollingerSeries(candles: CandleLike[], period = 20, deviation = 2) {
  const bb = new BollingerBands(period, deviation);
  const upper: IndicatorPoint[] = [];
  const middle: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];
  for (const candle of candles) {
    const value = bb.next(candle.close);
    if (!value) continue;
    upper.push({ time: candle.time, value: value.upper });
    middle.push({ time: candle.time, value: value.middle });
    lower.push({ time: candle.time, value: value.lower });
  }
  return { upper, middle, lower };
}

export function atrSeries(candles: CandleLike[], period = 14): IndicatorPoint[] {
  const atr = new ATR(period);
  const out: IndicatorPoint[] = [];
  for (const candle of candles) {
    const value = atr.next(candle);
    if (value !== null) out.push({ time: candle.time, value });
  }
  return out;
}

export function macdSeries(candles: CandleLike[], fast = 12, slow = 26, signal = 9) {
  const macd = new MACD(fast, slow, signal);
  return candles.map((candle) => {
    const out = macd.next(candle.close);
    return { time: candle.time, macd: out.macd, signal: out.signal, histogram: out.histogram };
  });
}

/** One object that owns all rolling state for a symbol. */
export class IndicatorEngine {
  readonly ema9 = new EMA(9);
  readonly ema21 = new EMA(21);
  readonly ema50 = new EMA(50);
  readonly ema200 = new EMA(200);
  readonly rsi = new RSI(14);
  readonly bb = new BollingerBands(20, 2);
  readonly macd = new MACD(12, 26, 9);
  readonly atr = new ATR(14);
  readonly stochastic = new Stochastic(14, 3);
  private lastPrice = 0;
  private samples = 0;

  update(price: number, candle?: Pick<CandleLike, "high" | "low" | "close">): IndicatorSnapshot {
    this.lastPrice = price;
    this.samples += 1;
    return {
      price,
      ema9: this.ema9.next(price),
      ema21: this.ema21.next(price),
      ema50: this.ema50.next(price),
      ema200: this.ema200.next(price),
      rsi: this.rsi.next(price),
      bb: this.bb.next(price),
      macd: this.macd.next(price),
      atr: candle ? this.atr.next(candle) : null,
      stochastic: candle ? this.stochastic.next(candle) : null,
      sampleCount: this.samples,
    };
  }

  snapshot(): IndicatorSnapshot {
    return {
      price: this.lastPrice,
      ema9: this.ema9.current,
      ema21: this.ema21.current,
      ema50: this.ema50.current,
      ema200: this.ema200.current,
      rsi: this.rsi.current,
      bb: this.bb.current,
      macd: this.macd.current,
      atr: this.atr.current,
      stochastic: this.stochastic.current ?? null,
      sampleCount: this.samples,
    };
  }
}
