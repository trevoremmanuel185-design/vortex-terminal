import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Every indicator signal the terminal produced, with its measured outcome. */
export const signalAudit = pgTable("signal_audit", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  score: integer("score").notNull().default(50),
  label: text("label").notNull().default("NEUTRAL"),
  price: doublePrecision("price").notNull().default(0),
  source: text("source").notNull().default("manual"),
  simulated: boolean("simulated").notNull().default(false),
  outcome: text("outcome").notNull().default("pending"),
  components: jsonb("components").$type<{ id: string; contribution: number }[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Trading journal — notes and tags attached to a contract. */
export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  contractId: text("contract_id").notNull().default(""),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull().default(""),
  stake: doublePrecision("stake").notNull().default(0),
  profit: doublePrecision("profit").notNull().default(0),
  tags: text("tags").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Contact form submissions (also mirrored to WhatsApp/email by the browser). */
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull().default("General"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SignalAuditRow = typeof signalAudit.$inferSelect;
export type JournalRow = typeof journalEntries.$inferSelect;
