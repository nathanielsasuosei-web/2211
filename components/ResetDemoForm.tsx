"use client";

import { useActionState, useState } from "react";
import { resetDemoAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconTrash } from "./icons";

export default function ResetDemoForm() {
  const [state, action, pending] = useActionState(resetDemoAction, undefined);
  const [confirm, setConfirm] = useState("");
  useActionToast(state);

  return (
    <form action={action} className="panel pad stack" style={{ gap: 12 }}>
      <p className="tiny muted" style={{ margin: 0, lineHeight: 1.65 }}>
        Rebuild the demo catalogue: wipes beats, videos, artists, orders, messages and generated audio, then re-seeds a
        fresh store with synthesised demo beats. Real uploaded content is removed too — use only on a demo install.
      </p>
      <div className="row row--wrap" style={{ gap: 10 }}>
        <input
          className="input mono"
          style={{ maxWidth: 200 }}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type RESET"
          aria-label="Confirmation"
        />
        <input type="hidden" name="confirm" value={confirm} />
        <button type="submit" className="btn btn--ghost btn--sm" style={{ color: "#ff9d9d" }} disabled={pending || confirm !== "RESET"}>
          <IconTrash size={14} /> {pending ? "Rebuilding…" : "Reset demo data"}
        </button>
      </div>
      {state?.error && <div className="form-error">{state.error}</div>}
    </form>
  );
}
