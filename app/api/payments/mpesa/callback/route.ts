import { NextResponse, type NextRequest } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { all, get } from "@/lib/db";
import { updateOrder } from "@/lib/repo";
import { failOrder, fulfillOrder } from "@/lib/fulfillment";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safaricom Daraja STK push callback.
 * Body shape: { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } } }
 */
export async function POST(req: NextRequest) {
  await ensureBootstrapped();
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const body = (payload.Body ?? payload) as Record<string, unknown>;
  const cb = (body.stkCallback ?? body.StkCallback ?? body) as Record<string, unknown>;
  const checkoutId = String(cb.CheckoutRequestID ?? cb.checkoutRequestID ?? "");
  const resultCode = String(cb.ResultCode ?? cb.resultCode ?? "");
  const resultDesc = String(cb.ResultDesc ?? cb.resultDesc ?? "");

  const order = await get<Order>("SELECT * FROM orders WHERE provider_ref = $1 ORDER BY created_at DESC LIMIT 1", [checkoutId]);
  if (!order) {
    void all;
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  if (resultCode === "0") {
    const metadata = (cb.CallbackMetadata ?? cb.callbackMetadata) as { Item?: { Name?: string; Value?: unknown }[] } | undefined;
    const items = metadata?.Item ?? [];
    const mpesaReceipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value ?? "");
    const phone = String(items.find((i) => i.Name === "PhoneNumber")?.Value ?? order.phone ?? "");

    if (!["paid", "delivered"].includes(order.status)) {
      await updateOrder(order.id, {
        status: "paid",
        provider: "mpesa",
        provider_ref: mpesaReceipt || checkoutId,
        phone,
        provider_payload: JSON.stringify(payload).slice(0, 8000),
      });
      await fulfillOrder(order.id);
    }
  } else if (!["paid", "delivered"].includes(order.status)) {
    await failOrder(order.id, `M-Pesa: ${resultDesc || `code ${resultCode}`}`);
  }

  // Daraja expects a 200 with this shape, otherwise it retries.
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
