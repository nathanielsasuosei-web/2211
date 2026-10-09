import Link from "next/link";
import { dashboardStats, listEmails, listMessages, recentOrders, listBeats } from "@/lib/repo";
import { formatDateTime, methodChip, statusChip } from "@/lib/view";
import { moneyLabel, env } from "@/lib/config";
import { smtpConfigured } from "@/lib/mail";
import { mpesaEnabled } from "@/lib/payments/mpesa";
import { paystackEnabled } from "@/lib/payments/paystack";
import { IconBolt, IconCheck, IconClock, IconMail, IconMusic, IconSettings, IconUpload, IconVideo } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin dashboard" };

export default async function AdminDashboard() {
  const [stats, orders, emails, messages, beats] = await Promise.all([
    dashboardStats(),
    recentOrders(8),
    listEmails(6),
    listMessages({ limit: 6 }),
    listBeats({ includeUnpublished: true, limit: 5, sort: "new" }),
  ]);

  const integrations = [
    {
      name: "Paystack (card · MoMo · bank)",
      on: paystackEnabled(),
      hint: paystackEnabled() ? "Live keys detected" : "Add PAYSTACK_SECRET_KEY — demo checkout is active",
    },
    {
      name: "M-Pesa STK push (Daraja)",
      on: mpesaEnabled(),
      hint: mpesaEnabled() ? `${env.mpesa.environment} keys detected` : "Add MPESA_CONSUMER_KEY / SECRET — simulated prompts",
    },
    {
      name: "Bank / mobile money (manual)",
      on: env.bank.enabled,
      hint: env.bank.enabled ? `${env.bank.name} · ${env.bank.accountNumber}` : "Disabled in .env",
    },
    {
      name: "Email delivery (SMTP)",
      on: smtpConfigured(),
      hint: smtpConfigured() ? `${env.smtp.host}:${env.smtp.port}` : "SMTP not set — emails captured in the outbox",
    },
  ];

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <div className="stat"><b>{stats.beats}</b><span>Beats</span></div>
        <div className="stat"><b>{stats.videos}</b><span>Videos</span></div>
        <div className="stat"><b>{stats.artists}</b><span>Artists</span></div>
        <div className="stat"><b>{stats.orders}</b><span>Orders</span></div>
        <div className="stat"><b>{moneyLabel(stats.revenueCents, env.currency)}</b><span>Revenue</span></div>
        <div className="stat"><b>{stats.pendingOrders}</b><span>Awaiting payment</span></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <section className="panel panel--flat pad stack" style={{ gap: 14 }}>
          <div className="row row--between" style={{ gap: 10 }}>
            <h2 className="display h-sm">Latest orders</h2>
            <Link href="/admin/orders" className="btn btn--ghost btn--sm">All orders</Link>
          </div>
          {orders.length === 0 ? (
            <p className="tiny muted" style={{ margin: 0 }}>No orders yet.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {orders.map((o) => {
                const status = statusChip(o.status);
                const method = methodChip(o.method);
                return (
                  <div key={o.id} className="row row--between row--wrap" style={{ gap: 10 }}>
                    <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                      <Link href={`/admin/orders?ref=${o.reference}`} style={{ fontWeight: 700, fontSize: 14 }}>
                        {o.beat?.title ?? "Beat"} · {moneyLabel(o.amount_cents, o.currency)}
                      </Link>
                      <span className="tiny dim">
                        {o.buyer?.name ?? "—"} · {formatDateTime(o.created_at)}
                      </span>
                    </div>
                    <span className="row" style={{ gap: 6 }}>
                      <span className={`chip ${method.tone}`}>{method.label}</span>
                      <span className={`chip ${status.tone}`}>{status.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel panel--flat pad stack" style={{ gap: 14 }}>
          <h2 className="display h-sm">Payments &amp; delivery</h2>
          <div className="stack" style={{ gap: 10 }}>
            {integrations.map((i) => (
              <div key={i.name} className="row row--between" style={{ gap: 10 }}>
                <span className="stack" style={{ gap: 2 }}>
                  <strong style={{ fontSize: 14 }}>{i.name}</strong>
                  <span className="tiny dim">{i.hint}</span>
                </span>
                <span className={`chip ${i.on ? "chip--ok" : "chip--warn"}`}>
                  {i.on ? <IconCheck size={12} /> : <IconClock size={12} />} {i.on ? "Active" : "Demo"}
                </span>
              </div>
            ))}
          </div>
          <Link href="/admin/settings" className="btn btn--outline btn--sm" style={{ alignSelf: "flex-start" }}>
            <IconSettings size={14} /> Configure
          </Link>
        </section>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <section className="panel panel--flat pad stack" style={{ gap: 14 }}>
          <div className="row row--between" style={{ gap: 10 }}>
            <h2 className="display h-sm">Newest beats</h2>
            <Link href="/admin/beats" className="btn btn--primary btn--sm">
              <IconUpload size={14} /> Upload
            </Link>
          </div>
          {beats.map((b) => (
            <div key={b.id} className="row row--between" style={{ gap: 10 }}>
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <Link href={`/beats/${b.slug}`} style={{ fontWeight: 700, fontSize: 14 }}>
                  <IconMusic size={12} className="red" /> {b.title}
                </Link>
                <span className="tiny dim">{b.genre} · {b.bpm ?? "—"} BPM · {b.plays} plays</span>
              </span>
              <span className={`chip ${b.published ? "chip--ok" : "chip--warn"}`}>{b.published ? "Live" : "Draft"}</span>
            </div>
          ))}
        </section>

        <section className="panel panel--flat pad stack" style={{ gap: 14 }}>
          <div className="row row--between" style={{ gap: 10 }}>
            <h2 className="display h-sm">Inbox &amp; outbox</h2>
            <span className="row" style={{ gap: 6 }}>
              <Link href="/admin/messages" className="btn btn--ghost btn--sm"><IconMail size={13} /> Messages</Link>
              <Link href="/admin/emails" className="btn btn--ghost btn--sm"><IconBolt size={13} /> Emails</Link>
            </span>
          </div>
          {messages.map((m) => (
            <div key={m.id} className="stack" style={{ gap: 2 }}>
              <span className="row" style={{ gap: 8 }}>
                <span className={`chip ${m.direction === "inbound" ? "chip--info" : "chip--red"}`}>{m.direction}</span>
                <strong style={{ fontSize: 13.5 }}>{m.subject}</strong>
              </span>
              <span className="tiny dim">
                {m.from_name ?? m.from_email ?? "—"} · {formatDateTime(m.created_at)}
              </span>
            </div>
          ))}
          <hr className="divider" />
          {emails.map((e) => (
            <div key={e.id} className="row row--between" style={{ gap: 10 }}>
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <strong style={{ fontSize: 13.5 }}>{e.subject}</strong>
                <span className="tiny dim mono">{e.to_address}</span>
              </span>
              <span className={`chip ${statusChip(e.status).tone}`}>{statusChip(e.status).label}</span>
            </div>
          ))}
          <Link href="/admin/videos" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
            <IconVideo size={14} /> Manage videos
          </Link>
        </section>
      </div>
    </>
  );
}
