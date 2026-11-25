export type ConnectionStatus =
  | "offline"
  | "connecting"
  | "authorizing"
  | "connected"
  | "reconnecting"
  | "error";

export type EngineKind = "live" | "simulation";
export type AccountKind = "demo" | "real";

export interface AccountInfo {
  loginid: string;
  currency: string;
  balance: number;
  isVirtual: boolean;
  email?: string;
  country?: string;
  scopes: string[];
  missingScopes: string[];
  highRiskScopes: string[];
}

export interface SymbolInfo {
  symbol: string;
  displayName: string;
  market: string;
  marketDisplay: string;
  submarket: string;
  pipSize: number;
  decimals: number;
  basePrice: number;
  open: boolean;
  exchangeClosed?: boolean;
}

export interface Tick {
  symbol: string;
  epoch: number;
  quote: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ContractType =
  | "CALL"
  | "PUT"
  | "ASIANU"
  | "ASIAND"
  | "DIGITMATCH"
  | "DIGITDIFF"
  | "DIGITEVEN"
  | "DIGITODD"
  | "DIGITOVER"
  | "DIGITUNDER"
  | "MULTUP"
  | "MULTDOWN";

export interface ProposalRequest {
  symbol: string;
  contractType: ContractType;
  stake: number;
  duration: number;
  durationUnit: "t" | "s" | "m" | "h" | "d";
  barrier?: string;
  currency: string;
}

export interface Proposal {
  id: string;
  symbol: string;
  contractType: ContractType;
  askPrice: number;
  payout: number;
  spot: number;
  spotTime: number;
  returnPct: number;
  longcode: string;
  receivedAt: number;
  isSimulated: boolean;
  error?: string;
}

export interface OpenContract {
  contractId: number;
  transactionId: number;
  symbol: string;
  contractType: ContractType;
  buyPrice: number;
  payout: number;
  entrySpot: number;
  currentSpot: number;
  profit: number;
  profitPct: number;
  longcode: string;
  purchaseTime: number;
  expiryTime: number;
  isSimulated: boolean;
  status: "open" | "sold" | "won" | "lost";
  entryDigit?: number;
  currentDigit?: number;
}

export interface ClosedContract {
  contractId: number;
  symbol: string;
  contractType: ContractType;
  buyPrice: number;
  sellPrice: number;
  payout: number;
  profit: number;
  purchaseTime: number;
  sellTime: number;
  entrySpot: number;
  exitSpot: number;
  isSimulated: boolean;
}

export interface BuyRequest {
  proposalId?: string;
  symbol: string;
  contractType: ContractType;
  stake: number;
  duration: number;
  durationUnit: "t" | "s" | "m" | "h" | "d";
  barrier?: string;
  currency: string;
}

export interface BuyResult {
  contractId: number;
  transactionId: number;
  buyPrice: number;
  payout: number;
  balanceAfter: number;
  isSimulated: boolean;
  longcode: string;
  entrySpot: number;
  purchaseTime: number;
  expiryTime: number;
}

export interface SellResult {
  soldFor: number;
  balanceAfter: number;
  profit: number;
}

export interface AuthorizeResult {
  account: AccountInfo;
  token: string;
}

export type StatusListener = (status: ConnectionStatus, detail?: string) => void;
export type LatencyListener = (ms: number) => void;

/** Common surface implemented by the live WebSocket engine and the simulation. */
export interface TradingEngine {
  readonly kind: EngineKind;
  connect(): Promise<void>;
  disconnect(): void;
  onStatus(cb: StatusListener): () => void;
  onLatency(cb: LatencyListener): () => void;
  authorize(token: string): Promise<AuthorizeResult>;
  getActiveSymbols(): Promise<SymbolInfo[]>;
  getHistory(symbol: string, granularity: number, count: number): Promise<Candle[]>;
  getTicks(symbol: string, count: number): Promise<Tick[]>;
  subscribeTicks(symbol: string, cb: (tick: Tick) => void): () => void;
  subscribeBalance(cb: (balance: number, currency: string) => void): () => void;
  subscribeProposal(
    req: ProposalRequest,
    cb: (proposal: Proposal | null, error?: string) => void,
  ): () => void;
  subscribeContract(contractId: number, cb: (contract: OpenContract | null) => void): () => void;
  buy(req: BuyRequest): Promise<BuyResult>;
  sell(contractId: number): Promise<SellResult>;
  getProfitTable(): Promise<ClosedContract[]>;
}

export interface DerivEnvelope {
  msg_type?: string;
  req_id?: number;
  error?: { code: string; message: string };
}

export type AnyMessage = Record<string, unknown>;

export interface WireSubscription<T> {
  unsubscribe: () => void;
  requestId: number;
}
