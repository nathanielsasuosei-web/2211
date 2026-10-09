import { env } from "@/lib/config";
import type { Order } from "@/lib/types";

export type PaymentOption = {
  id: Order["method"];
  label: string;
  blurb: string;
  available: boolean;
  demo: boolean;
  reason?: string;
  icon: "phone" | "card" | "bank";
};

/** Which payment rails can be offered for a given order. */
export function getPaymentOptions(order: Pick<Order, "currency" | "amount_cents">): PaymentOption[] {
  const paystackLive = env.paystack.enabled;
  const mpesaLive = env.mpesa.enabled;
  const mpesaCurrencyOk = order.currency === "KES";

  return [
    {
      id: "paystack",
      label: "Mobile money, card or bank — Paystack",
      blurb:
        "MTN MoMo, Telecel Cash, AirtelTigo Money, Visa/Mastercard, bank transfer and USSD. Secure hosted checkout, instant delivery.",
      available: true,
      demo: !paystackLive,
      reason: paystackLive ? undefined : "PAYSTACK_SECRET_KEY not set — runs as a simulated checkout.",
      icon: "card",
    },
    {
      id: "mpesa",
      label: "M-Pesa STK push (Lipa Na M-Pesa)",
      blurb: mpesaCurrencyOk
        ? "A prompt is pushed to your phone. Enter your M-Pesa PIN to pay — delivery is automatic."
        : "A prompt is pushed to your Safaricom line. Enter your M-Pesa PIN to pay — delivery is automatic.",
      available: true,
      demo: !mpesaLive,
      reason: mpesaLive
        ? mpesaCurrencyOk
          ? undefined
          : "M-Pesa settles in KES — the order amount will be charged as KES."
        : "Daraja keys not set — runs as a simulated STK prompt.",
      icon: "phone",
    },
    {
      id: "bank",
      label: env.bank.enabled ? "Bank transfer / MoMo (manual)" : "Bank transfer",
      blurb: `Send ${env.bank.name} · ${env.bank.accountName} · ${env.bank.accountNumber} or ${env.bank.momoName} ${env.bank.momoNumber}, then submit your transaction reference. Files are released as soon as the producer confirms.`,
      available: env.bank.enabled,
      demo: false,
      reason: env.bank.enabled ? undefined : "Disabled in settings.",
      icon: "bank",
    },
  ];
}

export function describeMethod(method: string): string {
  const map: Record<string, string> = {
    mpesa: "M-Pesa STK push",
    paystack: "Paystack (card / mobile money / bank)",
    bank: "Bank or mobile money transfer",
    demo: "Simulated checkout",
    free: "Free download",
  };
  return map[method] ?? method;
}
