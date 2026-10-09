import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import { getBeatById, getDeliveryByOrder, getLicense, getOrderByRef, getUserById } from "@/lib/repo";
import { deliveryFiles, fileUrl, formatDate, formatDateTime } from "@/lib/view";
import { env, moneyLabel } from "@/lib/config";
import OrderStatusPoller from "@/components/OrderStatusPoller";
import { IconCheck, IconClock, IconDownload, IconMail, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return { title: `Order ${ref}` };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  await ensureBootstrapped();
  const { ref } = await params;
  const query = await searchParams;
  const order = await getOrderByRef(ref);
  if (!order) notFound();

  const session = await getSession();
  const isOwner = session && (session.id === order.user_id || session.role === "admin");

  const [beat, license, buyer, delivery] = await Promise.all([
    getBeatById(order.beat_id),
    order.license_id ? getLicense(order.license_id) : Promise.resolve(null),
    getUserById(order.user_id),
    getDeliveryByOrder(order.id),
  ]);
  if (!beat || !buyer) notFound();

  const files = delivery ? deliveryFiles(delivery) : [];
  const paid = ["paid", "delivered"].includes(order.status);

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 24, maxWidth: 860 }}>
        <header className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">Order {order.reference}</span>
          <h1 className="display h-lg">
            {order.status === "delivered" ? (
              <>Payment received — <span className="red">enjoy the beat</span></>
            ) : order.status === "failed" ? (
              <>Payment <span className="red">not completed</span></>
            ) : order.status === "in_review" ? (
              <>Transfer <span className="red">under review</span></>
            ) : (
              <>Order <span className="red">in progress</span></>
            )}
          </h1>
          <p className="lede">
            {paid
              ? `Your ${license?.name ?? "licence"} files for “${beat.title}” have been emailed to ${buyer.email} and are available to download below.`
              : order.status === "in_review"
                ? "We are matching your bank / mobile money transfer. As soon as the producer confirms it, your files are released by email and appear here."
                : order.status === "failed"
                  ? "No money was taken. You can retry with another payment method or contact the producer for help."
                  : "Finish the payment to unlock instant delivery."}
          </p>
        </header>

        {!paid && <OrderStatusPoller reference={order.reference} initialStatus={query.status ?? order.status} />}

        <div className="panel pad-lg stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 16 }}>
            <div style={{ width: 92, height: 92, borderRadius: 16, overflow: "hidden", flex: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(beat.artwork) ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <Link href={`/beats/${beat.slug}`} className="display h-sm">{beat.title}</Link>
              <span className="tiny muted">
                {beat.genre} · {beat.bpm ?? "—"} BPM · {beat.musical_key ?? "—"}
              </span>
              <span className="row row--wrap" style={{ gap: 7 }}>
                <span className="chip chip--red">{license?.name ?? "Standard licence"}</span>
                <span className={`chip ${paid ? "chip--ok" : order.status === "failed" ? "chip--bad" : "chip--warn"}`}>
                  {order.status.replace("_", " ")}
                </span>
                <span className="chip">{moneyLabel(order.amount_cents, order.currency)}</span>
              </span>
            </div>
          </div>

          <hr className="divider" />

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <div className="stack" style={{ gap: 3 }}>
              <span className="tiny dim">Buyer</span>
              <strong style={{ fontSize: 14.5 }}>{buyer.name}</strong>
              <span className="tiny mono muted">{buyer.email}</span>
            </div>
            <div className="stack" style={{ gap: 3 }}>
              <span className="tiny dim">Payment method</span>
              <strong style={{ fontSize: 14.5, textTransform: "capitalize" }}>{order.method}</strong>
              {order.provider_ref && <span className="tiny mono muted">{order.provider_ref}</span>}
            </div>
            <div className="stack" style={{ gap: 3 }}>
              <span className="tiny dim">Created</span>
              <strong style={{ fontSize: 14.5 }}>{formatDateTime(order.created_at)}</strong>
            </div>
            <div className="stack" style={{ gap: 3 }}>
              <span className="tiny dim">{paid ? "Delivered" : "Expires"}</span>
              <strong style={{ fontSize: 14.5 }}>
                {paid ? formatDateTime(order.delivered_at) : order.expires_at ? formatDateTime(order.expires_at) : "—"}
              </strong>
            </div>
          </div>

          {order.bank_reference && (
            <div className="panel pad stack" style={{ gap: 4 }}>
              <span className="tiny dim">Your transfer reference</span>
              <strong className="mono">{order.bank_reference}</strong>
              {order.bank_note && <span className="tiny muted">{order.bank_note}</span>}
            </div>
          )}
        </div>

        {paid && delivery && (
          <div className="panel panel--red pad-lg stack" style={{ gap: 14 }}>
            <span className="row" style={{ gap: 10 }}>
              <IconCheck size={17} />
              <h2 className="display h-sm">Your files</h2>
            </span>

            <div className="stack" style={{ gap: 9 }}>
              {files.map((f, i) => (
                <div key={`${f.label}-${i}`} className="row row--between" style={{ gap: 10 }}>
                  <span className="tiny muted">• {f.label}</span>
                  <a className="btn btn--dark btn--sm" href={`/api/download/${delivery.token}?file=${i}`} download>
                    <IconDownload size={13} /> Download
                  </a>
                </div>
              ))}
            </div>

            <div className="row row--wrap" style={{ gap: 10 }}>
              <a className="btn btn--primary" href={`/api/download/${delivery.token}`} download>
                <IconDownload size={16} /> Download everything (ZIP)
              </a>
              {isOwner && (
                <Link href="/studio?tab=vault" className="btn btn--outline">
                  Open my Vault
                </Link>
              )}
            </div>

            <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
              <IconMail size={12} /> A copy was emailed to <span className="mono">{buyer.email}</span>
              {delivery.download_count > 0 ? ` · downloaded ${delivery.download_count}×` : ""}. Keep this link private —
              it is tied to your licence.
            </p>
          </div>
        )}

        {!paid && (
          <div className="row row--wrap" style={{ gap: 10 }}>
            <Link href={`/checkout/${order.reference}`} className="btn btn--primary">
              <IconClock size={15} /> {order.status === "failed" ? "Retry payment" : "Continue to payment"}
            </Link>
            <Link href="/studio?tab=orders" className="btn btn--ghost">My orders</Link>
            <Link href="/contact" className="btn btn--ghost">Need help?</Link>
          </div>
        )}

        <div className="panel panel--flat pad row row--wrap" style={{ gap: 12 }}>
          <span className="chip chip--red"><IconShield size={13} /></span>
          <span className="tiny muted" style={{ lineHeight: 1.6 }}>
            Licence issued {formatDate(order.delivered_at ?? order.created_at)} · Credit “Produced by {env.appName}” on
            all releases · Questions? <Link href="/contact" className="red">Contact the producer</Link>.
          </span>
        </div>
      </div>
    </div>
  );
}
