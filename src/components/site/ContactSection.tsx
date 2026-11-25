"use client";

import { useState } from "react";
import { Camera, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui/Primitives";
import { CONTACT, emailMessageHref, whatsappMessageHref } from "@/lib/contact";

export function ContactSection({ heading = "Talk to a human" }: { heading?: string }) {
  const [form, setForm] = useState({ name: "", email: "", topic: "Terminal support", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const composed = `Hi Trevor,\n\n${form.message}\n\n— ${form.name || "A VORTEX trader"} (${form.email || "no email provided"})\nTopic: ${form.topic}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(response.ok ? "sent" : "error");
      if (response.ok) {
        window.open(whatsappMessageHref(composed), "_blank", "noopener,noreferrer");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="contact" className="border-t border-hairline bg-obsidian-2/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald">Contact</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{heading}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            Questions about the terminal, a bug report, or a walkthrough of the risk manager? Reach Trevor directly —
            calls, WhatsApp, email or Instagram. No support tickets, no bots.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm">
            <li>
              <a
                href={whatsappMessageHref("Hi Trevor — I'd like help with VORTEX TERMINAL.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-emerald"
              >
                <span className="rounded-md border border-emerald/30 bg-emerald/10 p-1.5 text-emerald"><MessageCircle size={14} /></span>
                {CONTACT.phoneDisplay} <span className="text-[10px] uppercase tracking-wider text-ink-faint">WhatsApp</span>
              </a>
            </li>
            <li>
              <a href={CONTACT.phoneHref} className="inline-flex items-center gap-2 text-ink-muted hover:text-emerald">
                <span className="rounded-md border border-hairline bg-panel-2 p-1.5"><Phone size={14} /></span>
                {CONTACT.phoneDisplay} <span className="text-[10px] uppercase tracking-wider text-ink-faint">Calls</span>
              </a>
            </li>
            <li>
              <a href={CONTACT.emailHref} className="inline-flex items-center gap-2 break-all text-ink-muted hover:text-emerald">
                <span className="rounded-md border border-hairline bg-panel-2 p-1.5"><Mail size={14} /></span>
                {CONTACT.email}
              </a>
            </li>
            <li>
              <a
                href={CONTACT.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-ink-muted hover:text-cyan"
              >
                <span className="rounded-md border border-hairline bg-panel-2 p-1.5"><Camera size={14} /></span>
                {CONTACT.instagramHandle}
                <span className="rounded-full border border-cyan/40 bg-cyan/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan">
                  Verified
                </span>
              </a>
            </li>
            <li className="inline-flex items-center gap-2 text-ink-faint">
              <span className="rounded-md border border-hairline bg-panel-2 p-1.5"><MapPin size={14} /></span>
              Kampala, Uganda · GMT+3 · replies within a day
            </li>
          </ul>
          <p className="mt-4 rounded-lg border border-hairline bg-panel-2/60 p-3 text-[11px] leading-relaxed text-ink-faint">
            Never send API tokens, passwords or brokerage credentials over WhatsApp, Instagram or email. VORTEX will
            never ask for them.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-hairline bg-panel/80 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your name" htmlFor="contact-name">
              <input
                id="contact-name"
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
                placeholder="Ada Lovelace"
                autoComplete="name"
              />
            </Field>
            <Field label="Email" htmlFor="contact-email">
              <input
                id="contact-email"
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClass}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Topic" htmlFor="contact-topic">
              <select
                id="contact-topic"
                value={form.topic}
                onChange={(event) => setForm({ ...form, topic: event.target.value })}
                className={inputClass}
              >
                {["Terminal support", "Bot / XML import", "Risk settings", "Partnership", "Something else"].map((topic) => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Message" htmlFor="contact-message" hint="Submitting opens WhatsApp with your message pre-filled. Email works too — no account needed.">
              <textarea
                id="contact-message"
                required
                minLength={5}
                rows={4}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                className="w-full rounded-lg border border-hairline bg-obsidian/70 px-2.5 py-2 text-xs text-ink outline-none focus:border-cyan/60"
                placeholder="Tell me what you're trying to do…"
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" loading={status === "sending"}>
              <Send size={14} /> Send & open WhatsApp
            </Button>
            <a href={emailMessageHref(`VORTEX TERMINAL · ${form.topic}`, composed)}>
              <Button type="button" variant="secondary">
                <Mail size={14} /> Send by email
              </Button>
            </a>
          </div>
          {status === "sent" ? (
            <p className="mt-3 rounded-md border border-emerald/30 bg-emerald/10 px-2 py-1.5 text-[11px] text-emerald">
              Message logged. WhatsApp should open in a new tab — if it was blocked, use the buttons above.
            </p>
          ) : null}
          {status === "error" ? (
            <p className="mt-3 rounded-md border border-crimson/30 bg-crimson/10 px-2 py-1.5 text-[11px] text-crimson">
              Could not save the message, but you can still reach Trevor on WhatsApp or email.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}

export default ContactSection;
