"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { env, moneyLabel } from "@/lib/config";
import { getSession } from "@/lib/auth";
import {
  createMessage,
  createOrder,
  getBeatById,
  getOrderByRef,
  getUserById,
  getUserByEmail,
  listLicenses,
  updateOrder,
} from "@/lib/repo";
import { all } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { bankTransferEmail, orderCreatedEmail, pendingBankOrderAdminEmail } from "@/lib/emails";
import { fulfillOrder, failOrder } from "@/lib/fulfillment";
import { initializeTransaction, verifyTransaction } from "@/lib/payments/paystack";
import { normaliseMpesaPhone, sendStkPush, queryStkPush } from "@/lib/payments/mpesa";
import { notifyProducerOrder } from "@/lib/whatsapp";
import type { ActionState } from "./auth";

async function getAdminUserId(): Promise<string | null> {
  try {
    const admin = await getUserByEmail(env.adminEmail);
    if (admin) return admin.id;
    // fallback: first admin
    const rows = await all<{ id: string }>("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1");
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Create order                                                        */
/* ------------------------------------------------------------------ */

export async function createOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await ensureBootstrapped();
  const session = await getSession();
  const beatId = String(formData.get("beat_id") ?? "");
  const licenseId = String(formData.get("license_id") ?? "");

  if (!session) {
    // Send visitors to create an account, then straight back to this beat.
    const beat = await getBeatById(beatId);
    const back = beat ? `/beats/${beat.slug}?license=${encodeURIComponent(licenseId)}` : "/beats";
    redirect(`/signup?next=${encodeURIComponent(back)}`);
  }

  const beat = await getBeatById(beatId);
  if (!beat || !beat.published) return { ok: false, error: "That beat is no longer available." };
  if (beat.exclusive_sold) return { ok: false, error: "This beat has already been sold exclusively." };

  const licenses = await listLicenses(beat.id);
  const license = licenseId ? licenses.find((l) => l.id === licenseId) ?? null : (licenses[0] ?? null);
  const amount = license ? license.price_cents : beat.price_cents;
  const currency = license?.currency ?? beat.currency;

  // Free beat → deliver immediately.
  if (amount <= 0 || beat.is_free) {
    const freeOrder = await createOrder({
      user_id: session.id,
      beat_id: beat.id,
      license_id: license?.id ?? null,
      amount_cents: 0,
      currency,
      method: "demo",
      status: "paid",
      provider: "free",
    });
    await fulfillOrder(freeOrder.id);
    revalidatePath("/studio");
    redirect(`/order/${freeOrder.reference}?status=delivered`);
  }

  const order = await createOrder({
    user_id: session.id,
    beat_id: beat.id,
    license_id: license?.id ?? null,
    amount_cents: amount,
    currency,
    method: "paystack",
    status: "pending",
    expires_in_minutes: 60,
  });

  const user = await getUserById(session.id);
  if (user) {
    const mail = await orderCreatedEmail({ order, beat, license, user });
    await sendMail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      userId: user.id,
      orderId: order.id,
    });

    // ── Producer notification on website + WhatsApp ──
    try {
      const adminId = await getAdminUserId();
      await createMessage({
        direction: "inbound",
        kind: "order",
        from_user_id: user.id,
        to_user_id: adminId,
        from_name: user.name,
        from_email: user.email,
        subject: `New booking: ${beat.title} - ${license?.name ?? "Standard"} (${order.reference})`,
        body: `New booking order received:\n\nBeat: ${beat.title} (${beat.genre})\nLicence: ${license?.name ?? "Standard"}\nAmount: ${moneyLabel(order.amount_cents, order.currency)}\nBuyer: ${user.name} <${user.email}>\nPhone: ${user.phone ?? "—"}\nReference: ${order.reference}\nStatus: ${order.status}\n\nView in admin: ${env.appUrl}/admin/orders?ref=${order.reference}`,
        order_id: order.id,
        beat_id: beat.id,
      });

      await notifyProducerOrder({
        reference: order.reference,
        beatTitle: beat.title,
        beatGenre: beat.genre,
        licenseName: license?.name ?? "Standard",
        amount: moneyLabel(order.amount_cents, order.currency),
        currency: order.currency,
        method: order.method,
        buyerName: user.name,
        buyerEmail: user.email,
        buyerPhone: user.phone,
        status: order.status,
      }, "new");
    } catch (err) {
      console.error("[checkout] producer notify failed (new order):", err);
    }
  }

  redirect(`/checkout/${order.reference}`);
}

