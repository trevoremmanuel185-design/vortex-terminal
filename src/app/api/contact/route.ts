import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(160),
  topic: z.string().max(60).default("General"),
  message: z.string().min(5).max(4_000),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message" }, { status: 400 });
    }
    await db.insert(contactMessages).values(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    // The WhatsApp / mailto hand-off still works without persistence.
    return NextResponse.json({ ok: true, persisted: false }, { status: 202 });
  }
}
