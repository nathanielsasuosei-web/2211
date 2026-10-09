import Link from "next/link";
import { listBeats, listLicenses, dashboardStats } from "@/lib/repo";
import { fileUrl, formatDate, licensePerks } from "@/lib/view";
import { moneyLabel, env } from "@/lib/config";
import AdminBeatUpload from "@/components/AdminBeatUpload";
import BeatRowControls from "@/components/BeatRowControls";
import { IconMusic } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Beats" };

export default async function AdminBeatsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; genre?: string }>;
}) {
  const { q, genre } = await searchParams;
  const [beats, stats] = await Promise.all([
    listBeats({ includeUnpublished: true, q, genre, limit: 200, sort: "new" }),
    dashboardStats(),
  ]);
  const licensesByBeat = await Promise.all(beats.map((b) => listLicenses(b.id)));

  return (
    <>
      <section className="stack" style={{ gap: 14 }}>
        <div className="row row--between row--wrap" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">
              <IconMusic size={12} /> Catalogue
            </span>
            <h2 className="display h-md">Beats &amp; uploads</h2>
          </div>
          <div className="row row--wrap" style={{ gap: 8 }}>
            <span className="chip">{stats.beats} beats</span>
            <span className="chip chip--ok">{beats.filter((b) => b.published).length} live</span>
            <span className="chip chip--warn">{beats.filter((b) => !b.published).length} drafts</span>
          </div>
        </div>

        <AdminBeatUpload defaultCurrency={env.currency} />
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <div className="row row--between row--wrap" style={{ gap: 10 }}>
          <h3 className="display h-sm">All beats</h3>
          <form className="row" style={{ gap: 8 }}>
            <input name="q" defaultValue={q ?? ""} className="input" placeholder="Search title / tag…" style={{ width: 210, padding: "9px 12px" }} />
            <button type="submit" className="btn btn--dark btn--sm">Filter</button>
            {(q || genre) && (
              <Link href="/admin/beats" className="btn btn--ghost btn--sm">Clear</Link>
            )}
          </form>
        </div>

        {beats.length === 0 ? (
          <div className="empty">
            <h4>No beats yet</h4>
            <p>Use the upload form above to publish your first instrumental.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {beats.map((beat, i) => {
              const licenses = licensesByBeat[i] ?? [];
              return (
                <article key={beat.id} className="panel panel--flat pad" style={{ display: "grid", gap: 16 }}>
                  <div className="admin-beat">
                    <div style={{ width: 92, height: 92, borderRadius: 14, overflow: "hidden", flex: "none" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl(beat.artwork) ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>

                    <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                      <Link href={`/beats/${beat.slug}`} className="display" style={{ fontSize: 19 }}>{beat.title}</Link>
                      <span className="tiny muted">
                        {beat.genre} · {beat.bpm ?? "—"} BPM · {beat.musical_key ?? "—"} · {beat.mood ?? "no mood"}
                      </span>
                      <div className="row row--wrap" style={{ gap: 6 }}>
                        <span className={`chip ${beat.published ? "chip--ok" : "chip--warn"}`}>{beat.published ? "Published" : "Draft"}</span>
                        {beat.featured ? <span className="chip chip--red">Featured</span> : null}
                        {beat.is_free ? <span className="chip chip--info">Free</span> : null}
                        {beat.exclusive_sold ? <span className="chip chip--bad">Sold exclusively</span> : null}
                        <span className="chip">{moneyLabel(beat.price_cents, beat.currency)} base</span>
                      </div>
                      <span className="tiny dim">
                        {beat.plays} plays · {beat.downloads} sold · published {formatDate(beat.created_at)}
                      </span>
                    </div>

                    <div className="stack" style={{ gap: 6, minWidth: 190 }}>
                      <span className="tiny dim">Files</span>
                      <span className="tiny mono muted">preview: {beat.preview_file ? beat.preview_file.split("/").pop() : "—"}</span>
                      <span className="tiny mono muted">master: {beat.full_file ? beat.full_file.split("/").pop() : "—"}</span>
                      <span className="tiny mono muted">stems: {beat.trackout_file ? beat.trackout_file.split("/").pop() : "—"}</span>
                      <span className="tiny mono muted">art: {beat.artwork ? beat.artwork.split("/").pop() : "—"}</span>
                    </div>

                    <div className="stack" style={{ gap: 8, minWidth: 210 }}>
                      <span className="tiny dim">Licence tiers ({licenses.length})</span>
                      {licenses.slice(0, 4).map((l) => (
                        <span key={l.id} className="tiny row" style={{ gap: 6 }}>
                          <span className="chip chip--red" style={{ padding: "1px 8px" }}>{l.name}</span>
                          <span className="mono">{moneyLabel(l.price_cents, l.currency)}</span>
                        </span>
                      ))}
                      {licensePerks(licenses[0] ?? null).length > 0 && (
                        <span className="tiny dim">{licensePerks(licenses[0] ?? null).slice(0, 2).join(" · ")}</span>
                      )}
                    </div>
                  </div>

                  <BeatRowControls
                    beat={{
                      id: beat.id,
                      title: beat.title,
                      slug: beat.slug,
                      genre: beat.genre,
                      mood: beat.mood,
                      bpm: beat.bpm,
                      musical_key: beat.musical_key,
                      tags: beat.tags,
                      description: beat.description,
                      price: beat.price_cents / 100,
                      currency: beat.currency,
                      published: !!beat.published,
                      featured: !!beat.featured,
                      is_free: !!beat.is_free,
                    }}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        .admin-beat { display: grid; grid-template-columns: 92px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
        @media (max-width: 1000px) { .admin-beat { grid-template-columns: 72px minmax(0, 1fr); } }
      `}</style>
    </>
  );
}
