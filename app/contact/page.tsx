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
      <h1 className="sr-only">Contact</h1>
      <div className="wrap contact-grid">
        <div className="stack" style={{ gap: 16 }}>
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
