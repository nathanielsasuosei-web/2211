import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await ensureBootstrapped();
  const session = await getSession();
  const { next } = await searchParams;
  if (session) redirect(session.role === "admin" ? "/admin" : next?.startsWith("/") ? next : "/studio");

  return (
    <div className="section section--tight">
      <div className="wrap auth-grid">
        <div className="stack" style={{ gap: 16 }}>
          <span className="eyebrow">Welcome back</span>
          <h1 className="display h-lg">
            Sign in to <span className="red">your studio</span>
          </h1>
          <p className="lede">
            Access your licences, re-download purchased beats, read messages from the producer and continue any unpaid
            order.
          </p>
          <div className="panel panel--flat pad stack" style={{ gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Demo accounts</strong>
            <span className="tiny mono muted">artist@demo.com · Artist!2211</span>
            <span className="tiny mono muted">admin@2211beats.com · Admin!2211</span>
            <span className="tiny dim">Change both passwords from Admin → Settings before going live.</span>
          </div>
          <p className="tiny dim">
            New here? <Link href="/signup" className="red">Create a free artist account</Link>
          </p>
        </div>

        <AuthForm mode="login" next={next} />
      </div>

      <style>{`
        .auth-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 36px; align-items: start; }
        @media (max-width: 900px) { .auth-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
