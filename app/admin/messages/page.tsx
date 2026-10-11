import Link from "next/link";
import { listArtists, listMessages } from "@/lib/repo";
import { formatDateTime } from "@/lib/view";
import MessageComposer from "@/components/MessageComposer";
import MessageThread from "@/components/MessageThread";
import { IconMail, IconPhone, IconBolt } from "@/components/icons";
import { getProducerWhatsappNumber, isWhatsappConfigured, whatsappEnv } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Messages" };

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const [messages, artists] = await Promise.all([listMessages({ limit: 180 }), listArtists(200)]);
  const inbox = messages.filter((m) => m.direction === "inbound");
  const sent = messages.filter((m) => m.direction === "outbound");
  const bookings = inbox.filter((m) => m.kind === "order" || m.kind === "booking");
  const whatsapps = inbox.filter((m) => m.kind === "whatsapp");
  const contacts = inbox.filter((m) => m.kind === "contact");
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const whatsappTo = await getProducerWhatsappNumber();
  const whatsappOn = isWhatsappConfigured();

  return (
    <>
      <section className="stack" style={{ gap: 14 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow"><IconMail size={12} /> Communication — website + WhatsApp</span>
          <h2 className="display h-md">Messages, bookings & WhatsApp</h2>
          <p className="lede">
            Every booking order, bank transfer, contact enquiry and WhatsApp message lands here, is emailed to you, and (if configured) pings you on WhatsApp instantly. 
            You can reply by email — and use the WhatsApp buttons to chat directly.
          </p>
          <div className="row row--wrap" style={{ gap: 8 }}>
            <span className="chip chip--red"><IconBolt size={12} /> {bookings.length} bookings</span>
            <span className="chip chip--ok"><IconPhone size={12} /> {whatsapps.length} WhatsApp</span>
            <span className="chip chip--info"><IconMail size={12} /> {contacts.length} contacts</span>
            <span className={`chip ${whatsappOn ? "chip--ok" : "chip--warn"}`}>{whatsappOn ? `WhatsApp → ${whatsappTo || whatsappEnv.to || "from settings"}` : "WhatsApp not configured"}</span>
          </div>
        </div>
        <MessageComposer
          artists={artists.map((a) => ({ id: a.id, name: a.name, email: a.email }))}
          defaultTo={to ?? ""}
        />
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        <div className="stack" style={{ gap: 12 }}>
          <h3 className="display h-sm">Inbox — bookings, WhatsApp & contacts ({inbox.length})</h3>
          <p className="tiny muted" style={{ margin: 0 }}>Newest first. Booking orders create both a website message and a WhatsApp to {whatsappTo || "your number"}.</p>
          <MessageThread messages={inbox} brandName="Producer" isAdmin />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <h3 className="display h-sm">Sent ({sent.length})</h3>
          {sent.length === 0 ? (
            <div className="empty">
              <h4>Nothing sent yet</h4>
              <p>
                Order confirmations, deliveries and your own messages appear here. See the{" "}
                <Link href="/admin/emails" className="red">email outbox</Link> for delivery status.
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {sent.map((m) => {
                const recipient = m.to_user_id ? artistById.get(m.to_user_id) : null;
                return (
                  <article key={m.id} className="panel panel--flat pad stack" style={{ gap: 6 }}>
                    <div className="row row--between" style={{ gap: 10 }}>
                      <strong style={{ fontSize: 14 }}>{m.subject}</strong>
                      <span className="chip chip--red">{m.kind}</span>
                    </div>
                    <span className="tiny dim">
                      To {recipient?.name ?? recipient?.email ?? m.to_user_id ?? "—"} · {formatDateTime(m.created_at)}
                    </span>
                    <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
                      {m.body.slice(0, 180)}
                      {m.body.length > 180 ? "…" : ""}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
