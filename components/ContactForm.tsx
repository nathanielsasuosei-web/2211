"use client";

import { useActionState } from "react";
import { contactAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconMail } from "./icons";

export default function ContactForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(contactAction, undefined);
  useActionToast(state);

  if (state?.ok) {
    return (
      <div className="panel panel--red pad-lg stack" style={{ gap: 12 }}>
        <h2 className="display h-sm">Message sent ✅</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
          The producer has been emailed and your copy is on the way{defaultEmail ? ` (a reply will come from ${defaultEmail})` : ""}.
          If you have an account, the conversation also appears in your Studio inbox.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="panel pad-lg stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Send a message</span>
        <h2 className="display h-sm">Start the conversation</h2>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="c-name">Your name / artist name</label>
          <input id="c-name" name="name" className="input" required minLength={2} placeholder="Ama Serwaa" autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" name="email" type="email" className="input" required placeholder="you@email.com" autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="c-phone">Phone / WhatsApp (optional)</label>
          <input id="c-phone" name="phone" className="input" placeholder="+233 24 000 0000" autoComplete="tel" />
        </div>
        <div className="field">
          <label htmlFor="c-subject">Subject</label>
          <input id="c-subject" name="subject" className="input" required minLength={3} placeholder="Custom afrobeat production" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea
          id="c-message"
          name="message"
          className="textarea"
          required
          minLength={10}
          placeholder="Tell the producer what you need — reference tracks, key, tempo, deadline, budget…"
        />
        <span className="hint">You will get an automatic copy by email, plus a personal reply.</span>
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
        <IconMail size={16} />
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
