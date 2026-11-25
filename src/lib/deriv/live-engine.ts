import { DERIV_CONFIG } from "./config";
import { derivSocket } from "./DerivSocketService";
import { contractSentence } from "./payouts";
import {
  authorizeMessageSchema,
  balanceMessageSchema,
  buyMessageSchema,
  openContractMessageSchema,
  profitTableMessageSchema,
  proposalMessageSchema,
  sellMessageSchema,
  tickMessageSchema,
  ticksHistoryMessageSchema,
  activeSymbolsMessageSchema,
} from "./schemas";
import { decimalsForPip } from "./symbols";
import type {
  AccountInfo,
  AuthorizeResult,
  BuyRequest,
  BuyResult,
  Candle,
  ClosedContract,
  ContractType,
  LatencyListener,
  OpenContract,
  Proposal,
  ProposalRequest,
  SellResult,
  StatusListener,
  SymbolInfo,
  Tick,
  TradingEngine,
} from "./types";

function normaliseScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((scope) => (typeof scope === "string" ? scope : (scope as { scope?: string })?.scope ?? ""))
    .map((scope) => scope.toLowerCase().trim())
    .filter(Boolean);
}

function scopePresent(scopes: string[], wanted: string): boolean {
  return scopes.some((scope) => scope === wanted || scope === "admin");
}

export class LiveDerivEngine implements TradingEngine {
  readonly kind = "live" as const;
  private socket = derivSocket;
  private pipSizes = new Map<string, number>();

  onStatus(cb: StatusListener): () => void {
    return this.socket.onStatus(cb);
  }

  onLatency(cb: LatencyListener): () => void {
    return this.socket.onLatency(cb);
  }

