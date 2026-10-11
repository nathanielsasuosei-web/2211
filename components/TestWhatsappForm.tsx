"use client";

import { useActionState } from "react";
import { sendTestWhatsappAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconPhone } from "./icons";

export default function TestWhatsappForm({ defaultTo }: { defaultTo?: string }) {
  const [state, action, pending] = useActionState(sendTestWhatsappAction, undefined);
  useActionToast(state);

  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <div className="row row--wrap" style={{ gap: 10 }}>
        <input
          name="to"
          type="tel"
          className="input"
          placeholder="+233 24 000 0000"
          defaultValue={defaultTo}
          style={{ maxWidth: 260 }}
        />
        <input
          name="message"
          className="input"
          placeholder="Test message from 2211 BEATS"
          defaultValue="Hello! This is a test WhatsApp from your beat store. Booking notifications are working ✅"
          style={{ maxWidth: 420 }}
        />
        <button type="submit" className="btn btn--outline btn--sm" disabled={pending}>
          <IconPhone size={14} /> {pending ? "Sending…" : "Send test WhatsApp"}
        </button>
      </div>
      {state?.error && <span className="tiny" style={{ color: "#ff9d9d" }}>{state.error}</span>}
      {state?.ok && state.message && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny" style={{ color: "#7bf0ab" }}>{state.message}</span>
          {(state as any).waLink && (
            <a href={(state as any).waLink} target="_blank" rel="noreferrer noopener" className="tiny red">
              Open wa.me link → {(state as any).waLink}
            </a>
          )}
        </div>
      )}
    </form>
  );
}
