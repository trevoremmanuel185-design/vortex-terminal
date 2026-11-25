"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { Crosshair, Minus, Pencil, RotateCcw, TrendingUp } from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Panel, Segmented } from "@/components/ui/Primitives";
import { TIMEFRAMES, candlesFromTickGroups, candlesFromTicks, timeframeDef, type Timeframe } from "@/lib/indicators/candles";
import { bollingerSeries, emaSeries } from "@/lib/indicators";
import { formatNumber } from "@/lib/utils";
import { getEngine } from "@/lib/session/engines";
import type { Candle } from "@/lib/deriv/types";

const TF_OPTIONS = TIMEFRAMES.map((tf) => ({ value: tf.id, label: tf.label }));

export function PriceChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const tickLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaRefs = useRef<{ key: string; series: ISeriesApi<"Line"> }[]>([]);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const lastTimeRef = useRef<number>(0);

  const symbol = useTerminalStore((state) => state.symbol);
  const symbolMeta = useTerminalStore((state) => state.symbols.find((entry) => entry.symbol === state.symbol));
  const timeframe = useTerminalStore((state) => state.timeframe);
  const setTimeframe = useTerminalStore((state) => state.setTimeframe);
  const ticks = useTerminalStore((state) => state.ticks);
  const overlay = useTerminalStore((state) => state.chartOverlay);
  const toggleOverlay = useTerminalStore((state) => state.toggleOverlay);
  const engineKind = useTerminalStore((state) => state.engineKind);
  const status = useTerminalStore((state) => state.status);
  const proposal = useTerminalStore((state) => state.proposal);

  const [history, setHistory] = useState<Candle[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tool, setTool] = useState<"none" | "hline" | "trend">("none");
  const [trendPoints, setTrendPoints] = useState<{ x: number; y: number }[]>([]);
  const [showEma, setShowEma] = useState(true);

  const def = timeframeDef(timeframe);
  const decimals = symbolMeta?.decimals ?? 2;

  // ── chart bootstrap ────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0B0F17" },
        textColor: "#94A3B8",
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(30,41,59,0.55)", style: LineStyle.Dotted },
        horzLines: { color: "rgba(30,41,59,0.55)", style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: "#1E293B", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: "#1E293B", timeVisible: true, secondsVisible: true, rightOffset: 4 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#06B6D4", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#0E121B" },
        horzLine: { color: "#06B6D4", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#0E121B" },
      },
      localization: { priceFormatter: (price: number) => formatNumber(price, decimals) },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981",
      downColor: "#F43F5E",
      borderUpColor: "#10B981",
      borderDownColor: "#F43F5E",
      wickUpColor: "#34D399",
      wickDownColor: "#FB7185",
      priceFormat: { type: "price", precision: decimals, minMove: 1 / 10 ** decimals },
    });
    const line = chart.addSeries(LineSeries, {
      color: "#06B6D4",
      lineWidth: 1,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
    });
    line.applyOptions({ visible: false });
    chartRef.current = chart;
    candleRef.current = candles;
    tickLineRef.current = line;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      tickLineRef.current = null;
      emaRefs.current = [];
      priceLineRef.current = null;
    };
  }, [decimals]);

  // ── historical candles for the selected timeframe ──────────────
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    if (def.tickBased) {
      setHistory([]);
      return;
    }
    void getEngine(engineKind)
      .getHistory(symbol, def.granularity, 320)
      .then((candles) => {
        if (!cancelled) {
          setHistory(candles);
          lastTimeRef.current = candles[candles.length - 1]?.time ?? 0;
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "History unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, engineKind, def.granularity, def.tickBased]);

  // ── overlay EMA series (9/21/50) ───────────────────────────────
  const baseCandles = useMemo(() => {
    if (def.tickBased) return [];
    if (history.length === 0) return [];
    const merged = [...history];
    const granularity = def.seconds ?? 60;
    for (const tick of ticks) {
      if (tick.symbol !== symbol) continue;
      const last = merged[merged.length - 1];
      if (!last) continue;
      const bucket = Math.floor(tick.epoch / granularity) * granularity;
      if (bucket > last.time) {
        merged.push({ time: bucket, open: tick.quote, high: tick.quote, low: tick.quote, close: tick.quote });
      } else {
        last.high = Math.max(last.high, tick.quote);
        last.low = Math.min(last.low, tick.quote);
        last.close = tick.quote;
      }
    }
    return merged;
  }, [history, ticks, def.seconds, def.tickBased, symbol]);

  const tickCandles = useMemo(() => {
    if (!def.tickBased) return [];
    if (timeframe === "5t") return candlesFromTickGroups(ticks.filter((tick) => tick.symbol === symbol), 5);
    return candlesFromTicks(ticks.filter((tick) => tick.symbol === symbol), 1);
  }, [def.tickBased, timeframe, ticks, symbol]);

  const candles = def.tickBased ? tickCandles : baseCandles;

  // ── push data into the chart ───────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleRef.current;
    const tickSeries = tickLineRef.current;
    if (!chart || !candleSeries || !tickSeries) return;

    if (def.tickBased) {
      candleSeries.applyOptions({ visible: false });
      tickSeries.applyOptions({ visible: true });
      const lineData: LineData[] = ticks
        .filter((tick) => tick.symbol === symbol)
        .map((tick) => ({ time: tick.epoch as UTCTimestamp, value: tick.quote }));
      const deduped = lineData.filter((point, index) => index === 0 || point.time !== lineData[index - 1].time);
      if (deduped.length > 0) tickSeries.setData(deduped);
      chart.timeScale().fitContent();
    } else {
      tickSeries.applyOptions({ visible: false });
      candleSeries.applyOptions({ visible: true });
      const candleData: CandlestickData[] = candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
      if (candleData.length > 0) candleSeries.setData(candleData);
      if (!lastTimeRef.current || candleData.length < 50) {
        chart.timeScale().fitContent();
        lastTimeRef.current = candleData.length;
      }
    }

    // EMA overlays
    for (const entry of emaRefs.current) {
      try {
        chart.removeSeries(entry.series);
      } catch {
        /* series may already be gone */
      }
    }
    emaRefs.current = [];
    if (overlay.ema9 || overlay.ema21 || overlay.ema50) {
      const source = def.tickBased ? [] : candles;
      if (source.length > 2) {
        const definitions = [
          { key: "ema9", period: 9, color: "#22D3EE", enabled: overlay.ema9 },
          { key: "ema21", period: 21, color: "#F59E0B", enabled: overlay.ema21 },
          { key: "ema50", period: 50, color: "#A78BFA", enabled: overlay.ema50 },
        ];
        for (const definition of definitions) {
          if (!definition.enabled) continue;
          const series = chart.addSeries(LineSeries, {
            color: definition.color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          series.setData(
            emaSeries(source, definition.period).map((point) => ({
              time: point.time as UTCTimestamp,
              value: point.value,
            })),
          );
          emaRefs.current.push({ key: definition.key, series });
        }
      }
    }

    if (overlay.bollinger && candleSeries && candles.length > 20) {
      const bands = bollingerSeries(candles, 20, 2);
      for (const band of [bands.upper, bands.lower]) {
        const series = chart.addSeries(LineSeries, {
          color: "rgba(6,182,212,0.35)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData(band.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
        emaRefs.current.push({ key: `bb-${Math.random()}`, series });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, ticks, symbol, def.tickBased, timeframe, overlay]);

  // ── live price line for the proposal spot ─────────────────────
  useEffect(() => {
    const series = def.tickBased ? tickLineRef.current : candleRef.current;
    if (!series) return;
    if (priceLineRef.current) {
      try {
        series.removePriceLine(priceLineRef.current);
      } catch {
        /* noop */
      }
      priceLineRef.current = null;
    }
    const last = ticks[ticks.length - 1];
    if (!last) return;
    priceLineRef.current = series.createPriceLine({
      price: last.quote,
      color: "#06B6D4",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: symbolMeta?.displayName ?? symbol,
    });
    return () => {
      if (priceLineRef.current) {
        try {
          series.removePriceLine(priceLineRef.current);
        } catch {
          /* noop */
        }
        priceLineRef.current = null;
      }
    };
  }, [ticks, symbol, symbolMeta, def.tickBased, timeframe]);

  const lastTick = ticks[ticks.length - 1];
  const previousTick = ticks[ticks.length - 2];
  const direction = lastTick && previousTick ? (lastTick.quote >= previousTick.quote ? "up" : "down") : "up";

  const handleChartClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (tool !== "trend" || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setTrendPoints((points) => (points.length >= 2 ? [point] : [...points, point]));
    },
    [tool],
  );

  return (
    <Panel
      title="Chart"
      subtitle={`${symbolMeta?.displayName ?? symbol} · ${def.label}${" "}· ${history.length || candles.length} bars`}
      icon={<TrendingUp size={13} />}
      actions={
        <div className="flex items-center gap-1.5">
          {lastTick ? (
            <span className={`num hidden text-sm font-semibold sm:inline ${direction === "up" ? "text-emerald" : "text-crimson"}`}>
              {direction === "up" ? "▲" : "▼"} {formatNumber(lastTick.quote, decimals)}
            </span>
          ) : null}
          <Badge tone={engineKind === "simulation" ? "amber" : status === "connected" ? "emerald" : "neutral"}>
            {engineKind === "simulation" ? "SIMULATION" : "LIVE"}
          </Badge>
        </div>
      }
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-hairline/70 px-2 py-1.5">
        <Segmented options={TF_OPTIONS} value={timeframe} onChange={setTimeframe} size="sm" className="overflow-x-auto" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowEma((value) => !value)}
            className={`rounded border px-1.5 py-1 text-[9px] uppercase tracking-wider ${showEma ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-hairline text-ink-faint"}`}
            aria-pressed={showEma}
          >
            EMA
          </button>
          <button
            type="button"
            onClick={() => setTool(tool === "hline" ? "none" : "hline")}
            className={`rounded border p-1 ${tool === "hline" ? "border-amber/50 bg-amber/10 text-amber" : "border-hairline text-ink-faint hover:text-ink"}`}
            aria-label="Horizontal price line tool"
            title="Horizontal line (current price)"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            onClick={() => setTool(tool === "trend" ? "none" : "trend")}
            className={`rounded border p-1 ${tool === "trend" ? "border-amber/50 bg-amber/10 text-amber" : "border-hairline text-ink-faint hover:text-ink"}`}
            aria-label="Trendline tool"
            title="Trendline (click two points)"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => {
              setTrendPoints([]);
              chartRef.current?.timeScale().fitContent();
            }}
            className="rounded border border-hairline p-1 text-ink-faint hover:text-ink"
            aria-label="Reset drawings"
            title="Reset chart"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-hairline/70 px-2 py-1 text-[9px] text-ink-faint">
        <span className="inline-flex items-center gap-1"><Crosshair size={9} /> crosshair</span>
        <span>·</span>
        <button type="button" onClick={() => toggleOverlay("ema9")} className={overlay.ema9 ? "text-cyan" : ""}>EMA9</button>
        <button type="button" onClick={() => toggleOverlay("ema21")} className={overlay.ema21 ? "text-amber" : ""}>EMA21</button>
        <button type="button" onClick={() => toggleOverlay("ema50")} className={overlay.ema50 ? "text-purple-400" : ""}>EMA50</button>
        <button type="button" onClick={() => toggleOverlay("bollinger")} className={overlay.bollinger ? "text-cyan" : ""}>BB(20,2)</button>
        {proposal ? <span className="ml-auto num hidden sm:inline">spot {formatNumber(proposal.spot, decimals)}</span> : null}
      </div>

      <div className="relative min-h-[260px] flex-1 md:min-h-[320px]">
        <div ref={containerRef} onClick={handleChartClick} className="absolute inset-0" role="img" aria-label={`${symbolMeta?.displayName ?? symbol} ${def.label} chart`} />
        {tool === "trend" ? (
          <div className="pointer-events-none absolute left-2 top-2 rounded border border-amber/30 bg-obsidian/80 px-1.5 py-0.5 text-[9px] text-amber">
            Trendline: click two points ({trendPoints.length}/2)
          </div>
        ) : null}
        {trendPoints.length > 0 ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {trendPoints.length === 2 ? (
              <line
                x1={trendPoints[0].x}
                y1={trendPoints[0].y}
                x2={trendPoints[1].x}
                y2={trendPoints[1].y}
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            ) : (
              <circle cx={trendPoints[0].x} cy={trendPoints[0].y} r="2.5" fill="#F59E0B" />
            )}
          </svg>
        ) : null}
        {loadError ? (
          <p className="absolute bottom-2 left-2 rounded border border-amber/30 bg-obsidian/90 px-2 py-1 text-[10px] text-amber">
            Chart history: {loadError}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

export default PriceChart;
