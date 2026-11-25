import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BellRing,
  CircleDot,
  Cpu,
  FileCode2,
  FlaskConical,
  Gauge,
  Layers,
  LineChart,
  Lock,
  OctagonX,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { SiteFooter, SiteHeader, WhatsAppFab } from "@/components/site/SiteChrome";
import { ContactSection } from "@/components/site/ContactSection";
import { DemoTicker } from "@/components/site/DemoTicker";
import { Logo } from "@/components/brand/Logo";
import { Badge, Button, DisclaimerNote } from "@/components/ui/Primitives";

const FEATURES = [
  {
    icon: Activity,
    title: "Live Deriv feed, honestly badged",
    body: "Direct browser → Deriv WebSocket. Latency readout, 30s heartbeat, jittered exponential backoff and automatic re-subscribe. No token ever touches our servers.",
    tag: "Telemetry",
  },
  {
    icon: ScanLine,
    title: "Digit matrix at real pip precision",
    body: "Last-digit histogram over 25→1,000 ticks with hot/cold shading, Even/Odd, Over/Under, Matches/Differs and live streak counters — computed at the symbol's own pip size.",
    tag: "Analytics",
  },
  {
    icon: Gauge,
    title: "Indicator confluence, not hype",
    body: "A weighted 0–100 composite of EMA alignment, RSI/MACD momentum, band volatility and 1m/5m/15m agreement — with every component's contribution exposed.",
    tag: "Engine",
  },
  {
    icon: ShieldCheck,
    title: "Risk manager you cannot skip",
    body: "Max daily loss, take-profit, consecutive-loss halt, stake cap, open-position cap and cooldown. Bots physically cannot bypass it. EMERGENCY STOP is always one key away.",
    tag: "Safety",
  },
  {
    icon: Cpu,
    title: "Bot studio with recovery caps",
    body: "Four editable built-ins with plain-language risk notes, hard martingale caps and a worst-case cumulative-loss preview before you start.",
    tag: "Automation",
  },
  {
    icon: FileCode2,
    title: "DBot XML import, verified",
    body: "Drop a Deriv .xml file. We parse trade parameters and restart logic, list unsupported blocks and refuse partial conversions instead of running something else.",
    tag: "Import",
  },
  {
    icon: Wallet,
    title: "Ledger with real statistics",
    body: "Open contracts with live P&L and one-click sell. Closed history with win rate, profit factor, expectancy, avg win/loss, max drawdown, equity curve and CSV export.",
    tag: "Ledger",
  },
  {
    icon: FlaskConical,
    title: "Backtester that admits its limits",
    body: "Replay strategies on historical ticks with modelled payouts and spread. Outputs the same stats — permanently labelled “Backtest ≠ live results”.",
    tag: "Research",
  },
  {
    icon: BellRing,
    title: "Signal audit + trade journal",
    body: "Every bot and manual signal is recorded with its measured outcome, so hit-rate is a number, not a claim. Journal notes and tags live in Postgres.",
    tag: "Accountability",
  },
];

const COMPARISON = [
  { label: "Mandatory, non-bypassable risk limits", vortex: "Six limits + emergency stop", retail: "Optional, often hidden" },
  { label: "Signal performance claims", vortex: "Measured hit-rate from audited outcomes", retail: "“98% win rate” marketing" },
  { label: "Execution transparency", vortex: "Exact Deriv error messages + stale-quote guard", retail: "Generic “trade failed”" },
  { label: "Token handling", vortex: "Memory-only, sessionStorage opt-in, one-click wipe", retail: "Stored server-side" },
  { label: "Strategy honesty", vortex: "“Indicator confluence” + random-by-design notice", retail: "Guaranteed-profit bots" },
  { label: "Mobile workspace", vortex: "Purpose-built tabs from 360px", retail: "Desktop squeezed into a phone" },
];

