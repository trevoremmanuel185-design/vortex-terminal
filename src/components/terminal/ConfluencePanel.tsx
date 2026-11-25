"use client";

import { Gauge, Info } from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Panel } from "@/components/ui/Primitives";
import { cn, formatNumber } from "@/lib/utils";

const LABEL_TONE: Record<string, string> = {
  "STRONG BUY": "text-emerald",
  BUY: "text-emerald",
  NEUTRAL: "text-ink-muted",
  SELL: "text-crimson",
  "STRONG SELL": "text-crimson",
};

export function ConfluencePanel() {
  const confluence = useTerminalStore((state) => state.confluence);
  const snapshot = useTerminalStore((state) => state.snapshot);
  const digits = useTerminalStore((state) => state.digits);
  const meta = useTerminalStore((state) => state.symbols.find((entry) => entry.symbol === state.symbol));
  const decimals = meta?.decimals ?? 2;

  if (!confluence || !snapshot) {
    return (
      <Panel title="Indicator confluence" icon={<Gauge size={13} />}>
        <p className="text-[11px] text-ink-faint">Warming up the indicator engine…</p>
      </Panel>
    );
  }

  const score = confluence.score;
  const circumference = 2 * Math.PI * 26;
  const offset = circumference * (1 - score / 100);

  return (
    <Panel
      title="Indicator confluence"
      subtitle="Descriptive composite · not a prediction"
      icon={<Gauge size={13} />}
      actions={<Badge tone={score >= 56 ? "emerald" : score <= 44 ? "crimson" : "neutral"}>{score}</Badge>}
      bodyClassName="flex flex-col gap-2 p-2"
    >
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#1E293B" strokeWidth="5" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={score >= 56 ? "#10B981" : score <= 44 ? "#F43F5E" : "#06B6D4"}
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-lg font-semibold text-ink">{score}</span>
            <span className="text-[8px] uppercase tracking-wider text-ink-faint">/100</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold tracking-tight", LABEL_TONE[confluence.label])}>
            {confluence.label}
          </p>
          <p className="text-[10px] leading-relaxed text-ink-faint">
            {score > 54 ? "Indicators currently lean upward" : score < 46 ? "Indicators currently lean downward" : "Indicators are balanced"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1 text-[9px] text-ink-faint">
            <span className="num">RSI {snapshot.rsi !== null ? snapshot.rsi.toFixed(1) : "—"}</span>
            <span>·</span>
            <span className="num">ATR {snapshot.atr !== null ? formatNumber(snapshot.atr, Math.min(4, decimals)) : "—"}</span>
            <span>·</span>
            <span className="num">n={snapshot.sampleCount}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {confluence.components.map((component) => {
          const positive = component.contribution >= 0;
          const width = Math.min(100, Math.abs(component.raw) * 100);
          return (
            <div key={component.id}>
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="truncate text-ink-muted">{component.label}</span>
                <span className={cn("num shrink-0 font-semibold", positive ? "text-emerald" : "text-crimson")}>
                  {positive ? "+" : "−"}
                  {Math.abs(component.contribution).toFixed(1)}
                </span>
              </div>
              <div className="mt-0.5 flex h-1.5 overflow-hidden rounded-full bg-panel-3">
                <div className="flex w-1/2 justify-end">
                  {!positive ? <div className="h-full rounded-l-full bg-crimson/70" style={{ width: `${width}%` }} /> : null}
                </div>
                <div className="flex w-1/2">
                  {positive ? <div className="h-full rounded-r-full bg-emerald/70" style={{ width: `${width}%` }} /> : null}
                </div>
              </div>
              <p className="mt-0.5 truncate text-[9px] text-ink-faint">{component.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "EMA 9", value: snapshot.ema9 },
          { label: "EMA 21", value: snapshot.ema21 },
          { label: "EMA 50", value: snapshot.ema50 },
          { label: "BB upper", value: snapshot.bb?.upper ?? null },
          { label: "BB lower", value: snapshot.bb?.lower ?? null },
          { label: "MACD hist", value: snapshot.macd?.histogram ?? null },
        ].map((cell) => (
          <div key={cell.label} className="rounded border border-hairline/60 bg-panel-2/50 px-1.5 py-1">
            <p className="text-[8px] uppercase tracking-[0.1em] text-ink-faint">{cell.label}</p>
            <p className="num text-[10px] font-medium text-ink">
              {cell.value === null ? "—" : formatNumber(cell.value, Math.min(5, decimals + 1))}
            </p>
          </div>
        ))}
      </div>

      {digits ? (
        <div className="grid grid-cols-4 gap-1 text-[9px]">
          <span className="rounded border border-hairline/60 bg-obsidian/50 px-1 py-0.5 text-ink-faint">Even <span className="num text-emerald">{digits.evenPct.toFixed(0)}%</span></span>
          <span className="rounded border border-hairline/60 bg-obsidian/50 px-1 py-0.5 text-ink-faint">Odd <span className="num text-cyan">{digits.oddPct.toFixed(0)}%</span></span>
          <span className="rounded border border-hairline/60 bg-obsidian/50 px-1 py-0.5 text-ink-faint">Match <span className="num text-ink">{digits.matchPct.toFixed(0)}%</span></span>
          <span className="rounded border border-hairline/60 bg-obsidian/50 px-1 py-0.5 text-ink-faint">Differ <span className="num text-ink">{digits.differPct.toFixed(0)}%</span></span>
        </div>
      ) : null}

      <div className="flex items-start gap-1.5 rounded-md border border-hairline/60 bg-obsidian/50 px-2 py-1.5">
        <Info size={11} className="mt-0.5 shrink-0 text-ink-faint" />
        <p className="text-[9px] leading-relaxed text-ink-faint">
          {confluence.caveat} This is <span className="text-ink-muted">Indicator Confluence</span> — never accuracy or win
          probability. Measured hit-rate lives in the{" "}
          <a href="/audit" className="text-cyan underline-offset-2 hover:underline">signal audit</a>.
        </p>
      </div>
    </Panel>
  );
}

export default ConfluencePanel;
