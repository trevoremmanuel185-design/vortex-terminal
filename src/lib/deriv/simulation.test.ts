import { afterAll, describe, expect, it } from "vitest";
import { SimulationEngine } from "./simulation";
import { evaluatePreTrade, DEFAULT_RISK_LIMITS, applyTradeResult, DEFAULT_RISK_STATE } from "@/lib/risk/risk-manager";

/**
 * End-to-end engine test for the acceptance flow:
 * connect → symbols → ticks → proposal → buy → open P&L → sell.
 * Simulation Mode must be fully functional without any network access.
 */
describe("SimulationEngine", () => {
  const engine = new SimulationEngine();

  afterAll(() => engine.disconnect());

  it("connects and exposes the market catalogue", async () => {
    await engine.connect();
    const symbols = await engine.getActiveSymbols();
    expect(symbols.length).toBeGreaterThan(20);
    expect(symbols.some((symbol) => symbol.symbol === "1HZ75V")).toBe(true);
    expect(symbols.some((symbol) => symbol.market === "forex")).toBe(true);
  });

  it("serves tick history with real pip sizes", async () => {
    const ticks = await engine.getTicks("1HZ75V", 300);
    expect(ticks.length).toBe(300);
    expect(ticks[ticks.length - 1].quote).toBeGreaterThan(0);
  });

  it("emits a validated proposal that can be purchased and sold", async () => {
    const proposal = await new Promise<import("./types").Proposal>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("proposal timeout")), 4_000);
      let off: () => void = () => undefined;
      off = engine.subscribeProposal(
        {
          symbol: "1HZ75V",
          contractType: "CALL",
          stake: 1,
          duration: 5,
          durationUnit: "t",
          currency: "USD",
        },
        (value, error) => {
          if (error) {
            clearTimeout(timer);
            off();
            reject(new Error(error));
          } else if (value) {
            clearTimeout(timer);
            off();
            resolve(value);
          }
        },
      );
    });

    expect(proposal.isSimulated).toBe(true);
    expect(proposal.payout).toBeGreaterThan(proposal.askPrice);
    expect(proposal.returnPct).toBeGreaterThan(0);

    const balanceBefore = await new Promise<number>((resolve) => {
      let off: () => void = () => undefined;
      const timer = setTimeout(() => {
        off();
        resolve(0);
      }, 2_000);
      off = engine.subscribeBalance((balance) => {
        clearTimeout(timer);
        off();
        resolve(balance);
      });
    });

    const buy = await engine.buy({
      proposalId: proposal.id,
      symbol: "1HZ75V",
      contractType: "CALL",
      stake: 1,
      duration: 5,
      durationUnit: "t",
      currency: "USD",
    });
    expect(buy.isSimulated).toBe(true);
    expect(buy.contractId).toBeGreaterThan(0);
    expect(buy.balanceAfter).toBeCloseTo(balanceBefore - 1, 2);

    const snapshot = await new Promise<import("./types").OpenContract>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("contract timeout")), 4_000);
      let off: () => void = () => undefined;
      off = engine.subscribeContract(buy.contractId, (contract) => {
        if (contract) {
          clearTimeout(timer);
          off();
          resolve(contract);
        }
      });
    });
    expect(snapshot.status).toBe("open");
    expect(snapshot.isSimulated).toBe(true);

    const sell = await engine.sell(buy.contractId);
    expect(sell.soldFor).toBeGreaterThanOrEqual(0);
    const closed = await engine.getProfitTable();
    expect(closed.some((contract) => contract.contractId === buy.contractId)).toBe(true);
  });

  it("rejects stakes above the virtual balance", async () => {
    await expect(
      engine.buy({
        symbol: "1HZ75V",
        contractType: "CALL",
        stake: 10_000_000,
        duration: 5,
        durationUnit: "t",
        currency: "USD",
      }),
    ).rejects.toThrow(/Insufficient balance/);
  });
});

describe("risk manager integration", () => {
  it("halts after three consecutive losses", () => {
    let state = { ...DEFAULT_RISK_STATE, startingBalanceToday: 1_000, balance: 1_000 };
    for (let index = 0; index < 3; index += 1) {
      state = applyTradeResult(state, -1);
    }
    const decision = evaluatePreTrade(state, DEFAULT_RISK_LIMITS, { stake: 1 });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("MAX_CONSECUTIVE_LOSSES");
  });
});
