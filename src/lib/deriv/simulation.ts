import { formatNumber, gaussian, lastDigit } from "@/lib/utils";
import { contractSentence, returnRate } from "./payouts";
import { fallbackSymbols, symbolMeta } from "./symbols";
import type {
  AccountInfo,
  AuthorizeResult,
  BuyRequest,
  BuyResult,
  Candle,
  ClosedContract,
  ConnectionStatus,
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

const SEED_TICKS = 1_000;
const FLOOR_UNIT = 1e-8;

interface SimTicker {
  symbol: string;
  price: number;
  pipSize: number;
  intervalMs: number;
  lastEpoch: number;
  volatility: number;
  spikeBias: number;
  history: Tick[];
  subscribers: Set<(tick: Tick) => void>;
}

interface SimContract {
  contractId: number;
  transactionId: number;
  symbol: string;
  contractType: ContractType;
  buyPrice: number;
  payout: number;
  entrySpot: number;
  entryDigit: number;
  longcode: string;
  purchaseTime: number;
  expiryTime: number;
  barrier?: string;
  isVirtual: boolean;
  status: "open" | "won" | "lost" | "sold";
  finalProfit?: number;
  exitSpot?: number;
  closedAt?: number;
}

function tickInterval(symbol: string): number {
  if (symbol.startsWith("1HZ")) return 800;
  if (symbol.startsWith("R_")) return 1_400;
  if (symbol.startsWith("BOOM") || symbol.startsWith("CRASH")) return 1_600;
  if (symbol.startsWith("frx")) return 1_800;
  return 1_500;
}

function volatilityFor(symbol: string): number {
  if (symbol.startsWith("1HZ")) return 0.00042;
  if (symbol.startsWith("R_")) return 0.00028;
  if (symbol.startsWith("BOOM")) return 0.00016;
  if (symbol.startsWith("CRASH")) return 0.00016;
  if (symbol.startsWith("frx")) return 0.00006;
  return 0.00022;
}

/**
 * Deterministic-ish local market simulator.
 * It is *only* used when no token is connected and every artefact it produces is
 * tagged `isSimulated: true` so the UI can never present it as real money.
 */
export class SimulationEngine implements TradingEngine {
  readonly kind = "simulation" as const;

  private tickers = new Map<string, SimTicker>();
  private open = new Map<number, SimContract>();
  private closed: ClosedContract[] = [];
  private contractSubs = new Map<number, Set<(c: OpenContract | null) => void>>();
  private balanceSubs = new Set<(balance: number, currency: string) => void>();
  private statusSubs = new Set<StatusListener>();
  private latencySubs = new Set<LatencyListener>();
  private balance = 10_000;
  private startingBalance = 10_000;
  private currency = "USD";
  private loginid = "VRTC-SIM-4912";
  private loop: ReturnType<typeof setInterval> | null = null;
  private proposalTimers = new Map<number, ReturnType<typeof setInterval>>();
  private proposalCounter = 1;
  private nextContractId = 100_001;
  private nextTransactionId = 900_001;
  private connected = false;
  private status: ConnectionStatus = "offline";

  get isConnected() {
    return this.connected;
  }

  onStatus(cb: StatusListener): () => void {
    this.statusSubs.add(cb);
    cb(this.status, "Local simulation feed");
    return () => this.statusSubs.delete(cb);
  }

  onLatency(cb: LatencyListener): () => void {
    this.latencySubs.add(cb);
    cb(18);
    return () => this.latencySubs.delete(cb);
  }

  private emitStatus(status: ConnectionStatus) {
    this.status = status;
    for (const cb of this.statusSubs) cb(status, "Local simulation feed");
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.emitStatus("connecting");
    await new Promise((resolve) => setTimeout(resolve, 180));
    this.connected = true;
    this.emitStatus("connected");
    for (const cb of this.latencySubs) cb(9 + Math.round(Math.random() * 18));
    if (!this.loop) {
      this.loop = setInterval(() => this.pump(), 260);
    }
  }

  disconnect(): void {
    this.connected = false;
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    for (const timer of this.proposalTimers.values()) clearInterval(timer);
    this.proposalTimers.clear();
    for (const ticker of this.tickers.values()) ticker.subscribers.clear();
    this.open.clear();
    this.contractSubs.clear();
    this.balanceSubs.clear();
    this.emitStatus("offline");
  }

  async authorize(_token: string): Promise<AuthorizeResult> {
    await this.connect();
    const account: AccountInfo = {
      loginid: this.loginid,
      currency: this.currency,
      balance: this.balance,
      isVirtual: true,
      scopes: ["read", "trade", "trading_information"],
      missingScopes: [],
      highRiskScopes: [],
    };
    return { account, token: "" };
  }

  async getActiveSymbols(): Promise<SymbolInfo[]> {
    await this.connect();
    return fallbackSymbols();
  }

  private ticker(symbol: string): SimTicker {
    const existing = this.tickers.get(symbol);
    if (existing) return existing;
    const meta = symbolMeta(symbol);
    const intervalMs = tickInterval(symbol);
    const volatility = volatilityFor(symbol);
    const now = Math.floor(Date.now() / 1000);
    let price = meta.basePrice;
    const history: Tick[] = [];
    for (let i = SEED_TICKS; i > 0; i -= 1) {
      price = Math.max(price + price * volatility * gaussian(0, 1), FLOOR_UNIT);
      history.push({
        symbol,
        epoch: now - Math.round((i * intervalMs) / 1000),
        quote: Number(price.toFixed(meta.decimals)),
      });
    }
    const spikeBias = symbol.startsWith("BOOM") ? 1 : symbol.startsWith("CRASH") ? -1 : 0;
    const ticker: SimTicker = {
      symbol,
      price: history[history.length - 1]?.quote ?? meta.basePrice,
      pipSize: meta.pipSize,
      intervalMs,
      lastEpoch: now,
      volatility,
      spikeBias,
      history,
      subscribers: new Set(),
    };
    this.tickers.set(symbol, ticker);
    return ticker;
  }

  private pump() {
    const nowMs = Date.now();
    for (const ticker of this.tickers.values()) {
      if (nowMs - ticker.lastEpoch * 1000 < ticker.intervalMs) continue;
      ticker.lastEpoch = Math.floor(nowMs / 1000);
      let move = gaussian(0, 1) * ticker.volatility;
      if (ticker.spikeBias !== 0 && Math.random() < 0.012) {
        move += ticker.spikeBias * ticker.volatility * 12;
      }
      ticker.price = Math.max(ticker.price * (1 + move), FLOOR_UNIT);
      const meta = symbolMeta(ticker.symbol);
      const tick: Tick = {
        symbol: ticker.symbol,
        epoch: ticker.lastEpoch,
        quote: Number(ticker.price.toFixed(meta.decimals)),
      };
      ticker.history.push(tick);
      if (ticker.history.length > 3_000) ticker.history.shift();
      for (const cb of ticker.subscribers) cb(tick);
    }
    this.revalueContracts();
  }

  private quotation(symbol: string): number {
    return this.ticker(symbol).price;
  }

  subscribeTicks(symbol: string, cb: (tick: Tick) => void): () => void {
    void this.connect();
    const ticker = this.ticker(symbol);
    ticker.subscribers.add(cb);
    return () => {
      ticker.subscribers.delete(cb);
    };
  }

  subscribeBalance(cb: (balance: number, currency: string) => void): () => void {
    void this.connect();
    this.balanceSubs.add(cb);
    cb(this.balance, this.currency);
    return () => this.balanceSubs.delete(cb);
  }

  private emitBalance() {
    for (const cb of this.balanceSubs) cb(this.balance, this.currency);
  }

  async getTicks(symbol: string, count: number): Promise<Tick[]> {
    const ticker = this.ticker(symbol);
    return ticker.history.slice(-count);
  }

  async getHistory(symbol: string, granularity: number, count: number): Promise<Candle[]> {
    const ticker = this.ticker(symbol);
    const candles: Candle[] = [];
    const now = Math.floor(Date.now() / 1000);
    const start = now - granularity * count;
    let price = ticker.price * (1 - ticker.volatility * granularity * 1.2);
    for (let i = 0; i < count; i += 1) {
      const open = price;
      const drift = gaussian(0, 1) * ticker.volatility * Math.sqrt(granularity) * 1.6;
      const close = Math.max(open * (1 + drift), FLOOR_UNIT);
      const wick = Math.abs(gaussian(0, 1)) * ticker.volatility * Math.sqrt(granularity);
      const high = Math.max(open, close) * (1 + wick);
      const low = Math.min(open, close) * (1 - wick);
      candles.push({
        time: start + i * granularity,
        open: Number(open.toFixed(6)),
        high: Number(high.toFixed(6)),
        low: Number(low.toFixed(6)),
        close: Number(close.toFixed(6)),
      });
      price = close;
    }
    const last = candles[candles.length - 1];
    if (last) last.close = Number(ticker.price.toFixed(6));
    return candles;
  }

  subscribeProposal(
    req: ProposalRequest,
    cb: (proposal: Proposal | null, error?: string) => void,
  ): () => void {
    void this.connect();
    const key = this.proposalCounter++;
    const ticker = this.ticker(req.symbol);
    const meta = symbolMeta(req.symbol);
    const emit = () => {
      if (req.stake <= 0) {
        cb(null, "Stake must be greater than zero");
        return;
      }
      const rate = returnRate(req.contractType);
      const payout = Number((req.stake * (1 + rate)).toFixed(2));
      const spot = Number(this.quotation(req.symbol).toFixed(meta.decimals));
      const proposal: Proposal = {
        id: `sim-proposal-${key}-${Date.now()}`,
        symbol: req.symbol,
        contractType: req.contractType,
        askPrice: req.stake,
        payout,
        spot,
        spotTime: Math.floor(Date.now() / 1000),
        returnPct: rate * 100,
        longcode: contractSentence(
          req.contractType,
          meta.displayName,
          req.duration,
          req.durationUnit,
          req.barrier,
        ),
        receivedAt: Date.now(),
        isSimulated: true,
      };
      cb(proposal);
    };
    emit();
    const timer = setInterval(emit, Math.max(700, ticker.intervalMs));
    this.proposalTimers.set(key, timer);
    return () => {
      clearInterval(timer);
      this.proposalTimers.delete(key);
    };
  }

  private contractToOpen(contract: SimContract): OpenContract {
    const meta = symbolMeta(contract.symbol);
    const currentSpot = Number(this.quotation(contract.symbol).toFixed(meta.decimals));
    const currentDigit = lastDigit(currentSpot, meta.pipSize);
    const now = Date.now() / 1000;
    const duration = Math.max(1, contract.expiryTime - contract.purchaseTime);
    const progress = Math.min(1, Math.max(0, (now - contract.purchaseTime) / duration));
    let profit: number;
    if (contract.status === "open") {
      const winning = this.wouldWin(contract, currentSpot, currentDigit);
      const potential = winning ? contract.payout - contract.buyPrice : -contract.buyPrice;
      profit = Number((potential * progress).toFixed(2));
    } else {
      profit = Number((contract.finalProfit ?? 0).toFixed(2));
    }
    return {
      contractId: contract.contractId,
      transactionId: contract.transactionId,
      symbol: contract.symbol,
      contractType: contract.contractType,
      buyPrice: contract.buyPrice,
      payout: contract.payout,
      entrySpot: contract.entrySpot,
      currentSpot,
      profit,
      profitPct: (profit / contract.buyPrice) * 100,
      longcode: contract.longcode,
      purchaseTime: contract.purchaseTime,
      expiryTime: contract.expiryTime,
      isSimulated: true,
      status: contract.status === "sold" ? "sold" : contract.status,
      entryDigit: contract.entryDigit,
      currentDigit,
    };
  }

  private wouldWin(contract: SimContract, spot: number, digit: number): boolean {
    const barrier = Number(contract.barrier ?? "0");
    switch (contract.contractType) {
      case "CALL":
      case "MULTUP":
      case "ASIANU":
        return spot > contract.entrySpot;
      case "PUT":
      case "MULTDOWN":
      case "ASIAND":
        return spot < contract.entrySpot;
      case "DIGITMATCH":
        return digit === barrier;
      case "DIGITDIFF":
        return digit !== barrier;
      case "DIGITEVEN":
        return digit % 2 === 0;
      case "DIGITODD":
        return digit % 2 !== 0;
      case "DIGITOVER":
        return digit > barrier;
      case "DIGITUNDER":
        return digit < barrier;
      default:
        return false;
    }
  }

  private revalueContracts() {
    const now = Date.now() / 1000;
    for (const contract of [...this.open.values()]) {
      if (contract.status !== "open") continue;
      const quote = this.quotation(contract.symbol);
      const meta = symbolMeta(contract.symbol);
      const digit = lastDigit(quote, meta.pipSize);
      if (now >= contract.expiryTime) {
        const won = this.wouldWin(contract, quote, digit);
        contract.status = won ? "won" : "lost";
        contract.finalProfit = won ? contract.payout - contract.buyPrice : -contract.buyPrice;
        contract.exitSpot = quote;
        contract.closedAt = now;
        this.balance += won ? contract.payout : 0;
        this.emitBalance();
        this.closed.unshift({
          contractId: contract.contractId,
          symbol: contract.symbol,
          contractType: contract.contractType,
          buyPrice: contract.buyPrice,
          sellPrice: won ? contract.payout : 0,
          payout: contract.payout,
          profit: contract.finalProfit,
          purchaseTime: contract.purchaseTime,
          sellTime: Math.round(now),
          entrySpot: contract.entrySpot,
          exitSpot: quote,
          isSimulated: true,
        } satisfies ClosedContract);
        this.open.delete(contract.contractId);
        const subs = this.contractSubs.get(contract.contractId);
        if (subs) for (const cb of subs) cb(this.contractToOpen(contract));
        this.contractSubs.delete(contract.contractId);
        continue;
      }
      const subs = this.contractSubs.get(contract.contractId);
      if (subs && subs.size > 0) {
        const snapshot = this.contractToOpen(contract);
        for (const cb of subs) cb(snapshot);
      }
    }
  }

  subscribeContract(contractId: number, cb: (c: OpenContract | null) => void): () => void {
    const existing = this.open.get(contractId);
    if (!existing) {
      cb(null);
      return () => undefined;
    }
    const set = this.contractSubs.get(contractId) ?? new Set();
    set.add(cb);
    this.contractSubs.set(contractId, set);
    cb(this.contractToOpen(existing));
    return () => {
      set.delete(cb);
    };
  }

  private durationSeconds(req: BuyRequest): number {
    const ticker = this.ticker(req.symbol);
    const tickSeconds = Math.max(1, ticker.intervalMs / 1000);
    switch (req.durationUnit) {
      case "t":
        return Math.max(5, req.duration) * tickSeconds;
      case "s":
        return Math.max(5, req.duration);
      case "m":
        return req.duration * 60;
      case "h":
        return req.duration * 3600;
      default:
        return req.duration * 86_400;
    }
  }

  async buy(req: BuyRequest): Promise<BuyResult> {
    await this.connect();
    if (req.stake <= 0) throw new Error("Stake must be greater than zero");
    if (req.stake > this.balance) throw new Error("Insufficient balance for this purchase");
    const meta = symbolMeta(req.symbol);
    const quote = Number(this.quotation(req.symbol).toFixed(meta.decimals));
    const now = Math.floor(Date.now() / 1000);
    const contractId = this.nextContractId++;
    const transactionId = this.nextTransactionId++;
    const durationSec = this.durationSeconds(req);
    const payout = Number((req.stake * (1 + returnRate(req.contractType))).toFixed(2));
    const contract: SimContract = {
      contractId,
      transactionId,
      symbol: req.symbol,
      contractType: req.contractType,
      buyPrice: req.stake,
      payout,
      entrySpot: quote,
      entryDigit: lastDigit(quote, meta.pipSize),
      longcode: contractSentence(
        req.contractType,
        meta.displayName,
        req.duration,
        req.durationUnit,
        req.barrier,
      ),
      purchaseTime: now,
      expiryTime: now + durationSec,
      barrier: req.barrier,
      isVirtual: true,
      status: "open",
    };
    this.open.set(contractId, contract);
    this.balance = Number((this.balance - req.stake).toFixed(2));
    this.emitBalance();
    return {
      contractId,
      transactionId,
      buyPrice: req.stake,
      payout,
      balanceAfter: this.balance,
      isSimulated: true,
      longcode: contract.longcode,
      entrySpot: quote,
      purchaseTime: now,
      expiryTime: contract.expiryTime,
    };
  }

  async sell(contractId: number): Promise<SellResult> {
    const contract = this.open.get(contractId);
    if (!contract) throw new Error("Contract not found or already closed");
    const snapshot = this.contractToOpen(contract);
    const soldFor = Number(Math.max(0, contract.buyPrice + snapshot.profit).toFixed(2));
    const profit = Number((soldFor - contract.buyPrice).toFixed(2));
    contract.status = "sold";
    contract.finalProfit = profit;
    contract.closedAt = Date.now() / 1000;
    this.open.delete(contractId);
    this.balance = Number((this.balance + soldFor).toFixed(2));
    this.closed.unshift({
      contractId: contract.contractId,
      symbol: contract.symbol,
      contractType: contract.contractType,
      buyPrice: contract.buyPrice,
      sellPrice: soldFor,
      payout: contract.payout,
      profit,
      purchaseTime: contract.purchaseTime,
      sellTime: Math.round(Date.now() / 1000),
      entrySpot: contract.entrySpot,
      exitSpot: snapshot.currentSpot,
      isSimulated: true,
    });
    const subs = this.contractSubs.get(contractId);
    if (subs) for (const cb of subs) cb(this.contractToOpen(contract));
    this.contractSubs.delete(contractId);
    this.emitBalance();
    return { soldFor, balanceAfter: this.balance, profit };
  }

  async getProfitTable(): Promise<ClosedContract[]> {
    return [...this.closed];
  }

  getStartingBalance(): number {
    return this.startingBalance;
  }

  resetBalance(): void {
    this.balance = this.startingBalance;
    this.open.clear();
    this.closed = [];
    this.emitBalance();
  }

  describeContract(contract: SimContract): string {
    return contract.longcode;
  }

  formatQuote(symbol: string, value: number): string {
    const meta = symbolMeta(symbol);
    return formatNumber(value, meta.decimals);
  }
}
