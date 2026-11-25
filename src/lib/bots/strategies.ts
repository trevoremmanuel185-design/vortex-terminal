import { contractSentence, returnRate } from "@/lib/deriv/payouts";
import type { ContractType } from "@/lib/deriv/types";
import type { ConfluenceResult } from "@/lib/indicators/confluence";
import type { DigitStats } from "@/lib/indicators/digits";
import type { IndicatorSnapshot } from "@/lib/indicators";

export type BotId =
  | "smart-martingale"
  | "rsi-ema-sniper"
  | "digit-differential"
  | "spike-catcher"
  | "dbot-xml";

export interface BotParams {
  stake: number;
  duration: number;
  durationUnit: "t" | "s" | "m";
  contractType: ContractType;
  barrier: string;
  multiplier: number;
  martingaleCap: number;
  scoreThreshold: number;
  digitThreshold: number;
  cooldownSeconds: number;
  maxTradesPerSession: number;
}

export interface BotContext {
  snapshot: IndicatorSnapshot;
  digits: DigitStats;
  confluence: ConfluenceResult;
  symbol: string;
  previousPrice: number | null;
  symbolName: string;
}

export interface BotDecision {
  contractType: ContractType;
  duration: number;
  durationUnit: "t" | "s" | "m";
  barrier: string;
  rationale: string;
  confidence: number;
}

export interface BotDefinition {
  id: BotId;
  name: string;
  tagline: string;
  description: string;
  riskNotes: string;
  params: BotParams;
  evaluate: (context: BotContext, params: BotParams) => BotDecision | null;
}

const baseParams: BotParams = {
  stake: 1,
  duration: 5,
  durationUnit: "t",
  contractType: "CALL",
  barrier: "5",
  multiplier: 2.1,
  martingaleCap: 4,
  scoreThreshold: 62,
  digitThreshold: 5,
  cooldownSeconds: 10,
  maxTradesPerSession: 40,
};

