import Link from "next/link";
import { all } from "@/lib/db";
import { listUsers } from "@/lib/repo";
import { formatDateTime, initials } from "@/lib/view";
import { moneyLabel } from "@/lib/config";
import ArtistControls from "@/components/ArtistControls";
import type { Order, User } from "@/lib/types";
import { IconUsers } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Artists" };

export default async function AdminArtistsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const users = q
    ? ((await all<User>(
        "SELECT * FROM users WHERE lower(name) LIKE $1 OR lower(email) LIKE $1 OR COALESCE(phone,'') LIKE $1 ORDER BY created_at DESC LIMIT 200",
        [`%${q.toLowerCase()}%`],
      )) as User[])
    : await listUsers(200);

  const orders = (await all<Order>("SELECT * FROM orders")) as Order[];
  const spendByUser = new Map<string, { total: number; count: number; currency: string }>();
  for (const o of orders) {
    if (!["paid", "delivered"].includes(o.status)) continue;
    const cur = spendByUser.get(o.user_id) ?? { total: 0, count: 0, currency: o.currency };
    cur.total += o.amount_cents;
    cur.count += 1;
    spendByUser.set(o.user_id, cur);
  }

  const artists = users.filter((u) => u.role === "artist");

  return (
    <section className="stack" style={{ gap: 16 }}>
      <div className="row row--between row--wrap" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow"><IconUsers size={12} /> Community</span>
          <h2 className="display h-md">Artists</h2>
        </div>
        <form className="row" style={{ gap: 6 }}>
          <input name="q" defaultValue={q ?? ""} className="input" placeholder="Search name, email, phone…" style={{ width: 260, padding: "9px 12px" }} />
          <button type="submit" className="btn btn--dark btn--sm">Search</button>
          {q && <Link href="/admin/artists" className="btn btn--ghost btn--sm">Clear</Link>}
        </form>
      </div>

      {artists.length === 0 ? (
        <div className="empty">
          <h4>No artists found</h4>
          <p>Artists appear here as soon as they create an account.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Artist</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Purchases</th>
                <th>Spend</th>
                <th>Joined</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {artists.map((u) => {
                const spend = spendByUser.get(u.id);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="chip chip--red" style={{ width: 34, height: 34, justifyContent: "center", borderRadius: "50%" }}>
                          {initials(u.name)}
                        </span>
                        <div className="stack" style={{ gap: 2 }}>
                          <strong style={{ fontSize: 14 }}>{u.name}</strong>
                          <span className="tiny dim">{u.bio ? u.bio.slice(0, 46) : "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="stack" style={{ gap: 2 }}>
                        <a className="tiny red" href={`mailto:${u.email}`}>{u.email}</a>
                        <span className="tiny dim mono">{u.phone ?? "—"}</span>
                      </div>
                    </td>
                    <td className="tiny muted">{[u.city, u.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="mono">{spend?.count ?? 0}</td>
                    <td className="mono">{spend ? moneyLabel(spend.total, spend.currency) : "—"}</td>
                    <td className="tiny muted">{formatDateTime(u.created_at)}</td>
                    <td className="tiny muted">{u.last_login_at ? formatDateTime(u.last_login_at) : "never"}</td>
                    <td>
                      <ArtistControls user={{ id: u.id, name: u.name, email: u.email, active: !!u.is_active }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