/* ------------------------------------------------------------------ */
/* Start a payment                                                     */
/* ------------------------------------------------------------------ */

const startSchema = z.object({
  reference: z.string().min(3),
  method: z.enum(["mpesa", "paystack", "bank", "demo"]),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
});

export async function startPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await ensureBootstrapped();
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in to pay." };

  const parsed = startSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment request." };
  const { reference, method } = parsed.data;

  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.user_id !== session.id && session.role !== "admin") return { ok: false, error: "This order belongs to another account." };
  if (["paid", "delivered"].includes(order.status)) return { ok: true, message: "Already paid." };

  const beat = await getBeatById(order.beat_id);
  const user = await getUserById(order.user_id);
  if (!beat || !user) return { ok: false, error: "Order data is incomplete." };

  await updateOrder(order.id, { method, status: "awaiting_payment", provider: method });

  /* ---- Paystack hosted checkout -------------------------------- */
  if (method === "paystack") {
    const init = await initializeTransaction({
      email: user.email,
      amountMinor: order.amount_cents,
      currency: order.currency,
      reference: order.reference,
      metadata: {
        beat: beat.title,
        beat_id: beat.id,
        order_id: order.id,
        customer_name: user.name,
        customer_phone: user.phone ?? parsed.data.phone ?? "",
      },
    });
    await updateOrder(order.id, { provider_ref: init.reference, phone: parsed.data.phone || user.phone });
    if (!init.ok) return { ok: false, error: init.error ?? "Could not start the Paystack checkout." };
    return {
      ok: true,
      message: init.demo ? "Opening the simulated secure checkout…" : "Redirecting to Paystack…",
      redirect: init.authorizationUrl,
    };
  }

  /* ---- M-Pesa STK push ------------------------------------------ */
  if (method === "mpesa") {
    const phone = normaliseMpesaPhone(parsed.data.phone || user.phone || "");
    if (!phone) return { ok: false, error: "Enter a valid M-Pesa number, e.g. 0712 345 678." };
    const amountKsh = Math.max(1, Math.round(order.amount_cents / 100));
    const result = await sendStkPush({
      phone,
      amountKsh,
      accountReference: order.reference.slice(-8),
      description: `${beat.title} licence`,
    });
    if (!result.ok) return { ok: false, error: result.error ?? "M-Pesa rejected the request." };
    await updateOrder(order.id, {
      phone,
      provider_ref: result.checkoutRequestID ?? null,
      provider_payload: JSON.stringify(result),
      status: "awaiting_payment",
    });
    return {
      ok: true,
      message:
        result.customerMessage ??
        `STK prompt sent to ${phone}. Enter your M-Pesa PIN to complete the payment.`,
    };
  }

  /* ---- Bank / manual mobile money ------------------------------- */
  if (method === "bank") {
    await updateOrder(order.id, { status: "awaiting_payment", phone: parsed.data.phone || user.phone });
    const mail = await bankTransferEmail({ order, beat, user });
    await sendMail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      userId: user.id,
      orderId: order.id,
    });
    return {
      ok: true,
      message: `Transfer details emailed to ${user.email}. Send the payment, then submit your transaction reference below.`,
    };
  }

  /* ---- Simulated checkout (no gateway keys configured) ---------- */
  await updateOrder(order.id, { status: "awaiting_payment", provider: "demo" });
  redirect(`/checkout/demo/${order.reference}`);
}

/* ------------------------------------------------------------------ */
/* Bank transfer confirmation                                          */
/* ------------------------------------------------------------------ */

