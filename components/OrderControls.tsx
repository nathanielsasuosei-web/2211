"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { approveOrderAction, rejectOrderAction, resendDeliveryAction, refundOrderAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconCheck, IconClose, IconDownload, IconMail } from "./icons";

export default function OrderControls({
  reference,
  status,
  amount,
}: {
  reference: string;
  status: string;
  amount: string;
}) {
  const [approveState, approveAction, approving] = useActionState(approveOrderAction, undefined);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectOrderAction, undefined);
  const [resendState, resendAction, resending] = useActionState(resendDeliveryAction, undefined);
  const [refundState, refundAction, refunding] = useActionState(refundOrderAction, undefined);
  const [confirm, setConfirm] = useState<"none" | "approve" | "reject" | "refund">("none");
  const [reason, setReason] = useState("Payment could not be verified.");
  useActionToast(approveState);
  useActionToast(rejectState);
  useActionToast(resendState);
  useActionToast(refundState);

  const paid = ["paid", "delivered"].includes(status);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row row--wrap" style={{ gap: 7 }}>
        {!paid && (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setConfirm(confirm === "approve" ? "none" : "approve")}>
            <IconCheck size={13} /> Mark paid &amp; deliver
          </button>
        )}
        {paid && (
          <form action={resendAction}>
            <input type="hidden" name="reference" value={reference} />
            <button type="submit" className="btn btn--dark btn--sm" disabled={resending}>
              <IconMail size={13} /> {resending ? "Sending…" : "Re-send email"}
            </button>
          </form>
        )}
        {!paid && (
          <button type="button" className="btn btn--ghost btn--sm" style={{ color: "#ff9d9d" }} onClick={() => setConfirm(confirm === "reject" ? "none" : "reject")}>
            <IconClose size={13} /> Reject
          </button>
        )}
        {paid && (
          <button type="button" className="btn btn--ghost btn--sm" style={{ color: "#ff9d9d" }} onClick={() => setConfirm(confirm === "refund" ? "none" : "refund")}>
            Refund
          </button>
        )}
        <Link href={`/order/${reference}`} className="btn btn--ghost btn--sm">
          <IconDownload size={13} /> View
        </Link>
      </div>

      {confirm !== "none" && (
        <div className="panel pad stack" style={{ gap: 10 }}>
          <strong style={{ fontSize: 14 }}>
            {confirm === "approve"
              ? `Confirm ${amount} received and release the files?`
              : confirm === "reject"
                ? "Reject this payment?"
                : "Refund this order?"}
          </strong>
          <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {confirm === "approve"
              ? "The artist receives the delivery email with the beat files, licence certificate and a Vault entry."
              : confirm === "reject"
                ? "The artist is notified by email and in their Studio inbox, and can retry payment."
                : "The order is marked refunded and the artist is notified. Process the actual refund in your Paystack/bank dashboard."}
          </p>

          {confirm === "reject" && (
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
          )}

          <span className="row row--wrap" style={{ gap: 8 }}>
            {confirm === "approve" && (
              <form action={approveAction}>
                <input type="hidden" name="reference" value={reference} />
                <button type="submit" className="btn btn--primary btn--sm" disabled={approving}>
                  {approving ? "Delivering…" : "Yes, deliver files"}
                </button>
              </form>
            )}
            {confirm === "reject" && (
              <form action={rejectAction}>
                <input type="hidden" name="reference" value={reference} />
                <input type="hidden" name="reason" value={reason} />
                <button type="submit" className="btn btn--primary btn--sm" disabled={rejecting}>
                  {rejecting ? "Rejecting…" : "Reject order"}
                </button>
              </form>
            )}
            {confirm === "refund" && (
              <form action={refundAction}>
                <input type="hidden" name="reference" value={reference} />
                <button type="submit" className="btn btn--primary btn--sm" disabled={refunding}>
                  {refunding ? "Refunding…" : "Mark as refunded"}
                </button>
              </form>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm("none")}>
              Cancel
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
