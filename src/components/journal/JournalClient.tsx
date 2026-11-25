"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, Field, Panel, inputClass } from "@/components/ui/Primitives";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface JournalEntry {
  id: number;
  contractId: string;
  symbol: string;
  direction: string;
  stake: number;
  profit: number;
  tags: string;
  notes: string;
  createdAt: string;
}

export function JournalClient() {
  const [rows, setRows] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ symbol: "", direction: "CALL", stake: 1, profit: 0, tags: "", notes: "" });
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/journal", { cache: "no-store" });
      const json = (await response.json()) as { rows?: JournalEntry[] };
      setRows(json.rows ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addEntry() {
    if (form.notes.trim().length === 0 || form.symbol.trim().length === 0) {
      setMessage("Add a market and a note before saving.");
      return;
    }
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, contractId: "" }),
    });
    if (response.ok) {
      setMessage("Entry saved.");
      setForm({ symbol: "", direction: "CALL", stake: 1, profit: 0, tags: "", notes: "" });
      void load();
    } else {
      setMessage("Could not save the entry — try again.");
    }
  }

  async function remove(id: number) {
    await fetch(`/api/journal?id=${id}`, { method: "DELETE" });
    void load();
  }

  const total = rows.reduce((sum, row) => sum + row.profit, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Panel title="New journal entry" icon={<Plus size={13} />}>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Market" htmlFor="j-symbol">
              <input id="j-symbol" value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} placeholder="1HZ75V" className={inputClass} />
            </Field>
            <Field label="Direction" htmlFor="j-direction">
              <input id="j-direction" value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })} placeholder="CALL" className={inputClass} />
            </Field>
            <Field label="Stake" htmlFor="j-stake">
              <input id="j-stake" type="number" value={form.stake} onChange={(event) => setForm({ ...form, stake: Number(event.target.value) })} className={`${inputClass} num`} />
            </Field>
            <Field label="P&L" htmlFor="j-profit">
              <input id="j-profit" type="number" value={form.profit} onChange={(event) => setForm({ ...form, profit: Number(event.target.value) })} className={`${inputClass} num`} />
            </Field>
          </div>
          <Field label="Tags" htmlFor="j-tags" hint="Comma separated: breakout, revenge-trade, risk-ok">
            <input id="j-tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Notes" htmlFor="j-notes">
            <textarea
              id="j-notes"
              rows={5}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="w-full rounded-lg border border-hairline bg-obsidian/70 px-2.5 py-2 text-xs text-ink outline-none focus:border-cyan/60"
              placeholder="What did the setup look like? What would you repeat or avoid?"
            />
          </Field>
          <Button variant="primary" onClick={() => void addEntry()} className="w-full">
            <Plus size={13} /> Save entry
          </Button>
          {message ? <p className="text-[10px] text-ink-faint">{message}</p> : null}
        </div>
      </Panel>

      <Panel
        title="Journal"
        subtitle={`${rows.length} entries · net ${formatCurrency(total)}`}
        icon={<BookOpen size={13} />}
        actions={<Badge tone="cyan">Postgres</Badge>}
      >
        {loading ? (
          <p className="text-[11px] text-ink-faint">Loading journal…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No journal entries yet"
            description="Log the reasoning behind a trade here, or save a note straight from the terminal ledger. Notes live in Postgres, never in a third-party service."
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-hairline bg-panel-2/40 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="num text-[11px] font-semibold text-ink">{row.symbol}</span>
                  <Badge tone={row.direction.includes("PUT") || row.direction.includes("DOWN") ? "crimson" : "emerald"}>{row.direction || "—"}</Badge>
                  <span className={`num text-[10px] ${row.profit >= 0 ? "text-emerald" : "text-crimson"}`}>
                    {row.profit >= 0 ? "▲ +" : "▼ "}
                    {formatCurrency(row.profit)}
                  </span>
                  <span className="num ml-auto text-[9px] text-ink-faint">{formatDateTime(Math.floor(new Date(row.createdAt).getTime() / 1000))}</span>
                  <button type="button" onClick={() => void remove(row.id)} className="text-ink-faint hover:text-crimson" aria-label="Delete entry">
                    <Trash2 size={11} />
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-muted">{row.notes}</p>
                {row.tags ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.tags.split(",").filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded border border-hairline bg-obsidian/60 px-1.5 py-0.5 text-[9px] text-ink-faint">#{tag.trim()}</span>
                    ))}
                  </div>
                ) : null}
                {row.contractId ? <p className="num mt-1 text-[9px] text-ink-faint">contract #{row.contractId}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default JournalClient;
