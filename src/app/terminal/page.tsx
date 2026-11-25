import type { Metadata } from "next";
import { TerminalShell } from "@/components/terminal/TerminalShell";

export const metadata: Metadata = {
  title: "Trading terminal",
  description:
    "VORTEX TERMINAL workspace: Deriv charts, digit matrix, indicator confluence, risk-managed bots, ledger and journal.",
};

export default function TerminalPage() {
  return <TerminalShell />;
}
