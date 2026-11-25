"use client";

export interface SignalInput {
  symbol: string;
  direction: string;
  score: number;
  label: string;
  price: number;
  source: "manual" | "bot";
  simulated: boolean;
  components: { id: string; contribution: number }[];
}

/**
 * Signal audit trail. Stored server-side so the measured hit-rate survives a
 * reload and can be inspected honestly (wins and losses are never truncated).
 */
export async function recordSignal(input: SignalInput): Promise<number | null> {
  try {
    const response = await fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { id?: number };
    return typeof json.id === "number" ? json.id : null;
  } catch {
    return null;
  }
}

export async function resolveSignal(id: number, outcome: "hit" | "miss") {
  try {
    await fetch("/api/signals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, outcome }),
    });
  } catch {
    /* audit trail is best-effort */
  }
}
