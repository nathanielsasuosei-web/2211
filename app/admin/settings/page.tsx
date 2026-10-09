import { getAllSettings } from "@/lib/repo";
import { env } from "@/lib/config";
import { smtpConfigured } from "@/lib/mail";
import { mpesaEnabled } from "@/lib/payments/mpesa";
import { paystackEnabled } from "@/lib/payments/paystack";
import SettingsForm from "@/components/SettingsForm";
import ResetDemoForm from "@/components/ResetDemoForm";
import { IconCheck, IconClock, IconSettings } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Settings" };

export default async function AdminSettingsPage() {
  const settings = await getAllSettings();

  const integrations = [
    {
      name: "Paystack",
      on: paystackEnabled(),
      detail: paystackEnabled()
        ? "Live secret key loaded — hosted checkout active (card, MTN MoMo, Telecel Cash, bank, USSD)."
        : "Set PAYSTACK_SECRET_KEY (and PAYSTACK_PUBLIC_KEY) in .env.local to accept real payments.",
      docs: "https://dashboard.paystack.co/#/settings/developer",
    },
    {
      name: "M-Pesa (Daraja STK push)",
      on: mpesaEnabled(),
      detail: mpesaEnabled()
        ? `${env.mpesa.environment} credentials loaded — shortcode ${env.mpesa.shortCode}.`
        : "Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET and MPESA_PASSKEY to send real STK prompts.",
      docs: "https://developer.safaricom.co.ke",
    },
    {
      name: "Bank / mobile money (manual)",
      on: env.bank.enabled,
      detail: `${env.bank.name} · ${env.bank.accountName} · ${env.bank.accountNumber} · ${env.bank.momoName} ${env.bank.momoNumber}`,
      docs: "",
    },
    {
      name: "Email (SMTP)",
      on: smtpConfigured(),
      detail: smtpConfigured()
        ? `${env.smtp.host}:${env.smtp.port} as ${env.mailFrom}`
        : "Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS. Until then emails are captured in the outbox.",
      docs: "",
    },
    {
      name: "Database",
      on: true,
      detail: env.databaseUrl.startsWith("postgres")
        ? "PostgreSQL (DATABASE_URL)"
        : "SQLite at storage/app.db — set DATABASE_URL to switch to PostgreSQL.",
      docs: "",
    },
  ];

  return (
    <>
      <section className="stack" style={{ gap: 14 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow"><IconSettings size={12} /> Configuration</span>
          <h2 className="display h-md">Store settings</h2>
        </div>
        <SettingsForm settings={settings} />
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <h3 className="display h-sm">Payments &amp; delivery</h3>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          {integrations.map((i) => (
            <article key={i.name} className="panel panel--flat pad stack" style={{ gap: 8 }}>
              <div className="row row--between" style={{ gap: 10 }}>
                <strong style={{ fontSize: 14.5 }}>{i.name}</strong>
                <span className={`chip ${i.on ? "chip--ok" : "chip--warn"}`}>
                  {i.on ? <IconCheck size={12} /> : <IconClock size={12} />} {i.on ? "Active" : "Setup needed"}
                </span>
              </div>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>{i.detail}</p>
              {i.docs && (
                <a className="tiny red" href={i.docs} target="_blank" rel="noreferrer noopener">
                  Get credentials →
                </a>
              )}
            </article>
          ))}
        </div>

        <div className="panel panel--flat pad stack" style={{ gap: 8 }}>
          <strong style={{ fontSize: 14.5 }}>Webhook URLs</strong>
          <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Point your providers here so payments confirm automatically:
          </p>
          <span className="tiny mono muted">Paystack callback → {env.appUrl}/api/payments/paystack/webhook</span>
          <span className="tiny mono muted">Daraja STK callback → {env.appUrl}/api/payments/mpesa/callback</span>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <h3 className="display h-sm">Demo data</h3>
        <ResetDemoForm />
      </section>
    </>
  );
}
