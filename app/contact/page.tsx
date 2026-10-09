import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSiteSettings } from "@/lib/site";
import ContactForm from "@/components/ContactForm";
import { IconMail, IconPhone, IconShield, IconBolt } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact" };

export default async function ContactPage() {
  await ensureBootstrapped();
  const settings = await getSiteSettings();

  return (
    <div className="section section--tight">
      <div className="wrap contact-grid">
        <div className="stack" style={{ gap: 16 }}>
          <span className="eyebrow">Talk to the producer</span>
          <h1 className="display h-lg">
            Custom work, <span className="red">questions</span>, bookings
          </h1>
          <p className="lede">
            Every message is emailed straight to the producer and stored in your Studio inbox, so nothing gets lost.
            Expect a reply within 24 hours — usually much faster.
          </p>

          <div className="panel panel--flat pad stack" style={{ gap: 12 }}>
            <a className="row" style={{ gap: 11 }} href={`mailto:${settings.contactEmail}`}>
              <span className="chip chip--red"><IconMail size={14} /></span>
              <span className="muted">{settings.contactEmail}</span>
            </a>
            {settings.contactPhone && (
              <div className="row" style={{ gap: 11 }}>
                <span className="chip chip--red"><IconPhone size={14} /></span>
                <span className="muted">{settings.contactPhone}</span>
              </div>
            )}
            <div className="row" style={{ gap: 11 }}>
              <span className="chip chip--red"><IconBolt size={14} /></span>
              <span className="muted">{settings.studioLocation}</span>
            </div>
            <div className="row" style={{ gap: 11 }}>
              <span className="chip chip--red"><IconShield size={14} /></span>
              <span className="muted">Mobile money · card · bank transfer accepted</span>
            </div>
          </div>

          <div className="panel pad stack" style={{ gap: 8 }}>
            <strong style={{ fontSize: 14.5 }}>What people ask about</strong>
            {[
              "Custom afrobeats / amapiano / drill production",
              "Exclusive buy-outs and beat removal from the store",
              "Mix and master for a finished record",
              "Bulk licensing for a label or project",
            ].map((q) => (
              <span key={q} className="tiny muted">• {q}</span>
            ))}
          </div>
        </div>

        <ContactForm defaultEmail={settings.contactEmail} />
      </div>

      <style>{`
        .contact-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 34px; align-items: start; }
        @media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