export async function confirmBankPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await ensureBootstrapped();
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in." };

  const reference = String(formData.get("reference") ?? "");
  const bankReference = String(formData.get("bank_reference") ?? "").trim();
  const note = String(formData.get("bank_note") ?? "").trim().slice(0, 500);

  if (bankReference.length < 4) return { ok: false, error: "Enter the transaction reference from your bank or MoMo SMS." };

  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.user_id !== session.id) return { ok: false, error: "This order belongs to another account." };
  if (["paid", "delivered"].includes(order.status)) return { ok: true, message: "Payment already confirmed." };

  await updateOrder(order.id, {
    status: "in_review",
    method: "bank",
    bank_reference: bankReference,
    bank_note: note || null,
  });

  const beat = await getBeatById(order.beat_id);
  const user = await getUserById(order.user_id);
  if (beat && user) {
    const mail = await pendingBankOrderAdminEmail({ order, beat, buyer: user });
    await sendMail({ to: env.adminMail, subject: mail.subject, html: mail.html, text: mail.text, orderId: order.id });

    // Message to buyer
    await createMessage({
      direction: "outbound",
      kind: "order",
      to_user_id: user.id,
      from_name: env.appName,
      from_email: env.supportMail,
      subject: "Payment reference received",
      body: `We received your transfer reference ${bankReference} for ${beat.title}. Your files are released the moment the producer confirms the payment.`,
      order_id: order.id,
      beat_id: beat.id,
    });

    // ── Producer inbox + WhatsApp for bank submission ──
    try {
      const adminId = await getAdminUserId();
      await createMessage({
        direction: "inbound",
        kind: "order",
        from_user_id: user.id,
        to_user_id: adminId,
        from_name: user.name,
        from_email: user.email,
        subject: `Bank payment submitted: ${beat.title} (${order.reference}) - ${bankReference}`,
        body: `Bank/MoMo payment submitted:\n\nBeat: ${beat.title}\nAmount: ${moneyLabel(order.amount_cents, order.currency)}\nBuyer: ${user.name} <${user.email}>\nPhone: ${user.phone ?? "—"}\nBank ref: ${bankReference}\nNote: ${note || "—"}\nOrder ref: ${order.reference}\n\nVerify and approve in admin: ${env.appUrl}/admin/orders?ref=${order.reference}`,
        order_id: order.id,
        beat_id: beat.id,
      });

      await notifyProducerOrder({
        reference: order.reference,
        beatTitle: beat.title,
        beatGenre: beat.genre,
        licenseName: undefined,
        amount: moneyLabel(order.amount_cents, order.currency),
        currency: order.currency,
        method: "bank",
        buyerName: user.name,
        buyerEmail: user.email,
        buyerPhone: user.phone,
        bankReference,
        status: "in_review",
      }, "bank_submitted");
    } catch (err) {
      console.error("[checkout] producer notify failed (bank):", err);
    }
  }

  revalidatePath("/studio");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/messages");
  return {
    ok: true,
    message: "Reference submitted. We are verifying it now — you will get an email with your files as soon as it clears.",
  };
}

/* ------------------------------------------------------------------ */
/* Simulated payment (demo mode)                                       */
/* ------------------------------------------------------------------ */

export async function simulatePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await ensureBootstrapped();
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in." };
  const reference = String(formData.get("reference") ?? "");
  const outcome = String(formData.get("outcome") ?? "success");

  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.user_id !== session.id && session.role !== "admin") return { ok: false, error: "Not your order." };

  if (outcome === "failure") {
    await failOrder(order.id, "Simulated payment declined by the customer.");
    revalidatePath(`/order/${order.reference}`);
    return { ok: true, message: "Simulated a declined payment." };
  }

  await updateOrder(order.id, {
    status: "paid",
    provider: order.provider ?? "demo",
    provider_ref: order.provider_ref ?? `demo_${Date.now()}`,
    provider_payload: JSON.stringify({ simulated: true, at: new Date().toISOString() }),
  });
  await fulfillOrder(order.id);
  revalidatePath("/studio");
  revalidatePath(`/order/${order.reference}`);
  redirect(`/order/${order.reference}?status=delivered`);
}

