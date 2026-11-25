import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader, WhatsAppFab } from "@/components/site/SiteChrome";
import { BacktestLab } from "@/components/backtest/BacktestLab";
import { Button } from "@/components/ui/Primitives";

export const metadata: Metadata = {
  title: "Backtester",
  description: "Replay VORTEX strategies on tick history with modelled payouts, spread and recovery caps.",
};

export default function BacktestPage() {
  return (
    <div className="min-h-screen bg-obsidian">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald">Research</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Backtester</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Replay the same rule sets the bot engine uses, against tick history, with payouts and spread modelled.
              Every result carries the same warning: backtest ≠ live results.
            </p>
          </div>
          <Link href="/terminal">
            <Button variant="secondary">Back to terminal</Button>
          </Link>
        </div>
        <div className="mt-6">
          <BacktestLab />
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
