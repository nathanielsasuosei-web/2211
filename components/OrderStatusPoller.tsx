"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconClock } from "./icons";

export default function OrderStatusPoller({
  reference,
  initialStatus,
}: {
  reference: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState("Checking with the payment provider…");
  const [ticks, setTicks] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; message: string; delivered: boolean };
        if (!alive) return;
        setStatus(data.status);
        setNote(data.message);
        setTicks((t) => t + 1);
        if (data.delivered || data.status === "failed") {
          if (timer.current) window.clearInterval(timer.current);
          router.refresh();
        }
      } catch {
        /* transient */
      }
    };
    void check();
    timer.current = window.setInterval(check, 4000);
    return () => {
      alive = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [reference, router]);

  const failed = status === "failed";

  return (
    <div className={`panel pad ${failed ? "" : "panel--red"}`} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <span className="chip chip--warn">
        <IconClock size={13} /> {failed ? "Payment failed" : "Waiting for confirmation"}
      </span>
      <span className="tiny muted grow" style={{ lineHeight: 1.6 }}>
        {note} {ticks > 0 && !failed ? `(checked ${ticks}×)` : ""}
      </span>
      {failed ? (
        <Link href={`/checkout/${reference}`} className="btn btn--primary btn--sm">
          Retry payment
        </Link>
      ) : (
        <Link href={`/checkout/${reference}`} className="btn btn--ghost btn--sm">
          Open payment page
        </Link>
      )}
    </div>
  );
}
