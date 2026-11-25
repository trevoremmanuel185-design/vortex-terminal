"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CandlestickChart,
  Grid3X3,
  LayoutGrid,
  ListOrdered,
  OctagonX,
  Plug,
  Settings,
  ShieldAlert,
  Signal,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useTerminalStore, type MobileTab } from "@/lib/store/terminal";
import { useTradingSession } from "@/lib/session/useTradingSession";
import { useAnalytics } from "@/lib/session/useAnalytics";
import { useBotRunner } from "@/lib/session/useBotRunner";
import { Badge, Button, Segmented } from "@/components/ui/Primitives";
import { PanelErrorBoundary } from "@/components/terminal/ErrorPanel";
import { MarketWatch } from "@/components/terminal/MarketWatch";
import { PriceChart } from "@/components/terminal/PriceChart";
import { DigitAnalyzer } from "@/components/terminal/DigitAnalyzer";
import { ConfluencePanel } from "@/components/terminal/ConfluencePanel";
import { ExecutionPanel } from "@/components/terminal/ExecutionPanel";
import { BotPanel } from "@/components/terminal/BotPanel";
import { Ledger } from "@/components/terminal/Ledger";
import { ConnectionDrawer, RealAccountModal, SettingsDrawer } from "@/components/terminal/Drawers";
import { CONTACT } from "@/lib/contact";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { ContractType } from "@/lib/deriv/types";

const TABS: { id: MobileTab; label: string; icon: typeof Activity }[] = [
  { id: "markets", label: "Markets", icon: ListOrdered },
  { id: "chart", label: "Chart", icon: CandlestickChart },
  { id: "trade", label: "Trade", icon: Activity },
  { id: "bots", label: "Bots", icon: Bot },
  { id: "ledger", label: "Ledger", icon: Wallet },
];

