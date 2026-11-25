"use client";

import { useEffect, useRef } from "react";
import { useTerminalStore } from "@/lib/store/terminal";
import { IndicatorEngine } from "@/lib/indicators";
import { computeConfluence } from "@/lib/indicators/confluence";
import { digitStats, digitsFromTicks } from "@/lib/indicators/digits";
import { candlesFromTicks, timeframeDef, timeframeTrends } from "@/lib/indicators/candles";
import { ATR, Stochastic } from "@/lib/indicators";

interface AnalyticsState {
  key: string;
  engine: IndicatorEngine;
  atr: ATR;
  stochastic: Stochastic;
  processed: number;
  lastCandleTime: number;
  seen: Set<string>;
}

/**
 * Tick → analytics pipeline. Indicators are incremental (O(1) per tick), so a
 * 1,000-tick buffer costs the same per update as a 10-tick buffer. Computing
 * here (rather than in render) keeps the chart thread free.
 */
export function useAnalytics() {
  const symbol = useTerminalStore((state) => state.symbol);
  const ticks = useTerminalStore((state) => state.ticks);
  const timeframe = useTerminalStore((state) => state.timeframe);
  const stateRef = useRef<AnalyticsState | null>(null);

  useEffect(() => {
    const store = useTerminalStore.getState();
    const meta = store.symbols.find((entry) => entry.symbol === symbol);
    const pipSize = meta?.pipSize ?? 0.01;
    const key = `${symbol}:${pipSize}`;
    let current = stateRef.current;
    if (!current || current.key !== key) {
      current = {
        key,
        engine: new IndicatorEngine(),
        atr: new ATR(14),
        stochastic: new Stochastic(14, 3),
        processed: 0,
        lastCandleTime: 0,
        seen: new Set<string>(),
      };
      stateRef.current = current;
    }
    if (ticks.length === 0) return;

    // Feed only ticks we have never processed. Keying by epoch+quote is robust
    // to the rolling buffer being trimmed at its cap (a plain index is not).
    const pending = [];
    for (const tick of ticks) {
      const key = `${tick.epoch}:${tick.quote}`;
      if (current.seen.has(key)) continue;
      current.seen.add(key);
      pending.push(tick);
    }
    if (current.seen.size > 8_000) current.seen.clear();
    if (pending.length === 0 && current.processed > 0) return;

    const def = timeframeDef(timeframe);
    const merged = ticks.slice(-1_200);
    const candles = candlesFromTicks(merged, def.seconds ?? 60);
    let lastSnapshot = current.engine.snapshot();

    for (const tick of pending) {
      lastSnapshot = current.engine.update(tick.quote);
    }
    // Feed completed candles into the bar-based indicators.
    const latestCandle = candles[candles.length - 1];
    if (latestCandle && latestCandle.time !== current.lastCandleTime) {
      current.lastCandleTime = latestCandle.time;
      current.atr.next(latestCandle);
      current.stochastic.next(latestCandle);
    }
    current.processed = ticks.length;

    const snapshot = lastSnapshot;
    Object.assign(snapshot, {
      atr: current.atr.current,
      stochastic: current.stochastic.current,
      sampleCount: current.processed,
    });

    const digits = digitStats(
      digitsFromTicks(merged.slice(-1_000).map((tick) => tick.quote), pipSize),
      5,
    );
    const confluence = computeConfluence(snapshot, timeframeTrends(merged));
    useTerminalStore.getState().setAnalytics({ snapshot, digits, confluence });
  }, [symbol, ticks, timeframe]);
}
