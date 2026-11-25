import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  contractId: z.string().max(64).default(""),
  symbol: z.string().min(1).max(32),
  direction: z.string().max(32).default(""),
  stake: z.number().min(0).default(0),
  profit: z.number().default(0),
  tags: z.string().max(160).default(""),
  notes: z.string().min(1).max(4_000),
});

export async function GET() {
  try {
    const rows = await db.select().from(journalEntries).orderBy(desc(journalEntries.id)).limit(200);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid entry" }, { status: 400 });
    }
    const [row] = await db.insert(journalEntries).values(parsed.data).returning();
    return NextResponse.json({ row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Journal storage unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await db.delete(journalEntries).where(eq(journalEntries.id, id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
