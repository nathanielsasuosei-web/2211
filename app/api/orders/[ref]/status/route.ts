import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { refreshOrderStatusAction } from "@/lib/actions/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled by the checkout + order pages while a payment is in flight. */
export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  await ensureBootstrapped();
  const { ref } = await ctx.params;
  const result = await refreshOrderStatusAction(ref);
  return NextResponse.json(result);
}
