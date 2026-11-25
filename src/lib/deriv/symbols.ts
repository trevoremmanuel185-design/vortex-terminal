import type { SymbolInfo } from "./types";

/**
 * Fallback catalogue used by Simulation Mode and while the live
 * `active_symbols` response is in flight. The terminal always prefers the live
 * feed when a token is connected.
 */
type CatalogEntry = Omit<SymbolInfo, "open" | "exchangeClosed">;

const entry = (
  symbol: string,
  displayName: string,
  market: string,
  marketDisplay: string,
  submarket: string,
  pipSize: number,
  decimals: number,
  basePrice: number,
): CatalogEntry => ({
  symbol,
  displayName,
  market,
  marketDisplay,
  submarket,
  pipSize,
  decimals,
  basePrice,
});

export const SYMBOL_CATALOG: CatalogEntry[] = [
  // ── Synthetics · Continuous Indices ───────────────────────────────
  entry("R_10", "Volatility 10 Index", "synthetic_index", "Synthetics", "Continuous Indices", 0.001, 3, 6842.12),
  entry("R_25", "Volatility 25 Index", "synthetic_index", "Synthetics", "Continuous Indices", 0.001, 3, 3421.55),
  entry("R_50", "Volatility 50 Index", "synthetic_index", "Synthetics", "Continuous Indices", 0.0001, 4, 248.7213),
  entry("R_75", "Volatility 75 Index", "synthetic_index", "Synthetics", "Continuous Indices", 0.0001, 4, 98765.4321),
  entry("R_100", "Volatility 100 Index", "synthetic_index", "Synthetics", "Continuous Indices", 0.01, 2, 1521.34),
  // ── Synthetics · 1-second indices ─────────────────────────────────
  entry("1HZ10V", "Volatility 10 (1s) Index", "synthetic_index", "Synthetics", "1s Indices", 0.01, 2, 9281.45),
  entry("1HZ25V", "Volatility 25 (1s) Index", "synthetic_index", "Synthetics", "1s Indices", 0.01, 2, 4128.66),
  entry("1HZ50V", "Volatility 50 (1s) Index", "synthetic_index", "Synthetics", "1s Indices", 0.01, 2, 289.14),
  entry("1HZ75V", "Volatility 75 (1s) Index", "synthetic_index", "Synthetics", "1s Indices", 0.01, 2, 1204.37),
  entry("1HZ100V", "Volatility 100 (1s) Index", "synthetic_index", "Synthetics", "1s Indices", 0.01, 2, 683.19),
  // ── Synthetics · Boom / Crash ─────────────────────────────────────
  entry("BOOM300N", "Boom 300 Index", "synthetic_index", "Synthetics", "Boom/Crash", 0.001, 3, 9421.77),
  entry("BOOM500", "Boom 500 Index", "synthetic_index", "Synthetics", "Boom/Crash", 0.0001, 4, 11203.4421),
  entry("BOOM1000", "Boom 1000 Index", "synthetic_index", "Synthetics", "Boom/Crash", 0.0001, 4, 5432.8891),
  entry("CRASH300N", "Crash 300 Index", "synthetic_index", "Synthetics", "Boom/Crash", 0.001, 3, 3712.44),
  entry("CRASH500", "Crash 500 Index", "synthetic_index", "Synthetics", "Boom/Crash", 0.0001, 4, 8210.1145),
  entry("CRASH1000", "Crash 1000 Index", "synthetic_index", "Synthetics", "Boom/Crash", 0.0001, 4, 4102.7781),
  // ── Synthetics · Jump / Step / Range Break ────────────────────────
  entry("JD10", "Jump 10 Index", "synthetic_index", "Synthetics", "Jump Indices", 0.001, 3, 5124.33),
  entry("JD25", "Jump 25 Index", "synthetic_index", "Synthetics", "Jump Indices", 0.001, 3, 7288.91),
  entry("JD50", "Jump 50 Index", "synthetic_index", "Synthetics", "Jump Indices", 0.0001, 4, 312.4432),
  entry("JD75", "Jump 75 Index", "synthetic_index", "Synthetics", "Jump Indices", 0.0001, 4, 15422.7781),
  entry("JD100", "Jump 100 Index", "synthetic_index", "Synthetics", "Jump Indices", 0.01, 2, 2144.56),
  entry("stpRNG", "Step Index", "synthetic_index", "Synthetics", "Step Indices", 0.1, 1, 9012.4),
  entry("stpRNG2", "Step Index 200", "synthetic_index", "Synthetics", "Step Indices", 0.1, 1, 7445.2),
  entry("RDBEAR", "Range Break 100 Index", "synthetic_index", "Synthetics", "Range Break Indices", 0.001, 3, 2210.55),
  entry("RDBULL", "Range Break 200 Index", "synthetic_index", "Synthetics", "Range Break Indices", 0.001, 3, 1802.14),
  // ── Forex · majors / minors / exotics ─────────────────────────────
  entry("frxEURUSD", "EUR/USD", "forex", "Forex", "Major Pairs", 0.0001, 5, 1.08421),
  entry("frxGBPUSD", "GBP/USD", "forex", "Forex", "Major Pairs", 0.0001, 5, 1.26714),
  entry("frxUSDJPY", "USD/JPY", "forex", "Forex", "Major Pairs", 0.01, 3, 151.422),
  entry("frxAUDUSD", "AUD/USD", "forex", "Forex", "Major Pairs", 0.0001, 5, 0.65814),
  entry("frxUSDCAD", "USD/CAD", "forex", "Forex", "Major Pairs", 0.0001, 5, 1.35912),
  entry("frxUSDCHF", "USD/CHF", "forex", "Forex", "Major Pairs", 0.0001, 5, 0.88421),
  entry("frxNZDUSD", "NZD/USD", "forex", "Forex", "Major Pairs", 0.0001, 5, 0.60122),
  entry("frxEURGBP", "EUR/GBP", "forex", "Forex", "Minor Pairs", 0.0001, 5, 0.85561),
  entry("frxEURJPY", "EUR/JPY", "forex", "Forex", "Minor Pairs", 0.01, 3, 164.211),
  entry("frxGBPJPY", "GBP/JPY", "forex", "Forex", "Minor Pairs", 0.01, 3, 191.843),
  entry("frxUSDZAR", "USD/ZAR", "forex", "Forex", "Exotic Pairs", 0.0001, 5, 18.7124),
  entry("frxUSDTRY", "USD/TRY", "forex", "Forex", "Exotic Pairs", 0.0001, 5, 32.4181),
  entry("frxUSDNGN", "USD/NGN", "forex", "Forex", "Exotic Pairs", 0.0001, 5, 1412.55),
  // ── Commodities ───────────────────────────────────────────────────
  entry("frxXAUUSD", "Gold/USD", "commodities", "Commodities", "Metals", 0.01, 2, 2334.18),
  entry("frxXAGUSD", "Silver/USD", "commodities", "Commodities", "Metals", 0.001, 3, 27.412),
  entry("frxXPTUSD", "Platinum/USD", "commodities", "Commodities", "Metals", 0.01, 2, 944.66),
  entry("frxXPDUSD", "Palladium/USD", "commodities", "Commodities", "Metals", 0.01, 2, 1024.31),
  entry("frxBROUSD", "Oil/USD", "commodities", "Commodities", "Energy", 0.01, 2, 78.44),
];

export function fallbackSymbols(): SymbolInfo[] {
  return SYMBOL_CATALOG.map((s) => ({ ...s, open: true, exchangeClosed: false }));
}

export function symbolMeta(symbol: string): SymbolInfo {
  return (
    fallbackSymbols().find((s) => s.symbol === symbol) ?? {
      ...entry(symbol, symbol, "synthetic_index", "Synthetics", "Indices", 0.01, 2, 1000),
      open: true,
    }
  );
}

export const MARKET_ORDER = ["synthetic_index", "forex", "commodities", "indices", "crypto"] as const;

export const DEFAULT_SYMBOL = "1HZ75V";

export function decimalsForPip(pipSize: number): number {
  if (!Number.isFinite(pipSize) || pipSize <= 0) return 2;
  const s = pipSize.toFixed(10);
  const idx = s.indexOf(".");
  if (idx < 0) return 0;
  return s.slice(idx + 1).replace(/0+$/, "").length;
}
