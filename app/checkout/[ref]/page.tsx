import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import { getBeatById, getLicense, getOrderByRef, getUserById } from "@/lib/repo";
import { getPaymentOptions } from "@/lib/payments/options";
import { formatDate, fileUrl, formatDuration } from "@/lib/view";
import { env, moneyLabel } from "@/lib/config";
import CheckoutPanel from "@/components/CheckoutPanel";
import { IconMail, IconShield, IconClock } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return { title: `Checkout ${ref}` };
}

export default async function CheckoutPage({ params }: { params: Promise<{ ref: string }> }) {
  await ensureBootstrapped();
  const { ref } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/checkout/${ref}`)}`);

  const order = await getOrderByRef(ref);
  if (!order) notFound();
  if (order.user_id !== session.id && session.role !== "admin") {
    return (
      <div className="section">
        <div className="wrap empty">
          <h4>This order belongs to a different account</h4>
          <p>
            <Link href="/studio?tab=orders" className="red">Back to my orders</Link>
          </p>
        </div>
      </div>
    );
  }

  const [beat, license, buyer] = await Promise.all([
    getBeatById(order.beat_id),
    order.license_id ? getLicense(order.license_id) : Promise.resolve(null),
    getUserById(order.user_id),
  ]);
  if (!beat) notFound();

  const options = getPaymentOptions(order);
  const paid = ["paid", "delivered"].includes(order.status);

  if (paid) redirect(`/order/${order.reference}?status=delivered`);

  return (
    <div className="section section--tight">
      <div className="wrap checkout-grid">
        <CheckoutPanel
          reference={order.reference}
          amountCents={order.amount_cents}
          currency={order.currency}
          options={options}
          bank={{ ...env.bank }}
          defaultPhone={buyer?.phone ?? order.phone}
          initialStatus={order.status}
        />

        <aside className="stack" style={{ gap: 18 }}>
          <div className="panel pad-lg stack" style={{ gap: 16 }}>
            <span className="eyebrow">Order summary</span>
            <div className="row" style={{ gap: 14 }}>
              <div style={{ width: 78, height: 78, borderRadius: 14, overflow: "hidden", flex: "none" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(beat.artwork) ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div className="stack" style={{ gap: 5 }}>
                <Link href={`/beats/${beat.slug}`} className="red" style={{ fontWeight: 800, fontSize: 17 }}>
                  {beat.title}
                </Link>
                <span className="tiny muted">
                  {beat.genre} · {beat.bpm ?? "—"} BPM · {beat.musical_key ?? "—"} · {formatDuration(beat.duration_sec)}
                </span>
                <span className="chip chip--red" style={{ alignSelf: "flex-start" }}>{license?.name ?? "Standard licence"}</span>
              </div>
            </div>

            <hr className="divider" />

            <div className="stack" style={{ gap: 8 }}>
              <div className="row row--between"><span className="muted">Licence</span><span>{license?.name ?? "Standard"}</span></div>
              <div className="row row--between"><span className="muted">Buyer</span><span>{buyer?.name}</span></div>
              <div className="row row--between"><span className="muted">Email</span><span className="mono tiny">{buyer?.email}</span></div>
              <div className="row row--between"><span className="muted">Order date</span><span>{formatDate(order.created_at)}</span></div>
              <div className="row row--between" style={{ fontSize: 20, fontWeight: 800 }}>
                <span>Total</span>
                <span className="red">{moneyLabel(order.amount_cents, order.currency)}</span>
              </div>
            </div>
          </div>

          <div className="panel panel--flat pad stack" style={{ gap: 10 }}>
            <span className="row" style={{ gap: 10 }}><IconMail size={16} className="red" /><strong style={{ fontSize: 14 }}>Delivered by email</strong></span>
            <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
              Untagged WAV, MP3, stems (on Trackout/Exclusive) and your licence certificate are attached to the delivery
              email sent to <span className="mono">{buyer?.email}</span>. The same files stay in your Vault forever.
            </p>
            <span className="row" style={{ gap: 10 }}><IconShield size={16} className="red" /><strong style={{ fontSize: 14 }}>Protected payments</strong></span>
            <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
              Card and mobile money payments are processed by Paystack and Safaricom Daraja — this site never stores your
              card number or PIN.
            </p>
            <span className="row" style={{ gap: 10 }}><IconClock size={16} className="red" /><strong style={{ fontSize: 14 }}>Order expires in 60 minutes</strong></span>
            <p className="tiny dim" style={{ margin: 0 }}>Need help? <Link href="/contact" className="red">Message the producer</Link>.</p>
          </div>
        </aside>
      </div>

      <style>{`
        .checkout-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 26px; align-items: start; }
        @media (max-width: 980px) { .checkout-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