/* ------------------------------------------------------------------ */
/* Status polling + provider re-check                                  */
/* ------------------------------------------------------------------ */

export async function refreshOrderStatusAction(reference: string): Promise<{
  status: string;
  message: string;
  delivered: boolean;
}> {
  await ensureBootstrapped();
  const order = await getOrderByRef(reference);
  if (!order) return { status: "unknown", message: "Order not found.", delivered: false };

  if (["paid", "delivered"].includes(order.status)) {
    return { status: order.status, message: "Payment confirmed — your files are on the way.", delivered: true };
  }

  // M-Pesa: ask Daraja whether the checkout completed.
  if (order.method === "mpesa" && order.provider_ref && env.mpesa.enabled) {
    const result = await queryStkPush(order.provider_ref);
    const payload = result as { ResultCode?: string; ResultDesc?: string } | null;
    if (payload?.ResultCode === "0") {
      await updateOrder(order.id, {
        status: "paid",
        provider_payload: JSON.stringify(payload),
      });
      await fulfillOrder(order.id);
      return { status: "delivered", message: "M-Pesa payment confirmed — files delivered.", delivered: true };
    }
    if (payload?.ResultCode && payload.ResultCode !== "1032") {
      await failOrder(order.id, String(payload.ResultDesc ?? "M-Pesa checkout failed"));
      return { status: "failed", message: String(payload.ResultDesc ?? "Payment failed."), delivered: false };
    }
    return { status: order.status, message: "Waiting for you to enter your M-Pesa PIN…", delivered: false };
  }

  // Paystack: verify the transaction directly (covers lost webhooks).
  if (order.method === "paystack" && env.paystack.enabled) {
    const verified = await verifyTransaction(order.reference);
    if (verified.ok) {
      await updateOrder(order.id, {
        status: "paid",
        provider_ref: verified.reference,
        provider_payload: JSON.stringify(verified.raw ?? {}),
      });
      await fulfillOrder(order.id);
      return { status: "delivered", message: "Payment confirmed — files delivered.", delivered: true };
    }
    if (verified.status === "failed" || verified.status === "abandoned") {
      await failOrder(order.id, `Paystack reported: ${verified.status}`);
      return { status: "failed", message: "The payment was not completed.", delivered: false };
    }
  }

  if (order.status === "in_review") {
    return { status: "in_review", message: "Your transfer is being verified by the producer.", delivered: false };
  }
  return { status: order.status, message: "Still awaiting payment.", delivered: false };
}

export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in." };
  const reference = String(formData.get("reference") ?? "");
  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.user_id !== session.id && session.role !== "admin") return { ok: false, error: "Not your order." };
  if (["paid", "delivered"].includes(order.status)) return { ok: false, error: "Paid orders cannot be cancelled." };
  await updateOrder(order.id, { status: "cancelled" });
  revalidatePath("/studio");
  return { ok: true, message: "Order cancelled." };
}

export async function retryOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const reference = String(formData.get("reference") ?? "");
  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  await updateOrder(order.id, { status: "pending", failure_reason: null });
  revalidatePath(`/checkout/${reference}`);
  redirect(`/checkout/${reference}`);
}

/* ------------------------------------------------------------------ */
/* Free downloads                                                      */
/* ------------------------------------------------------------------ */

export async function claimFreeBeatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect(`/login?next=/beats`);
  const beatId = String(formData.get("beat_id") ?? "");
  const beat = await getBeatById(beatId);
  if (!beat) return { ok: false, error: "Beat not found." };
  if (!beat.is_free && beat.price_cents > 0) return { ok: false, error: "This beat is not free." };

  const licenses = await listLicenses(beat.id);
  const order = await createOrder({
    user_id: session!.id,
    beat_id: beat.id,
    license_id: licenses[0]?.id ?? null,
    amount_cents: 0,
    currency: beat.currency,
    method: "demo",
    status: "paid",
    provider: "free",
  });
  await fulfillOrder(order.id);
  revalidatePath("/studio");
  redirect(`/order/${order.reference}?status=delivered`);
}
