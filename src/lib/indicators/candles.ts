import type { Candle, Tick } from "@/lib/deriv/types";

export type Timeframe = "1t" | "5t" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface TimeframeDef {
  id: Timeframe;
  label: string;
  seconds: number | null;
  granularity: number;
  tickBased: boolean;
}

export const TIMEFRAMES: TimeframeDef[] = [
  { id: "1t", label: "1T", seconds: null, granularity: 0, tickBased: true },
  { id: "5t", label: "5T", seconds: null, granularity: 0, tickBased: true },
  { id: "1m", label: "1m", seconds: 60, granularity: 60, tickBased: false },
  { id: "5m", label: "5m", seconds: 300, granularity: 300, tickBased: false },
  { id: "15m", label: "15m", seconds: 900, granularity: 900, tickBased: false },
  { id: "1h", label: "1h", seconds: 3600, granularity: 3600, tickBased: false },
  { id: "4h", label: "4h", seconds: 14400, granularity: 14400, tickBased: false },
  { id: "1d", label: "1d", seconds: 86400, granularity: 86400, tickBased: false },
];

export function timeframeDef(tf: Timeframe): TimeframeDef {
  return TIMEFRAMES.find((entry) => entry.id === tf) ?? TIMEFRAMES[2];
}

export function candlesFromTicks(
  ticks: Pick<Tick, "epoch" | "quote">[],
  seconds: number,
): Candle[] {
  if (ticks.length === 0) return [];
  const sorted = [...ticks].sort((a, b) => a.epoch - b.epoch);
  const buckets = new Map<number, Candle>();
  for (const tick of sorted) {
    const bucket = Math.floor(tick.epoch / seconds) * seconds;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, {
        time: bucket,
        open: tick.quote,
        high: tick.quote,
        low: tick.quote,
        close: tick.quote,
      });
    } else {
      existing.high = Math.max(existing.high, tick.quote);
      existing.low = Math.min(existing.low, tick.quote);
      existing.close = tick.quote;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

/** Buckets every N ticks into a candle (Deriv's 5-tick granularity analogue). */
export function candlesFromTickGroups(ticks: Tick[], groupSize: number): Candle[] {
  const sorted = [...ticks].sort((a, b) => a.epoch - b.epoch);
  const out: Candle[] = [];
  for (let i = 0; i < sorted.length; i += groupSize) {
    const group = sorted.slice(i, i + groupSize);
    if (group.length === 0) continue;
    const prices = group.map((tick) => tick.quote);
    out.push({
      time: group[0].epoch,
      open: group[0].quote,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    });
  }
  return out;
}

/** Derive multi-timeframe trend context from a single tick buffer. */
export function timeframeTrends(ticks: Tick[]): { tf: Timeframe; changePct: number; direction: 1 | -1 | 0 }[] {
  return (["1m", "5m", "15m"] as Timeframe[]).map((tf) => {
    const def = timeframeDef(tf);
    const candles = candlesFromTicks(ticks, def.seconds ?? 60);
    const window = candles.slice(-20);
    if (window.length < 2) return { tf, changePct: 0, direction: 0 as const };
    const first = window[0].open;
    const last = window[window.length - 1].close;
    const changePct = first ? ((last - first) / first) * 100 : 0;
    return {
      tf,
      changePct,
      direction: changePct > 0.0005 ? (1 as const) : changePct < -0.0005 ? (-1 as const) : (0 as const),
    };
  });
}