const FAQS = [
  {
    q: "Is VORTEX TERMINAL affiliated with Deriv?",
    a: "No. It is an independent interface for the Deriv WebSocket API. We are not affiliated with, endorsed by or operated by Deriv unless officially registered as a Deriv partner. All execution happens on your own Deriv account.",
  },
  {
    q: "Can I use it without a token?",
    a: "Yes. Without a token the terminal opens in Simulation Mode with a live-looking synthetic feed, clearly badged SIMULATION. It is impossible to place a simulated trade as if it were real — simulated contracts are labelled everywhere and never touch a real balance.",
  },
  {
    q: "Do you store my API token?",
    a: "No. Tokens stay in browser memory by default. “Remember me” keeps it in sessionStorage for that tab only, with a risk explanation. Disconnect & wipe removes it from memory and storage. Tokens are only ever sent to Deriv's own WebSocket endpoint.",
  },
  {
    q: "Are the signals predictive?",
    a: "No. The score is labelled Indicator Confluence because it describes how aligned past price behaviour is right now. It is never called accuracy or win probability. Synthetic indices are random by design and cannot be reliably predicted.",
  },
  {
    q: "What happens to a bot if I close the tab?",
    a: "It stops. Bots run in the foreground tab only (it pauses automatically when the tab is hidden) and a warning is shown before you close it. That is a safety feature, not a limitation.",
  },
  {
    q: "Can I trade a real account?",
    a: "Yes — after a two-step confirmation where you type REAL. Real mode paints an amber/crimson frame with a LIVE badge, and starting a bot on a real account requires a second explicit confirmation showing stake, stop-loss and take-profit.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-obsidian">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-hairline">
          <div className="pointer-events-none absolute inset-0 grid-noise opacity-70" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.05fr_0.95fr] md:py-20">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="emerald" dot>Deriv WebSocket API</Badge>
                <Badge tone="cyan">Demo-first</Badge>
                <Badge tone="neutral">No token leaves your browser</Badge>
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-[56px]">
                Trade with
                <span className="bg-gradient-to-r from-emerald via-emerald to-cyan bg-clip-text text-transparent"> precision.</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base">
                VORTEX TERMINAL is an institutional-grade workspace for Deriv synthetics, forex and commodities.
                Sub-second analytics, a mandatory risk manager, and automation that shows you its losses — not just
                its wins.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/terminal">
                  <Button variant="primary" size="lg">
                    Launch the terminal <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link href="/audit">
                  <Button variant="secondary" size="lg">
                    Inspect the signal audit
                  </Button>
                </Link>
              </div>
              <dl className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Timeframes", value: "1t → 1d" },
                  { label: "Bots", value: "4 + XML" },
                  { label: "Risk limits", value: "6 hard" },
                  { label: "Token storage", value: "In-memory" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-hairline bg-panel/70 px-3 py-2">
                    <dt className="text-[9px] uppercase tracking-[0.16em] text-ink-faint">{item.label}</dt>
                    <dd className="num mt-0.5 text-sm font-semibold text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <DemoTicker />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Lock, label: "CSP hardened" },
                  { icon: Timer, label: "Sub-50ms ticks" },
                  { icon: Smartphone, label: "360px ready" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 rounded-lg border border-hairline bg-panel/60 px-2 py-1.5">
                    <item.icon size={12} className="text-cyan" />
                    <span className="text-[10px] text-ink-muted">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald">The workspace</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Everything a serious operator expects
              </h2>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-ink-faint">
              Built around one principle: the tool must never flatter the operator. Numbers are tabular, signals are
              descriptive, and every risk limit is enforced by the engine, not the strategy.
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="group rounded-xl border border-hairline bg-panel/70 p-4 transition-colors duration-150 hover:border-hairline-bright hover:bg-panel-2/80"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-lg border border-emerald/25 bg-emerald/10 p-1.5 text-emerald">
                    <feature.icon size={16} />
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{feature.tag}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Demo first */}
        <section className="border-y border-hairline bg-obsidian-2/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Badge tone="amber" dot>Demo-first</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                Risk guardrails that are already on
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Bots start in DEMO. Real mode is a deliberate, two-step decision — and the interface never lets you
                forget which mode you are in.
              </p>
              <DisclaimerNote>
                Trading derivatives carries a high level of risk and you can lose all your capital. Not financial
                advice. Past performance doesn&apos;t guarantee future results. 18+ only.
              </DisclaimerNote>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: OctagonX, title: "EMERGENCY STOP", body: "One button or the Esc key halts every bot, optionally closes open positions and logs the reason." },
                { icon: ShieldCheck, title: "Type REAL to confirm", body: "Switching to a live account cannot happen by accident. Once live, an amber/crimson frame and LIVE badge persist." },
                { icon: CircleDot, title: "SIMULATION badge", body: "Without a token, every price, proposal and contract is labelled simulated. A simulated fill can never masquerade as real." },
                { icon: TrendingUp, title: "Worst-case preview", body: "Martingale ladders show their capped cumulative exposure before the first trade, not after the fifth." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-hairline bg-panel/70 p-4">
                  <item.icon size={16} className="text-amber" />
                  <h3 className="mt-2 text-xs font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-cyan" />
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Why operators switch</h2>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
            A side-by-side against the typical retail “bot portal” pattern — not a specific competitor.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-hairline">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="bg-panel-2/80 text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Capability</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-emerald">
                    <span className="inline-flex items-center gap-1.5"><LogoMarkInline /> VORTEX TERMINAL</span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Typical bot portal</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, index) => (
                  <tr key={row.label} className={index % 2 ? "bg-panel/40" : "bg-transparent"}>
                    <th scope="row" className="border-t border-hairline/70 px-3 py-2.5 font-medium text-ink-muted">{row.label}</th>
                    <td className="border-t border-hairline/70 px-3 py-2.5 text-ink">
                      <span className="inline-flex items-start gap-1.5">
                        <span className="mt-0.5 text-emerald" aria-hidden>✓</span>
                        {row.vortex}
                      </span>
                    </td>
                    <td className="border-t border-hairline/70 px-3 py-2.5 text-ink-faint">{row.retail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-hairline bg-obsidian-2/60">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Three steps to a disciplined session</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                { step: "01", title: "Connect or simulate", body: "Open instantly in Simulation Mode, or paste a Read + Trade + Trading Information token (or use Deriv OAuth). Scope issues are flagged immediately." },
                { step: "02", title: "Read the market", body: "Pick a symbol from the live catalogue, study the digit distribution and the confluence breakdown, then set your risk budget before you size a single trade." },
                { step: "03", title: "Execute or automate", body: "Take a manual position with a live proposal, or launch a capped bot. Watch the ledger, the journal and the audit trail — the numbers are yours." },
              ].map((item) => (
                <div key={item.step} className="rounded-xl border border-hairline bg-panel/70 p-4">
                  <span className="num text-[10px] font-semibold text-cyan">{item.step}</span>
                  <h3 className="mt-2 text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Straight answers</h2>
          <div className="mt-5 divide-y divide-hairline rounded-xl border border-hairline bg-panel/60">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink">
                  {faq.q}
                  <span className="text-ink-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{faq.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href="/legal/risk">
              <Button variant="ghost" size="sm">Risk disclosure</Button>
            </Link>
            <Link href="/legal/terms">
              <Button variant="ghost" size="sm">Terms</Button>
            </Link>
            <Link href="/legal/privacy">
              <Button variant="ghost" size="sm">Privacy</Button>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-hairline">
          <div className="pointer-events-none absolute inset-0 grid-noise opacity-60" aria-hidden />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-14 text-center">
            <LineChart size={22} className="text-emerald" />
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Precision beats prediction.
            </h2>
            <p className="max-w-xl text-xs leading-relaxed text-ink-muted">
              Start on virtual funds. Learn the digit matrix. Let the risk manager hold the line. Then — only then —
              consider a live account.
            </p>
            <Link href="/terminal">
              <Button variant="primary" size="lg">
                Open VORTEX TERMINAL <ArrowRight size={16} />
              </Button>
            </Link>
            <p className="text-[10px] text-ink-faint">No sign-up. No payment. Simulation available instantly.</p>
          </div>
        </section>

        <ContactSection />
      </main>

      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}

function LogoMarkInline() {
  return (
    <svg width="12" height="12" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 5 41 15.5v16L24 43 7 32.5v-16L24 5Z" stroke="#10B981" strokeWidth="3" strokeLinejoin="round" />
      <path d="M24 17v14" stroke="#06B6D4" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
