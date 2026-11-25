import type { IndicatorSnapshot } from "./index";

export type SignalLabel = "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL";

export interface ComponentScore {
  id: "trend" | "momentum" | "volatility" | "agreement";
  label: string;
  raw: number; // -1 … +1
  weight: number;
  contribution: number; // points added to the 0–100 score
  detail: string;
}

export interface ConfluenceResult {
  score: number; // 0–100
  label: SignalLabel;
  bias: "up" | "down" | "flat";
  components: ComponentScore[];
  caveat: string;
  computedAt: number;
}

export const CONFLUENCE_CAVEAT =
  "Indicators describe past price behaviour and do not predict future results. Synthetic indices are random by design.";

const WEIGHTS = { trend: 0.35, momentum: 0.3, volatility: 0.15, agreement: 0.2 } as const;

export function labelForScore(score: number): SignalLabel {
  if (score >= 72) return "STRONG BUY";
  if (score >= 56) return "BUY";
  if (score > 44) return "NEUTRAL";
  if (score > 28) return "SELL";
  return "STRONG SELL";
}

interface AgreementInput {
  tf: string;
  direction: 1 | -1 | 0;
}

/**
 * Indicator confluence — an explicitly *descriptive* composite. Never call this
 * accuracy or win probability: it measures how aligned four indicator families
 * are right now, not the odds of the next tick.
 */
export function computeConfluence(
  snapshot: IndicatorSnapshot,
  agreement: AgreementInput[] = [],
): ConfluenceResult {
  const details: ComponentScore[] = [];

  // ── Trend: EMA stack alignment ───────────────────────────────────
  let trendRaw = 0;
  const { ema9, ema21, ema50, ema200, price } = snapshot;
  if (ema9 !== null && ema21 !== null) {
    trendRaw += ema9 > ema21 ? 0.34 : -0.34;
  }
  if (ema21 !== null && ema50 !== null) {
    trendRaw += ema21 > ema50 ? 0.33 : -0.33;
  }
  if (ema50 !== null && ema200 !== null) {
    trendRaw += ema50 > ema200 ? 0.33 : -0.33;
  }
  if (ema200 !== null && price) {
    trendRaw += price > ema200 ? 0.1 : -0.1;
  }
  trendRaw = Math.max(-1, Math.min(1, trendRaw));
  const stack =
    ema9 !== null && ema21 !== null && ema50 !== null
      ? ema9 > ema21 && ema21 > ema50
        ? "bullish stack (9 > 21 > 50)"
        : ema9 < ema21 && ema21 < ema50
          ? "bearish stack (9 < 21 < 50)"
          : "EMAs interleaved"
      : "warming up";
  details.push({
    id: "trend",
    label: "Trend · EMA alignment",
    raw: trendRaw,
    weight: WEIGHTS.trend,
    contribution: trendRaw * WEIGHTS.trend * 100,
    detail: stack,
  });

  // ── Momentum: RSI + MACD histogram ───────────────────────────────
  let momentumRaw = 0;
  const momentumNotes: string[] = [];
  if (snapshot.rsi !== null) {
    const rsi = snapshot.rsi;
    const rsiComponent = Math.max(-1, Math.min(1, (rsi - 50) / 22));
    momentumRaw += rsiComponent * 0.55;
    momentumNotes.push(`RSI ${rsi.toFixed(1)}`);
  }
  if (snapshot.macd) {
    const { macd, histogram } = snapshot.macd;
    const scale = Math.abs(macd) > 0 ? Math.abs(macd) : 1e-9;
    const macdComponent = Math.max(-1, Math.min(1, histogram / (scale * 1.5)));
    momentumRaw += macdComponent * 0.45;
    momentumNotes.push(`MACD hist ${histogram >= 0 ? "+" : ""}${histogram.toFixed(4)}`);
  }
  momentumRaw = Math.max(-1, Math.min(1, momentumRaw));
  details.push({
    id: "momentum",
    label: "Momentum · RSI / MACD",
    raw: momentumRaw,
    weight: WEIGHTS.momentum,
    contribution: momentumRaw * WEIGHTS.momentum * 100,
    detail: momentumNotes.join(" · ") || "warming up",
  });

  // ── Volatility: band position & ATR expansion ────────────────────
  let volatilityRaw = 0;
  let volatilityNote = "bands warming up";
  if (snapshot.bb) {
    const { upper, middle, lower } = snapshot.bb;
    const halfRange = Math.max(upper - middle, 1e-9);
    const position = Math.max(-1, Math.min(1, (snapshot.price - middle) / halfRange));
    volatilityRaw = position * 0.6;
    volatilityNote = `Price at ${(((position + 1) / 2) * 100).toFixed(0)}% of band`;
  }
  if (snapshot.atr && snapshot.price > 0) {
    const atrPct = (snapshot.atr / snapshot.price) * 100;
    const expansion = Math.max(-1, Math.min(1, (atrPct - 0.05) / 0.25));
    volatilityRaw += expansion * 0.4 * Math.sign(volatilityRaw || 1);
    volatilityNote += ` · ATR ${atrPct.toFixed(3)}%`;
  }
  volatilityRaw = Math.max(-1, Math.min(1, volatilityRaw));
  details.push({
    id: "volatility",
    label: "Volatility · BB / ATR",
    raw: volatilityRaw,
    weight: WEIGHTS.volatility,
    contribution: volatilityRaw * WEIGHTS.volatility * 100,
    detail: volatilityNote,
  });

  // ── Agreement: 1m / 5m / 15m structure ──────────────────────────
  const active = agreement.filter((tf) => tf.direction !== 0);
  const agreementRaw =
    agreement.length > 0 ? active.reduce((sum, tf) => sum + tf.direction, 0) / agreement.length : 0;
  details.push({
    id: "agreement",
    label: "Multi-timeframe agreement",
    raw: agreementRaw,
    weight: WEIGHTS.agreement,
    contribution: agreementRaw * WEIGHTS.agreement * 100,
    detail:
      agreement.length > 0
        ? agreement.map((tf) => `${tf.tf}:${tf.direction > 0 ? "▲" : tf.direction < 0 ? "▼" : "="}`).join("  ")
        : "1m / 5m / 15m unavailable",
  });

  const total = details.reduce((sum, part) => sum + part.contribution, 0);
  const score = Math.round(Math.max(0, Math.min(100, 50 + total)));
  const label = labelForScore(score);
  return {
    score,
    label,
    bias: score > 54 ? "up" : score < 46 ? "down" : "flat",
    components: details,
    caveat: CONFLUENCE_CAVEAT,
    computedAt: Date.now(),
  };
}
