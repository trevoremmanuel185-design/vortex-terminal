"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Camera, Mail, Menu, MessageCircle, Phone, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CONTACT, NOT_AFFILIATED_NOTICE, emailMessageHref, whatsappMessageHref } from "@/lib/contact";
import { Button } from "@/components/ui/Primitives";

const NAV = [
  { href: "/terminal", label: "Terminal" },
  { href: "/terminal/backtest", label: "Backtester" },
  { href: "/audit", label: "Signal audit" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-hairline/80 bg-obsidian/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="VORTEX TERMINAL home">
          <Logo tagline size={28} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-panel-2 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/terminal" className="hidden sm:block">
            <Button variant="primary" size="sm">
              Launch terminal <ArrowUpRight size={12} />
            </Button>
          </Link>
          <button
            type="button"
            className="rounded-md border border-hairline p-1.5 text-ink-muted md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-hairline bg-panel px-4 py-2 md:hidden" aria-label="Mobile navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm text-ink-muted hover:bg-panel-2 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-obsidian-2/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo tagline size={30} />
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-muted">
            A precision workspace for the Deriv WebSocket API: live analytics, risk-managed automation and an
            honest signal audit. Demo-first by design — start on virtual funds.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={CONTACT.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald/30 bg-emerald/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald hover:bg-emerald/20"
            >
              <MessageCircle size={13} /> WhatsApp
            </a>
            <a
              href={CONTACT.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel-2 px-2.5 py-1.5 text-[11px] text-ink-muted hover:border-cyan/40 hover:text-cyan"
            >
              <Camera size={13} /> {CONTACT.instagramHandle} <span className="text-cyan" aria-label="verified">✓</span>
            </a>
          </div>
        </div>
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Product</h3>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-emerald">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/settings" className="hover:text-emerald">
                Settings & support
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Contact</h3>
          <ul className="mt-3 space-y-2 text-xs text-ink-muted">
            <li>
              <a href={CONTACT.emailHref} className="inline-flex items-center gap-1.5 hover:text-emerald">
                <Mail size={12} /> {CONTACT.email}
              </a>
            </li>
            <li>
              <a href={CONTACT.phoneHref} className="inline-flex items-center gap-1.5 hover:text-emerald">
                <Phone size={12} /> {CONTACT.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={CONTACT.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-emerald"
              >
                <Camera size={12} /> {CONTACT.instagramHandle}
              </a>
            </li>
          </ul>
          <h3 className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Legal</h3>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
            <li><Link href="/legal/risk" className="hover:text-emerald">Risk disclosure</Link></li>
            <li><Link href="/legal/terms" className="hover:text-emerald">Terms of use</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-emerald">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-hairline/70 px-4 py-5">
        <div className="mx-auto max-w-6xl space-y-2 text-[10px] leading-relaxed text-ink-faint">
          <p>
            <strong className="text-ink-muted">Risk warning:</strong> Trading derivatives carries a high level of
            risk and you can lose all of your capital. Not financial advice. Past performance doesn&apos;t guarantee
            future results. 18+ only. Synthetic indices are random by design.
          </p>
          <p>{NOT_AFFILIATED_NOTICE}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span>© {new Date().getFullYear()} VORTEX TERMINAL. Built by {CONTACT.owner}.</span>
            <span className="inline-flex items-center gap-1.5 text-emerald/80">
              <ShieldCheck size={12} /> Tokens stay in your browser
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFab() {
  return (
    <a
      href={whatsappMessageHref("Hi Trevor — I'm using VORTEX TERMINAL and need help with")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-emerald/40 bg-emerald px-3.5 py-2.5 text-[11px] font-semibold text-obsidian shadow-[0_10px_30px_-10px_rgba(16,185,129,0.9)] transition-transform hover:scale-[1.03] md:bottom-6"
    >
      <MessageCircle size={16} /> Chat on WhatsApp
    </a>
  );
}

export function ContactActions({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="primary" size={compact ? "sm" : "md"}>
          <MessageCircle size={14} /> WhatsApp {CONTACT.phoneDisplay}
        </Button>
      </a>
      <a href={emailMessageHref("VORTEX TERMINAL enquiry", "Hi Trevor,")}>
        <Button variant="secondary" size={compact ? "sm" : "md"}>
          <Mail size={14} /> Email
        </Button>
      </a>
      <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="ghost" size={compact ? "sm" : "md"}>
          <Camera size={14} /> {CONTACT.instagramHandle}
        </Button>
      </a>
    </div>
  );
}
