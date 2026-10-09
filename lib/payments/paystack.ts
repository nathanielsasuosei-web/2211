import "server-only";
import crypto from "node:crypto";
import { env } from "../config";

/**
 * Paystack — cards, bank transfer, USSD and mobile money (MTN MoMo / Telecel
 * Cash / AirtelTigo) across Ghana, Nigeria, Kenya and South Africa.
 * Docs: https://paystack.com/docs/api
 *
 * Without PAYSTACK_SECRET_KEY the module runs in demo mode and returns a local
 * hosted checkout page so the flow can be tested end-to-end.
 */

const API = "https://api.paystack.co";

export function paystackEnabled(): boolean {
  return env.paystack.enabled;
}

async function paystackFetch(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.paystack.secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  return { ok: res.ok && data.status !== false, httpStatus: res.status, ...data };
}

export interface InitializeResult {
  ok: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference: string;
  demo?: boolean;
  error?: string;
}

export async function initializeTransaction(opts: {
  email: string;
  amountMinor: number; // pesewas / kobo
  currency: string;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  if (!paystackEnabled()) {
    return {
      ok: true,
      demo: true,
      reference: opts.reference,
      authorizationUrl: `${env.appUrl}/checkout/demo/${opts.reference}`,
    };
  }
  const result = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: opts.email,
      amount: Math.max(50, Math.round(opts.amountMinor)),
      currency: opts.currency,
      reference: opts.reference,
      callback_url: `${env.appUrl}/api/payments/paystack/callback?reference=${encodeURIComponent(opts.reference)}`,
      metadata: {
        ...(opts.metadata ?? {}),
        app: env.appName,
        cancel_action: `${env.appUrl}/order/${opts.reference}`,
      },
    }),
  });
  const data = (result.data ?? {}) as { authorization_url?: string; access_code?: string; reference?: string };
  return {
    ok: result.ok && Boolean(data.authorization_url),
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference ?? opts.reference,
    error: result.ok ? undefined : (result.message ?? `Paystack error (${result.httpStatus})`),
  };
}

export interface VerifyResult {
  ok: boolean;
  status?: string;
  amount?: number;
  currency?: string;
  gateway?: string;
  channel?: string;
  reference: string;
  paidAt?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (!paystackEnabled()) {
    return { ok: false, reference, status: "demo", error: "Paystack is not configured." };
  }
  const result = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
  const data = (result.data ?? {}) as Record<string, unknown>;
  return {
    ok: result.ok && data.status === "success",
    status: String(data.status ?? "unknown"),
    amount: Number(data.amount ?? 0),
    currency: String(data.currency ?? ""),
    gateway: String(data.gateway ?? ""),
    channel: String(data.channel ?? ""),
    reference,
    paidAt: data.paid_at ? String(data.paid_at) : undefined,
    raw: data,
    error: result.ok ? undefined : (result.message ?? "Verification failed"),
  };
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !env.paystack.secretKey) return false;
  const hash = crypto.createHmac("sha512", env.paystack.secretKey).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}
