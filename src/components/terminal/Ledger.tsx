"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Download, ListOrdered, NotebookPen, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Button, EmptyState, Panel, Stat, inputClass } from "@/components/ui/Primitives";
import { CONTRACT_LABELS } from "@/lib/deriv/payouts";
import { computeStats, downloadCsv, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

type Tab = "open" | "history" | "stats";

export function Ledger({ onSell }: { onSell: (contractId: number) => Promise<void> }) {
  const open = useTerminalStore((state) => state.openContracts);
  const closed = useTerminalStore((state) => state.closedContracts);
  const riskState = useTerminalStore((state) => state.riskState);
  const account = useTerminalStore((state) => state.account);
  const [tab, setTab] = useState<Tab>("open");
  const [selling, setSelling] = useState<number | null>(null);
  const [journalFor, setJournalFor] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [journalStatus, setJournalStatus] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState("");

  const currency = account?.currency ?? "USD";
  const stats = useMemo(() => computeStats(closed, riskState.startingBalanceToday), [closed, riskState.startingBalanceToday]);
  const filteredClosed = useMemo(() => {
    const query = tagFilter.trim().toLowerCase();
    if (!query) return closed;
    return closed.filter((contract) =>
      `${contract.symbol} ${contract.contractType} ${contract.contractId}`.toLowerCase().includes(query),
    );
  }, [closed, tagFilter]);

  const equityPoints = stats.equityCurve.slice(-120);
  const equityPath = useMemo(() => {
    if (equityPoints.length < 2) return "";
    const values = equityPoints.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return equityPoints
      .map((point, index) => {
        const x = (index / (equityPoints.length - 1)) * 100;
        const y = 100 - ((point.value - min) / Math.max(0.0001, max - min)) * 96 - 2;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [equityPoints]);

  async function sell(contractId: number) {
    setSelling(contractId);
    try {
      await onSell(contractId);
    } finally {
      setSelling(null);
    }
  }

  async function saveJournal() {
    if (journalFor === null || notes.trim().length === 0) return;
    const contract = closed.find((entry) => entry.contractId === journalFor);
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: String(journalFor),
          symbol: contract?.symbol ?? "unknown",
          direction: contract?.contractType ?? "",
          stake: contract?.buyPrice ?? 0,
          profit: contract?.profit ?? 0,
          tags,
          notes,
        }),
      });
      setJournalStatus(response.ok ? "Journal entry saved to your Postgres journal." : "Could not save the note right now.");
      if (response.ok) {
        setNotes("");
        setTags("");
        setJournalFor(null);
      }
    } catch {
      setJournalStatus("Could not reach the journal API.");
    }
  }

  return (
    <Panel
      title="Trade ledger"
      subtitle={`${open.length} open · ${closed.length} closed`}
      icon={<Wallet size={13} />}
      actions={
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-hairline bg-obsidian/60 p-0.5">
            {(["open", "history", "stats"] as Tab[]).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setTab(entry)}
                aria-pressed={tab === entry}
                className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${tab === entry ? "bg-panel-3 text-ink" : "text-ink-faint hover:text-ink-muted"}`}
              >
                {entry}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Export CSV"
            onClick={() =>
              downloadCsv(`vortex-ledger-${Date.now()}.csv`, [
                ["contract_id", "symbol", "type", "buy_price", "sell_price", "profit", "purchase_time", "sell_time", "simulated"],
                ...closed.map((contract) => [
                  contract.contractId,
                  contract.symbol,
                  contract.contractType,
                  contract.buyPrice,
                  contract.sellPrice,
                  contract.profit,
                  formatDateTime(contract.purchaseTime),
                  formatDateTime(contract.sellTime),
                  contract.isSimulated ? "yes" : "no",
                ]),
              ])
            }
          >
            <Download size={11} /> CSV
          </Button>
          <Link href="/journal" aria-label="Open trading journal">
            <Button size="sm" variant="ghost"><BookOpen size={11} /></Button>
          </Link>
        </div>
      }
      bodyClassName="flex min-h-0 flex-1 flex-col p-2"
    >
      {tab === "open" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {open.length === 0 ? (
            <EmptyState
              title="No open positions"
              description="Place a manual trade or start a bot. Open contracts appear here with live P&L and a one-click sell."
              icon={<ListOrdered size={16} />}
            />
          ) : (
            <table className="w-full border-collapse text-left text-[10px]">
              <thead className="sticky top-0 bg-panel/95 text-[8px] uppercase tracking-[0.12em] text-ink-faint backdrop-blur">
                <tr>
                  <th className="px-1.5 py-1">ID</th>
                  <th className="px-1.5 py-1">Market</th>
                  <th className="px-1.5 py-1">Type</th>
                  <th className="px-1.5 py-1 text-right">Stake</th>
                  <th className="px-1.5 py-1 text-right">Entry</th>
                  <th className="px-1.5 py-1 text-right">Now</th>
                  <th className="px-1.5 py-1 text-right">P&L</th>
                  <th className="px-1.5 py-1" />
                </tr>
              </thead>
              <tbody>
                {open.map((contract) => {
                  const positive = contract.profit >= 0;
                  return (
                    <tr key={contract.contractId} className="border-t border-hairline/50 hover:bg-panel-2/50">
                      <td className="num px-1.5 py-1 text-ink-faint">#{contract.contractId}</td>
                      <td className="px-1.5 py-1 text-ink-muted">
                        {contract.symbol} {contract.isSimulated ? <span className="text-amber">· sim</span> : null}
                      </td>
                      <td className="px-1.5 py-1 text-ink">{CONTRACT_LABELS[contract.contractType] ?? contract.contractType}</td>
                      <td className="num px-1.5 py-1 text-right text-ink-muted">{formatNumber(contract.buyPrice, 2)}</td>
                      <td className="num px-1.5 py-1 text-right text-ink-muted">{formatNumber(contract.entrySpot, 4)}</td>
                      <td className="num px-1.5 py-1 text-right text-ink-muted">{formatNumber(contract.currentSpot, 4)}</td>
                      <td className={`num px-1.5 py-1 text-right font-semibold ${positive ? "text-emerald" : "text-crimson"}`}>
                        {positive ? "▲ +" : "▼ "}
                        {contract.profit.toFixed(2)}
                      </td>
                      <td className="px-1.5 py-1 text-right">
                        <Button
                          size="sm"
                          variant="sell"
                          loading={selling === contract.contractId}
                          onClick={() => void sell(contract.contractId)}
                        >
                          Sell
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {journalStatus ? <p className="mt-1 text-[9px] text-emerald">{journalStatus}</p> : null}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <input
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            placeholder="Filter by market, type or contract id…"
            aria-label="Filter closed trades"
            className={`${inputClass} h-7 text-[10px]`}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            {filteredClosed.length === 0 ? (
              <EmptyState title="No closed trades yet" description="Settled and sold contracts appear here with their realised P&L. Export to CSV any time." />
            ) : (
              <table className="w-full border-collapse text-left text-[10px]">
                <thead className="sticky top-0 bg-panel/95 text-[8px] uppercase tracking-[0.12em] text-ink-faint backdrop-blur">
                  <tr>
                    <th className="px-1.5 py-1">ID</th>
                    <th className="px-1.5 py-1">Market</th>
                    <th className="px-1.5 py-1">Type</th>
                    <th className="px-1.5 py-1 text-right">Stake</th>
                    <th className="px-1.5 py-1 text-right">P&L</th>
                    <th className="px-1.5 py-1">Closed</th>
                    <th className="px-1.5 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {filteredClosed.map((contract) => {
                    const positive = contract.profit >= 0;
                    return (
                      <tr key={`${contract.contractId}-${contract.sellTime}`} className="border-t border-hairline/50 hover:bg-panel-2/50">
                        <td className="num px-1.5 py-1 text-ink-faint">#{contract.contractId}</td>
                        <td className="px-1.5 py-1 text-ink-muted">{contract.symbol}</td>
                        <td className="px-1.5 py-1 text-ink">{CONTRACT_LABELS[contract.contractType] ?? contract.contractType}</td>
                        <td className="num px-1.5 py-1 text-right text-ink-muted">{formatNumber(contract.buyPrice, 2)}</td>
                        <td className={`num px-1.5 py-1 text-right font-semibold ${positive ? "text-emerald" : "text-crimson"}`}>
                          {positive ? "▲ +" : "▼ "}
                          {contract.profit.toFixed(2)}
                        </td>
                        <td className="num px-1.5 py-1 text-ink-faint">{formatDateTime(contract.sellTime)}</td>
                        <td className="px-1.5 py-1 text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setJournalFor(contract.contractId); setTags(""); setNotes(""); }}>
                            <NotebookPen size={10} /> Note
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {journalFor !== null ? (
            <div className="rounded-md border border-cyan/30 bg-cyan/5 p-2">
              <p className="text-[10px] font-semibold text-cyan">Journal · contract #{journalFor}</p>
              <div className="mt-1 grid gap-1.5 sm:grid-cols-[1fr_2fr_auto]">
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tags: breakout, mistake" className={`${inputClass} h-7 text-[10px]`} aria-label="Journal tags" />
                <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What did you see? What would you repeat?" className={`${inputClass} h-7 text-[10px]`} aria-label="Journal notes" />
                <Button size="sm" variant="primary" onClick={() => void saveJournal()} disabled={notes.trim().length === 0}>
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "stats" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <Stat label="Win rate" value={`${stats.winRate.toFixed(1)}%`} tone={stats.winRate >= 50 ? "up" : "down"} sub={`${stats.wins}W / ${stats.losses}L`} />
            <Stat label="Profit factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} tone={stats.profitFactor >= 1 ? "up" : "down"} />
            <Stat label="Expectancy" value={formatCurrency(stats.expectancy, currency)} tone={stats.expectancy >= 0 ? "up" : "down"} />
            <Stat label="Max drawdown" value={formatCurrency(stats.maxDrawdown, currency)} tone="down" />
            <Stat label="Avg win" value={formatCurrency(stats.avgWin, currency)} tone="up" />
            <Stat label="Avg loss" value={formatCurrency(stats.avgLoss, currency)} tone="down" />
            <Stat label="Net P&L" value={formatCurrency(stats.netProfit, currency)} tone={stats.netProfit >= 0 ? "up" : "down"} />
            <Stat label="Longest loss run" value={`${stats.longestLossStreak}`} tone="amber" />
          </div>
          <div className="rounded-md border border-hairline/70 bg-obsidian/50 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">Equity curve</p>
              <span className="num text-[9px] text-ink-faint">{equityPoints.length} points</span>
            </div>
            {equityPath ? (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-1 h-16 w-full" role="img" aria-label="Equity curve">
                <polyline points={equityPath} fill="none" stroke="#10B981" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
              </svg>
            ) : (
              <p className="mt-2 text-[10px] text-ink-faint">Close a few trades to build the equity curve.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-3">
            <div className="rounded border border-hairline/60 bg-panel-2/40 p-1.5">
              <p className="text-[8px] uppercase tracking-wider text-ink-faint">Starting balance</p>
              <p className="num text-ink">{formatCurrency(riskState.startingBalanceToday, currency)}</p>
            </div>
            <div className="rounded border border-hairline/60 bg-panel-2/40 p-1.5">
              <p className="text-[8px] uppercase tracking-wider text-ink-faint">Current balance</p>
              <p className="num text-ink">{formatCurrency(account?.balance ?? riskState.balance, currency)}</p>
            </div>
            <div className="rounded border border-hairline/60 bg-panel-2/40 p-1.5">
              <p className="text-[8px] uppercase tracking-wider text-ink-faint">Closed trades</p>
              <p className="num text-ink">{stats.count}</p>
            </div>
          </div>
          <p className="flex items-center gap-1 text-[9px] text-ink-faint">
            {stats.netProfit >= 0 ? <TrendingUp size={10} className="text-emerald" /> : <TrendingDown size={10} className="text-crimson" />}
            Statistics include simulated and real contracts from this session. Past performance doesn&apos;t guarantee future results.
          </p>
        </div>
      ) : null}
      <div className="mt-1 flex items-center justify-between border-t border-hairline/60 pt-1 text-[9px] text-ink-faint">
        <span>Balance <span className="num text-ink">{formatCurrency(account?.balance ?? riskState.balance, currency)}</span></span>
        <Badge tone={open.some((entry) => entry.isSimulated) ? "amber" : "neutral"}>
          {open.some((entry) => entry.isSimulated) ? "contains simulated" : "live contracts"}
        </Badge>
      </div>
    </Panel>
  );
}

export default Ledger;
