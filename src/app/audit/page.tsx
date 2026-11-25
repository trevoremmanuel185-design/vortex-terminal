import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { db } from "@/db";
import { signalAudit, type SignalAuditRow } from "@/db/schema";
import { SiteFooter, SiteHeader, WhatsAppFab } from "@/components/site/SiteChrome";
import { Badge, Panel, Stat } from "@/components/ui/Primitives";
import { CONFLUENCE_CAVEAT } from "@/lib/indicators/confluence";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Signal audit",
  description:
    "Every signal VORTEX produced, what happened next, and the measured hit-rate — wins and losses included.",
};

async function loadAudit(): Promise<{
  rows: SignalAuditRow[];
  hits: number;
  misses: number;
  pending: number;
  error: boolean;
}> {
  try {
    const rows = await db.select().from(signalAudit).orderBy(desc(signalAudit.id)).limit(150);
    const [aggregate] = await db
      .select({
        hits: sql<number>`count(*) filter (where outcome = 'hit')::int`,
        misses: sql<number>`count(*) filter (where outcome = 'miss')::int`,
        pending: sql<number>`count(*) filter (where outcome = 'pending')::int`,
      })
      .from(signalAudit);
    return {
      rows,
      hits: aggregate?.hits ?? 0,
      misses: aggregate?.misses ?? 0,
      pending: aggregate?.pending ?? 0,
      error: false,
    };
  } catch {
    return { rows: [], hits: 0, misses: 0, pending: 0, error: true };
  }
}

export default async function AuditPage() {
  const { rows, hits, misses, pending, error } = await loadAudit();
  const resolved = hits + misses;
  const hitRate = resolved > 0 ? (hits / resolved) * 100 : 0;

  return (
    <div className="min-h-screen bg-obsidian">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald">Accountability</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Signal audit</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Every manual and bot signal is written to Postgres the moment it is generated, then resolved against the
              actual contract result. No cherry-picking: pending and losing signals stay in the table.
            </p>
          </div>
          <Badge tone={error ? "amber" : "cyan"}>{error ? "storage unavailable" : "live from Postgres"}</Badge>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Resolved signals" value={resolved} sub="hit + miss" />
          <Stat label="Measured hit rate" value={resolved ? `${hitRate.toFixed(1)}%` : "—"} tone={hitRate >= 50 ? "up" : "down"} sub="no marketing multiplier" />
          <Stat label="Hits" value={hits} tone="up" />
          <Stat label="Misses" value={misses} tone="down" />
        </div>

        <p className="mt-3 rounded-lg border border-amber/25 bg-amber/5 px-3 py-2 text-[11px] leading-relaxed text-amber/90">
          <AlertTriangle size={12} className="mr-1 inline" />{" "}
          {CONFLUENCE_CAVEAT} A positive hit-rate over a small sample is not evidence of an edge, and simulated
          outcomes are labelled separately.
        </p>

        <Panel
          title="Audit trail"
          subtitle={`${rows.length} most recent records`}
          className="mt-6"
          bodyClassName="overflow-x-auto p-0"
        >
          {rows.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-ink-muted">No signals recorded yet.</p>
              <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-ink-faint">
                Open the terminal, place a manual trade or start a bot. Each signal is stored with its confluence score,
                component contributions and the realised outcome.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
              <thead className="bg-panel-2/80 text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2 text-right">Confluence</th>
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2 text-right">Entry</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-hairline/60">
                    <td className="num px-3 py-1.5 text-ink-faint">{formatDateTime(Math.floor(new Date(row.createdAt).getTime() / 1000))}</td>
                    <td className="px-3 py-1.5 text-ink-muted">{row.symbol}</td>
                    <td className="px-3 py-1.5 text-ink">{row.direction}</td>
                    <td className="num px-3 py-1.5 text-right font-semibold text-ink">{row.score}</td>
                    <td className="px-3 py-1.5 text-ink-muted">{row.label}</td>
                    <td className="num px-3 py-1.5 text-right text-ink-muted">{formatNumber(row.price, 4)}</td>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-faint">
                        {row.source}
                        {row.simulated ? <span className="rounded border border-amber/30 bg-amber/10 px-1 text-[8px] uppercase text-amber">sim</span> : null}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      {row.outcome === "hit" ? (
                        <span className="inline-flex items-center gap-1 text-emerald"><CheckCircle2 size={11} /> hit</span>
                      ) : row.outcome === "miss" ? (
                        <span className="inline-flex items-center gap-1 text-crimson"><XCircle size={11} /> miss</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-ink-faint"><MinusCircle size={11} /> pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { title: "What gets recorded", body: "Symbol, direction, 0–100 confluence score, label, entry spot, source (manual/bot) and whether the fill was simulated." },
            { title: "How outcomes resolve", body: "Each signal is linked to its Deriv contract. Wins are hits, losses are misses; sold-early contracts use realised P&L. Nothing is deleted." },
            { title: "What this is not", body: "This is not a win-probability claim nor backtested marketing. It is a raw ledger of what this terminal's indicators and bots actually did." },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-hairline bg-panel/60 p-3">
              <h2 className="text-xs font-semibold text-ink">{card.title}</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{card.body}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
