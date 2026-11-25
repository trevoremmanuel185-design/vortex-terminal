import type { Metadata } from "next";
import { SiteFooter, SiteHeader, WhatsAppFab } from "@/components/site/SiteChrome";
import { ContactSection } from "@/components/site/ContactSection";
import { CONTACT } from "@/lib/contact";
import { DisclaimerNote } from "@/components/ui/Primitives";

export const metadata: Metadata = {
  title: "Contact",
  description: `Talk to ${CONTACT.owner} about VORTEX TERMINAL: WhatsApp, calls, email or Instagram ${CONTACT.instagramHandle}.`,
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-obsidian">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pt-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald">Support</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Contact VORTEX</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Direct line to the builder. Product questions, risk-manager walkthroughs, XML import problems or a bug report —
          all go to the same place. Typical reply time: within a day (GMT+3).
        </p>
        <div className="mt-4 max-w-2xl">
          <DisclaimerNote>
            Never share your Deriv API token, password or one-time codes. VORTEX support will never ask for them. If
            someone does, it is not us.
          </DisclaimerNote>
        </div>
      </main>
      <ContactSection heading="Send a message" />
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
