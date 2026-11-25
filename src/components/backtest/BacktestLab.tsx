"use client";

import { useState } from "react";
import { FlaskConical, Play, RotateCcw } from "lucide-react";
import { Badge, Button, DisclaimerNote, Field, Panel, Stat, inputClass } from "@/components/ui/Primitives";
import { BOTS } from "@/lib/bots/strategies";
import type { BotParams } from "@/lib/bots/strategies";
import { runBacktest, type BacktestResult } from "@/lib/bots/backtest";
import { getSimulationEngine } from "@/lib/session/engines";
import { SYMBOL_CATALOG, symbolMeta } from "@/lib/deriv/symbols";
import { formatCurrency, formatNumber } from "@/lib/utils";

const STRATEGIES = [
  { value: "smart-martingale", label: "Smart Martingale" },
  { value: "rsi-ema-sniper", label: "RSI + EMA Sniper" },
  { value: "digit-differential", label: "Digit Differential" },
  { value: "spike-catcher", label: "Spike Catcher" },
] as const;

export function BacktestLab() {
  const [strategyId, setStrategyId] = useState<(typeof STRATEGIES)[number]["value"]>("smart-martingale");
  const [symbol, setSymbol] = useState("1HZ75V");
  const [startingBalance, setStartingBalance] = useState(1_000);
  const [spreadPct, setSpreadPct] = useState(2);
  const [durationTicks, setDurationTicks] = useState(5);
  const [params, setParams] = useState<BotParams>({ ...BOTS[0].params });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const engine = getSimulationEngine();
      await engine.connect();
      const ticks = await engine.getTicks(symbol, 900);
      if (ticks.length < 120) throw new Error("Not enough history to replay — try another market.");
      const output = runBacktest(ticks, {
        strategyId,
        params,
        pipSize: symbolMeta(symbol).pipSize,
        startingBalance,
        spreadPct,
        durationTicks,
      });
      setResult(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setBusy(false);
    }
  }

  const equityPath = (() => {
    if (!result || result.stats.equityCurve.length < 2) return "";
    const values = [startingBalance, ...result.stats.equityCurve.map((point) => point.value)];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 100 - ((value - min) / Math.max(0.0001, max - min)) * 94 - 3;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  })();

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Panel title="Configuration" icon={<FlaskConical size={13} />}>
        <div className="space-y-2">
          <Field label="Strategy" htmlFor="bt-strategy">
            <select id="bt-strategy" value={strategyId} onChange={(event) => setStrategyId(event.target.value as typeof strategyId)} className={inputClass}>
              {STRATEGIES.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Market" htmlFor="bt-symbol">
            <select id="bt-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} className={inputClass}>
              {SYMBOL_CATALOG.map((entry) => (
                <option key={entry.symbol} value={entry.symbol}>{entry.displayName}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Starting balance" htmlFor="bt-balance">
              <input id="bt-balance" type="number" min={10} value={startingBalance} onChange={(event) => setStartingBalance(Math.max(10, Number(event.target.value)))} className={`${inputClass} num`} />
            </Field>
            <Field label="Spread / fees %" htmlFor="bt-spread">
              <input id="bt-spread" type="number" min={0} max={10} step={0.1} value={spreadPct} onChange={(event) => setSpreadPct(Math.max(0, Number(event.target.value)))} className={`${inputClass} num`} />
            </Field>
            <Field label="Base stake" htmlFor="bt-stake">
              <input id="bt-stake" type="number" min={0.35} step={0.5} value={params.stake} onChange={(event) => setParams({ ...params, stake: Math.max(0.35, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Multiplier" htmlFor="bt-mult">
              <input id="bt-mult" type="number" min={1} max={4} step={0.1} value={params.multiplier} onChange={(event) => setParams({ ...params, multiplier: Number(event.target.value) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Recovery cap" htmlFor="bt-cap">
              <input id="bt-cap" type="number" min={1} max={8} value={params.martingaleCap} onChange={(event) => setParams({ ...params, martingaleCap: Number(event.target.value) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Duration (ticks)" htmlFor="bt-duration">
              <input id="bt-duration" type="number" min={1} max={20} value={durationTicks} onChange={(event) => setDurationTicks(Math.max(1, Number(event.target.value)))} className={`${inputClass} num`} />
            </Field>
            <Field label="Barrier digit" htmlFor="bt-barrier">
              <input id="bt-barrier" value={params.barrier} onChange={(event) => setParams({ ...params, barrier: event.target.value })} className={`${inputClass} num`} />
            </Field>
            <Field label="Confluence ≥" htmlFor="bt-score">
              <input id="bt-score" type="number" min={0} max={100} value={params.scoreThreshold} onChange={(event) => setParams({ ...params, scoreThreshold: Number(event.target.value) })} className={`${inputClass} num`} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" loading={busy} onClick={() => void run()}>
              <Play size={13} /> Run backtest
            </Button>
            <Button variant="ghost" onClick={() => { setResult(null); setError(null); }} aria-label="Clear results">
              <RotateCcw size={13} />
            </Button>
          </div>
          {error ? <p className="rounded border border-crimson/30 bg-crimson/10 px-2 py-1 text-[10px] text-crimson">{error}</p> : null}
          <DisclaimerNote>
            Backtest ≠ live results. Replay uses indicative payouts, a configurable spread and cannot model latency,
            requotes, feed gaps or your own behaviour under drawdown.
          </DisclaimerNote>
        </div>
      </Panel>

      <Panel title="Replay results" subtitle={result ? `${result.ticks} ticks · ${result.trades.length} trades` : "No run yet"} actions={<Badge tone="amber">Historical replay</Badge>}>
        {!result ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
            <FlaskConical size={20} className="text-ink-faint" />
            <p className="text-xs text-ink-muted">Configure a strategy and run the replay.</p>
            <p className="max-w-sm text-[10px] leading-relaxed text-ink-faint">
              The engine feeds each historical tick through the same incremental indicators used in the terminal,
              settles contracts after the chosen duration and applies the recovery ladder.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Net P&L" value={formatCurrency(result.endingBalance - result.startingBalance)} tone={result.endingBalance >= result.startingBalance ? "up" : "down"} />
              <Stat label="Win rate" value={`${result.stats.winRate.toFixed(1)}%`} tone={result.stats.winRate >= 50 ? "up" : "down"} sub={`${result.stats.wins}W / ${result.stats.losses}L`} />
              <Stat label="Profit factor" value={Number.isFinite(result.stats.profitFactor) ? result.stats.profitFactor.toFixed(2) : "∞"} tone={result.stats.profitFactor >= 1 ? "up" : "down"} />
              <Stat label="Max drawdown" value={formatCurrency(result.stats.maxDrawdown)} tone="down" />
              <Stat label="Expectancy / trade" value={formatCurrency(result.stats.expectancy)} tone={result.stats.expectancy >= 0 ? "up" : "down"} />
              <Stat label="Avg win" value={formatCurrency(result.stats.avgWin)} tone="up" />
              <Stat label="Avg loss" value={formatCurrency(result.stats.avgLoss)} tone="down" />
              <Stat label="Ending balance" value={formatCurrency(result.endingBalance)} />
            </div>

            {equityPath ? (
              <div className="rounded-lg border border-hairline bg-obsidian/50 p-2">
                <p className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">Equity curve</p>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-1 h-28 w-full" role="img" aria-label="Backtest equity curve">
                  <polyline points={equityPath} fill="none" stroke="#10B981" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            ) : null}

            <div className="max-h-72 overflow-auto rounded-lg border border-hairline">
              <table className="w-full border-collapse text-left text-[10px]">
                <thead className="sticky top-0 bg-panel-2 text-[8px] uppercase tracking-[0.12em] text-ink-faint">
                  <tr>
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">Type</th>
                    <th className="px-2 py-1 text-right">Stake</th>
                    <th className="px-2 py-1 text-right">Entry</th>
                    <th className="px-2 py-1 text-right">Exit</th>
                    <th className="px-2 py-1 text-right">P&L</th>
                    <th className="px-2 py-1">Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((trade, index) => (
                    <tr key={`${trade.index}-${index}`} className="border-t border-hairline/50">
                      <td className="num px-2 py-1 text-ink-faint">{index + 1}</td>
                      <td className="px-2 py-1 text-ink">{trade.contractType}</td>
                      <td className="num px-2 py-1 text-right text-ink-muted">{formatNumber(trade.stake, 2)}</td>
                      <td className="num px-2 py-1 text-right text-ink-muted">{formatNumber(trade.entryQuote, 4)}</td>
                      <td className="num px-2 py-1 text-right text-ink-muted">{formatNumber(trade.exitQuote, 4)}</td>
                      <td className={`num px-2 py-1 text-right font-semibold ${trade.profit >= 0 ? "text-emerald" : "text-crimson"}`}>
                        {trade.profit >= 0 ? "▲ +" : "▼ "}
                        {trade.profit.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-ink-faint">{trade.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] leading-relaxed text-ink-faint">{result.disclaimer}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default BacktestLab;
