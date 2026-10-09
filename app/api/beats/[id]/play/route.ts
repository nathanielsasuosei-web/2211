import { NextResponse, type NextRequest } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getBeatById, recordPlay } from "@/lib/repo";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureBootstrapped();
  const { id } = await ctx.params;
  const beat = await getBeatById(id);
  if (!beat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  await recordPlay(id, session?.id ?? null);
  return NextResponse.json({ ok: true, plays: (beat.plays ?? 0) + 1 });
}