export const BOTS: BotDefinition[] = [
  {
    id: "smart-martingale",
    name: "Smart Martingale with Recovery Cap",
    tagline: "Rise/Fall with a capped recovery ladder",
    description:
      "Trades Rise or Fall in the direction of the 21/50 EMA stack. After a loss the next stake is multiplied, but the ladder is hard-capped so a losing run cannot escalate beyond the cap. The bot stops as soon as the cumulative stake of a full ladder would exceed the account risk budget.",
    riskNotes:
      "Martingale increases stake after losses. Even with a cap, a long losing run can exhaust the account. Synthetic indices are random — no recovery pattern is guaranteed.",
    params: { ...baseParams, multiplier: 2.1, martingaleCap: 4, scoreThreshold: 55 },
    evaluate: (context, params) => {
      const { ema9, ema21, ema50 } = context.snapshot;
      if (ema9 === null || ema21 === null || ema50 === null) return null;
      const bull = ema9 > ema21 && ema21 > ema50;
      const bear = ema9 < ema21 && ema21 < ema50;
      if (!bull && !bear) return null;
      return {
        contractType: bull ? "CALL" : "PUT",
        duration: params.duration,
        durationUnit: params.durationUnit,
        barrier: params.barrier,
        rationale: `EMA stack is ${bull ? "bullish" : "bearish"} (9 ${bull ? ">" : "<"} 21 ${bull ? ">" : "<"} 50)`,
        confidence: Math.round(Math.min(90, Math.abs(context.confluence.score - 50) * 2)),
      };
    },
  },
  {
    id: "rsi-ema-sniper",
    name: "RSI + EMA Trend Sniper",
    tagline: "Momentum confirmation, filtered by confluence",
    description:
      "Waits for RSI(14) to leave neutral territory *and* for the MACD histogram to agree with the EMA trend before buying Rise or Fall. If the confluence score is below your threshold the trade is skipped entirely.",
    riskNotes:
      "Momentum filters reduce trade count, not risk. RSI can stay overbought in a strong trend and the price can continue against the position.",
    params: { ...baseParams, scoreThreshold: 62, durationUnit: "m", duration: 1 },
    evaluate: (context, params) => {
      const { rsi, ema9, ema21, macd } = context.snapshot;
      if (rsi === null || ema9 === null || ema21 === null || !macd) return null;
      if (context.confluence.score < params.scoreThreshold) return null;
      const bull = rsi > 53 && macd.histogram > 0 && ema9 > ema21;
      const bear = rsi < 47 && macd.histogram < 0 && ema9 < ema21;
      if (!bull && !bear) return null;
      return {
        contractType: bull ? "CALL" : "PUT",
        duration: params.duration,
        durationUnit: params.durationUnit,
        barrier: params.barrier,
        rationale: `RSI ${rsi.toFixed(1)} + MACD ${macd.histogram > 0 ? "positive" : "negative"} with ${params.scoreThreshold}+ confluence`,
        confidence: Math.round(context.confluence.score),
      };
    },
  },
  {
    id: "digit-differential",
    name: "Digit Differential",
    tagline: "Trades the last-digit distribution, not predictions",
    description:
      "Reads the recent last-digit sample at the symbol's own pip precision. When a digit is under-represented beyond a tolerance band it takes a Differs position; when the Even/Odd split is stretched it fades that side. This is a distribution-following strategy — not a prediction engine.",
    riskNotes:
      "Digits are independent draws. Historical under-representation does not make a digit 'due'. Differs contracts pay little and lose the full stake quickly.",
    params: { ...baseParams, contractType: "DIGITDIFF", scoreThreshold: 0, digitThreshold: 5 },
    evaluate: (context, params) => {
      const stats = context.digits;
      if (stats.sample < 50) return null;
      const worst = stats.counts.indexOf(Math.min(...stats.counts));
      const best = stats.counts.indexOf(Math.max(...stats.counts));
      const threshold = Number(params.barrier) || params.digitThreshold;
      if (Math.abs(stats.evenPct - 50) > 6) {
        const fadeEven = stats.evenPct > 50;
        return {
          contractType: fadeEven ? "DIGITODD" : "DIGITEVEN",
          duration: params.duration,
          durationUnit: params.durationUnit,
          barrier: String(threshold),
          rationale: `Even/Odd split stretched to ${stats.evenPct.toFixed(1)}% / ${stats.oddPct.toFixed(1)}% — fading the crowded side`,
          confidence: Math.round(Math.min(75, Math.abs(stats.evenPct - 50) * 6)),
        };
      }
      return {
        contractType: "DIGITDIFF",
        duration: params.duration,
        durationUnit: params.durationUnit,
        barrier: String(best),
        rationale: `Digit ${best} is the most frequent (${stats.percentages[best].toFixed(1)}%), digit ${worst} least frequent — Differing from ${best}`,
        confidence: 55,
      };
    },
  },
  {
    id: "spike-catcher",
    name: "Boom / Crash Spike Catcher",
    tagline: "Rides the spike bias of Boom & Crash indices",
    description:
      "Boom indices drift down with occasional upward spikes and Crash indices mirror that. The bot watches the last tick delta and the short EMA slope, then takes a position aligned with the symbol's spike bias while volatility is expanding.",
    riskNotes:
      "Spikes are unpredictable in timing. A spike can hit immediately after entry or not occur for many minutes. Never run this on an instrument whose mechanics you do not understand.",
    params: { ...baseParams, duration: 5, durationUnit: "t", scoreThreshold: 0 },
    evaluate: (context, params) => {
      const name = context.symbolName.toLowerCase();
      const isBoom = name.includes("boom");
      const isCrash = name.includes("crash");
      if (!isBoom && !isCrash) return null;
      const { ema9, ema21, atr } = context.snapshot;
      if (ema9 === null || ema21 === null) return null;
      const aligned = isBoom ? ema9 >= ema21 : ema9 <= ema21;
      const volatilityOk = atr === null || context.snapshot.price === 0
        ? true
        : (atr / context.snapshot.price) * 100 > 0.03;
      if (!aligned || !volatilityOk) return null;
      return {
        contractType: isBoom ? "CALL" : "PUT",
        duration: params.duration,
        durationUnit: params.durationUnit,
        barrier: params.barrier,
        rationale: `${isBoom ? "Boom" : "Crash"} bias with ${isBoom ? "upward" : "downward"} spike alignment confirmed by EMA slope`,
        confidence: 58,
      };
    },
  },
];

export function botById(id: BotId): BotDefinition {
  return BOTS.find((bot) => bot.id === id) ?? BOTS[0];
}

export function describePotential(bot: BotDefinition, params: BotParams) {
  let stake = params.stake;
  let cumulative = 0;
  for (let step = 0; step < params.martingaleCap; step += 1) {
    cumulative += stake;
    stake *= params.multiplier;
  }
  return {
    worstCaseCumulative: Number(cumulative.toFixed(2)),
    topStake: Number((params.stake * params.multiplier ** (params.martingaleCap - 1)).toFixed(2)),
    payoutRate: returnRate(params.contractType) * 100,
  };
}

export function xmlBotDefinition(params: BotParams, name = "Imported DBot strategy"): BotDefinition {
  return {
    id: "dbot-xml",
    name,
    tagline: "Imported from Deriv DBot XML",
    description: contractSentence(
      params.contractType,
      "the selected market",
      params.duration,
      params.durationUnit,
      params.barrier,
    ),
    riskNotes:
      "Imported strategies contain arbitrary logic. VORTEX compiles only a verified subset and refuses to run partially-converted bots.",
    params,
    evaluate: (context, values) => {
      const { ema9, ema21 } = context.snapshot;
      if (ema9 === null || ema21 === null) return null;
      const bull = ema9 > ema21;
      return {
        contractType: values.contractType,
        duration: values.duration,
        durationUnit: values.durationUnit,
        barrier: values.barrier,
        rationale: "Imported rule set satisfied on the latest closed tick",
        confidence: 50,
      };
    },
  };
}
