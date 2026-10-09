import { NextResponse, type NextRequest } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { env } from "@/lib/config";
import { verifyTransaction } from "@/lib/payments/paystack";
import { getOrderByRef, updateOrder } from "@/lib/repo";
import { failOrder, fulfillOrder } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paystack redirect target. We never trust the browser: the transaction is
 * verified server-to-server before anything is delivered.
 */
export async function GET(req: NextRequest) {
  await ensureBootstrapped();
  const reference = req.nextUrl.searchParams.get("reference") ?? "";
  const trxref = req.nextUrl.searchParams.get("trxref") ?? reference;
  if (!reference) return NextResponse.redirect(`${env.appUrl}/studio?tab=orders`);

  const order = await getOrderByRef(reference);
  if (!order) return NextResponse.redirect(`${env.appUrl}/studio?tab=orders`);

  if (["paid", "delivered"].includes(order.status)) {
    return NextResponse.redirect(`${env.appUrl}/order/${order.reference}?status=delivered`);
  }

  const verified = await verifyTransaction(trxref || reference);
  if (verified.ok) {
    await updateOrder(order.id, {
      status: "paid",
      provider: "paystack",
      provider_ref: verified.reference,
      provider_payload: JSON.stringify(verified.raw ?? {}).slice(0, 8000),
    });
    await fulfillOrder(order.id);
    return NextResponse.redirect(`${env.appUrl}/order/${order.reference}?status=delivered`);
  }

  await failOrder(order.id, `Paystack reported: ${verified.status}`);
  return NextResponse.redirect(`${env.appUrl}/order/${order.reference}?status=failed`);
}
