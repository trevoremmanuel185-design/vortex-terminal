"use client";

import { LiveDerivEngine } from "@/lib/deriv/live-engine";
import { SimulationEngine } from "@/lib/deriv/simulation";
import type { ProposalRequest, TradingEngine } from "@/lib/deriv/types";

let simulation: SimulationEngine | null = null;
let live: LiveDerivEngine | null = null;

export function getSimulationEngine(): SimulationEngine {
  if (!simulation) simulation = new SimulationEngine();
  return simulation;
}

export function getLiveEngine(): LiveDerivEngine {
  if (!live) live = new LiveDerivEngine();
  return live;
}

export function getEngine(kind: "live" | "simulation"): TradingEngine {
  return kind === "live" ? getLiveEngine() : getSimulationEngine();
}

/** Resolves the first proposal a subscribing engine emits (for bot orders). */
export function fetchProposal(
  engine: TradingEngine,
  request: ProposalRequest,
  timeoutMs = 6_000,
): Promise<{ proposal: import("@/lib/deriv/types").Proposal | null; error?: string }> {
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe: () => void = () => undefined;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      unsubscribe();
      resolve({ proposal: null, error: "Proposal request timed out" });
    }, timeoutMs);
    unsubscribe = engine.subscribeProposal(request, (proposal, error) => {
      if (done) return;
      if (error) {
        done = true;
        clearTimeout(timer);
        unsubscribe();
        resolve({ proposal: null, error });
        return;
      }
      if (proposal) {
        done = true;
        clearTimeout(timer);
        unsubscribe();
        resolve({ proposal });
      }
    });
  });
}
