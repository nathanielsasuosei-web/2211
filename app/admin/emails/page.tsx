import Link from "next/link";
import { listEmails } from "@/lib/repo";
import { formatDateTime, statusChip } from "@/lib/view";
import { smtpConfigured } from "@/lib/mail";
import { env } from "@/lib/config";
import TestEmailForm from "@/components/TestEmailForm";
import { IconMail, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Email outbox" };

export default async function AdminEmailsPage() {
  const emails = await listEmails(80);
  const smtpOn = smtpConfigured();

  return (
    <section className="stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow"><IconMail size={12} /> Delivery log</span>
        <h2 className="display h-md">Email outbox</h2>
        <p className="lede">
          Every email the platform sends — welcome messages, order confirmations, beat deliveries with attachments,
          payment notifications and your own messages.
        </p>
      </div>

      <div className={`panel pad ${smtpOn ? "" : "panel--red"}`} style={{ display: "grid", gap: 12 }}>
        <div className="row row--between row--wrap" style={{ gap: 10 }}>
          <span className="row" style={{ gap: 9 }}>
            <IconShield size={15} className="red" />
            <strong style={{ fontSize: 14.5 }}>
              {smtpOn ? `SMTP active — ${env.smtp.host}:${env.smtp.port}` : "SMTP not configured"}
            </strong>
          </span>
          <span className={`chip ${smtpOn ? "chip--ok" : "chip--warn"}`}>{smtpOn ? "Sending for real" : "Captured locally"}</span>
        </div>
        <p className="tiny muted" style={{ margin: 0, lineHeight: 1.65 }}>
          {smtpOn
            ? "Emails are delivered through your SMTP provider. Failures are logged below with the provider error."
            : "Add SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS to .env.local to deliver for real. Until then every email is written to storage/outbox and listed here, so deliveries, attachments and links can still be inspected."}
        </p>
        <TestEmailForm />
      </div>

      {emails.length === 0 ? (
        <div className="empty">
          <h4>No emails yet</h4>
          <p>Sign up an artist or complete a purchase and the emails will appear here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Sent</th>
                <th>To</th>
                <th>Subject</th>
                <th>Transport</th>
                <th>Attachments</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => {
                const status = statusChip(e.status);
                let attachments: { name: string; bytes?: number | null }[] = [];
                try {
                  attachments = e.attachments ? JSON.parse(e.attachments) : [];
                } catch {
                  attachments = [];
                }
                return (
                  <tr key={e.id}>
                    <td className="tiny muted nowrap">{formatDateTime(e.created_at)}</td>
                    <td className="tiny mono">{e.to_address}</td>
                    <td>
                      <div className="stack" style={{ gap: 3 }}>
                        <strong style={{ fontSize: 13.5 }}>{e.subject}</strong>
                        <span className="tiny dim">{(e.body_preview ?? "").slice(0, 90)}…</span>
                      </div>
                    </td>
                    <td className="tiny mono dim">{e.transport}</td>
                    <td className="tiny muted">
                      {attachments.length ? attachments.map((a) => a.name).join(", ") : "—"}
                    </td>
                    <td>
                      <span className={`chip ${status.tone}`}>{status.label}</span>
                      {e.error && <span className="tiny dim" style={{ display: "block", marginTop: 4 }}>{e.error}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="tiny dim">
        Local captures live in <span className="mono">storage/outbox/</span> ·{" "}
        <Link href="/admin/settings" className="red">Configure SMTP</Link>
      </p>
    </section>
  );
}
