"use client";

import { useMemo, useState } from "react";
import { Grid3X3, Info } from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Panel, Segmented } from "@/components/ui/Primitives";
import { digitStats, digitsFromTicks, digitDistributionLabel } from "@/lib/indicators/digits";
import { cn } from "@/lib/utils";

const WINDOWS = [25, 50, 100, 500, 1_000] as const;

export function DigitAnalyzer() {
  const ticks = useTerminalStore((state) => state.ticks);
  const symbol = useTerminalStore((state) => state.symbol);
  const meta = useTerminalStore((state) => state.symbols.find((entry) => entry.symbol === state.symbol));
  const [windowSize, setWindowSize] = useState<(typeof WINDOWS)[number]>(100);
  const [threshold, setThreshold] = useState(5);

  const pipSize = meta?.pipSize ?? 0.01;
  const digits = useMemo(
    () => digitsFromTicks(ticks.slice(-windowSize).map((tick) => tick.quote), pipSize),
    [ticks, windowSize, pipSize],
  );
  const stats = useMemo(() => digitStats(digits, threshold), [digits, threshold]);
  const lastDigits = digits.slice(-24).reverse();
  const maxCount = Math.max(1, ...stats.counts);

  return (
    <Panel
      title="Digit matrix"
      subtitle={`${windowSize} ticks · pip ${meta?.pipSize ?? "—"}`}
      icon={<Grid3X3 size={13} />}
      actions={<Badge tone="cyan">n={stats.sample}</Badge>}
      bodyClassName="flex flex-col gap-2 p-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <Segmented
          options={WINDOWS.map((size) => ({ value: String(size), label: size >= 1000 ? "1000" : String(size) }))}
          value={String(windowSize)}
          onChange={(value) => setWindowSize(Number(value) as (typeof WINDOWS)[number])}
          size="sm"
        />
        <label className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-ink-faint">
          Over/Under
          <select
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            className="h-6 rounded border border-hairline bg-obsidian px-1 text-[10px] text-ink"
            aria-label="Over under threshold digit"
          >
            {Array.from({ length: 10 }, (_, digit) => (
              <option key={digit} value={digit}>{digit}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-10 items-end gap-1">
        {stats.counts.map((count, digit) => {
          const pct = stats.percentages[digit];
          const isHot = stats.hot.includes(digit);
          const isCold = stats.cold.includes(digit);
          return (
            <div key={digit} className="flex flex-col items-center gap-1">
              <span className={cn("num text-[9px]", isHot ? "text-emerald" : isCold ? "text-crimson" : "text-ink-faint")}>
                {pct.toFixed(1)}
              </span>
              <div className="flex h-16 w-full items-end overflow-hidden rounded-sm bg-panel-3/70">
                <div
                  className={cn(
                    "w-full rounded-sm transition-[height] duration-200",
                    isHot ? "bg-emerald/80" : isCold ? "bg-crimson/70" : "bg-cyan/40",
                  )}
                  style={{ height: `${Math.max(6, (count / maxCount) * 100)}%` }}
                  title={`${digit}: ${count} hits (${pct.toFixed(2)}%)`}
                />
              </div>
              <span className={cn("num text-[10px] font-semibold", digit === threshold ? "text-amber" : "text-ink-muted")}>{digit}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-4">
        {[
          { label: "Even", value: `${stats.evenPct.toFixed(1)}%`, tone: stats.evenPct >= 50 ? "text-emerald" : "text-ink-muted", streak: stats.evenStreak },
          { label: "Odd", value: `${stats.oddPct.toFixed(1)}%`, tone: stats.oddPct > 50 ? "text-emerald" : "text-ink-muted", streak: stats.oddStreak },
          { label: `Match ${threshold}`, value: `${stats.matchPct.toFixed(1)}%`, tone: "text-ink-muted", streak: stats.matchStreak },
          { label: `Differ ${threshold}`, value: `${stats.differPct.toFixed(1)}%`, tone: "text-ink-muted", streak: stats.differStreak },
          { label: `Over ${threshold}`, value: `${stats.overPct.toFixed(1)}%`, tone: "text-ink-muted" },
          { label: `Under ${threshold}`, value: `${stats.underPct.toFixed(1)}%`, tone: "text-ink-muted" },
          { label: "Max even run", value: `${stats.maxEvenStreak}`, tone: "text-ink-muted" },
          { label: "Max odd run", value: `${stats.maxOddStreak}`, tone: "text-ink-muted" },
        ].map((cell) => (
          <div key={cell.label} className="rounded border border-hairline/70 bg-panel-2/60 px-1.5 py-1">
            <p className="text-[8px] uppercase tracking-[0.1em] text-ink-faint">{cell.label}</p>
            <p className={cn("num text-[11px] font-semibold", cell.tone)}>
              {cell.value}
              {cell.streak !== undefined ? <span className="ml-1 text-[8px] font-normal text-ink-faint">run {cell.streak}</span> : null}
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-ink-faint">Last digits (newest first)</p>
        <div className="flex flex-wrap gap-1">
          {lastDigits.map((digit, index) => (
            <span
              key={`${digit}-${index}`}
              className={cn(
                "num flex h-5 w-5 items-center justify-center rounded border text-[10px]",
                index === 0
                  ? "border-cyan/60 bg-cyan/15 text-cyan"
                  : stats.hot.includes(digit)
                    ? "border-emerald/30 bg-emerald/5 text-emerald"
                    : stats.cold.includes(digit)
                      ? "border-crimson/30 bg-crimson/5 text-crimson"
                      : "border-hairline bg-panel-2 text-ink-muted",
              )}
            >
              {digit}
            </span>
          ))}
          {lastDigits.length === 0 ? <span className="text-[10px] text-ink-faint">Waiting for ticks…</span> : null}
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-md border border-hairline/70 bg-obsidian/50 px-2 py-1.5">
        <Info size={11} className="mt-0.5 shrink-0 text-ink-faint" />
        <p className="text-[9px] leading-relaxed text-ink-faint">
          <span className="text-ink-muted">{digitDistributionLabel(stats.chiSquare, stats.sample)}</span> · χ² ={" "}
          <span className="num">{stats.chiSquare.toFixed(1)}</span> vs 16.92 critical. Last digits are independent draws;
          a &quot;cold&quot; digit is not due. {meta?.displayName ?? symbol} digits are read at pip precision {pipSize}.
        </p>
      </div>
    </Panel>
  );
}

export default DigitAnalyzer;
