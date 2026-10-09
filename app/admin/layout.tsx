import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import AdminNav from "@/components/AdminNav";
import { IconBolt, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureBootstrapped();
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (session.role !== "admin") {
    return (
      <div className="section">
        <div className="wrap empty">
          <h4>Producer access only</h4>
          <p>
            You are signed in as <strong>{session.name}</strong> ({session.email}). The upload console is reserved for the
            producer account. <Link href="/studio" className="red">Go to your studio</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="section section--tight">
      <div className="wrap">
        <header className="row row--between row--wrap" style={{ gap: 14, marginBottom: 22 }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">
              <IconShield size={12} /> Producer console
            </span>
            <h1 className="display h-md">
              Signed in as <span className="red">{session.name}</span>
            </h1>
          </div>
          <div className="row row--wrap" style={{ gap: 8 }}>
            <Link href="/" className="btn btn--ghost btn--sm">View site</Link>
            <Link href="/admin/beats" className="btn btn--primary btn--sm">
              <IconBolt size={14} /> Upload a beat
            </Link>
          </div>
        </header>

        <div className="admin-shell">
          <AdminNav />
          <div className="stack" style={{ gap: 22, minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
