"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { simulatePaymentAction } from "@/lib/actions/checkout";
import { useActionToast } from "./Toast";
import { IconBolt, IconCard, IconPhone, IconShield } from "./icons";

/**
 * Simulated hosted checkout. Appears when Paystack / Daraja keys are not set so
 * the whole purchase → email delivery flow can be demonstrated.
 */
export default function DemoCheckout({
  reference,
  amount,
  beatTitle,
  artwork,
  email,
  phone,
}: {
  reference: string;
  amount: string;
  beatTitle: string;
  artwork?: string | null;
  email: string;
  phone?: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(simulatePaymentAction, undefined);
  const [step, setStep] = useState<"form" | "processing">("form");
  const [network, setNetwork] = useState("MTN Mobile Money");
  useActionToast(state);

  useEffect(() => {
    if (state?.redirect) router.push(state.redirect);
  }, [router, state]);

  return (
    <div className="panel pad-lg stack" style={{ gap: 18 }}>
      <div className="row row--between" style={{ gap: 10 }}>
        <span className="row" style={{ gap: 9 }}>
          <span className="chip chip--red"><IconShield size={13} /></span>
          <strong style={{ letterSpacing: "0.02em" }}>Secure checkout</strong>
        </span>
        <span className="tiny dim mono">{reference}</span>
      </div>

      <div className="row" style={{ gap: 14 }}>
        {artwork && (
          <div style={{ width: 68, height: 68, borderRadius: 13, overflow: "hidden", flex: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artwork} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny dim">Paying for</span>
          <strong style={{ fontSize: 17 }}>{beatTitle}</strong>
          <span className="red display" style={{ fontSize: 26 }}>{amount}</span>
        </div>
      </div>

      <hr className="divider" />

      <div className="stack" style={{ gap: 12 }}>
        <span className="tiny dim">Simulated payment rails — no real money moves in demo mode.</span>
        <div className="method-grid" style={{ gridTemplateColumns: "1fr" }}>
          {[
            { id: "MTN Mobile Money", icon: IconPhone, note: phone ?? "+233 24 000 0000" },
            { id: "Telecel Cash", icon: IconPhone, note: "Prompt sent to your handset" },
            { id: "Visa / Mastercard", icon: IconCard, note: email },
          ].map((opt) => (
            <label key={opt.id} className="method" data-selected={network === opt.id}>
              <input type="radio" name="network" value={opt.id} checked={network === opt.id} onChange={() => setNetwork(opt.id)} />
              <span className="stack" style={{ gap: 4 }}>
                <span className="row" style={{ gap: 8 }}>
                  <opt.icon size={15} className="red" />
                  <h4>{opt.id}</h4>
                </span>
                <p>{opt.note}</p>
              </span>
            </label>
          ))}
        </div>
      </div>

      <form
        action={action}
        className="stack"
        style={{ gap: 12 }}
        onSubmit={() => setStep("processing")}
      >
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="outcome" value="success" />

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending || step === "processing"}>
          {pending || step === "processing" ? (
            "Authorising payment…"
          ) : (
            <>
              <IconBolt size={17} /> Approve &amp; pay {amount}
            </>
          )}
        </button>

        <div className="row" style={{ gap: 10 }}>
          <button
            type="submit"
            formNoValidate
            className="btn btn--ghost btn--sm grow"
            name="outcome"
            value="failure"
            disabled={pending}
          >
            Simulate a declined payment
          </button>
          <Link href={`/checkout/${reference}`} className="btn btn--ghost btn--sm">
            Back to methods
          </Link>
        </div>

        {state?.error && <div className="form-error">{state.error}</div>}

        <p className="tiny dim center" style={{ margin: 0, lineHeight: 1.6 }}>
          Add <span className="mono">PAYSTACK_SECRET_KEY</span> or Daraja keys to <span className="mono">.env.local</span>{" "}
          and this screen is replaced by the real hosted checkout / STK push.
        </p>
      </form>
    </div>
  );
}
