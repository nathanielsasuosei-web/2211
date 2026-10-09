"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  confirmBankPaymentAction,
  startPaymentAction,
  cancelOrderAction,
} from "@/lib/actions/checkout";
import { useActionToast } from "./Toast";
import { IconBank, IconBolt, IconCard, IconCheck, IconClock, IconPhone, IconShield } from "./icons";
import { moneyLabel } from "@/lib/money";
import type { PaymentOption } from "@/lib/payments/options";

export type BankDetails = {
  name: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  swift: string;
  momoName: string;
  momoNumber: string;
  instructions: string;
};

const ICONS = { phone: IconPhone, card: IconCard, bank: IconBank } as const;

export default function CheckoutPanel({
  reference,
  amountCents,
  currency,
  options,
  bank,
  defaultPhone,
  initialStatus,
}: {
  reference: string;
  amountCents: number;
  currency: string;
  options: PaymentOption[];
  bank: BankDetails;
  defaultPhone?: string | null;
  initialStatus: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<string>(options.find((o) => o.available)?.id ?? "paystack");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [payState, payAction, paying] = useActionState(startPaymentAction, undefined);
  const [bankState, bankAction, bankPending] = useActionState(confirmBankPaymentAction, undefined);
  const [cancelState, cancelAction] = useActionState(cancelOrderAction, undefined);
  const [status, setStatus] = useState(initialStatus);
  const [statusNote, setStatusNote] = useState("Choose a payment method to continue.");
  const [bankRef, setBankRef] = useState("");
  const [bankNote, setBankNote] = useState("");
  const pollRef = useRef<number | null>(null);

  useActionToast(payState);
  useActionToast(bankState);
  useActionToast(cancelState);

  /* provider redirect (Paystack hosted checkout / demo gateway) */
  useEffect(() => {
    if (payState?.redirect) {
      setStatusNote(payState.message ?? "Redirecting to the secure checkout…");
      window.setTimeout(() => {
        window.location.href = payState.redirect!;
      }, 500);
    }
  }, [payState]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/status`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status: string; message: string; delivered: boolean };
      setStatus(data.status);
      setStatusNote(data.message);
      if (data.delivered) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        router.push(`/order/${reference}?status=delivered`);
      }
    } catch {
      /* keep polling */
    }
  }, [reference, router]);

  /* poll while a payment is in flight */
  useEffect(() => {
    const inFlight = ["awaiting_payment", "pending", "in_review"].includes(status);
    if (!inFlight) return;
    pollRef.current = window.setInterval(poll, 4000);
    void poll();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [poll, status]);

  const selected = options.find((o) => o.id === method);
  const Icon = selected ? ICONS[selected.icon] : IconCard;
  const needsPhone = method === "mpesa";
  const isBank = method === "bank";

  const steps = [
    { label: "Order created", done: true },
    { label: "Payment started", done: ["awaiting_payment", "in_review", "paid", "delivered"].includes(status) },
    { label: "Payment confirmed", done: ["paid", "delivered"].includes(status) },
    { label: "Files emailed + unlocked in Vault", done: status === "delivered" },
  ];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="panel pad-lg stack" style={{ gap: 16 }}>
        <div className="row row--between row--wrap" style={{ gap: 10 }}>
          <span className="eyebrow">Secure checkout</span>
          <span className="chip chip--red">
            <IconShield size={13} /> Order {reference}
          </span>
        </div>

        <div className="method-grid">
          {options.map((opt) => {
            const OptIcon = ICONS[opt.icon];
            return (
              <label key={opt.id} className="method" data-selected={method === opt.id}>
                <input
                  type="radio"
                  name="method"
                  value={opt.id}
                  checked={method === opt.id}
                  onChange={() => setMethod(opt.id)}
                  disabled={!opt.available}
                />
                <span className="stack" style={{ gap: 5 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <OptIcon size={16} className="red" />
                    <h4>{opt.label}</h4>
                  </span>
                  <p>{opt.blurb}</p>
                  {opt.demo && <span className="chip chip--warn">Demo mode — no real charge</span>}
                  {opt.reason && !opt.demo && <span className="chip">{opt.reason}</span>}
                </span>
              </label>
            );
          })}
        </div>

        <form action={payAction} className="stack" style={{ gap: 14 }}>
          <input type="hidden" name="reference" value={reference} />
          <input type="hidden" name="method" value={method} />

          {needsPhone && (
            <div className="field">
              <label htmlFor="mpesa-phone">M-Pesa phone number</label>
              <input
                id="mpesa-phone"
                name="phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678 or 254712345678"
                inputMode="tel"
                required
              />
              <span className="hint">
                You will receive an STK push on this line. Enter your M-Pesa PIN to pay {moneyLabel(amountCents, "KES")}.
              </span>
            </div>
          )}

          {!needsPhone && !isBank && (
            <div className="field">
              <label htmlFor="pay-phone">Mobile money number (optional)</label>
              <input
                id="pay-phone"
                name="phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233 24 000 0000"
                inputMode="tel"
              />
              <span className="hint">
                Saved to your profile so Paystack can offer MTN MoMo / Telecel Cash at checkout.
              </span>
            </div>
          )}

          {payState?.error && <div className="form-error">{payState.error}</div>}
          {payState?.ok && payState.message && !payState.redirect && <div className="form-ok">{payState.message}</div>}

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={paying}>
            {paying ? (
              "Contacting payment provider…"
            ) : (
              <>
                <Icon size={17} />
                {method === "mpesa"
                  ? `Send M-Pesa prompt — ${moneyLabel(amountCents, currency)}`
                  : method === "bank"
                    ? "Show transfer details"
                    : `Pay ${moneyLabel(amountCents, currency)} securely`}
              </>
            )}
          </button>

          <p className="tiny dim center" style={{ margin: 0 }}>
            By paying you accept the{" "}
            <Link href="/licensing" className="red">licence terms</Link>. Files are delivered by email immediately after
            confirmation.
          </p>
        </form>
      </div>

      {isBank && (
        <div className="panel panel--flat pad-lg stack" style={{ gap: 14 }}>
          <h3 className="display h-sm">Bank &amp; mobile money details</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div className="panel pad stack" style={{ gap: 6 }}>
              <span className="chip chip--red"><IconBank size={13} /> Bank transfer</span>
              <span className="tiny dim">Bank</span>
              <strong>{bank.name}</strong>
              <span className="tiny dim">Account name</span>
              <strong>{bank.accountName}</strong>
              <span className="tiny dim">Account number</span>
              <strong className="mono">{bank.accountNumber}</strong>
              <span className="tiny dim">Branch / SWIFT</span>
              <span className="mono muted">{bank.branch} · {bank.swift}</span>
            </div>
            <div className="panel pad stack" style={{ gap: 6 }}>
              <span className="chip chip--red"><IconPhone size={13} /> Mobile money</span>
              <span className="tiny dim">Network</span>
              <strong>{bank.momoName}</strong>
              <span className="tiny dim">Number</span>
              <strong className="mono">{bank.momoNumber}</strong>
              <span className="tiny dim">Amount</span>
              <strong>{moneyLabel(amountCents, currency)}</strong>
              <span className="tiny dim">Reference to quote</span>
              <strong className="mono">{reference}</strong>
            </div>
          </div>
          <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>{bank.instructions}</p>

          <form action={bankAction} className="stack" style={{ gap: 12 }}>
            <input type="hidden" name="reference" value={reference} />
            <div className="form-grid">
              <div className="field">
                <label htmlFor="bank-ref">Transaction reference from your SMS/receipt</label>
                <input
                  id="bank-ref"
                  name="bank_reference"
                  className="input"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  required
                  minLength={4}
                  placeholder="e.g. MP161234567890"
                />
              </div>
              <div className="field">
                <label htmlFor="bank-note">Note (optional)</label>
                <input
                  id="bank-note"
                  name="bank_note"
                  className="input"
                  value={bankNote}
                  onChange={(e) => setBankNote(e.target.value)}
                  placeholder="Sent from MTN MoMo at 14:32"
                />
              </div>
            </div>
            <button type="submit" className="btn btn--outline btn--block" disabled={bankPending}>
              {bankPending ? "Submitting…" : "I have paid — submit reference"}
            </button>
            <p className="tiny dim" style={{ margin: 0 }}>
              The producer verifies manual payments and your files are emailed the moment it clears.
            </p>
          </form>
        </div>
      )}

      <div className="panel panel--flat pad-lg stack" style={{ gap: 14 }}>
        <div className="row row--between row--wrap" style={{ gap: 10 }}>
          <h3 className="display h-sm">Order status</h3>
          <span className="row" style={{ gap: 8 }}>
            <span className="chip chip--red"><IconClock size={12} /> {statusNote}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={poll}>
              Refresh
            </button>
          </span>
        </div>

        <div className="timeline">
          {steps.map((s) => (
            <div key={s.label} className="timeline__item" data-done={s.done}>
              <span className="timeline__dot">{s.done ? <IconCheck size={11} /> : ""}</span>
              <span className="stack" style={{ gap: 2 }}>
                <strong style={{ fontSize: 14.5 }}>{s.label}</strong>
                <span className="tiny dim">{s.done ? "Completed" : "Pending"}</span>
              </span>
            </div>
          ))}
        </div>

        {status === "failed" && (
          <div className="form-error stack" style={{ gap: 8 }}>
            <span>This payment did not complete. You can retry with a different method.</span>
            <span className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setStatus("pending")}>
                <IconBolt size={13} /> Try again
              </button>
              <Link href="/beats" className="btn btn--ghost btn--sm">Back to the store</Link>
            </span>
          </div>
        )}

        <div className="row row--wrap" style={{ gap: 10 }}>
          <Link href="/studio?tab=orders" className="btn btn--ghost btn--sm">View all my orders</Link>
          {!["paid", "delivered"].includes(status) && (
            <form action={cancelAction} style={{ display: "inline" }}>
              <input type="hidden" name="reference" value={reference} />
              <button type="submit" className="btn btn--ghost btn--sm" style={{ color: "#ff9d9d" }}>
                Cancel this order
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
