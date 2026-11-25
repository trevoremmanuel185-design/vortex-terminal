import type { BotParams } from "./strategies";
import type { ContractType } from "@/lib/deriv/types";

/**
 * Deriv DBot XML → internal strategy AST.
 *
 * We intentionally support a verified subset of Blockly blocks. If *any* block
 * falls outside that subset the import is rejected: running a silently partial
 * conversion would misrepresent the user's strategy and risk real money.
 */
const SUPPORTED_BLOCKS = new Set([
  "trade_definition",
  "trade_definition_market",
  "trade_definition_tradetype",
  "trade_definition_contracttype",
  "trade_definition_candleinterval",
  "trade_definition_restartbuysell",
  "trade_definition_restartonerror",
  "trade_definition_tradeoptions",
  "before_purchase",
  "purchase",
  "during_purchase",
  "after_purchase",
  "trade_again",
  "statement",
  "variables_set",
  "variables_get",
  "math_number",
  "math_arithmetic",
  "logic_compare",
  "logic_operation",
  "logic_boolean",
  "controls_if",
  "text",
  "text_join",
  "tick_analysis",
  "tick",
  "last_digit",
  "check_direction",
  "sma",
  "smaa",
  "ema",
  "emaa",
  "rsi",
  "macda",
  "bollinger",
  "notify",
  "console_log",
]);

const CONTRACT_TYPES: ContractType[] = [
  "CALL",
  "PUT",
  "DIGITMATCH",
  "DIGITDIFF",
  "DIGITEVEN",
  "DIGITODD",
  "DIGITOVER",
  "DIGITUNDER",
  "MULTUP",
  "MULTDOWN",
];

export interface ParsedXmlStrategy {
  ok: boolean;
  name: string;
  params: BotParams;
  blocks: string[];
  unsupported: string[];
  errors: string[];
  summary: string[];
  restartOnError: boolean;
  restartBuySell: boolean;
  market: { market: string; submarket: string; symbol: string } | null;
}

const DEFAULT_PARAMS: BotParams = {
  stake: 1,
  duration: 5,
  durationUnit: "t",
  contractType: "CALL",
  barrier: "5",
  multiplier: 2,
  martingaleCap: 3,
  scoreThreshold: 0,
  digitThreshold: 5,
  cooldownSeconds: 10,
  maxTradesPerSession: 25,
};

function fieldValue(fragment: string, name: string): string | null {
  const regex = new RegExp(`<field[^>]*name="${name}"[^>]*>([\\s\\S]*?)</field>`, "i");
  const match = fragment.match(regex);
  return match ? match[1].trim() : null;
}

function blocksOfType(xml: string, type: string): string[] {
  const regex = new RegExp(
    `<block[^>]*type="${type}"[^>]*>([\\s\\S]*?)</block>`,
    "gi",
  );
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) out.push(match[1]);
  return out;
}

function numeric(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseContract(raw: string | null): ContractType | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/[\s-]/g, "_");
  const direct = CONTRACT_TYPES.find((type) => type === upper);
  if (direct) return direct;
  const alias: Record<string, ContractType> = {
    RISE: "CALL",
    FALL: "PUT",
    HIGHER: "ASIANU",
    LOWER: "ASIAND",
    EVEN: "DIGITEVEN",
    ODD: "DIGITODD",
    OVER: "DIGITOVER",
    UNDER: "DIGITUNDER",
    MATCHES: "DIGITMATCH",
    DIFFERS: "DIGITDIFF",
    MULTIPLIER_UP: "MULTUP",
    MULTIPLIER_DOWN: "MULTDOWN",
    "DIGIT_MATCH": "DIGITMATCH",
    "DIGIT_DIFF": "DIGITDIFF",
  };
  return alias[upper] ?? null;
}

