import { NextResponse, type NextRequest } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { getOrderByRef, updateOrder } from "@/lib/repo";
import { failOrder, fulfillOrder } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paystack webhook. Signature: HMAC-SHA512 of the raw body using the secret key.
 * Always answer 200 fast so Paystack does not retry forever.
 */
export async function POST(req: NextRequest) {
  await ensureBootstrapped();
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const data = (event.data ?? {}) as Record<string, unknown>;
  const reference = String(data.reference ?? "");
  if (!reference) return NextResponse.json({ received: true });

  const order = await getOrderByRef(reference);
  if (!order) return NextResponse.json({ received: true, note: "unknown reference" });
  if (["paid", "delivered"].includes(order.status)) return NextResponse.json({ received: true, note: "already handled" });

  if (event.event === "charge.success") {
    const amount = Number(data.amount ?? 0);
    const currency = String(data.currency ?? order.currency);
    if (amount && amount < order.amount_cents) {
      await failOrder(order.id, `Underpayment: received ${amount} ${currency}, expected ${order.amount_cents}`);
      return NextResponse.json({ received: true, note: "underpayment" });
    }
    await updateOrder(order.id, {
      status: "paid",
      provider: "paystack",
      provider_ref: String((data as { id?: number | string }).id ?? data.reference ?? "paystack"),
      provider_payload: raw.slice(0, 8000),
    });
    await fulfillOrder(order.id);
    return NextResponse.json({ received: true, delivered: true });
  }

  return NextResponse.json({ received: true });
}
