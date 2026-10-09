import "server-only";
import { env } from "../config";

/**
 * Safaricom Daraja — M-Pesa STK Push (Lipa Na M-Pesa Online).
 * Docs: https://developer.safaricom.co.ke/docs
 *
 * When MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET are absent the module runs in
 * demo mode: it returns a simulated STK prompt so the whole purchase flow can
 * be exercised without credentials.
 */

let cachedToken: { value: string; expiresAt: number } | null = null;

export function mpesaEnabled(): boolean {
  return env.mpesa.enabled;
}

export function normaliseMpesaPhone(input: string): string | null {
  const digits = String(input || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  if (digits.startsWith("+254")) return digits.slice(1);
  return null;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const auth = Buffer.from(`${env.mpesa.consumerKey}:${env.mpesa.consumerSecret}`).toString("base64");
  const res = await fetch(`${env.mpesa.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; errorMessage?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.errorMessage ?? `M-Pesa auth failed (${res.status})`);
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return cachedToken.value;
}

export interface StkResult {
  ok: boolean;
  checkoutRequestID?: string;
  merchantRequestID?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  demo?: boolean;
  error?: string;
}

export async function sendStkPush(opts: {
  phone: string;
  amountKsh: number;
  accountReference: string;
  description?: string;
}): Promise<StkResult> {
  const phone = normaliseMpesaPhone(opts.phone);
  if (!phone) return { ok: false, error: "Enter a valid M-Pesa number, e.g. 0712 345 678." };

  if (!mpesaEnabled()) {
    return {
      ok: true,
      demo: true,
      checkoutRequestID: `demo_${Date.now()}`,
      merchantRequestID: `demo-merchant`,
      responseCode: "0",
      responseDescription: "Demo mode: simulated STK push sent.",
      customerMessage: `Demo prompt sent to ${phone}. Confirm to complete the payment.`,
    };
  }

  try {
    const token = await accessToken();
    const ts = timestamp();
    const password = Buffer.from(`${env.mpesa.shortCode}${env.mpesa.passkey}${ts}`).toString("base64");
    const callback =
      env.mpesa.callbackUrl || `${env.appUrl}/api/payments/mpesa/callback`;

    const res = await fetch(`${env.mpesa.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: env.mpesa.shortCode,
        Password: password,
        Timestamp: ts,
        TransactionType: env.mpesa.transactionType,
        Amount: Math.max(1, Math.round(opts.amountKsh)),
        PartyA: phone,
        PartyB: env.mpesa.shortCode,
        PhoneNumber: phone,
        CallBackURL: callback,
        AccountReference: opts.accountReference.slice(0, 12),
        TransactionDesc: (opts.description ?? "Beat purchase").slice(0, 13),
      }),
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      errorMessage?: string;
    };
    return {
      ok: res.ok && data.ResponseCode === "0",
      checkoutRequestID: data.CheckoutRequestID,
      merchantRequestID: data.MerchantRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription ?? data.errorMessage,
      customerMessage: data.CustomerMessage,
      error: res.ok ? undefined : (data.errorMessage ?? `M-Pesa error (${res.status})`),
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function queryStkPush(checkoutRequestID: string) {
  if (!mpesaEnabled() || !checkoutRequestID) return null;
  try {
    const token = await accessToken();
    const ts = timestamp();
    const password = Buffer.from(`${env.mpesa.shortCode}${env.mpesa.passkey}${ts}`).toString("base64");
    const res = await fetch(`${env.mpesa.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: env.mpesa.shortCode,
        Password: password,
        Timestamp: ts,
        CheckoutRequestID: checkoutRequestID,
      }),
      cache: "no-store",
    });
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
