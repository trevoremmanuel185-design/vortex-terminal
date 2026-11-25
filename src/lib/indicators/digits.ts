import { lastDigit } from "@/lib/utils";

export interface DigitStats {
  sample: number;
  counts: number[];
  percentages: number[];
  evenPct: number;
  oddPct: number;
  matchPct: number;
  differPct: number;
  overPct: number;
  underPct: number;
  threshold: number;
  hot: number[];
  cold: number[];
  evenStreak: number;
  oddStreak: number;
  matchStreak: number;
  differStreak: number;
  maxEvenStreak: number;
  maxOddStreak: number;
  expectedPct: number;
  chiSquare: number;
}

export interface DigitStreaks {
  even: number;
  odd: number;
  match: number;
  differ: number;
  maxEven: number;
  maxOdd: number;
  maxMatch: number;
  maxDiffer: number;
}

export function digitsFromTicks(quotes: number[], pipSize: number): number[] {
  return quotes.map((quote) => lastDigit(quote, pipSize));
}

export function streakCounters(digits: number[], target = 5): DigitStreaks {
  let even = 0;
  let odd = 0;
  let match = 0;
  let differ = 0;
  let maxEven = 0;
  let maxOdd = 0;
  let maxMatch = 0;
  let maxDiffer = 0;
  for (const digit of digits) {
    if (digit % 2 === 0) {
      even += 1;
      maxEven = Math.max(maxEven, even);
      odd = 0;
    } else {
      odd += 1;
      maxOdd = Math.max(maxOdd, odd);
      even = 0;
    }
    if (digit === target) {
      match += 1;
      maxMatch = Math.max(maxMatch, match);
      differ = 0;
    } else {
      differ += 1;
      maxDiffer = Math.max(maxDiffer, differ);
      match = 0;
    }
  }
  return { even, odd, match, differ, maxEven, maxOdd, maxMatch, maxDiffer };
}

/**
 * Last-digit distribution. Synthetic index digits are independent draws —
 * the UI shows these as descriptive statistics only, never as a forecast.
 */
export function digitStats(digits: number[], threshold = 5): DigitStats {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const digit of digits) {
    if (digit >= 0 && digit <= 9) counts[digit] += 1;
  }
  const sample = counts.reduce((a, b) => a + b, 0);
  const percentages = counts.map((count) => (sample ? (count / sample) * 100 : 0));
  const even = counts.reduce((sum, count, digit) => (digit % 2 === 0 ? sum + count : sum), 0);
  const odd = sample - even;
  const matches = counts[threshold] ?? 0;
  const differs = sample - matches;
  const over = counts.reduce((sum, count, digit) => (digit > threshold ? sum + count : sum), 0);
  const under = sample - over;
  const expected = sample / 10;
  const chiSquare = sample === 0
    ? 0
    : counts.reduce((sum, count) => sum + ((count - expected) ** 2) / expected, 0);
  const ranked = counts
    .map((count, digit) => ({ count, digit }))
    .sort((a, b) => b.count - a.count);
  const streaks = streakCounters(digits, threshold);

  return {
    sample,
    counts,
    percentages,
    evenPct: sample ? (even / sample) * 100 : 0,
    oddPct: sample ? (odd / sample) * 100 : 0,
    matchPct: sample ? (matches / sample) * 100 : 0,
    differPct: sample ? (differs / sample) * 100 : 0,
    overPct: sample ? (over / sample) * 100 : 0,
    underPct: sample ? (under / sample) * 100 : 0,
    threshold,
    hot: ranked.slice(0, 2).map((entry) => entry.digit),
    cold: ranked.slice(-2).map((entry) => entry.digit),
    evenStreak: streaks.even,
    oddStreak: streaks.odd,
    matchStreak: streaks.match,
    differStreak: streaks.differ,
    maxEvenStreak: streaks.maxEven,
    maxOddStreak: streaks.maxOdd,
    expectedPct: 10,
    chiSquare,
  };
}

/** Empirical frequency table used for statistical literacy notes. */
export function digitDistributionLabel(chiSquare: number, sample: number, df = 9): string {
  if (sample < 100) return "Sample too small for a meaningful comparison";
  const critical = 16.92; // p = 0.05, df = 9
  return chiSquare > critical
    ? "Sample deviates from uniform at the 5% level (can be normal noise)"
    : "Consistent with a uniform 10% distribution";
}
