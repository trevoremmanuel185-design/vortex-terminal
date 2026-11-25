import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { signalAudit } from "@/db/schema";

export const dynamic = "force-dynamic";

const componentsSchema = z.array(
  z.object({ id: z.string(), contribution: z.number() }),
);

const createSchema = z.object({
  symbol: z.string().min(1).max(32),
  direction: z.string().min(1).max(32),
  score: z.number().min(0).max(100),
  label: z.string().min(1).max(24),
  price: z.number().finite(),
  source: z.enum(["manual", "bot"]).default("manual"),
  simulated: z.boolean().default(false),
  components: componentsSchema.default([]),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  outcome: z.enum(["hit", "miss", "pending"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const [row] = await db
      .insert(signalAudit)
      .values({
        symbol: parsed.data.symbol,
        direction: parsed.data.direction,
        score: Math.round(parsed.data.score),
        label: parsed.data.label,
        price: parsed.data.price,
        source: parsed.data.source,
        simulated: parsed.data.simulated,
        components: parsed.data.components,
      })
      .returning({ id: signalAudit.id });
    return NextResponse.json({ id: row?.id ?? null }, { status: 201 });
  } catch {
    // The trading loop must never fail because telemetry storage is unavailable.
    return NextResponse.json({ id: null, persisted: false }, { status: 202 });
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await db
      .update(signalAudit)
      .set({ outcome: parsed.data.outcome })
      .where(eq(signalAudit.id, parsed.data.id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}

export async function GET() {
  try {
    const rows = await db.select().from(signalAudit).orderBy(desc(signalAudit.id)).limit(200);
    const [aggregate] = await db
      .select({
        total: sql<number>`count(*)::int`,
        hits: sql<number>`count(*) filter (where outcome = 'hit')::int`,
        misses: sql<number>`count(*) filter (where outcome = 'miss')::int`,
      })
      .from(signalAudit);
    return NextResponse.json({ rows, aggregate: aggregate ?? { total: 0, hits: 0, misses: 0 } });
  } catch {
    return NextResponse.json({ rows: [], aggregate: { total: 0, hits: 0, misses: 0 } });
  }
}
