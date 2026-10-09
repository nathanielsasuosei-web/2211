import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import { getBeatBySlug, listBeats, listBeatFiles, listLicenses, listPurchases, getSetting } from "@/lib/repo";
import { formatDate, formatDuration, toTrack } from "@/lib/view";
import { moneyLabel } from "@/lib/config";
import BeatCard from "@/components/BeatCard";
import BeatDetailPlayer from "@/components/BeatDetailPlayer";
import BuyPanel from "@/components/BuyPanel";
import { IconCheck, IconClock, IconDownload, IconMusic, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const beat = await getBeatBySlug(slug).catch(() => null);
  if (!beat) return { title: "Beat not found" };
  return {
    title: `${beat.title} — ${beat.genre} instrumental`,
    description: (beat.description ?? `${beat.title} — ${beat.genre} beat, ${beat.bpm ?? ""} BPM`).slice(0, 170),
  };
}

export default async function BeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ license?: string }>;
}) {
  await ensureBootstrapped();
  const { slug } = await params;
  const query = await searchParams;
  const beat = await getBeatBySlug(slug);
  if (!beat) notFound();

  const [licenses, session, similar, files, brand] = await Promise.all([
    listLicenses(beat.id),
    getSession(),
    listBeats({ genre: beat.genre, limit: 5 }),
    listBeatFiles(beat.id),
    getSetting("brand_name", "2211 BEATS"),
  ]);

  const purchases = session ? await listPurchases(session.id) : [];
  const owned = purchases.some((p) => p.beat_id === beat.id);
  const related = similar.filter((b) => b.id !== beat.id).slice(0, 4);
  const tags = (beat.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const cheapest = licenses.length ? Math.min(...licenses.map((l) => l.price_cents)) : beat.price_cents;
  const track = toTrack(beat);

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 26 }}>
        <nav className="tiny dim" aria-label="Breadcrumb">
          <Link href="/beats" className="dim">Beat store</Link> /{" "}
          <Link href={`/beats?genre=${encodeURIComponent(beat.genre)}`} className="dim">{beat.genre}</Link> /{" "}
          <span style={{ color: "var(--text)" }}>{beat.title}</span>
        </nav>

        <div className="beat-detail" id="beat-top">
          <div className="stack" style={{ gap: 20 }}>
            <BeatDetailPlayer beat={track} artworkUrl={track.artworkUrl} owned={owned} />

            <div className="stack" style={{ gap: 12 }}>
              <span className="eyebrow">{beat.mood ? `${beat.mood} ${beat.genre}` : beat.genre}</span>
              <h1 className="display h-lg">{beat.title}</h1>
              <div className="row row--wrap" style={{ gap: 8 }}>
                {beat.bpm ? <span className="chip chip--red">{beat.bpm} BPM</span> : null}
                {beat.musical_key ? <span className="chip">{beat.musical_key}</span> : null}
                <span className="chip"><IconClock size={12} /> {formatDuration(beat.duration_sec)}</span>
                <span className="chip"><IconMusic size={12} /> {beat.plays} plays</span>
                <span className="chip"><IconDownload size={12} /> {beat.downloads} sold</span>
                {beat.exclusive_sold ? <span className="chip chip--bad">Sold exclusively</span> : null}
                {owned ? <span className="chip chip--ok">In your Vault</span> : null}
              </div>
              {beat.description && <p className="lede" style={{ maxWidth: "none" }}>{beat.description}</p>}
              {tags.length > 0 && (
                <div className="row row--wrap" style={{ gap: 7 }}>
                  {tags.map((t) => (
                    <Link key={t} href={`/beats?q=${encodeURIComponent(t)}`} className="chip">#{t}</Link>
                  ))}
                </div>
              )}
              <span className="tiny dim">Published {formatDate(beat.created_at)}</span>
            </div>

            <div className="panel panel--flat pad stack" style={{ gap: 12 }}>
              <h3 className="h-sm display">What you receive</h3>
              <ul className="stack" style={{ gap: 9, listStyle: "none", margin: 0, padding: 0 }}>
                {[
                  "Untagged master (WAV 24-bit + MP3 320kbps)",
                  "Trackout stems on the Trackout and Exclusive licences",
                  "Signed licence certificate with usage terms and splits",
                  "Instant email delivery plus unlimited re-downloads from your Vault",
                ].map((line) => (
                  <li key={line} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                    <span className="chip chip--red" style={{ marginTop: 1 }}><IconCheck size={12} /></span>
                    <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{line}</span>
                  </li>
                ))}
              </ul>
              {files.length > 0 && (
                <div className="stack" style={{ gap: 6, marginTop: 4 }}>
                  <span className="tiny dim">Extra files attached to this beat</span>
                  {files.map((f) => (
                    <span key={f.id} className="tiny mono muted">• {f.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="stack" style={{ gap: 18 }}>
            <BuyPanel
              beatId={beat.id}
              beatSlug={beat.slug}
              beatTitle={beat.title}
              currency={beat.currency}
              isFree={!!beat.is_free || beat.price_cents === 0}
              exclusiveSold={!!beat.exclusive_sold}
              licenses={licenses}
              track={track}
              signedIn={!!session}
              owned={owned}
              initialLicenseId={query.license}
            />

            <div className="panel panel--flat pad stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="chip chip--red"><IconShield size={13} /></span>
                <strong style={{ fontSize: 14.5 }}>
                  From {Number.isFinite(cheapest) && cheapest > 0 ? moneyLabel(cheapest, beat.currency) : "free"}
                </strong>
              </div>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
                Non-exclusive licences stay available to other artists. Buying exclusive rights removes “{beat.title}”
                from the store permanently and transfers full usage to you.
              </p>
              <Link href="/licensing" className="tiny red">Compare licence tiers →</Link>
            </div>

            <div className="panel panel--flat pad stack" style={{ gap: 8 }}>
              <strong style={{ fontSize: 14.5 }}>Produced by {brand}</strong>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
                Mixed and mastered in-house. Custom production, vocal sessions and rush deliveries are available —
                message the producer directly.
              </p>
              <span className="row" style={{ gap: 8 }}>
                <Link href="/contact" className="btn btn--outline btn--sm">Request custom work</Link>
                <Link href="/about" className="btn btn--ghost btn--sm">About the producer</Link>
              </span>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="stack" style={{ gap: 18 }}>
            <div className="row row--between row--wrap" style={{ gap: 12 }}>
              <h2 className="display h-md">More <span className="red">{beat.genre}</span> beats</h2>
              <Link href={`/beats?genre=${encodeURIComponent(beat.genre)}`} className="btn btn--ghost btn--sm">See all</Link>
            </div>
            <div className="beat-grid">
              {related.map((r) => (
                <BeatCard key={r.id} track={toTrack(r)} queue={related.map(toTrack)} />
              ))}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .beat-detail { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 30px; }
        @media (max-width: 940px) { .beat-detail { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
