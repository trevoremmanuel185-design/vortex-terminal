import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader, WhatsAppFab } from "@/components/site/SiteChrome";
import { JournalClient } from "@/components/journal/JournalClient";
import { Button } from "@/components/ui/Primitives";

export const metadata: Metadata = {
  title: "Trading journal",
  description: "Notes, tags and realised P&L for every VORTEX trade. Stored in your own Postgres database.",
};

export default function JournalPage() {
  return (
    <div className="min-h-screen bg-obsidian">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald">Reflection</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Trading journal</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
              The most underrated risk tool. Record why you took a trade while the reasoning is still honest, tag the
              mistakes, and review the pattern later.
            </p>
          </div>
          <Link href="/terminal">
            <Button variant="secondary">Back to terminal</Button>
          </Link>
        </div>
        <div className="mt-6">
          <JournalClient />
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