export function parseDbotXml(xml: string): ParsedXmlStrategy {
  const errors: string[] = [];
  const summary: string[] = [];
  const trimmed = xml.trim();

  if (!trimmed) {
    return {
      ok: false,
      name: "Empty strategy",
      params: { ...DEFAULT_PARAMS },
      blocks: [],
      unsupported: [],
      errors: ["The file is empty."],
      summary: [],
      restartOnError: false,
      restartBuySell: false,
      market: null,
    };
  }
  if (!/<xml[\s>]/i.test(trimmed) || !/<block/i.test(trimmed)) {
    return {
      ok: false,
      name: "Invalid file",
      params: { ...DEFAULT_PARAMS },
      blocks: [],
      unsupported: [],
      errors: ["This does not look like a Deriv DBot (Blockly XML) strategy file."],
      summary: [],
      restartOnError: false,
      restartBuySell: false,
      market: null,
    };
  }

  const blockTypes = [...trimmed.matchAll(/<block[^>]*type="([^"]+)"/gi)].map((m) => m[1]);
  const uniqueBlocks = [...new Set(blockTypes)];
  const unsupported = uniqueBlocks.filter((type) => !SUPPORTED_BLOCKS.has(type));

  const tradeOptions = blocksOfType(trimmed, "trade_definition_tradeoptions")[0] ?? "";
  const stake = numeric(fieldValue(tradeOptions, "AMOUNT"), 1);
  const duration = numeric(fieldValue(tradeOptions, "DURATION"), 5);
  const rawUnit = (fieldValue(tradeOptions, "DURATIONTYPE") ?? "t").toLowerCase();
  const durationUnit: BotParams["durationUnit"] =
    rawUnit.startsWith("t") ? "t" : rawUnit.startsWith("s") ? "s" : "m";

  const marketBlock = blocksOfType(trimmed, "trade_definition_market")[0] ?? "";
  const market = {
    market: fieldValue(marketBlock, "MARKET_LIST") ?? "synthetic_index",
    submarket: fieldValue(marketBlock, "SUBMARKET_LIST") ?? "random_index",
    symbol: fieldValue(marketBlock, "SYMBOL_LIST") ?? "R_100",
  };

  const contractBlock = blocksOfType(trimmed, "trade_definition_contracttype")[0] ?? "";
  const rawContract =
    fieldValue(contractBlock, "TYPE") ??
    fieldValue(trimmed, "TYPE") ??
    fieldValue(trimmed, "CONTRACT_TYPE");
  const contractType = normaliseContract(rawContract);
  if (!contractType) errors.push("No supported contract type found in the strategy.");

  const restartOnError = /trade_definition_restartonerror/i.test(trimmed);
  const restartBuySell = /trade_definition_restartbuysell/i.test(trimmed);

  if (!Number.isFinite(stake) || stake <= 0) errors.push("Trade stake must be greater than zero.");
  if (!Number.isFinite(duration) || duration <= 0) errors.push("Trade duration must be greater than zero.");
  if (stake > 100) errors.push("Stake above 100 is outside the safe import range.");

  const hasPurchase = /type="purchase"/i.test(trimmed);
  if (!hasPurchase) errors.push("No purchase block found — the strategy would never trade.");
  if (unsupported.length > 0) {
    errors.push(
      `Refusing to run: ${unsupported.length} unsupported block${unsupported.length === 1 ? "" : "s"} (${unsupported
        .slice(0, 4)
        .join(", ")}${unsupported.length > 4 ? "…" : ""}). A partial conversion would behave differently from your bot.`,
    );
  }

  const barrierField =
    fieldValue(tradeOptions, "BARRIER") ??
    fieldValue(tradeOptions, "PREDICTION") ??
    (/DIGIT/i.test(rawContract ?? "") ? "5" : "");
  const barrier = barrierField ? barrierField : "5";

  summary.push(`Market: ${market.symbol} (${market.submarket})`);
  if (contractType) summary.push(`Contract: ${contractType}`);
  summary.push(`Stake: ${stake} · Duration: ${duration} ${durationUnit === "t" ? "ticks" : durationUnit === "s" ? "seconds" : "minutes"}`);
  summary.push(`Restart on error: ${restartOnError ? "yes" : "no"}`);
  summary.push(`Blocks detected: ${uniqueBlocks.length} (${uniqueBlocks.length - unsupported.length} supported)`);

  return {
    ok: errors.length === 0,
    name: "Imported DBot strategy",
    params: {
      ...DEFAULT_PARAMS,
      stake: Number(stake.toFixed(2)),
      duration,
      durationUnit,
      contractType: contractType ?? "CALL",
      barrier,
    },
    blocks: uniqueBlocks,
    unsupported,
    errors,
    summary,
    restartOnError,
    restartBuySell,
    market,
  };
}
