"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bot,
  CircleAlert,
  CirclePlay,
  CircleStop,
  FileCode2,
  FlaskConical,
  OctagonX,
  Pause,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Button, DisclaimerNote, Field, Panel, Progress, inputClass } from "@/components/ui/Primitives";
import { BOTS, botById, describePotential, xmlBotDefinition } from "@/lib/bots/strategies";
import { martingaleLadder, riskUtilisation } from "@/lib/risk/risk-manager";
import { parseDbotXml, type ParsedXmlStrategy } from "@/lib/bots/xml";
import { CONTRACT_LABELS } from "@/lib/deriv/payouts";
import { formatCurrency } from "@/lib/utils";
import { requestNotificationPermission, raiseAlert } from "@/lib/alerts";

export function BotPanel({ onSellAll }: { onSellAll: () => Promise<void> }) {
  const bot = useTerminalStore((state) => state.bot);
  const riskLimits = useTerminalStore((state) => state.riskLimits);
  const riskState = useTerminalStore((state) => state.riskState);
  const accountType = useTerminalStore((state) => state.accountType);
  const emergencyStop = useTerminalStore((state) => state.emergencyStop);
  const account = useTerminalStore((state) => state.account);
  const openContracts = useTerminalStore((state) => state.openContracts);
  const setStrategyId = useTerminalStore((state) => state.setStrategyId);
  const patchParams = useTerminalStore((state) => state.patchBotParams);
  const replaceParams = useTerminalStore((state) => state.replaceBotParams);
  const setRiskLimits = useTerminalStore((state) => state.setRiskLimits);
  const setBotStatus = useTerminalStore((state) => state.setBotStatus);
  const pushBotLog = useTerminalStore((state) => state.pushBotLog);
  const setEmergencyStop = useTerminalStore((state) => state.setEmergencyStop);
  const setRealApproved = useTerminalStore((state) => state.setRealApproved);
  const resetBotSession = useTerminalStore((state) => state.resetBotSession);
  const setXmlNotice = useTerminalStore((state) => state.setXmlNotice);
  const xmlNotice = useTerminalStore((state) => state.xmlNotice);
  const xmlErrors = useTerminalStore((state) => state.xmlErrors);

  const [confirmReal, setConfirmReal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [parsed, setParsed] = useState<ParsedXmlStrategy | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<"strategy" | "risk" | "xml" | "log">("strategy");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const definition = botById(bot.strategyId);
  const ladder = useMemo(
    () => martingaleLadder(bot.params.stake, bot.params.multiplier, bot.params.martingaleCap, riskLimits.maxStake),
    [bot.params.stake, bot.params.multiplier, bot.params.martingaleCap, riskLimits.maxStake],
  );
  const utilisation = riskUtilisation(riskState, riskLimits);
  const currency = account?.currency ?? "USD";
  const statusTone = bot.status === "running" ? "amber" : bot.status === "halted" ? "crimson" : bot.status === "paused" ? "cyan" : "neutral";

  function start() {
    if (emergencyStop) {
      pushBotLog("error", "Emergency stop is engaged. Reset it before starting the bot.");
      return;
    }
    if (accountType === "real" && !bot.realApproved) {
      setConfirmReal(true);
      return;
    }
    void requestNotificationPermission();
    setBotStatus("running");
    pushBotLog("info", `Bot started · ${definition.name} · stake ${bot.currentStake.toFixed(2)} ${currency}`);
    raiseAlert("Bot running", `${definition.name} is live in ${accountType.toUpperCase()} mode.`, "info", { notify: true });
  }

  async function emergency(reason: string, closeAll: boolean) {
    setEmergencyStop(true, reason);
    pushBotLog("error", `EMERGENCY STOP · ${reason}`);
    raiseAlert("EMERGENCY STOP", reason, "error");
    if (closeAll) await onSellAll();
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseDbotXml(String(reader.result ?? ""));
      setParsed(result);
      setXmlNotice(result.ok ? "XML strategy parsed and verified." : "XML import rejected — see details.", result.errors);
      if (result.ok) replaceParams(result.params);
      pushBotLog(result.ok ? "info" : "error", result.ok ? `Imported ${file.name} (${result.blocks.length} blocks verified)` : `Rejected ${file.name}: ${result.errors[0] ?? "invalid"}`);
    };
    reader.readAsText(file);
  }

  return (
    <Panel
      title="Bot engine"
      icon={<Bot size={13} />}
      subtitle={definition.name}
      actions={
        <div className="flex items-center gap-1.5">
          <Badge tone={statusTone} dot={bot.status === "running"}>{bot.status}</Badge>
          <Badge tone={accountType === "real" ? "crimson" : "emerald"}>{accountType === "real" ? "REAL" : "DEMO"}</Badge>
        </div>
      }
      bodyClassName="flex min-h-0 flex-col gap-2 p-2"
    >
      <div className="flex items-center gap-1 rounded-lg border border-hairline bg-obsidian/50 p-0.5">
        {(["strategy", "risk", "xml", "log"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setTab(entry)}
            aria-pressed={tab === entry}
            className={`flex-1 rounded-md px-1 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              tab === entry ? "bg-panel-3 text-ink" : "text-ink-faint hover:text-ink-muted"
            }`}
          >
            {entry === "log" ? `log ${bot.logs.length}` : entry}
          </button>
        ))}
      </div>

      {bot.haltedReason ? (
        <p className="rounded-md border border-crimson/40 bg-crimson/10 px-2 py-1.5 text-[10px] leading-relaxed text-crimson">
          <span className="font-semibold">HALTED BY RISK:</span> {bot.haltedReason}
        </p>
      ) : null}

      <div className="flex gap-1.5">
        {bot.status === "running" ? (
          <Button size="sm" variant="warning" className="flex-1" onClick={() => { setBotStatus("paused", "Paused by operator"); pushBotLog("warn", "Bot paused"); }}>
            <Pause size={12} /> Pause
          </Button>
        ) : (
          <Button size="sm" variant="primary" className="flex-1" onClick={start} disabled={bot.status === "halted" && emergencyStop}>
            <CirclePlay size={12} /> {bot.status === "paused" ? "Resume" : "Start bot"}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => { setBotStatus("idle"); pushBotLog("info", "Bot stopped by operator"); }}>
          <CircleStop size={12} /> Stop
        </Button>
        <Button size="sm" variant="danger" onClick={() => void emergency("Operator pressed EMERGENCY STOP", false)} aria-label="Emergency stop">
          <OctagonX size={12} /> Stop
        </Button>
      </div>

      <div className="rounded-md border border-amber/25 bg-amber/5 px-2 py-1.5 text-[9px] leading-relaxed text-amber/90">
        Foreground only: the bot pauses if this tab is hidden and stops if you close it. {openContracts.length} open position
        {openContracts.length === 1 ? "" : "s"} · session {bot.wins}W / {bot.losses}L.
      </div>

      {tab === "strategy" ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-0.5">
          <Field label="Built-in strategy" htmlFor="strategy">
            <select
              id="strategy"
              value={bot.strategyId}
              onChange={(event) => setStrategyId(event.target.value as typeof bot.strategyId)}
              className={inputClass}
            >
              {BOTS.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
              {xmlNotice ? <option value="dbot-xml">Imported DBot strategy</option> : null}
            </select>
          </Field>
          <div className="rounded-md border border-hairline/70 bg-panel-2/50 p-2">
            <p className="text-[10px] font-semibold text-ink">{definition.tagline}</p>
            <p className="mt-1 text-[9px] leading-relaxed text-ink-muted">{definition.description}</p>
            <p className="mt-1.5 rounded border border-crimson/25 bg-crimson/5 px-1.5 py-1 text-[9px] leading-relaxed text-crimson/90">
              <CircleAlert size={9} className="mr-1 inline" /> {definition.riskNotes}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label={`Base stake (${currency})`} htmlFor="bot-stake">
              <input
                id="bot-stake"
                type="number"
                min={0.35}
                step={0.5}
                value={bot.params.stake}
                onChange={(event) => patchParams({ stake: Math.max(0, Number(event.target.value)) })}
                className={`${inputClass} num`}
              />
            </Field>
            <Field label="Multiplier" htmlFor="bot-mult">
              <input
                id="bot-mult"
                type="number"
                min={1}
                max={4}
                step={0.1}
                value={bot.params.multiplier}
                onChange={(event) => patchParams({ multiplier: Number(event.target.value) })}
                className={`${inputClass} num`}
              />
            </Field>
            <Field label="Recovery cap" htmlFor="bot-cap" hint="Hard cap on ladder steps">
              <input
                id="bot-cap"
                type="number"
                min={1}
                max={8}
                value={bot.params.martingaleCap}
                onChange={(event) => patchParams({ martingaleCap: Number(event.target.value) })}
                className={`${inputClass} num`}
              />
            </Field>
            <Field label="Confluence ≥" htmlFor="bot-score">
              <input
                id="bot-score"
                type="number"
                min={0}
                max={100}
                value={bot.params.scoreThreshold}
                onChange={(event) => patchParams({ scoreThreshold: Number(event.target.value) })}
                className={`${inputClass} num`}
              />
            </Field>
            <Field label="Duration" htmlFor="bot-duration">
              <div className="flex gap-1">
                <input
                  id="bot-duration"
                  type="number"
                  min={1}
                  value={bot.params.duration}
                  onChange={(event) => patchParams({ duration: Math.max(1, Number(event.target.value)) })}
                  className={`${inputClass} num`}
                />
                <select
                  value={bot.params.durationUnit}
                  onChange={(event) => patchParams({ durationUnit: event.target.value as "t" | "s" | "m" })}
                  className="h-9 rounded-lg border border-hairline bg-obsidian/70 px-1 text-[10px] text-ink"
                  aria-label="Bot duration unit"
                >
                  <option value="t">ticks</option>
                  <option value="s">sec</option>
                  <option value="m">min</option>
                </select>
              </div>
            </Field>
            <Field label="Barrier" htmlFor="bot-barrier">
              <input
                id="bot-barrier"
                value={bot.params.barrier}
                onChange={(event) => patchParams({ barrier: event.target.value })}
                className={`${inputClass} num`}
              />
            </Field>
          </div>

          <div className="rounded-md border border-amber/30 bg-amber/5 p-2">
            <p className="flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-amber">
              <span>Worst-case ladder</span>
              <span className="num">{formatCurrency(ladder.cumulative, currency)}</span>
            </p>
            <p className="num mt-1 text-[9px] text-ink-muted">
              {ladder.stakes.map((entry) => entry.toFixed(2)).join(" → ")}
              {ladder.capped ? " (capped)" : ""} · top stake {formatCurrency(ladder.topStake, currency)}
            </p>
            <p className="mt-1 text-[9px] leading-relaxed text-ink-faint">
              Contract {CONTRACT_LABELS[bot.params.contractType]} · indicative return{" "}
              {describePotential(definition, bot.params).payoutRate.toFixed(1)}%. A full ladder can lose the cumulative
              amount above.
            </p>
          </div>
        </div>
      ) : null}

      {tab === "risk" ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-0.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            <ShieldCheck size={12} className="text-emerald" /> Mandatory risk manager
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Max daily loss (${currency})`} htmlFor="risk-loss">
              <input id="risk-loss" type="number" min={1} value={riskLimits.maxDailyLoss} onChange={(event) => setRiskLimits({ maxDailyLoss: Math.max(1, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <Field label={`Take-profit (${currency})`} htmlFor="risk-tp">
              <input id="risk-tp" type="number" min={0} value={riskLimits.takeProfitTarget} onChange={(event) => setRiskLimits({ takeProfitTarget: Math.max(0, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Max consecutive losses" htmlFor="risk-streak">
              <input id="risk-streak" type="number" min={1} max={20} value={riskLimits.maxConsecutiveLosses} onChange={(event) => setRiskLimits({ maxConsecutiveLosses: Math.max(1, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Max stake cap" htmlFor="risk-stake">
              <input id="risk-stake" type="number" min={1} value={riskLimits.maxStake} onChange={(event) => setRiskLimits({ maxStake: Math.max(1, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Max open positions" htmlFor="risk-open">
              <input id="risk-open" type="number" min={1} max={20} value={riskLimits.maxOpenPositions} onChange={(event) => setRiskLimits({ maxOpenPositions: Math.max(1, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Cooldown (seconds)" htmlFor="risk-cool">
              <input id="risk-cool" type="number" min={0} value={riskLimits.cooldownSeconds} onChange={(event) => setRiskLimits({ cooldownSeconds: Math.max(0, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <Field label="Max trades / session" htmlFor="risk-trades">
              <input id="risk-trades" type="number" min={1} value={riskLimits.maxTradesPerSession} onChange={(event) => setRiskLimits({ maxTradesPerSession: Math.max(1, Number(event.target.value)) })} className={`${inputClass} num`} />
            </Field>
            <div className="flex flex-col justify-end gap-1">
              <label className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={riskLimits.stopOnRealAccount}
                  onChange={(event) => setRiskLimits({ stopOnRealAccount: event.target.checked })}
                  className="accent-emerald"
                />
                Block bots on REAL
              </label>
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border border-hairline/70 bg-panel-2/40 p-2">
            {[
              { label: "Daily loss budget used", value: utilisation.lossPct, tone: "crimson" as const },
              { label: "Trade cap used", value: utilisation.tradePct, tone: "cyan" as const },
              { label: "Loss streak", value: utilisation.lossChainPct, tone: "amber" as const },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[9px] text-ink-faint">
                  <span>{row.label}</span>
                  <span className="num">{row.value.toFixed(0)}%</span>
                </div>
                <Progress value={row.value} tone={row.tone} />
              </div>
            ))}
            <p className="num text-[9px] text-ink-faint">
              P&L today {formatCurrency(riskState.balance - riskState.startingBalanceToday, currency)} · losses in a row{" "}
              {riskState.consecutiveLosses}/{riskLimits.maxConsecutiveLosses} · trades {riskState.tradesToday}/
              {riskLimits.maxTradesPerSession}
            </p>
          </div>

          <div className="flex gap-1.5">
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => void emergency("Operator pressed EMERGENCY STOP", false)}
            >
              <OctagonX size={13} /> EMERGENCY STOP (Esc)
            </Button>
            <Button variant="secondary" onClick={() => void emergency("Emergency stop + close all", true)}>
              Close all too
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              resetBotSession();
              setRealApproved(false);
              pushBotLog("info", "Risk state reset by operator");
            }}
          >
            Reset halt & bot counters
          </Button>
          <DisclaimerNote>
            Risk limits persist across reloads and cannot be disabled by a strategy. Starting a bot on a real account
            needs a separate confirmation.
          </DisclaimerNote>
        </div>
      ) : null}

      {tab === "xml" ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-0.5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={`rounded-lg border border-dashed p-3 text-center transition-colors ${
              dragOver ? "border-cyan/60 bg-cyan/5" : "border-hairline bg-panel-2/40"
            }`}
          >
            <Upload size={16} className="mx-auto text-ink-faint" />
            <p className="mt-1 text-[10px] text-ink-muted">Drop a Deriv DBot .xml here</p>
            <Button size="sm" variant="secondary" className="mt-1.5" onClick={() => fileInput.current?.click()}>
              <FileCode2 size={12} /> Choose file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {parsed ? (
            <div className="space-y-1.5 rounded-md border border-hairline/70 bg-panel-2/40 p-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-ink">Conversion summary</p>
                <Badge tone={parsed.ok ? "emerald" : "crimson"}>{parsed.ok ? "verified" : "rejected"}</Badge>
              </div>
              <ul className="space-y-0.5">
                {parsed.summary.map((line) => (
                  <li key={line} className="text-[9px] text-ink-muted">· {line}</li>
                ))}
              </ul>
              {parsed.unsupported.length > 0 ? (
                <p className="rounded border border-crimson/30 bg-crimson/5 px-1.5 py-1 text-[9px] text-crimson">
                  Unsupported blocks: {parsed.unsupported.join(", ")}
                </p>
              ) : null}
              {parsed.errors.length > 0 ? (
                <ul className="space-y-0.5">
                  {parsed.errors.map((error) => (
                    <li key={error} className="text-[9px] leading-relaxed text-crimson/90">· {error}</li>
                  ))}
                </ul>
              ) : null}
              <Button
                size="sm"
                variant={parsed.ok ? "primary" : "secondary"}
                disabled={!parsed.ok}
                onClick={() => {
                  replaceParams(parsed.params);
                  void pushBotLog("info", "Imported strategy parameters applied");
                  setXmlNotice("Imported parameters applied. Review them in the Strategy tab.");
                }}
              >
                <FlaskConical size={12} /> Apply verified parameters
              </Button>
            </div>
          ) : null}
          {xmlNotice ? <p className="text-[9px] text-ink-faint">{xmlNotice}</p> : null}
          {xmlErrors.length > 0 && !parsed ? (
            <ul className="space-y-0.5">
              {xmlErrors.map((error) => (
                <li key={error} className="text-[9px] text-crimson/90">· {error}</li>
              ))}
            </ul>
          ) : null}
          <DisclaimerNote>
            VORTEX compiles a verified subset of Blockly blocks. Anything outside it is refused rather than silently
            approximated.
          </DisclaimerNote>
        </div>
      ) : null}

      {tab === "log" ? (
        <div className="min-h-0 flex-1 space-y-1 overflow-auto pr-0.5">
          {bot.logs.length === 0 ? (
            <p className="rounded border border-dashed border-hairline p-2 text-[10px] text-ink-faint">
              No events yet. Start the bot or place a trade to populate the log.
            </p>
          ) : null}
          {bot.logs.map((log) => (
            <div key={log.id} className="flex gap-1.5 rounded border border-hairline/60 bg-obsidian/40 px-1.5 py-1">
              <span className="num shrink-0 text-[8px] text-ink-faint">
                {new Date(log.at).toLocaleTimeString("en-GB", { hour12: false })}
              </span>
              <span
                className={`text-[9px] leading-relaxed ${
                  log.level === "error"
                    ? "text-crimson"
                    : log.level === "warn"
                      ? "text-amber"
                      : log.level === "trade"
                        ? "text-emerald"
                        : "text-ink-muted"
                }`}
              >
                {log.message}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {confirmReal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-crimson/50 bg-panel p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-crimson">
              <ShieldCheck size={15} /> Start bot on REAL account
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              This will place automated trades with real funds. Review the parameters and type <strong className="text-ink">REAL</strong> to
              continue.
            </p>
            <dl className="mt-3 space-y-1 rounded-md border border-hairline bg-obsidian/60 p-2 text-[10px]">
              <div className="flex justify-between"><dt className="text-ink-faint">Base stake</dt><dd className="num text-ink">{formatCurrency(bot.params.stake, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Stop-loss (daily)</dt><dd className="num text-ink">{formatCurrency(riskLimits.maxDailyLoss, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Take-profit</dt><dd className="num text-ink">{formatCurrency(riskLimits.takeProfitTarget, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Worst-case ladder</dt><dd className="num text-crimson">{formatCurrency(ladder.cumulative, currency)}</dd></div>
            </dl>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Type REAL"
              className={`${inputClass} mt-3`}
              aria-label="Type REAL to confirm"
            />
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                disabled={confirmText !== "REAL"}
                onClick={() => {
                  setRealApproved(true);
                  setConfirmText("");
                  setConfirmReal(false);
                  setBotStatus("running");
                  pushBotLog("error", "REAL-account bot approved by operator");
                }}
              >
                Start on REAL
              </Button>
              <Button variant="ghost" onClick={() => { setConfirmReal(false); setConfirmText(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export default BotPanel;
