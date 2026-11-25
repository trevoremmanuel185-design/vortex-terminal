# VORTEX TERMINAL — Trade with precision.

An institutional-grade, dark-themed trading terminal and automation workspace for the
**Deriv WebSocket API**. Built with Next.js (App Router), TypeScript (strict), Tailwind CSS v4,
Zustand, Lightweight Charts, Zod, Drizzle ORM + PostgreSQL, Vitest and Playwright.

> **Risk warning.** Trading derivatives carries a high level of risk and you can lose all of your capital.
> Not financial advice. Past performance doesn't guarantee future results. 18+ only. Synthetic indices are
> random by design. VORTEX is an independent interface and is **not affiliated with Deriv** unless
> officially registered as a Deriv partner.

---

## 1. Quick start

```bash
cp .env.example .env          # DATABASE_URL + NEXT_PUBLIC_DERIV_APP_ID
npm install
npx drizzle-kit push          # create signal_audit, journal_entries, contact_messages
npm run dev                   # http://localhost:3000
```

Simulation Mode is available instantly with no token: open `/terminal`. It is clearly badged
**SIMULATION**, and every simulated contract is tagged so it can never be mistaken for a real fill.

Production:

```bash
npm run build && npm run start
```

Unit tests: `npx vitest run` · E2E: `npx playwright install --with-deps && npx playwright test`
(the Playwright spec is `.mjs` so production images never depend on Playwright).

---

## 2. Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres used for signal audit, journal and contact messages. Never used for tokens. |
| `NEXT_PUBLIC_DERIV_APP_ID` | recommended | Deriv OAuth application id (falls back to `1089`). |
| `NEXT_PUBLIC_DERIV_WS_URL` | optional | Override the Deriv WebSocket endpoint. |

All Deriv endpoints are isolated in **`src/lib/deriv/config.ts`** and should be re-checked against
<https://api.deriv.com> when Deriv changes endpoints or auth flows.

**Never place API tokens in environment variables or send them to this app's backend.**

---

## 3. Architecture

```
src/
├─ app/
│  ├─ page.tsx                     Landing (live demo chart, features, comparison, FAQ, contact)
│  ├─ terminal/page.tsx            Trading workspace (Header, MarketWatch, Chart, Digit, Execution, Bot, Ledger)
│  ├─ terminal/backtest/page.tsx   Backtester
│  ├─ audit/page.tsx               Signal audit — real hit-rate from Postgres (SSR)
│  ├─ journal/page.tsx             Trading journal (Postgres CRUD)
│  ├─ contact/page.tsx             Contact page
│  ├─ settings/page.tsx            Settings & support reference
│  ├─ legal/[slug]/page.tsx        Risk disclosure / Terms / Privacy
│  ├─ api/{health,signals,journal,contact}/route.ts
│  ├─ icon.svg                     Favicon (prism + crosshair)
│  ├─ globals.css                  Design tokens, motion, tabular-nums, glass, reduced motion
│  └─ layout.tsx                   Metadata, fonts, PWA registration
├─ components/
│  ├─ brand/Logo.tsx               Bespoke interlocking prism + candlestick/crosshair mark (gradient/mono)
│  ├─ site/                        SiteChrome (header/footer/WhatsApp FAB), DemoTicker, ContactSection
│  ├─ terminal/                    TerminalShell, MarketWatch, PriceChart, DigitAnalyzer, ConfluencePanel,
│  │                               ExecutionPanel, BotPanel, Ledger, Drawers, ErrorPanel
│  ├─ backtest/BacktestLab.tsx
│  ├─ journal/JournalClient.tsx
│  ├─ ui/Primitives.tsx            Badge, Panel, Button, Stat, Field, Segmented, Progress, Toggle…
│  └─ system/PwaRegister.tsx
├─ db/                             Drizzle client + schema
└─ lib/
   ├─ deriv/
   │  ├─ config.ts                 Endpoints, scopes, timeouts, backoff (single source of truth)
   │  ├─ types.ts                  TradingEngine interface + domain types
   │  ├─ schemas.ts                Zod schemas for authorize/balance/ticks/ticks_history/proposal/buy/
   │  │                            proposal_open_contract/sell/profit_table/active_symbols/ping
   │  ├─ DerivSocketService.ts     Typed singleton: req_id correlation, timeouts, streams, heartbeat,
   │  │                            jittered backoff 1s→30s, restore-after-reconnect, forget cleanup
   │  ├─ live-engine.ts            Live adapter (browser → Deriv only)
   │  ├─ simulation.ts             Local simulated feed (ticks/proposals/contracts/settlement)
   │  ├─ symbols.ts                Fallback catalogue with real pip sizes + decimals
   │  └─ payouts.ts                Indicative return rates (simulation + backtester only)
   ├─ indicators/                  Incremental EMA/RSI/BB/MACD/ATR/Stochastic, digit stats,
   │                               confluence score, candle aggregation + unit tests
   ├─ bots/                        Built-in strategies, DBot XML parser, backtester + unit tests
   ├─ risk/risk-manager.ts         Pure, mandatory risk layer + unit tests
   ├─ store/terminal.ts            Zustand store (persisted preferences & risk limits + hydration)
   ├─ session/                     useTradingSession, useAnalytics, useBotRunner, engine accessors
   ├─ alerts.ts                    Local audio + browser notifications
   ├─ signals.ts                   Signal audit client (POST/PATCH)
   ├─ contact.ts                   Support contacts + non-affiliation notice
   └─ utils.ts                     Formatting, last-digit precision, trade statistics, CSV export
tests/e2e/smoke.spec.mjs           Playwright: landing, simulation buy/sell, emergency stop, 360px mobile
public/                            logo.svg, logo-mono.svg, manifest.webmanifest, sw.js (offline shell)
netlify.toml, playwright.config.mjs, vitest.config.ts, .env.example
```

