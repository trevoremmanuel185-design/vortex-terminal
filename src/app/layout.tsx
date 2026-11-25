import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PwaRegister } from "@/components/system/PwaRegister";

export const metadata: Metadata = {
  metadataBase: new URL("https://vortex-terminal.app"),
  title: {
    default: "VORTEX TERMINAL — Trade with precision.",
    template: "%s · VORTEX TERMINAL",
  },
  description:
    "Institutional-grade Deriv analytics terminal: live charts, digit analytics, indicator confluence, risk-managed bots, backtesting and an honest signal audit. Demo-first.",
  applicationName: "VORTEX TERMINAL",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "VORTEX TERMINAL — Trade with precision.",
    description:
      "A dark, precision-focused Deriv trading workspace with a mandatory risk manager and an honest signal audit.",
    type: "website",
    images: [{ url: "/logo.svg", width: 256, height: 256, alt: "VORTEX TERMINAL" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07090e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-screen bg-obsidian text-ink antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
