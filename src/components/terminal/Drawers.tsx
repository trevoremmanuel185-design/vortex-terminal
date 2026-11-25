"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Link2,
  Power,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Button, Field, Segmented, Toggle, inputClass } from "@/components/ui/Primitives";
import { CONTACT, NOT_AFFILIATED_NOTICE } from "@/lib/contact";
import { ContactActions } from "@/components/site/SiteChrome";
import { DERIV_CONFIG } from "@/lib/deriv/config";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { requestNotificationPermission } from "@/lib/alerts";

export function DrawerShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-obsidian/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close drawer" onClick={onClose} tabIndex={-1} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-hairline bg-panel shadow-2xl">
        <header className="flex items-start justify-between gap-2 border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="text-[10px] text-ink-faint">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded border border-hairline p-1 text-ink-muted hover:text-ink" aria-label="Close">
            <X size={14} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

interface OAuthAccount {
  accountId: string;
  token: string;
}

export function ConnectionDrawer({
  onClose,
  onConnectToken,
  onDisconnect,
}: {
  onClose: () => void;
  onConnectToken: (token: string, remember: boolean) => Promise<unknown>;
  onDisconnect: () => void;
}) {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(useTerminalStore.getState().rememberToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([]);
  const [advanced, setAdvanced] = useState(false);

  const account = useTerminalStore((state) => state.account);
  const status = useTerminalStore((state) => state.status);
  const latency = useTerminalStore((state) => state.latency);
  const engineKind = useTerminalStore((state) => state.engineKind);
  const accountType = useTerminalStore((state) => state.accountType);
  const protocolNotice = useTerminalStore((state) => state.protocolNotice);
  const connectionError = useTerminalStore((state) => state.connectionError);
  const appId = DERIV_CONFIG.appId;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const accounts: OAuthAccount[] = [];
    for (let index = 1; index <= 5; index += 1) {
      const accountId = params.get(`acct${index}`);
      const accountToken = params.get(`token${index}`);
      if (accountId && accountToken) accounts.push({ accountId, token: accountToken });
    }
    if (accounts.length > 0) {
      setOauthAccounts(accounts);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const oauthHref = useMemo(() => {
    const redirect = typeof window !== "undefined" ? `${window.location.origin}${DERIV_CONFIG.oauthRedirectPath}` : "";
    return `${DERIV_CONFIG.oauthAuthorizeUrl}?app_id=${encodeURIComponent(appId)}&l=EN&redirect_uri=${encodeURIComponent(redirect)}`;
  }, [appId]);

  const requiredScopes = DERIV_CONFIG.requiredScopes;
  const scopeState = (id: string) =>
    account ? (!account.missingScopes.some((label) => label.toLowerCase().includes(id.replace("_", " ").split(" ")[0])) ? "granted" : "missing") : "unknown";

  async function connect(candidate = token) {
    setBusy(true);
    setError(null);
    try {
      await onConnectToken(candidate.trim(), remember);
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DrawerShell title="Connection & account" subtitle="Browser → Deriv WebSocket. Tokens never reach our backend." onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-hairline bg-obsidian/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">Telemetry</span>
            <Badge tone={status === "connected" ? "emerald" : status === "reconnecting" ? "amber" : "crimson"} dot>
              {status}
            </Badge>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
            <div><dt className="text-ink-faint">Latency</dt><dd className="num text-ink">{latency ? `${latency}ms` : "—"}</dd></div>
            <div><dt className="text-ink-faint">Endpoint</dt><dd className="num truncate text-ink">{DERIV_CONFIG.wsUrl.replace("wss://", "")}</dd></div>
            <div><dt className="text-ink-faint">Mode</dt><dd className="text-ink">{engineKind === "live" ? "Deriv live" : "Simulation"}</dd></div>
            <div><dt className="text-ink-faint">Heartbeat</dt><dd className="num text-ink">30s ping</dd></div>
          </dl>
          <p className="mt-2 text-[9px] leading-relaxed text-ink-faint">
            Automatic re-authorize and stream restoration after a drop. Exponential backoff 1s → 30s with jitter.
            Pending orders are never replayed, so a reconnect cannot duplicate a purchase.
          </p>
        </div>

        {connectionError ? (
          <p className="rounded-md border border-crimson/30 bg-crimson/10 px-2 py-1.5 text-[10px] text-crimson">{connectionError}</p>
        ) : null}
        {protocolNotice ? (
          <p className="rounded-md border border-amber/30 bg-amber/10 px-2 py-1.5 text-[10px] text-amber">{protocolNotice}</p>
        ) : null}

        {account ? (
          <div className={`rounded-lg border p-3 ${accountType === "real" ? "border-crimson/50 bg-crimson/5" : "border-emerald/30 bg-emerald/5"}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-ink-faint">{accountType === "real" ? "REAL ACCOUNT" : "DEMO ACCOUNT"}</p>
                <p className="num text-sm font-semibold text-ink">{account.loginid}</p>
                <p className="text-[10px] text-ink-faint">{account.isVirtual ? "Virtual funds" : "Live funds"} · {account.country ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">Balance</p>
                <p className="num text-sm font-semibold text-emerald">{formatCurrency(account.balance, account.currency)}</p>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">Token scopes</p>
              <div className="flex flex-wrap gap-1">
                {requiredScopes.map((scope) => {
                  const state = scopeState(scope.id);
                  return (
                    <span
                      key={scope.id}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] ${
                        state === "granted" ? "border-emerald/30 bg-emerald/10 text-emerald" : "border-crimson/40 bg-crimson/10 text-crimson"
                      }`}
                    >
                      {state === "granted" ? <CheckCircle2 size={9} /> : <AlertTriangle size={9} />} {scope.label}
                    </span>
                  );
                })}
                {account.highRiskScopes.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded border border-crimson/40 bg-crimson/10 px-1.5 py-0.5 text-[9px] text-crimson">
                    <ShieldAlert size={9} /> {account.highRiskScopes.join(", ")} scope present
                  </span>
                ) : null}
              </div>
              {account.missingScopes.length > 0 ? (
                <p className="text-[9px] leading-relaxed text-amber">
                  Missing: {account.missingScopes.join(", ")}. Proposals or execution will fail until those scopes are added.
                </p>
              ) : account.highRiskScopes.length > 0 ? (
                <p className="text-[9px] leading-relaxed text-crimson">
                  Use a token with only Read + Trade + Trading Information.
                </p>
              ) : (
                <p className="text-[9px] leading-relaxed text-emerald/90">All required scopes present.</p>
              )}
            </div>
            <Button variant="danger" size="sm" className="mt-2 w-full" onClick={onDisconnect}>
              <Trash2 size={12} /> Disconnect & wipe credentials
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">API token</p>
          <Field label="Deriv API token" hint="Scopes required: Read, Trade, Trading Information. Payments/Admin tokens are rejected by policy." htmlFor="deriv-token">
            <div className="relative">
              <input
                id="deriv-token"
                type={visible ? "text" : "password"}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={visible ? "paste your token" : "••••••••••••••••"}
                className={`${inputClass} pr-8`}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                className="absolute right-1.5 top-2 text-ink-faint hover:text-ink"
                aria-label={visible ? "Hide token" : "Show token"}
              >
                {visible ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </Field>
          <label className="flex items-start gap-2 rounded-md border border-hairline bg-obsidian/50 p-2">
            <Toggle checked={remember} onChange={setRemember} label="Remember token for this tab" />
            <span className="text-[9px] leading-relaxed text-ink-faint">
              <strong className="text-ink-muted">Remember me (optional).</strong> Stores the token in sessionStorage so a
              refresh keeps the session. Risk: any script running in this tab could read it. Leave it off to keep the
              token in memory only — it disappears on refresh.
            </span>
          </label>
          <Button variant="primary" loading={busy} disabled={token.trim().length < 10} onClick={() => void connect()} className="w-full">
            <Link2 size={13} /> Authorize token
          </Button>
          {error ? <p className="rounded border border-crimson/30 bg-crimson/10 px-2 py-1 text-[10px] text-crimson">{error}</p> : null}
        </div>

        <div className="space-y-2 rounded-lg border border-hairline bg-obsidian/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">OAuth / App ID</p>
          <p className="text-[9px] leading-relaxed text-ink-faint">
            App ID <span className="num text-ink">{appId}</span> (from <code>NEXT_PUBLIC_DERIV_APP_ID</code>). The
            callback returns <code>acct1/token1</code>, <code>acct2/token2</code>… accounts for you to choose from.
          </p>
          <a href={oauthHref}>
            <Button variant="secondary" className="w-full">
              <Wifi size={13} /> Connect via Deriv OAuth
            </Button>
          </a>
          {oauthAccounts.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-ink-faint">Accounts returned by Deriv</p>
              {oauthAccounts.map((entry) => (
                <button
                  key={entry.accountId}
                  type="button"
                  onClick={() => void connect(entry.token)}
                  className="flex w-full items-center justify-between rounded border border-hairline bg-panel-2/70 px-2 py-1.5 text-left text-[10px] text-ink hover:border-cyan/40"
                >
                  <span className="num">{entry.accountId}</span>
                  <span className="text-[9px] uppercase tracking-wider text-ink-faint">
                    {entry.accountId.startsWith("VRTC") ? "demo" : "real"} · use account
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={() => setAdvanced((value) => !value)} className="text-[9px] text-cyan underline-offset-2 hover:underline">
            Why isolate the endpoint?
          </button>
          {advanced ? (
            <p className="text-[9px] leading-relaxed text-ink-faint">
              Deriv occasionally rotates endpoints and auth flows. Every URL in VORTEX lives in{" "}
              <code>src/lib/deriv/config.ts</code>, verified against api.deriv.com at build time.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-emerald/25 bg-emerald/5 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald"><ShieldCheck size={12} /> Simulation Mode</p>
          <p className="mt-1 text-[9px] leading-relaxed text-ink-faint">
            No token? The terminal runs a local simulated feed with a SIMULATION badge. Simulated contracts are tagged
            and can never be mistaken for real fills.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              onDisconnect();
              onClose();
            }}
          >
            <Power size={12} /> Use simulation instead
          </Button>
        </div>
      </div>
    </DrawerShell>
  );
}

export function SettingsDrawer({ onClose, onDisconnect }: { onClose: () => void; onDisconnect: () => void }) {
  const limits = useTerminalStore((state) => state.riskLimits);
  const setLimits = useTerminalStore((state) => state.setRiskLimits);
  const riskState = useTerminalStore((state) => state.riskState);
  const accountType = useTerminalStore((state) => state.accountType);
  const [notifyState, setNotifyState] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [reminders, setReminders] = useState(true);
  const [sessionStart] = useState(riskState.sessionStartedAt);

  const sessionMinutes = Math.floor((Date.now() - sessionStart) / 60_000);

  return (
    <DrawerShell title="Settings & support" subtitle="Risk, alerts, responsible trading and contact" onClose={onClose}>
      <div className="space-y-4">
        <section className="space-y-2 rounded-lg border border-hairline bg-obsidian/50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            <ShieldCheck size={12} className="text-emerald" /> Responsible trading
          </p>
          <div className="grid gap-1.5 text-[10px]">
            <div className="flex justify-between"><span className="text-ink-faint">Daily loss budget</span><span className="num text-ink">{formatCurrency(limits.maxDailyLoss)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">P&L today</span><span className={`num ${riskState.balance - riskState.startingBalanceToday >= 0 ? "text-emerald" : "text-crimson"}`}>{formatCurrency(riskState.balance - riskState.startingBalanceToday)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Session time</span><span className="num text-ink">{sessionMinutes} min</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label="Max daily loss" htmlFor="settings-loss">
              <input id="settings-loss" type="number" min={1} value={limits.maxDailyLoss} onChange={(event) => setLimits({ maxDailyLoss: Math.max(1, Number(event.target.value)) })} className={`${inputClass} h-8`} />
            </Field>
            <Field label="Max stake" htmlFor="settings-stake">
              <input id="settings-stake" type="number" min={1} value={limits.maxStake} onChange={(event) => setLimits({ maxStake: Math.max(1, Number(event.target.value)) })} className={`${inputClass} h-8`} />
            </Field>
          </div>
          <p className="text-[9px] leading-relaxed text-ink-faint">
            Set a deposit limit with Deriv as well — VORTEX can only limit what it executes. Take a 5-minute break every
            60 minutes, never chase losses, and never trade money you cannot afford to lose.
          </p>
          {reminders ? (
            <p className="rounded border border-amber/25 bg-amber/5 px-2 py-1 text-[9px] text-amber">
              <Clock size={9} className="mr-1 inline" />
              {sessionMinutes >= 60
                ? `You've been in the terminal for ${sessionMinutes} minutes. Consider a break.`
                : "Session reminder set for 60 minutes. Loss limits are enforced automatically."}
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-[10px] text-ink-muted">
            <Toggle checked={reminders} onChange={setReminders} label="Session reminders" /> Session-time reminders
          </label>
        </section>

        <section className="space-y-2 rounded-lg border border-hairline bg-obsidian/50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            <Bell size={12} className="text-cyan" /> Alerts
          </p>
          <p className="text-[9px] leading-relaxed text-ink-faint">
            Browser notifications plus synthesised tones for fills, settlements and risk halts. Nothing is sent to a
            server; audio is generated locally.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-ink-muted">Notification permission</span>
            <Badge tone={notifyState === "granted" ? "emerald" : notifyState === "denied" ? "crimson" : "amber"}>{notifyState}</Badge>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const result = await requestNotificationPermission();
              setNotifyState(result);
            }}
          >
            <Bell size={12} /> Enable notifications
          </Button>
        </section>

        <section className="space-y-2 rounded-lg border border-hairline bg-obsidian/50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            <Smartphone size={12} className="text-emerald" /> Supported platforms
          </p>
          <Segmented options={[{ value: "web", label: "Web" }, { value: "pwa", label: "Installable PWA" }]} value="pwa" onChange={() => undefined} size="sm" />
          <p className="text-[9px] leading-relaxed text-ink-faint">
            Add VORTEX to your home screen from the browser menu. The shell works offline; live data resumes when the
            WebSocket reconnects.
          </p>
        </section>

        <section className="space-y-2 rounded-lg border border-hairline bg-obsidian/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Support</p>
          <ContactActions compact />
          <ul className="space-y-1 text-[9px] text-ink-faint">
            <li>Instagram: <a className="text-cyan" href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer">{CONTACT.instagramHandle}</a></li>
            <li>Email: <a className="text-cyan" href={CONTACT.emailHref}>{CONTACT.email}</a></li>
            <li>Calls & WhatsApp: <a className="text-cyan" href={CONTACT.phoneHref}>{CONTACT.phoneDisplay}</a></li>
          </ul>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/legal/risk"><Button size="sm" variant="ghost">Risk disclosure</Button></Link>
            <Link href="/legal/terms"><Button size="sm" variant="ghost">Terms</Button></Link>
            <Link href="/legal/privacy"><Button size="sm" variant="ghost">Privacy</Button></Link>
          </div>
          <p className="text-[9px] leading-relaxed text-ink-faint">{NOT_AFFILIATED_NOTICE}</p>
        </section>

        <section className="rounded-lg border border-crimson/30 bg-crimson/5 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-crimson"><RefreshCw size={12} /> Session</p>
          <p className="mt-1 text-[9px] leading-relaxed text-ink-faint">
            Current mode: {accountType.toUpperCase()}. Disconnecting wipes the token from memory and sessionStorage and
            drops back to Simulation Mode.
          </p>
          <Button size="sm" variant="danger" className="mt-2 w-full" onClick={() => { onDisconnect(); onClose(); }}>
            <Trash2 size={12} /> Disconnect & wipe credentials
          </Button>
        </section>
      </div>
    </DrawerShell>
  );
}

export function RealAccountModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [step, setStep] = useState(1);
  const [text, setText] = useState("");
  const account = useTerminalStore((state) => state.account);
  const limits = useTerminalStore((state) => state.riskLimits);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-obsidian/85 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label="Confirm real account">
      <div className="w-full max-w-md rounded-xl border border-crimson/50 bg-panel p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-crimson">
          <ShieldAlert size={16} /> Switch to REAL money
        </p>
        {step === 1 ? (
          <>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              You are about to switch from demo to a live account{account ? ` (${account.loginid})` : ""}. Real money is
              at risk. Losing trades are not recoverable.
            </p>
            <ul className="mt-2 space-y-1 rounded-md border border-hairline bg-obsidian/60 p-2 text-[10px] text-ink-muted">
              <li>· Daily loss limit: {formatCurrency(limits.maxDailyLoss)}</li>
              <li>· Take-profit target: {formatCurrency(limits.takeProfitTarget)}</li>
              <li>· Bots blocked on REAL: {limits.stopOnRealAccount ? "yes" : "no"}</li>
              <li>· Trading derivatives can lose all of your capital.</li>
            </ul>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" className="flex-1" onClick={() => setStep(2)}>I understand, continue</Button>
              <Button variant="ghost" onClick={onCancel}>Stay on demo</Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              Final confirmation: type <strong className="text-ink">REAL</strong> to enable live trading. The interface
              will stay in an amber/crimson LIVE state until you switch back.
            </p>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="REAL"
              aria-label="Type REAL to confirm"
              className={`${inputClass} mt-3`}
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <Button variant="danger" className="flex-1" disabled={text !== "REAL"} onClick={onConfirm}>Enable REAL mode</Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
