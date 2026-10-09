"use client";

import { useActionState } from "react";
import { sendTestEmailAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconMail } from "./icons";

export default function TestEmailForm() {
  const [state, action, pending] = useActionState(sendTestEmailAction, undefined);
  useActionToast(state);

  return (
    <form action={action} className="row row--wrap" style={{ gap: 10 }}>
      <input name="to" type="email" className="input" placeholder="you@email.com" required style={{ maxWidth: 300 }} />
      <button type="submit" className="btn btn--outline btn--sm" disabled={pending}>
        <IconMail size={14} /> {pending ? "Sending…" : "Send test email"}
      </button>
      {state?.error && <span className="tiny" style={{ color: "#ff9d9d" }}>{state.error}</span>}
      {state?.ok && state.message && <span className="tiny" style={{ color: "#7bf0ab" }}>{state.message}</span>}
    </form>
  );
}
