"use client";

import { useActionState, useState } from "react";
import { sendArtistMessageAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconMail, IconUsers } from "./icons";

export default function MessageComposer({
  artists,
  defaultTo,
}: {
  artists: { id: string; name: string; email: string }[];
  defaultTo?: string;
}) {
  const [state, action, pending] = useActionState(sendArtistMessageAction, undefined);
  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  useActionToast(state);

  const templates = [
    {
      label: "New beat drop",
      subject: "New beat just dropped — first 3 artists get 20% off",
      body: "Hey! A new instrumental just landed in the store. Reply with the vibe you are working on and I will hold a licence discount for you for 48 hours.",
    },
    {
      label: "Payment received",
      subject: "Payment received — your files are on the way",
      body: "Your transfer has cleared. The untagged files, stems and licence certificate have been emailed to you and are in your Vault. Enjoy the record!",
    },
    {
      label: "Session reminder",
      subject: "Studio session reminder",
      body: "Quick reminder about our session. Come with your reference tracks and lyrics — we will track vocals, comp and tune on the day.",
    },
  ];

  return (
    <form action={action} className="panel pad-lg stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow"><IconMail size={12} /> Compose</span>
        <h3 className="display h-sm">Email an artist (or all of them)</h3>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="m-to">Recipient</label>
          <select id="m-to" name="to" className="select" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="all">All artists ({artists.length})</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.email}
              </option>
            ))}
          </select>
          <span className="hint">
            <IconUsers size={11} /> Delivery goes out by email and lands in each artist&apos;s Studio inbox.
          </span>
        </div>
        <div className="field">
          <label htmlFor="m-subject">Subject</label>
          <input
            id="m-subject"
            name="subject"
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            minLength={3}
            placeholder="New beat just dropped"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="m-body">Message</label>
        <textarea
          id="m-body"
          name="body"
          className="textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={3}
          placeholder="Write your message — line breaks are preserved in the email."
        />
      </div>

      <div className="row row--wrap" style={{ gap: 8 }}>
        <span className="tiny dim">Quick templates:</span>
        {templates.map((t) => (
          <button
            key={t.label}
            type="button"
            className="chip"
            onClick={() => {
              setSubject(t.subject);
              setBody(t.body);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && state.message && <div className="form-ok">{state.message}</div>}

      <button type="submit" className="btn btn--primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        <IconMail size={15} /> {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