  async connect(): Promise<void> {
    await this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  async authorize(token: string): Promise<AuthorizeResult> {
    this.socket.setToken(token);
    await this.socket.connect();
    const response = await this.socket.request(
      { authorize: token },
      authorizeMessageSchema,
      DERIV_CONFIG.requestTimeoutMs,
    );
    const a = response.authorize;
    let balance = a.balance;
    if (balance === undefined) {
      const balanceResponse = await this.socket.request({ balance: 1 }, balanceMessageSchema);
      balance = balanceResponse.balance.balance;
    }
    const scopes = normaliseScopes(a.scopes);
    const missingScopes = DERIV_CONFIG.requiredScopes.filter(
      (scope) => !scopePresent(scopes, scope.id),
    ).map((scope) => scope.label);
    const highRiskScopes = DERIV_CONFIG.highRiskScopes.filter((scope) =>
      scopes.includes(scope),
    );
    const account: AccountInfo = {
      loginid: a.loginid,
      currency: a.currency,
      balance: balance ?? 0,
      isVirtual: a.is_virtual === 1 || a.is_virtual === true || a.loginid.startsWith("VRTC"),
      email: a.email,
      country: a.country,
      scopes,
      missingScopes,
      highRiskScopes,
    };
    return { account, token };
  }

  async getActiveSymbols(): Promise<SymbolInfo[]> {
    const response = await this.socket.request(
      { active_symbols: "brief", product_type: "basic" },
      activeSymbolsMessageSchema,
    );
    return response.active_symbols
      .filter((s) => s.is_trading_suspended !== 1)
      .map((s) => {
        const pipSize = s.pip_size ?? 0.01;
        this.pipSizes.set(s.symbol, pipSize);
        return {
          symbol: s.symbol,
          displayName: s.display_name,
          market: s.market ?? "synthetic_index",
          marketDisplay: s.market_display_name ?? "Markets",
          submarket: s.submarket_display_name ?? s.submarket ?? "Other",
          pipSize,
          decimals: decimalsForPip(pipSize),
          basePrice: 0,
          open: s.exchange_is_open === 1 || s.exchange_is_open === true,
          exchangeClosed: s.exchange_is_open === 0,
        } satisfies SymbolInfo;
      });
  }

  async getHistory(symbol: string, granularity: number, count: number): Promise<Candle[]> {
    const response = await this.socket.request(
      {
        ticks_history: symbol,
        end: "latest",
        count,
        style: "candles",
        granularity,
        subscribe: 0,
      },
      ticksHistoryMessageSchema,
    );
    const candles = response.history.candles ?? [];
    return candles.map((c) => ({
      time: c.epoch,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
  }

  async getTicks(symbol: string, count: number): Promise<Tick[]> {
    const response = await this.socket.request(
      { ticks_history: symbol, end: "latest", count, style: "ticks", subscribe: 0 },
      ticksHistoryMessageSchema,
    );
    const prices = response.history.prices ?? [];
    const times = response.history.times ?? [];
    return prices.map((quote, index) => ({ symbol, quote, epoch: times[index] ?? 0 }));
  }

  subscribeTicks(symbol: string, cb: (tick: Tick) => void): () => void {
    return this.socket.subscribe(
      { ticks: symbol, subscribe: 1 },
      tickMessageSchema,
      (message) => {
        this.pipSizes.set(message.tick.symbol, message.tick.pip_size ?? 0.01);
        cb({ symbol: message.tick.symbol, epoch: message.tick.epoch, quote: message.tick.quote });
      },
    );
  }

  subscribeBalance(cb: (balance: number, currency: string) => void): () => void {
    return this.socket.subscribe({ balance: 1, subscribe: 1 }, balanceMessageSchema, (message) => {
      cb(message.balance.balance, message.balance.currency);
    });
  }

  subscribeProposal(
    req: ProposalRequest,
    cb: (proposal: Proposal | null, error?: string) => void,
  ): () => void {
    const payload: Record<string, unknown> = {
      proposal: 1,
      amount: req.stake,
      basis: "stake",
      contract_type: req.contractType,
      currency: req.currency,
      duration: req.duration,
      duration_unit: req.durationUnit,
      symbol: req.symbol,
      subscribe: 1,
    };
    if (req.barrier) payload.barrier = req.barrier;
    return this.socket.subscribe(
      payload,
      proposalMessageSchema,
      (message) => {
        const p = message.proposal;
        cb({
          id: p.id,
          symbol: p.symbol ?? req.symbol,
          contractType: (p.contract_type as ContractType) ?? req.contractType,
          askPrice: p.ask_price,
          payout: p.payout,
          spot: p.spot ?? 0,
          spotTime: p.spot_time ?? Math.floor(Date.now() / 1000),
          returnPct: p.ask_price > 0 ? ((p.payout - p.ask_price) / p.ask_price) * 100 : 0,
          longcode:
            p.longcode ??
            contractSentence(req.contractType, req.symbol, req.duration, req.durationUnit, req.barrier),
          receivedAt: Date.now(),
          isSimulated: false,
        });
      },
      (error) => cb(null, error),
    );
  }

  private mapOpenContract(raw: {
    contract_id: number;
    transaction_id?: number;
    symbol: string;
    contract_type: string;
    buy_price: number;
    payout?: number;
    entry_spot?: number;
    entry_tick?: number;
    current_spot?: number;
    profit?: number;
    longcode?: string;
    purchase_time?: number;
    date_expiry?: number;
    is_sold?: number | boolean;
    status?: string;
  }): OpenContract {
    const profit = raw.profit ?? 0;
    const sold = raw.is_sold === 1 || raw.is_sold === true || raw.status === "sold";
    const status: OpenContract["status"] = sold
      ? profit > 0
        ? "won"
        : "lost"
      : "open";
    return {
      contractId: raw.contract_id,
      transactionId: raw.transaction_id ?? raw.contract_id,
      symbol: raw.symbol,
      contractType: raw.contract_type as ContractType,
      buyPrice: raw.buy_price,
      payout: raw.payout ?? 0,
      entrySpot: raw.entry_spot ?? raw.entry_tick ?? 0,
      currentSpot: raw.current_spot ?? 0,
      profit,
      profitPct: raw.buy_price > 0 ? (profit / raw.buy_price) * 100 : 0,
      longcode: raw.longcode ?? raw.contract_type,
      purchaseTime: raw.purchase_time ?? Math.floor(Date.now() / 1000),
      expiryTime: raw.date_expiry ?? 0,
      isSimulated: false,
      status,
    };
  }

  subscribeContract(contractId: number, cb: (contract: OpenContract | null) => void): () => void {
    return this.socket.subscribe(
      { proposal_open_contract: 1, contract_id: contractId, subscribe: 1 },
      openContractMessageSchema,
      (message) => cb(this.mapOpenContract(message.proposal_open_contract)),
      () => cb(null),
    );
  }

  async buy(req: BuyRequest): Promise<BuyResult> {
    if (!req.proposalId) throw new Error("Proposal expired — wait for a fresh quote before buying");
    const response = await this.socket.request(
      { buy: req.proposalId, price: req.stake },
      buyMessageSchema,
    );
    const b = response.buy;
    return {
      contractId: b.contract_id,
      transactionId: b.transaction_id,
      buyPrice: b.buy_price,
      payout: b.payout ?? 0,
      balanceAfter: b.balance_after ?? 0,
      isSimulated: false,
      longcode: b.longcode ?? "",
      entrySpot: b.entry_tick ?? b.entry_spot ?? 0,
      purchaseTime: b.purchase_time ?? Math.floor(Date.now() / 1000),
      expiryTime: b.date_expiry ?? 0,
    };
  }

  async sell(contractId: number): Promise<SellResult> {
    const response = await this.socket.request({ sell: contractId, price: 0 }, sellMessageSchema);
    return {
      soldFor: response.sell.sold_for,
      balanceAfter: response.sell.balance_after ?? 0,
      profit: response.sell.sold_for,
    };
  }

  async getProfitTable(): Promise<ClosedContract[]> {
    const response = await this.socket.request(
      { profit_table: 1, description: 1, limit: 100, sort: "DESC" },
      profitTableMessageSchema,
    );
    const rows = response.profit_table.transactions ?? [];
    return rows.map((row) => ({
      contractId: row.contract_id ?? 0,
      symbol: row.shortcode ?? "—",
      contractType: "CALL" as ContractType,
      buyPrice: row.buy_price ?? 0,
      sellPrice: row.sell_price ?? 0,
      payout: row.payout ?? 0,
      profit: row.profit ?? 0,
      purchaseTime: row.purchase_time ?? 0,
      sellTime: row.sell_time ?? 0,
      entrySpot: row.entry_spot ?? 0,
      exitSpot: row.exit_tick ?? 0,
      isSimulated: false,
    }));
  }
}
