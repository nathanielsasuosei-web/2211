"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resendWelcomeAction } from "@/lib/actions/admin";
import { useToast } from "./Toast";
import { IconMail, IconUsers } from "./icons";

export default function ArtistControls({
  user,
}: {
  user: { id: string; name: string; email: string; active: boolean };
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const sendWelcome = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("id", user.id);
      const result = await resendWelcomeAction(undefined, form);
      push(result?.message ?? result?.error ?? "Done", result?.ok === false ? "bad" : "ok");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row row--wrap" style={{ gap: 7 }}>
      <Link href={`/admin/messages?to=${encodeURIComponent(user.id)}`} className="btn btn--dark btn--sm">
        <IconMail size={13} /> Message
      </Link>
      <button type="button" className="btn btn--ghost btn--sm" onClick={sendWelcome} disabled={busy}>
        <IconUsers size={13} /> {busy ? "Sending…" : "Re-send welcome"}
      </button>
    </div>
  );
}
