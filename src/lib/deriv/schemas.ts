import { z } from "zod";

/**
 * Every inbound frame from Deriv is validated here before it reaches the UI.
 * Unknown keys are preserved (`.catchall`) because Deriv extends payloads
 * frequently — we only assert on the fields we actually consume.
 */
export const baseMessageSchema = z
  .object({
    msg_type: z.string().optional(),
    req_id: z.number().optional(),
    error: z
      .object({
        code: z.union([z.string(), z.number()]).transform((c) => String(c)),
        message: z.string(),
      })
      .optional(),
  })
  .catchall(z.unknown());

const scopeSchema = z.array(z.string()).optional();

export const authorizeMessageSchema = baseMessageSchema.extend({
  authorize: z
    .object({
      loginid: z.string(),
      currency: z.string().default("USD"),
      balance: z.number().optional(),
      is_virtual: z.union([z.number(), z.boolean()]).optional(),
      scopes: scopeSchema,
      email: z.string().optional(),
      country: z.string().optional(),
    })
    .catchall(z.unknown()),
});

export const balanceMessageSchema = baseMessageSchema.extend({
  balance: z
    .object({
      balance: z.number(),
      currency: z.string().default("USD"),
      loginid: z.string().optional(),
    })
    .catchall(z.unknown()),
});

export const tickMessageSchema = baseMessageSchema.extend({
  tick: z
    .object({
      symbol: z.string(),
      epoch: z.number(),
      quote: z.number(),
      pip_size: z.number().optional(),
    })
    .catchall(z.unknown()),
});

export const ticksHistoryMessageSchema = baseMessageSchema.extend({
  history: z
    .object({
      prices: z.array(z.number()).optional(),
      times: z.array(z.number()).optional(),
      candles: z
        .array(
          z
            .object({
              epoch: z.number(),
              open: z.number(),
              high: z.number(),
              low: z.number(),
              close: z.number(),
            })
            .catchall(z.unknown()),
        )
        .optional(),
      instrument_id: z.string().optional(),
    })
    .catchall(z.unknown()),
});

export const proposalMessageSchema = baseMessageSchema.extend({
  proposal: z
    .object({
      id: z.string(),
      ask_price: z.number(),
      payout: z.number(),
      spot: z.number().optional(),
      spot_time: z.number().optional(),
      longcode: z.string().optional(),
      contract_type: z.string().optional(),
      symbol: z.string().optional(),
    })
    .catchall(z.unknown()),
});

export const buyMessageSchema = baseMessageSchema.extend({
  buy: z
    .object({
      contract_id: z.number(),
      transaction_id: z.number(),
      buy_price: z.number(),
      payout: z.number().optional(),
      balance_after: z.number().optional(),
      longcode: z.string().optional(),
      start_time: z.number().optional(),
      purchase_time: z.number().optional(),
      date_expiry: z.number().optional(),
      entry_tick: z.number().optional(),
      entry_spot: z.number().optional(),
    })
    .catchall(z.unknown()),
});

export const openContractMessageSchema = baseMessageSchema.extend({
  proposal_open_contract: z
    .object({
      contract_id: z.number(),
      transaction_id: z.number().optional(),
      symbol: z.string(),
      contract_type: z.string(),
      buy_price: z.number(),
      payout: z.number().optional(),
      entry_spot: z.number().optional(),
      entry_tick: z.number().optional(),
      current_spot: z.number().optional(),
      current_spot_time: z.number().optional(),
      profit: z.number().optional(),
      longcode: z.string().optional(),
      purchase_time: z.number().optional(),
      date_expiry: z.number().optional(),
      is_sold: z.union([z.number(), z.boolean()]).optional(),
      status: z.string().optional(),
      sell_price: z.number().optional(),
      sell_spot: z.number().optional(),
      exit_tick: z.number().optional(),
    })
    .catchall(z.unknown()),
});

export const sellMessageSchema = baseMessageSchema.extend({
  sell: z
    .object({
      sold_for: z.number(),
      balance_after: z.number().optional(),
      transaction_id: z.number().optional(),
      contract_id: z.number().optional(),
    })
    .catchall(z.unknown()),
});

export const profitTableMessageSchema = baseMessageSchema.extend({
  profit_table: z
    .object({
      transactions: z
        .array(
          z
            .object({
              contract_id: z.number().optional(),
              transaction_id: z.number().optional(),
              buy_price: z.number().optional(),
              sell_price: z.number().optional(),
              payout: z.number().optional(),
              profit: z.number().optional(),
              purchase_time: z.number().optional(),
              sell_time: z.number().optional(),
              shortcode: z.string().optional(),
              longcode: z.string().optional(),
              entry_spot: z.number().optional(),
              exit_tick: z.number().optional(),
            })
            .catchall(z.unknown()),
        )
        .optional(),
    })
    .catchall(z.unknown()),
});

export const activeSymbolsMessageSchema = baseMessageSchema.extend({
  active_symbols: z.array(
    z
      .object({
        symbol: z.string(),
        display_name: z.string(),
        market: z.string().optional(),
        market_display_name: z.string().optional(),
        submarket: z.string().optional(),
        submarket_display_name: z.string().optional(),
        pip_size: z.number().optional(),
        exchange_is_open: z.union([z.number(), z.boolean()]).optional(),
        is_trading_suspended: z.union([z.number(), z.boolean()]).optional(),
      })
      .catchall(z.unknown()),
  ),
});

export const pingMessageSchema = baseMessageSchema.extend({
  ping: z.string().optional(),
});

export type ValidatedAuthorize = z.infer<typeof authorizeMessageSchema>;
export type ValidatedTick = z.infer<typeof tickMessageSchema>;
export type ValidatedProposal = z.infer<typeof proposalMessageSchema>;
export type ValidatedBuy = z.infer<typeof buyMessageSchema>;
export type ValidatedOpenContract = z.infer<typeof openContractMessageSchema>;
export type ValidatedSell = z.infer<typeof sellMessageSchema>;

export function safeParseMessage<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const first = parsed.error.issues[0];
  return {
    ok: false,
    error: first ? `${first.path.join(".") || "message"}: ${first.message}` : "Invalid message",
  };
}
