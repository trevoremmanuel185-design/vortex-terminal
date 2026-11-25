import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Extracts the last digit at the instrument's real pip precision. */
export function lastDigit(quote: number, pipSize: number): number {
  const decimals = Math.max(0, Math.round(-Math.log10(pipSize || 0.01)));
  const scaled = Math.round(quote * Math.pow(10, decimals));
  return Math.abs(scaled) % 10;
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 2,
  options: { sign?: boolean; compact?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const { sign = false, compact = false } = options;
  const abs = Math.abs(value);
  const formatted = compact && abs >= 1000
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(abs)
    : abs.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  if (value < 0) return `-${formatted}`;
  return sign ? `+${formatted}` : formatted;
}

export function formatCurrency(value: number, currency = "USD", decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${formatNumber(value, decimals)} ${currency}`;
  }
}

export function formatTime(epochSeconds: number, withSeconds = true): string {
  if (!epochSeconds) return "—";
  const d = new Date(epochSeconds * 1000);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  });
}

export function formatDateTime(epochSeconds: number): string {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function timeAgo(epochMs: number): string {
  const diff = Math.max(0, Date.now() - epochMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Box–Muller normal sample, used by the simulation + backtester. */
export function gaussian(mean = 0, sd = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function toNumber(value: string | number, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export interface TradeStats {
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdown: number;
  equityCurve: { time: number; value: number }[];
  longestLossStreak: number;
}

export interface StatsTrade {
  profit: number;
  sellTime?: number;
  purchaseTime?: number;
}

export function computeStats(trades: StatsTrade[], startingBalance = 0): TradeStats {
  const sorted = [...trades].sort(
    (a, b) => (a.sellTime ?? a.purchaseTime ?? 0) - (b.sellTime ?? b.purchaseTime ?? 0),
  );
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let equity = startingBalance;
  let peak = startingBalance;
  let maxDrawdown = 0;
  let streak = 0;
  let longestLossStreak = 0;
  const equityCurve: { time: number; value: number }[] = [];

  for (const trade of sorted) {
    if (trade.profit > 0) {
      wins += 1;
      grossProfit += trade.profit;
      streak = 0;
    } else if (trade.profit < 0) {
      losses += 1;
      grossLoss += Math.abs(trade.profit);
      streak += 1;
      longestLossStreak = Math.max(longestLossStreak, streak);
    }
    equity += trade.profit;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    equityCurve.push({
      time: Math.round(trade.sellTime ?? trade.purchaseTime ?? Date.now() / 1000),
      value: Number(equity.toFixed(2)),
    });
  }

  const count = wins + losses;
  return {
    count,
    wins,
    losses,
    winRate: count ? (wins / count) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    expectancy: count ? (grossProfit - grossLoss) / count : 0,
    avgWin: wins ? grossProfit / wins : 0,
    avgLoss: losses ? grossLoss / losses : 0,
    netProfit: grossProfit - grossLoss,
    grossProfit,
    grossLoss,
    maxDrawdown,
    equityCurve,
    longestLossStreak,
  };
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
