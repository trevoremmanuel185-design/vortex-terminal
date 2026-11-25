"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Lock, ShieldAlert, Zap } from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Button, Field, Panel, Segmented, inputClass } from "@/components/ui/Primitives";
import { CONTRACT_LABELS } from "@/lib/deriv/payouts";
import { DERIV_CONFIG } from "@/lib/deriv/config";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ContractType } from "@/lib/deriv/types";
import type { BuyResult } from "@/lib/deriv/types";

const GROUPS = [
  { value: "risefall", label: "Rise/Fall" },
  { value: "digits", label: "Digits" },
  { value: "multipliers", label: "Multipliers" },
] as const;

const GROUP_TYPES: Record<(typeof GROUPS)[number]["value"], ContractType[]> = {
  risefall: ["CALL", "PUT"],
  digits: ["DIGITMATCH", "DIGITDIFF", "DIGITEVEN", "DIGITODD", "DIGITOVER", "DIGITUNDER"],
  multipliers: ["MULTUP", "MULTDOWN"],
};

export function ExecutionPanel({ onBuy }: { onBuy: (options: { source: "manual" }) => Promise<BuyResult> }) {
  const tradeForm = useTerminalStore((state) => state.tradeForm);
  const patch = useTerminalStore((state) => state.patchTradeForm);
  const proposal = useTerminalStore((state) => state.proposal);
  const proposalError = useTerminalStore((state) => state.proposalError);
  const buying = useTerminalStore((state) => state.buying);
  const status = useTerminalStore((state) => state.status);
  const engineKind = useTerminalStore((state) => state.engineKind);
  const accountType = useTerminalStore((state) => state.accountType);
  const account = useTerminalStore((state) => state.account);
  const riskLimits = useTerminalStore((state) => state.riskLimits);
  const riskState = useTerminalStore((state) => state.riskState);
  const emergencyStop = useTerminalStore((state) => state.emergencyStop);
  const meta = useTerminalStore((state) => state.symbols.find((entry) => entry.symbol === state.symbol));
  const setProposalError = useTerminalStore((state) => state.setProposalError);

  const [group, setGroup] = useState<(typeof GROUPS)[number]["value"]>("risefall");
  const [now, setNow] = useState(Date.now());
  const [showRealConfirm, setShowRealConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const freshMs = proposal ? Math.max(0, DERIV_CONFIG.proposalStaleMs - (now - proposal.receivedAt)) : 0;
  const isStale = !proposal || freshMs <= 0;
  const isSimulated = engineKind === "simulation";
  const currency = account?.currency ?? "USD";
  const stake = tradeForm.stake;
  const overUnder = useMemo(
    () => ["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeForm.contractType),
    [tradeForm.contractType],
  );

  const disabledReason = (() => {
    if (status !== "connected") return "Waiting for the Deriv connection…";
    if (emergencyStop) return "Emergency stop is engaged — reset it in the risk panel.";
    if (isStale) return "Proposal is stale (>5s) or unavailable.";
    if (stake > riskLimits.maxStake) return `Stake exceeds your max stake of ${riskLimits.maxStake.toFixed(2)}.`;
    if (riskState.openPositions >= riskLimits.maxOpenPositions) return "Max open positions reached.";
    return null;
  })();

  async function execute() {
    setError(null);
    if (accountType === "real" && !showRealConfirm) {
      setShowRealConfirm(true);
      return;
    }
    try {
      await onBuy({ source: "manual" });
      setShowRealConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Buy failed");
    }
  }

  return (
    <Panel
      title="Execute"
      subtitle={`${meta?.displayName ?? "—"} · ${CONTRACT_LABELS[tradeForm.contractType]}`}
      icon={<Zap size={13} />}
      actions={
        <Badge tone={isSimulated ? "amber" : accountType === "real" ? "crimson" : "emerald"}>
          {isSimulated ? "Simulated" : accountType === "real" ? "Live" : "Demo"}
        </Badge>
      }
      bodyClassName="flex flex-col gap-2 p-2"
    >
      <Segmented options={GROUPS.map((entry) => ({ value: entry.value, label: entry.label }))} value={group} onChange={(value) => {
        setGroup(value);
        patch({ contractType: GROUP_TYPES[value][0] });
      }} size="sm" className="w-full" />

      <div className="grid grid-cols-2 gap-1">
        {GROUP_TYPES[group].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => patch({ contractType: type })}
            aria-pressed={tradeForm.contractType === type}
            className={`rounded-md border px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
              tradeForm.contractType === type
                ? "border-emerald/50 bg-emerald/15 text-emerald"
                : "border-hairline bg-panel-2/70 text-ink-muted hover:border-hairline-bright hover:text-ink"
            }`}
          >
            {CONTRACT_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={`Stake (${currency})`} htmlFor="stake">
          <input
            id="stake"
            type="number"
            min={0.35}
            step={0.5}
            value={tradeForm.stake}
            onChange={(event) => patch({ stake: Math.max(0, Number(event.target.value)) })}
            className={`${inputClass} num`}
          />
        </Field>
        <Field label="Duration" htmlFor="duration">
          <div className="flex gap-1">
            <input
              id="duration"
              type="number"
              min={1}
              value={tradeForm.duration}
              onChange={(event) => patch({ duration: Math.max(1, Number(event.target.value)) })}
              className={`${inputClass} num`}
            />
            <select
              value={tradeForm.durationUnit}
              onChange={(event) => patch({ durationUnit: event.target.value as "t" | "s" | "m" })}
              className="h-9 shrink-0 rounded-lg border border-hairline bg-obsidian/70 px-1 text-[10px] text-ink"
              aria-label="Duration unit"
            >
              <option value="t">ticks</option>
              <option value="s">sec</option>
              <option value="m">min</option>
            </select>
          </div>
        </Field>
      </div>

      {overUnder ? (
        <Field label="Barrier digit" htmlFor="barrier">
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => patch({ barrier: String(digit) })}
                aria-pressed={tradeForm.barrier === String(digit)}
                className={`num h-7 flex-1 rounded border text-[10px] ${
                  tradeForm.barrier === String(digit)
                    ? "border-cyan/50 bg-cyan/15 text-cyan"
                    : "border-hairline bg-panel-2 text-ink-muted hover:text-ink"
                }`}
              >
                {digit}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      <div className="rounded-lg border border-hairline bg-obsidian/60 p-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">Proposal</span>
          <span className={`num inline-flex items-center gap-1 text-[9px] ${isStale ? "text-amber" : "text-emerald"}`}>
            <span className={`h-1 w-1 rounded-full ${isStale ? "bg-amber" : "bg-emerald animate-pulse-dot"}`} />
            {isStale ? "stale" : `fresh ${(freshMs / 1000).toFixed(1)}s`}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[8px] uppercase tracking-wider text-ink-faint">Payout</p>
            <p className="num text-xs font-semibold text-emerald">
              {proposal ? formatCurrency(proposal.payout, currency) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-wider text-ink-faint">Return</p>
            <p className="num text-xs font-semibold text-ink">
              {proposal ? `${proposal.returnPct >= 0 ? "+" : ""}${proposal.returnPct.toFixed(2)}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-wider text-ink-faint">Spot</p>
            <p className="num text-xs font-semibold text-ink">
              {proposal ? formatNumber(proposal.spot, meta?.decimals ?? 2) : "—"}
            </p>
          </div>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[9px] leading-relaxed text-ink-faint">
          {proposal?.longcode ?? "Waiting for a live proposal from Deriv…"}
        </p>
      </div>

      {proposalError ? (
        <p className="rounded-md border border-crimson/30 bg-crimson/10 px-2 py-1.5 text-[10px] leading-relaxed text-crimson">
          {proposalError}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-crimson/30 bg-crimson/10 px-2 py-1.5 text-[10px] leading-relaxed text-crimson">
          {error}
        </p>
      ) : null}

      {showRealConfirm && accountType === "real" ? (
        <div className="rounded-md border border-crimson/50 bg-crimson/10 p-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-crimson">
            <ShieldAlert size={12} /> REAL-MONEY CONFIRMATION
          </p>
          <p className="mt-1 text-[10px] text-ink-muted">
            Buy {CONTRACT_LABELS[tradeForm.contractType]} on {meta?.displayName} for{" "}
            <span className="num font-semibold text-ink">{formatCurrency(stake, currency)}</span> from your live account.
          </p>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" variant="danger" loading={buying} onClick={() => void execute()}>
              Confirm real buy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRealConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant={tradeForm.contractType === "PUT" || tradeForm.contractType === "DIGITUNDER" || tradeForm.contractType === "DIGITDIFF" || tradeForm.contractType === "MULTDOWN" ? "sell" : "primary"}
          size="lg"
          loading={buying}
          disabled={Boolean(disabledReason)}
          onClick={() => void execute()}
          title={disabledReason ?? undefined}
        >
          <Lock size={13} />
          {isSimulated ? "Simulated buy" : accountType === "real" ? "Buy (REAL)" : "Buy"}{" "}
          {CONTRACT_LABELS[tradeForm.contractType]} · {formatCurrency(stake, currency)}
        </Button>
      )}

      {disabledReason ? (
        <p className="flex items-start gap-1 text-[9px] leading-relaxed text-amber/90">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {disabledReason}
        </p>
      ) : null}
      <p className="text-[9px] leading-relaxed text-ink-faint">
        {isSimulated
          ? "Simulation Mode: this purchase is virtual, tagged simulated and can never touch a real balance."
          : "Executed on Deriv with your token. Exact API errors are shown verbatim — no hidden retries."}
      </p>
      <button
        type="button"
        onClick={() => setProposalError(null)}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      >
        clear error
      </button>
    </Panel>
  );
}

export default ExecutionPanel;
