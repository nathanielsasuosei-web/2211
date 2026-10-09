import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";
import { IconCheck, IconMail, IconShield, IconDownload } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create artist account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await ensureBootstrapped();
  const session = await getSession();
  const { next } = await searchParams;
  if (session) redirect(next?.startsWith("/") ? next : "/studio");

  return (
    <div className="section section--tight">
      <div className="wrap auth-grid">
        <div className="stack" style={{ gap: 16 }}>
          <span className="eyebrow">Free artist account</span>
          <h1 className="display h-lg">
            Your beats, <span className="red">your vault</span>
          </h1>
          <p className="lede">
            Create an account to license beats, pay with mobile money or card, and keep every file, licence certificate
            and receipt in one private place.
          </p>
          <div className="stack" style={{ gap: 10 }}>
            {[
              ["Instant email delivery", <IconMail key="m" size={13} />],
              ["Unlimited re-downloads from your Vault", <IconDownload key="d" size={13} />],
              ["Direct messages with the producer", <IconCheck key="c" size={13} />],
              ["Secure checkout — no card details stored here", <IconShield key="s" size={13} />],
            ].map(([label, icon]) => (
              <span key={String(label)} className="row" style={{ gap: 10 }}>
                <span className="chip chip--red">{icon}</span>
                <span className="muted" style={{ fontSize: 14 }}>{label as string}</span>
              </span>
            ))}
          </div>
          <p className="tiny dim">
            Already registered? <Link href="/login" className="red">Sign in</Link>
          </p>
        </div>

        <AuthForm mode="signup" next={next} />
      </div>

      <style>{`
        .auth-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 36px; align-items: start; }
        @media (max-width: 900px) { .auth-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
