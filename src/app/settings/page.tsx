import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Lock, Settings2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { SiteFooter, SiteHeader, WhatsAppFab } from "@/components/site/SiteChrome";
import { ContactActions } from "@/components/site/SiteChrome";
import { Badge, Button, DisclaimerNote, Panel } from "@/components/ui/Primitives";
import { CONTACT, NOT_AFFILIATED_NOTICE } from "@/lib/contact";
import { DERIV_CONFIG } from "@/lib/deriv/config";
import { DEFAULT_RISK_LIMITS } from "@/lib/risk/risk-manager";

export const metadata: Metadata = {
  title: "Settings & support",
  description: "Connection security, risk defaults, alerts, PWA install and direct support contacts.",
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-obsidian">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald">Control room</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Settings & support</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Live risk settings, alerts and the connection manager are inside the terminal drawer. This page covers the
          defaults, security posture and direct support.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Panel title="Connection defaults" icon={<Lock size={13} />}>
            <dl className="space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Endpoint</dt><dd className="num truncate text-ink">{DERIV_CONFIG.wsUrl}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">App ID</dt><dd className="num text-ink">{DERIV_CONFIG.appId}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Heartbeat</dt><dd className="num text-ink">30s ping</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Backoff</dt><dd className="num text-ink">1s → 30s + jitter</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Token storage</dt><dd className="text-ink">Memory (sessionStorage opt-in)</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Proposal freshness</dt><dd className="num text-ink">5s hard limit</dd></div>
            </dl>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
              Override the endpoint and app id with <code>NEXT_PUBLIC_DERIV_WS_URL</code> and{" "}
              <code>NEXT_PUBLIC_DERIV_APP_ID</code>. All URLs are isolated in{" "}
              <code>src/lib/deriv/config.ts</code>.
            </p>
            <Link href="/terminal" className="mt-3 inline-block">
              <Button variant="primary" size="sm"><Settings2 size={12} /> Open the connection manager</Button>
            </Link>
          </Panel>

          <Panel title="Risk defaults" icon={<ShieldCheck size={13} />}>
            <dl className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><dt className="text-ink-faint">Max daily loss</dt><dd className="num text-ink">{DEFAULT_RISK_LIMITS.maxDailyLoss}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Take-profit target</dt><dd className="num text-ink">{DEFAULT_RISK_LIMITS.takeProfitTarget}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Max consecutive losses</dt><dd className="num text-ink">{DEFAULT_RISK_LIMITS.maxConsecutiveLosses}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Max stake</dt><dd className="num text-ink">{DEFAULT_RISK_LIMITS.maxStake}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Max open positions</dt><dd className="num text-ink">{DEFAULT_RISK_LIMITS.maxOpenPositions}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Cooldown</dt><dd className="num text-ink">{DEFAULT_RISK_LIMITS.cooldownSeconds}s</dd></div>
            </dl>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
              These defaults apply until you change them in the bot panel. They persist across reloads and are enforced
              by the engine, not the strategy.
            </p>
          </Panel>

          <Panel title="Support" icon={<BellRing size={13} />}>
            <ContactActions compact />
            <ul className="mt-3 space-y-1 text-[10px] text-ink-muted">
              <li>Instagram (verified): <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-cyan">{CONTACT.instagramHandle}</a></li>
              <li>Email: <a href={CONTACT.emailHref} className="text-cyan">{CONTACT.email}</a></li>
              <li>Calls & WhatsApp: <a href={CONTACT.phoneHref} className="text-cyan">{CONTACT.phoneDisplay}</a></li>
            </ul>
            <DisclaimerNote>Never send API tokens or passwords to support. We will never ask for them.</DisclaimerNote>
          </Panel>

          <Panel title="Install & wipe" icon={<Smartphone size={13} />}>
            <p className="text-[11px] leading-relaxed text-ink-muted">
              VORTEX is an installable PWA. Use your browser menu → “Add to Home screen” for a standalone window. The
              app shell loads offline; live data resumes when the WebSocket reconnects.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="emerald">PWA manifest</Badge>
              <Badge tone="cyan">Service worker</Badge>
              <Badge tone="neutral">CSP hardened</Badge>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-faint">
              <Trash2 size={11} className="mt-0.5 shrink-0" />
              To wipe credentials: terminal header → connection manager → “Disconnect & wipe credentials”. This clears
              the token from memory and sessionStorage and returns to Simulation Mode.
            </p>
            <Link href="/legal/privacy" className="mt-2 inline-block text-[10px] text-cyan underline-offset-2 hover:underline">
              Read the privacy policy
            </Link>
          </Panel>
        </div>

        <div className="mt-4">
          <DisclaimerNote>
            Trading derivatives carries a high level of risk and you can lose all your capital. Not financial advice.
            Past performance doesn&apos;t guarantee future results. 18+ only. {NOT_AFFILIATED_NOTICE}
          </DisclaimerNote>
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
