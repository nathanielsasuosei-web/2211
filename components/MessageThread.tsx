"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { markThreadReadAction, replyToMessageAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconMail } from "./icons";
import { formatDateTime } from "@/lib/view";
import type { Message } from "@/lib/types";

export default function MessageThread({
  messages,
  brandName,
  isAdmin,
}: {
  messages: Message[];
  brandName: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(messages[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [readState, readAction, readPending] = useActionState(markThreadReadAction, undefined);
  const [replyState, replyAction, replyPending] = useActionState(replyToMessageAction, undefined);
  useActionToast(replyState);

  useEffect(() => {
    if (!open) return;
    const msg = messages.find((m) => m.id === open);
    if (msg && !msg.is_read && msg.to_user_id) {
      const form = new FormData();
      form.set("id", msg.id);
      readAction(form);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  void readState;
  void readPending;

  if (!messages.length) {
    return (
      <div className="empty">
        <h4>No messages yet</h4>
        <p>
          Order updates, delivery confirmations and replies from {brandName} land here — and in your email inbox.{" "}
          <Link href="/contact" className="red">Start a conversation</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {messages.map((m) => {
        const isOpen = open === m.id;
        const inbound = m.direction === "inbound";
        return (
          <article key={m.id} className="panel pad stack" style={{ gap: 12 }}>
            <button
              type="button"
              className="row row--between"
              style={{ gap: 12, background: "none", border: 0, cursor: "pointer", padding: 0, textAlign: "left" }}
              onClick={() => setOpen(isOpen ? null : m.id)}
              aria-expanded={isOpen}
            >
              <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                <span className="row" style={{ gap: 8 }}>
                  <span className={`chip ${inbound ? "chip--info" : "chip--red"}`}>
                    <IconMail size={12} /> {inbound ? (isAdmin ? "Received" : "From producer") : isAdmin ? "Sent" : "You"}
                  </span>
                  {!m.is_read && m.to_user_id && <span className="chip chip--warn">new</span>}
                  <strong style={{ fontSize: 15 }}>{m.subject}</strong>
                </span>
                <span className="tiny dim">
                  {formatDateTime(m.created_at)} · {m.from_name ?? m.from_email ?? brandName}
                </span>
              </span>
              <span className="tiny dim">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <div className="stack" style={{ gap: 14 }}>
                <p className="muted" style={{ margin: 0, lineHeight: 1.75, fontSize: 14.5, whiteSpace: "pre-wrap" }}>
                  {m.body}
                </p>

                {m.order_id && (
                  <span className="tiny dim">
                    Related to order <span className="mono">{m.order_id}</span>
                  </span>
                )}

                <form
                  action={replyAction}
                  className="stack"
                  style={{ gap: 10 }}
                  onSubmit={() => setReply("")}
                >
                  <input type="hidden" name="id" value={m.id} />
                  <textarea
                    className="textarea"
                    name="body"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={`Write a reply — it is emailed to ${inbound ? m.from_email ?? "the sender" : brandName} and saved here.`}
                    required
                    minLength={2}
                  />
                  {replyState?.error && <div className="form-error">{replyState.error}</div>}
                  <span className="row" style={{ gap: 10 }}>
                    <button type="submit" className="btn btn--primary btn--sm" disabled={replyPending || reply.length < 2}>
                      <IconMail size={14} /> {replyPending ? "Sending…" : "Send reply by email"}
                    </button>
                    {replyState?.ok && replyState.message && <span className="tiny muted">{replyState.message}</span>}
                  </span>
                </form>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
