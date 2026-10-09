import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import {
  listMessages,
  listOrders,
  listPurchases,
  getUserById,
  getBeatById,
  getSetting,
} from "@/lib/repo";
import { deliveryFiles, fileUrl, formatDateTime, methodChip, statusChip } from "@/lib/view";
import { env, moneyLabel } from "@/lib/config";
import { publicUser } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";
import MessageThread from "@/components/MessageThread";
import { IconBolt, IconDownload, IconMail, IconMusic, IconPhone, IconShield, IconUser } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "My studio" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "vault", label: "My Vault" },
  { id: "orders", label: "Orders" },
  { id: "messages", label: "Messages" },
  { id: "profile", label: "Profile" },
] as const;

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await ensureBootstrapped();
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/studio")}`);

  const { tab } = await searchParams;
  const active = (TABS.find((t) => t.id === tab)?.id ?? "overview") as (typeof TABS)[number]["id"];

  const user = await getUserById(session.id);
  if (!user) redirect("/login");

  const [purchases, orders, messages, brand] = await Promise.all([
    listPurchases(session.id),
    listOrders({ userId: session.id, limit: 50 }),
    listMessages({ userId: session.id, limit: 60 }),
    getSetting("brand_name", "2211 BEATS"),
  ]);

  const spend = orders
    .filter((o) => ["paid", "delivered"].includes(o.status))
    .reduce((sum, o) => sum + o.amount_cents, 0);
  const currency = orders[0]?.currency ?? "GHS";
  const pending = orders.filter((o) => ["pending", "awaiting_payment", "in_review"].includes(o.status));
  const unread = messages.filter((m) => !m.is_read && m.to_user_id === session.id).length;

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 22 }}>
        <header className="row row--between row--wrap" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">
              <IconUser size={12} /> Artist studio
            </span>
            <h1 className="display h-lg">
              {user.name.split(" ")[0]}’s <span className="red">studio</span>
            </h1>
            <span className="tiny muted mono">
              {user.email} · joined {formatDateTime(user.created_at)}
            </span>
          </div>
          <Link href="/beats" className="btn btn--primary">
            <IconBolt size={15} /> Find more beats
          </Link>
        </header>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div className="stat"><b>{purchases.length}</b><span>Licences owned</span></div>
          <div className="stat"><b>{moneyLabel(spend, currency)}</b><span>Total spent</span></div>
          <div className="stat"><b>{orders.length}</b><span>Orders</span></div>
          <div className="stat"><b>{unread}</b><span>Unread messages</span></div>
        </div>

        <nav className="tabs" aria-label="Studio sections">
          {TABS.map((t) => (
            <Link key={t.id} href={t.id === "overview" ? "/studio" : `/studio?tab=${t.id}`} aria-current={active === t.id ? "page" : undefined}>
              {t.label}
              {t.id === "messages" && unread > 0 ? ` (${unread})` : ""}
            </Link>
          ))}
        </nav>

        {active === "overview" && (
          <div className="stack" style={{ gap: 20 }}>
            {pending.length > 0 && (
              <div className="panel panel--red pad stack" style={{ gap: 10 }}>
                <strong className="row" style={{ gap: 8 }}>
                  <IconMail size={15} /> {pending.length} order{pending.length === 1 ? "" : "s"} awaiting payment
                </strong>
                {pending.map((o) => (
                  <div key={o.id} className="row row--between row--wrap" style={{ gap: 10 }}>
                    <span className="tiny muted mono">{o.reference} · {moneyLabel(o.amount_cents, o.currency)}</span>
                    <Link href={`/checkout/${o.reference}`} className="btn btn--primary btn--sm">Complete payment</Link>
                  </div>
                ))}
              </div>
            )}

            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              <div className="panel panel--flat pad stack" style={{ gap: 12 }}>
                <h2 className="display h-sm">Latest in your Vault</h2>
                {purchases.length === 0 ? (
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Nothing licensed yet.{" "}
                    <Link href="/beats" className="red">Browse the catalogue</Link> — files arrive by email the moment
                    payment clears.
                  </p>
                ) : (
                  purchases.slice(0, 3).map((p) => (
                    <div key={p.delivery_id} className="row row--between" style={{ gap: 10 }}>
                      <span className="row" style={{ gap: 10, minWidth: 0 }}>
                        <span style={{ width: 40, height: 40, borderRadius: 9, overflow: "hidden", flex: "none" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fileUrl(p.beat_artwork) ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </span>
                        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                          <Link href={`/beats/${p.beat_slug}`} style={{ fontWeight: 700, fontSize: 14 }}>{p.beat_title}</Link>
                          <span className="tiny dim">{p.license_name ?? "Licence"} · {formatDateTime(p.delivered_at)}</span>
                        </span>
                      </span>
                      <a className="btn btn--dark btn--sm" href={`/api/download/${p.token}`} download>
                        <IconDownload size={13} /> ZIP
                      </a>
                    </div>
                  ))
                )}
                <Link href="/studio?tab=vault" className="btn btn--ghost btn--sm">Open full Vault</Link>
              </div>

              <div className="panel panel--flat pad stack" style={{ gap: 12 }}>
                <h2 className="display h-sm">Messages</h2>
                {messages.length === 0 ? (
                  <p className="tiny muted" style={{ margin: 0 }}>No messages yet.</p>
                ) : (
                  messages.slice(0, 4).map((m) => (
                    <div key={m.id} className="stack" style={{ gap: 3 }}>
                      <span className="row row--between" style={{ gap: 8 }}>
                        <strong style={{ fontSize: 13.5 }}>{m.subject}</strong>
                        {!m.is_read && m.to_user_id === session.id && <span className="chip chip--red">new</span>}
                      </span>
                      <span className="tiny dim">{formatDateTime(m.created_at)} · {m.from_name ?? brand}</span>
                    </div>
                  ))
                )}
                <Link href="/studio?tab=messages" className="btn btn--ghost btn--sm">Open inbox</Link>
              </div>
            </div>
          </div>
        )}

        {active === "vault" && (
          <div className="stack" style={{ gap: 14 }}>
            {purchases.length === 0 ? (
              <div className="empty">
                <h4>Your Vault is empty</h4>
                <p>
                  Licensed beats, stems and licence certificates appear here forever.{" "}
                  <Link href="/beats" className="red">Find your next beat</Link>.
                </p>
              </div>
            ) : (
              purchases.map((p) => {
                const files = deliveryFiles({ files: p.files });
                return (
                  <article key={p.delivery_id} className="vault-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(p.beat_artwork) ?? ""} alt="" />
                    <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                      <Link href={`/beats/${p.beat_slug}`} className="display" style={{ fontSize: 19 }}>
                        {p.beat_title}
                      </Link>
                      <span className="row row--wrap" style={{ gap: 7 }}>
                        <span className="chip chip--red">{p.license_name ?? "Licence"}</span>
                        <span className="chip">{p.beat_genre}</span>
                        <span className="chip">{moneyLabel(p.amount_cents, p.currency)}</span>
                        <span className={`chip ${statusChip(p.order_status).tone}`}>{statusChip(p.order_status).label}</span>
                      </span>
                      <span className="tiny dim">
                        Delivered {formatDateTime(p.delivered_at)} · {p.download_count} download
                        {p.download_count === 1 ? "" : "s"} · order {p.reference}
                      </span>
                      <div className="row row--wrap" style={{ gap: 7 }}>
                        {files.map((f, i) => (
                          <a key={`${f.label}-${i}`} className="btn btn--dark btn--sm" href={`/api/download/${p.token}?file=${i}`} download>
                            <IconDownload size={12} /> {f.label}
                          </a>
                        ))}
                      </div>
                    </div>
                    <div className="stack" style={{ gap: 8 }}>
                      <a className="btn btn--primary" href={`/api/download/${p.token}`} download>
                        <IconDownload size={15} /> Download all
                      </a>
                      <Link className="btn btn--ghost btn--sm" href={`/order/${p.reference}`}>
                        Receipt
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {active === "orders" && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Beat</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">No orders yet.</td>
                  </tr>
                )}
                {await Promise.all(
                  orders.map(async (o) => {
                    const beat = await getBeatById(o.beat_id);
                    const status = statusChip(o.status);
                    const method = methodChip(o.method);
                    return (
                      <tr key={o.id}>
                        <td className="mono tiny">{o.reference}</td>
                        <td>{beat ? <Link href={`/beats/${beat.slug}`} className="red">{beat.title}</Link> : "—"}</td>
                        <td>{moneyLabel(o.amount_cents, o.currency)}</td>
                        <td><span className={`chip ${method.tone}`}>{method.label}</span></td>
                        <td><span className={`chip ${status.tone}`}>{status.label}</span></td>
                        <td className="tiny muted">{formatDateTime(o.created_at)}</td>
                        <td>
                          {["paid", "delivered"].includes(o.status) ? (
                            <Link href={`/order/${o.reference}`} className="btn btn--dark btn--sm">Files</Link>
                          ) : o.status === "cancelled" ? (
                            <span className="tiny dim">—</span>
                          ) : (
                            <Link href={`/checkout/${o.reference}`} className="btn btn--primary btn--sm">Pay</Link>
                          )}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}

        {active === "messages" && <MessageThread messages={messages} brandName={brand} />}

        {active === "profile" && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            <ProfileForm user={publicUser(user)} />
            <div className="panel panel--flat pad stack" style={{ gap: 12 }}>
              <h2 className="display h-sm">Delivery &amp; security</h2>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                <IconMail size={12} /> Files and receipts are sent to <span className="mono">{user.email}</span>. Add{" "}
                <span className="mono">{env.supportMail}</span> to your contacts so deliveries never land in spam.
              </p>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                <IconPhone size={12} /> Your phone number is used for mobile money prompts (MTN MoMo, M-Pesa). Keep it
                current.
              </p>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                <IconShield size={12} /> Card details are never stored on this site — payments are tokenised by Paystack.
              </p>
              <hr className="divider" />
              <span className="row" style={{ gap: 9 }}>
                <IconMusic size={15} className="red" />
                <strong style={{ fontSize: 14 }}>Need a different licence?</strong>
              </span>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Upgrades (MP3 → WAV → Trackout → Exclusive) are deducted from what you already paid.{" "}
                <Link href="/contact" className="red">Message the producer</Link>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