### Deriv connection layer

- `send<T>()` assigns monotonic `req_id`s, correlates responses and always resolves/rejects (per-request timeout).
- Every inbound frame is validated with Zod before it reaches the UI.
- Subscriptions are registered centrally, restored in order after a reconnect (`authorize` first), and cleaned up
  with `forget`. Pending *orders* are never replayed, so reconnects cannot duplicate purchases.
- 30s heartbeat with `ping` round-trip latency, exponential backoff (1s → 30s) with jitter.
- The token lives in memory only; "Remember me" writes it to `sessionStorage` and explains the risk.
  "Disconnect & wipe credentials" removes it from both and returns to Simulation Mode.
- CSP, `X-Frame-Options: DENY`, nosniff, strict referrer policy and a `wss://ws.derivws.com` `connect-src` are
  configured in `next.config.ts` and `netlify.toml`.

### Analytics honesty

- The composite is labelled **Indicator Confluence** (0–100) with per-component contributions. It is never described
  as accuracy or win probability.
- The footnote "Indicators describe past price behaviour and do not predict future results. Synthetic indices are
  random by design." accompanies the score and the digit matrix.
- The **Signal Audit** page shows every signal plus its measured outcome (hit/miss/pending) from Postgres, including
  simulated signals labelled separately.

### Risk manager (cannot be bypassed)

Max daily loss · take-profit target · max consecutive losses · max stake · max open positions · cooldown ·
max trades per session · real-account automation block. Plus the **EMERGENCY STOP** button and the `Esc` key.
Limits are persisted and enforced by `evaluatePreTrade` in `src/lib/risk/risk-manager.ts` before any engine call.
Martingale ladders show their capped worst-case cumulative loss before the bot starts.

Bots run in the foreground tab only, pause when the tab is hidden and stop when it closes (with a `beforeunload`
warning). Every built-in exposes a plain-language description **and** explicit risk notes.

---

## 4. Acceptance checklist

1. **Connect demo token → balance → symbol → ticks → proposal** — connection drawer (token/OAuth) → `authorize` →
   scope verification → `balance` stream → `active_symbols` catalogue → `ticks` + `proposal` subscriptions.
2. **Manual demo trade → open position → live P&L → sell** — `buy` → `proposal_open_contract` stream → ledger sell via `sell`.
3. **Bot trades and halts** — bot loop places orders, then halts with a visible reason on max consecutive losses or Esc.
4. **REAL requires 2 steps** — type `REAL`; header keeps a crimson frame + LIVE badge + risk banner; bots require a
   separate confirmation showing stake, stop-loss and take-profit.
5. **Network drop** — status shows `reconnecting`, trade buttons are disabled, subscriptions are restored, no order replay.
6. **Mobile at 360px** — bottom tab bar (Markets/Chart/Trade/Bots/Ledger) + sticky one-thumb trade bar.
7. **Quality gates** — `npx vitest run` (49 tests), `tsc --noEmit`, `next build` and `build_and_start` all pass.

---

## 5. Deploy

**Netlify**: connect the repo; `netlify.toml` sets the build command, `@netlify/plugin-nextjs`, security headers and
cache rules. Add `DATABASE_URL` and `NEXT_PUBLIC_DERIV_APP_ID` in the Netlify UI.

**Vercel**: import the repo, add the same two environment variables, then run `npx drizzle-kit push` against the
production database once.

Deriv OAuth: register the deployment's `/terminal` URL as the `redirect_uri` for your app id. The callback hash
(`acct1/token1`, `acct2/token2`, …) is parsed in the connection drawer and cleared from the URL immediately.

The PWA (`public/manifest.webmanifest` + `public/sw.js`) makes the app installable and provides an offline shell;
WebSocket traffic is never cached or proxied.

---

## 6. Contact & support

- **Instagram (verified):** [@trevor_mukisa_](https://instagram.com/trevor_mukisa_)
- **Email:** [trevormukisa185@gmail.com](mailto:trevormukisa185@gmail.com)
- **Calls & WhatsApp:** [+256 743274325](tel:+256743274325) · [wa.me/256743274325](https://wa.me/256743274325)

Never share your Deriv API token, password or one-time codes. VORTEX support will never ask for them.

---

## 7. Legal

Risk disclosure, Terms and Privacy live at `/legal/risk`, `/legal/terms` and `/legal/privacy`. They state plainly that
trading can lose all capital, that tokens stay in the browser, and that this project is not affiliated with Deriv
unless officially registered as a Deriv partner.
