"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { lastDigit } from "@/lib/utils";
import { Badge } from "@/components/ui/Primitives";

interface DemoProps {
  symbolLabel?: string;
  start?: number;
  compact?: boolean;
}

/**
 * Landing-page live ticker. Pure local simulation (no network, no chart
 * library) so the marketing route stays tiny and instantly interactive.
 */
export function DemoTicker({ symbolLabel = "Volatility 75 (1s)", start = 1204.37, compact = false }: DemoProps) {
  const [price, setPrice] = useState(start);
  const [series, setSeries] = useState<number[]>(() =>
    Array.from({ length: 64 }, (_, i) => start + Math.sin(i / 4) * 1.4 + (Math.random() - 0.5) * 0.8),
  );
  const [direction, setDirection] = useState<"up" | "down">("up");
  const previous = useRef(start);

  useEffect(() => {
    const timer = setInterval(() => {
      setPrice((current) => {
        const drift = (Math.random() - 0.5) * 0.62;
        const next = Number(Math.max(1, current + drift).toFixed(2));
        previous.current = current;
        setDirection(next >= current ? "up" : "down");
        setSeries((values) => [...values.slice(-79), next]);
        return next;
      });
    }, 900);
    return () => clearInterval(timer);
  }, []);

  const change = price - previous.current;
  const digits = useMemo(
    () => series.slice(-16).map((value) => lastDigit(value, 0.01)),
    [series],
  );
  const min = Math.min(...series);
  const max = Math.max(...series);
  const points = series
    .map((value, index) => {
      const x = (index / Math.max(1, series.length - 1)) * 100;
      const y = 100 - ((value - min) / Math.max(0.0001, max - min)) * 92 - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="rounded-xl border border-hairline bg-panel/95 p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-hairline/70 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-dot" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold text-ink">{symbolLabel}</p>
            <p className="num text-[9px] uppercase tracking-[0.16em] text-ink-faint">Simulated feed · tick chart</p>
          </div>
        </div>
        <Badge tone="amber">Simulation</Badge>
      </div>

      <div className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className={`num text-2xl font-semibold ${direction === "up" ? "text-emerald" : "text-crimson"}`}>
            {price.toFixed(2)}
          </p>
          <p className={`num text-[10px] ${change >= 0 ? "text-emerald" : "text-crimson"}`}>
            {change >= 0 ? "▲ +" : "▼ "}
            {change.toFixed(2)} ({((change / price) * 100).toFixed(3)}%)
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">Last digits</p>
          <div className="mt-1 flex gap-1">
            {digits.slice(-8).map((digit, index) => (
              <span
                key={`${digit}-${index}`}
                className={`num flex h-5 w-5 items-center justify-center rounded border text-[10px] ${
                  digit === 5
                    ? "border-cyan/60 bg-cyan/15 text-cyan"
                    : "border-hairline bg-panel-2 text-ink-muted"
                }`}
              >
                {digit}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={compact ? "mt-2 h-20" : "mt-3 h-28"}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Simulated price chart">
          <defs>
            <linearGradient id="demo-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points={`0,100 ${points} 100,100`} fill="url(#demo-fill)" stroke="none" />
          <polyline points={points} fill="none" stroke="#10B981" strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={100 - ((price - min) / Math.max(0.0001, max - min)) * 92 - 4} x2="100" y2={100 - ((price - min) / Math.max(0.0001, max - min)) * 92 - 4} stroke="#06B6D4" strokeDasharray="2 2" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {[
          { label: "Rise payout", value: "+94.2%" },
          { label: "Even / Odd", value: "95.2%" },
          { label: "Confluence", value: "63" },
          { label: "Latency", value: "18ms" },
        ].map((item) => (
          <div key={item.label} className="rounded border border-hairline/70 bg-obsidian/60 px-1.5 py-1">
            <p className="text-[8px] uppercase tracking-[0.1em] text-ink-faint">{item.label}</p>
            <p className="num text-[10px] font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DemoTicker;