function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function TerminalShell() {
  const { buyNow, sellContract, connectWithToken, disconnectAndWipe } = useTradingSession();
  useAnalytics();
  useBotRunner();
  const isDesktop = useIsDesktop();

  const [showConnection, setShowConnection] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRealModal, setShowRealModal] = useState(false);

  const account = useTerminalStore((state) => state.account);
  const accountType = useTerminalStore((state) => state.accountType);
  const engineKind = useTerminalStore((state) => state.engineKind);
  const status = useTerminalStore((state) => state.status);
  const latency = useTerminalStore((state) => state.latency);
  const symbol = useTerminalStore((state) => state.symbol);
  const meta = useTerminalStore((state) => state.symbols.find((entry) => entry.symbol === state.symbol));
  const lastTick = useTerminalStore((state) => state.ticks[state.ticks.length - 1]);
  const previousTick = useTerminalStore((state) => state.ticks[state.ticks.length - 2]);
  const botStatus = useTerminalStore((state) => state.bot.status);
  const openCount = useTerminalStore((state) => state.openContracts.length);
  const protocolNotice = useTerminalStore((state) => state.protocolNotice);
  const emergencyStop = useTerminalStore((state) => state.emergencyStop);
  const mobileTab = useTerminalStore((state) => state.mobileTab);
  const setMobileTab = useTerminalStore((state) => state.setMobileTab);
  const setAccountType = useTerminalStore((state) => state.setAccountType);
  const setRealConfirmed = useTerminalStore((state) => state.setRealConfirmed);
  const setEmergencyStop = useTerminalStore((state) => state.setEmergencyStop);
  const pushBotLog = useTerminalStore((state) => state.pushBotLog);
  const patchTradeForm = useTerminalStore((state) => state.patchTradeForm);

  // Emergency stop is always one key away.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const store = useTerminalStore.getState();
      store.setEmergencyStop(true, "EMERGENCY STOP · Esc key");
      store.pushBotLog("error", "EMERGENCY STOP via Esc — all automation halted");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const change = lastTick && previousTick ? lastTick.quote - previousTick.quote : 0;
  const currency = account?.currency ?? "USD";
  const isReal = accountType === "real";
  const priceDecimals = meta?.decimals ?? 2;

  async function switchToReal() {
    if (engineKind === "simulation") {
      setShowConnection(true);
      return;
    }
    setShowRealModal(true);
  }

  function sellAll() {
    return Promise.all(
      useTerminalStore.getState().openContracts.map((contract) =>
        sellContract(contract.contractId).catch(() => undefined),
      ),
    ).then(() => undefined);
  }

  async function quickTrade(type: ContractType) {
    patchTradeForm({ contractType: type });
    try {
      await buyNow({ source: "manual" });
    } catch {
      /* error is surfaced in the execution panel */
    }
  }

  const marketsPanel = (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1">
        <MarketWatch />
      </div>
      <div className="min-h-0 flex-1">
        <ConfluencePanel />
      </div>
    </div>
  );

  const chartPanel = (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1">
        <PriceChart />
      </div>
      <div className={isDesktop ? "max-h-[42%] shrink-0" : "shrink-0"}>
        <DigitAnalyzer />
      </div>
    </div>
  );

  const tradePanel = (
    <div className="flex flex-col gap-2">
      <ExecutionPanel onBuy={() => buyNow({ source: "manual" }).then((result) => result)} />
      <div className="min-h-[520px]">
        <BotPanel onSellAll={sellAll} />
      </div>
    </div>
  );

  const ledgerPanel = <Ledger onSell={async (contractId) => { try { await sellContract(contractId); } catch { /* surfaced in the log */ } }} />;

  return (
    <div className={cn("flex h-[100dvh] flex-col bg-obsidian", isReal && "ring-1 ring-inset ring-crimson/60")}>
      {/* Real-account persistent guardrail */}
      {isReal ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-crimson/50 bg-crimson/10 px-3 py-1 text-[10px] text-crimson">
          <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.16em]">
            <ShieldAlert size={11} /> Live account · real funds
          </span>
          <span className="hidden text-crimson/80 sm:inline">
            Risk of loss is real. Every order is final once executed on Deriv.
          </span>
          <button type="button" className="ml-auto underline" onClick={() => { setAccountType("demo"); setRealConfirmed(false); }}>
            Switch back to demo
          </button>
        </div>
      ) : null}

      <header className={cn("shrink-0 border-b bg-panel/80 backdrop-blur", isReal ? "border-crimson/40" : "border-hairline")}>
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 sm:px-3">
          <Link href="/" aria-label="VORTEX TERMINAL home" className="flex items-center">
            <span className="hidden sm:inline"><Logo size={26} /></span>
            <span className="sm:hidden"><Logo size={24} showWordmark={false} /></span>
          </Link>
          <Badge tone={engineKind === "simulation" ? "amber" : "emerald"} dot>
            {engineKind === "simulation" ? "Simulation" : "Deriv live"}
          </Badge>
          {isReal ? <Badge tone="crimson" dot>Live</Badge> : <Badge tone="cyan">Demo</Badge>}

          <div className="ml-1 hidden items-center gap-2 sm:flex">
            <div className="flex items-center gap-1.5 rounded-md border border-hairline bg-obsidian/60 px-2 py-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", status === "connected" ? "bg-emerald animate-pulse-dot" : status === "reconnecting" ? "bg-amber animate-pulse-dot" : "bg-crimson")} />
              <span className="text-[10px] capitalize text-ink-muted">{status === "connected" ? "connected" : status}</span>
              <span className="num text-[10px] text-ink-faint">{latency ? `${latency}ms` : "—"}</span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-md border border-hairline bg-obsidian/60 px-2 py-1 md:flex">
              <span className="num text-[10px] text-ink-faint">{DERIV_HOST}</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden text-right sm:block">
              <p className="num text-[11px] font-semibold text-ink">{meta?.displayName ?? symbol}</p>
              <p className={cn("num text-[10px]", change >= 0 ? "text-emerald" : "text-crimson")}>
                {lastTick ? `${change >= 0 ? "▲ +" : "▼ "}${formatNumber(change, priceDecimals)}` : "waiting for ticks"}
                {lastTick ? ` · ${formatNumber(lastTick.quote, priceDecimals)}` : ""}
              </p>
            </div>
            <div className="mx-1 hidden h-6 w-px bg-hairline sm:block" />
            <div className="text-right">
              <p className="text-[8px] uppercase tracking-[0.14em] text-ink-faint">{accountType} balance</p>
              <p className="num text-[11px] font-semibold text-emerald">
                {account ? formatCurrency(account.balance, currency) : formatCurrency(0, currency)}
              </p>
            </div>
            <Segmented
              options={[
                { value: "demo", label: "Demo" },
                { value: "real", label: "Real" },
              ]}
              value={accountType}
              onChange={(value) => {
                if (value === "real") void switchToReal();
                else {
                  setAccountType("demo");
                  setRealConfirmed(false);
                }
              }}
              size="sm"
              className={isReal ? "border-crimson/50" : ""}
            />
            <Button size="sm" variant="secondary" onClick={() => setShowConnection(true)} aria-label="Connection and account">
              <Plug size={12} /> <span className="hidden md:inline">{account ? account.loginid : "Connect"}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)} aria-label="Settings and support">
              <Settings size={13} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMobileTab("bots")} aria-label="Bots">
              <Bot size={13} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-t border-hairline/70 px-2 py-1 text-[9px] text-ink-faint sm:px-3">
          <span className="inline-flex items-center gap-1"><Signal size={9} className="text-emerald" /> heartbeat 30s</span>
          <span>·</span>
          <span>tick → pixel &lt; 50ms</span>
          <span>·</span>
          <span className={botStatus === "running" ? "text-amber" : botStatus === "halted" ? "text-crimson" : ""}>
            bot: {botStatus}
          </span>
          <span>·</span>
          <span>{openCount} open</span>
          <span>·</span>
          <Link href="/terminal/backtest" className="hover:text-cyan">backtester</Link>
          <span>·</span>
          <Link href="/audit" className="hover:text-cyan">signal audit</Link>
          <span>·</span>
          <Link href="/journal" className="hover:text-cyan">journal</Link>
          <span>·</span>
          <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald">support</a>
          {emergencyStop ? (
            <button type="button" onClick={() => { setEmergencyStop(false); }} className="ml-auto inline-flex items-center gap-1 rounded border border-crimson/50 bg-crimson/10 px-1.5 py-0.5 text-crimson">
              <OctagonX size={9} /> stop active — reset
            </button>
          ) : (
            <span className="ml-auto hidden items-center gap-1 sm:inline-flex"><kbd className="rounded border border-hairline bg-panel-2 px-1">Esc</kbd> emergency stop</span>
          )}
        </div>
        {engineKind === "simulation" ? (
          <div className="flex items-center gap-2 border-t border-amber/25 bg-amber/5 px-2 py-1 text-[9px] text-amber sm:px-3">
            <AlertTriangle size={10} />
            <span className="truncate">
              SIMULATION — virtual feed and virtual fills. Connect a Deriv demo token for live prices.
            </span>
            <button type="button" onClick={() => setShowConnection(true)} className="ml-auto shrink-0 rounded border border-amber/40 px-1.5 py-0.5 font-semibold">
              Connect
            </button>
          </div>
        ) : protocolNotice ? (
          <div className="border-t border-amber/25 bg-amber/5 px-2 py-1 text-[9px] text-amber sm:px-3">{protocolNotice}</div>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-1.5 sm:p-2">
        {isDesktop === null ? (
          <div className="flex h-full items-center justify-center text-[11px] text-ink-faint">Loading terminal…</div>
        ) : isDesktop ? (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[272px_minmax(0,1fr)_336px]">
              <div className="hidden min-h-0 lg:block">
                <PanelErrorBoundary title="Markets">{marketsPanel}</PanelErrorBoundary>
              </div>
              <div className="flex min-h-0 flex-col gap-2">
                <div className="min-h-0 flex-1">
                  <PanelErrorBoundary title="Chart"><PriceChart /></PanelErrorBoundary>
                </div>
                <div className="min-h-0 shrink-0">
                  <PanelErrorBoundary title="Digit matrix"><DigitAnalyzer /></PanelErrorBoundary>
                </div>
              </div>
              <div className="hidden min-h-0 flex-col gap-2 lg:flex">
                <PanelErrorBoundary title="Execution"><ExecutionPanel onBuy={() => buyNow({ source: "manual" }).then((result) => result)} /></PanelErrorBoundary>
                <div className="min-h-0 flex-1">
                  <PanelErrorBoundary title="Bot engine"><BotPanel onSellAll={sellAll} /></PanelErrorBoundary>
                </div>
              </div>
            </div>
            <div className="h-[224px] shrink-0">
              <PanelErrorBoundary title="Ledger">{ledgerPanel}</PanelErrorBoundary>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
            {mobileTab === "markets" ? <PanelErrorBoundary title="Markets">{marketsPanel}</PanelErrorBoundary> : null}
            {mobileTab === "chart" ? <PanelErrorBoundary title="Chart">{chartPanel}</PanelErrorBoundary> : null}
            {mobileTab === "trade" ? <PanelErrorBoundary title="Execution">{tradePanel}</PanelErrorBoundary> : null}
            {mobileTab === "bots" ? <div className="min-h-[560px]"><PanelErrorBoundary title="Bots"><BotPanel onSellAll={sellAll} /></PanelErrorBoundary></div> : null}
            {mobileTab === "ledger" ? <PanelErrorBoundary title="Ledger">{ledgerPanel}</PanelErrorBoundary> : null}
          </div>
        )}
      </main>

      {/* Mobile sticky trade bar + tab bar */}
      <div className="shrink-0 border-t border-hairline bg-panel/95 backdrop-blur lg:hidden">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] text-ink-faint">{meta?.displayName ?? symbol} · one-thumb trade</p>
            <p className={cn("num text-[11px] font-semibold", change >= 0 ? "text-emerald" : "text-crimson")}>
              {lastTick ? formatNumber(lastTick.quote, priceDecimals) : "—"}
            </p>
          </div>
          <Button size="sm" variant="buy" onClick={() => void quickTrade("CALL")} aria-label="Quick buy Rise">
            Rise ▲
          </Button>
          <Button size="sm" variant="sell" onClick={() => void quickTrade("PUT")} aria-label="Quick buy Fall">
            Fall ▼
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => { setEmergencyStop(true, "Emergency stop (mobile)"); pushBotLog("error", "Emergency stop via mobile bar"); }}
            aria-label="Emergency stop"
          >
            <OctagonX size={12} />
          </Button>
        </div>
        <nav className="grid grid-cols-5 border-t border-hairline/70" aria-label="Terminal sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              aria-current={mobileTab === tab.id ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 text-[9px]",
                mobileTab === tab.id ? "text-emerald" : "text-ink-faint",
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.id === "ledger" && openCount > 0 ? (
                <span className="absolute mt-3 ml-4 rounded-full bg-emerald px-1 text-[7px] text-obsidian">{openCount}</span>
              ) : null}
            </button>
          ))}
        </nav>
      </div>

      {showConnection ? (
        <ConnectionDrawer
          onClose={() => setShowConnection(false)}
          onConnectToken={connectWithToken}
          onDisconnect={() => { disconnectAndWipe(); }}
        />
      ) : null}
      {showSettings ? <SettingsDrawer onClose={() => setShowSettings(false)} onDisconnect={disconnectAndWipe} /> : null}
      {showRealModal ? (
        <RealAccountModal
          onCancel={() => setShowRealModal(false)}
          onConfirm={() => {
            setAccountType("real");
            setRealConfirmed(true);
            setShowRealModal(false);
            pushBotLog("warn", "REAL mode enabled — real funds are at risk");
          }}
        />
      ) : null}
    </div>
  );
}

const DERIV_HOST = "wss://ws.derivws.com/websockets/v3";

export default TerminalShell;
