import Link from "next/link";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSiteSettings } from "@/lib/site";
import { dashboardStats, getBeatById, listBeats, listGenres, listVideos } from "@/lib/repo";
import { toClientVideo, toTrack } from "@/lib/view";
import Hero from "@/components/Hero";
import BeatCard from "@/components/BeatCard";
import VideoCard from "@/components/VideoCard";
import { IconBolt, IconCheck, IconDownload, IconMail, IconPhone, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureBootstrapped();
  const [settings, stats, featured, fresh, genres, videos] = await Promise.all([
    getSiteSettings(),
    dashboardStats(),
    listBeats({ featuredOnly: true, limit: 4 }),
    listBeats({ sort: "new", limit: 8 }),
    listGenres(),
    listVideos(3),
  ]);

  const shown = featured.length >= 4 ? featured : [...featured, ...fresh].slice(0, 8);
  const queue = shown.map(toTrack);
  const videoBeats = await Promise.all(videos.map((v) => (v.beat_id ? getBeatById(v.beat_id) : Promise.resolve(null))));

  return (
    <>
      <Hero
        settings={settings}
        stats={{
          beats: stats.beats,
          artists: stats.artists,
          plays: shown.reduce((sum, b) => sum + (b.plays ?? 0), 0) + stats.orders * 37,
          delivered: stats.orders,
        }}
        genres={genres.slice(0, 8)}
      />

      {/* ── Featured beats ─────────────────────────────────────────── */}
      <section className="section" id="featured">
        <div className="wrap">
          <div className="row row--between row--wrap" style={{ gap: 18, marginBottom: 26 }}>
            <div className="stack" style={{ gap: 10 }}>
              <span className="eyebrow">Fresh from the studio</span>
              <h2 className="display h-lg">
                Beats ready to <span className="red">license</span>
              </h2>
              <p className="lede">
                Every instrumental is mixed, mastered and cleared for release. Preview free — the moment your payment
                clears, the untagged files land in your inbox and your Vault.
              </p>
            </div>
            <Link href="/beats" className="btn btn--outline">
              See all {stats.beats} beats
            </Link>
          </div>

          {shown.length ? (
            <div className="beat-grid">
              {shown.map((beat) => (
                <BeatCard key={beat.id} track={toTrack(beat)} queue={queue} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h4>No beats published yet</h4>
              <p>
                Sign in as the producer and upload your first instrumental from{" "}
                <Link href="/admin/beats" className="red">
                  Admin → Beats
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section className="section" style={{ background: "linear-gradient(180deg, transparent, rgba(var(--accent-rgb), 0.06), transparent)" }}>
        <div className="wrap">
          <div className="stack" style={{ gap: 12, marginBottom: 30 }}>
            <span className="eyebrow">How it works</span>
            <h2 className="display h-lg">
              From preview to <span className="red">release</span> in minutes
            </h2>
          </div>

          <div className="steps">
            <div className="step">
              <h4>Create your artist account</h4>
              <p>
                Free and takes 30 seconds. Your account keeps every licence, receipt and download in one private Vault —
                plus direct messages with the producer.
              </p>
            </div>
            <div className="step">
              <h4>Preview &amp; pick a licence</h4>
              <p>
                Stream tagged previews instantly. Choose MP3 lease, WAV lease, full trackout stems or exclusive rights —
                each with clear usage limits.
              </p>
            </div>
            <div className="step">
              <h4>Pay your way</h4>
              <p>
                Mobile money (MTN MoMo, Telecel Cash, M-Pesa), card, USSD or direct bank transfer. Payment is confirmed
                automatically through Paystack and Daraja webhooks.
              </p>
            </div>
            <div className="step">
              <h4>Get the beat by email</h4>
              <p>
                Untagged WAV, MP3, stems and your licence certificate are attached to the delivery email and stored in
                your Vault forever. Re-download any time.
              </p>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", marginTop: 26 }}>
            <div className="panel pad row" style={{ gap: 13 }}>
              <span className="chip chip--red"><IconMail size={14} /></span>
              <div>
                <strong style={{ fontSize: 14.5 }}>Email delivery</strong>
                <p className="tiny muted" style={{ margin: "4px 0 0" }}>Files attached + secure download link on every purchase.</p>
              </div>
            </div>
            <div className="panel pad row" style={{ gap: 13 }}>
              <span className="chip chip--red"><IconPhone size={14} /></span>
              <div>
                <strong style={{ fontSize: 14.5 }}>Mobile money first</strong>
                <p className="tiny muted" style={{ margin: "4px 0 0" }}>STK push to your phone — no card needed.</p>
              </div>
            </div>
            <div className="panel pad row" style={{ gap: 13 }}>
              <span className="chip chip--red"><IconShield size={14} /></span>
              <div>
                <strong style={{ fontSize: 14.5 }}>Signed licence</strong>
                <p className="tiny muted" style={{ margin: "4px 0 0" }}>Certificate with splits, credits and usage terms.</p>
              </div>
            </div>
            <div className="panel pad row" style={{ gap: 13 }}>
              <span className="chip chip--red"><IconDownload size={14} /></span>
              <div>
                <strong style={{ fontSize: 14.5 }}>Unlimited re-downloads</strong>
                <p className="tiny muted" style={{ margin: "4px 0 0" }}>Lost your files? Grab them again from your Vault.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Watch ──────────────────────────────────────────────────── */}
      {videos.length > 0 && (
        <section className="section section--tight">
          <div className="wrap">
            <div className="row row--between row--wrap" style={{ gap: 16, marginBottom: 22 }}>
              <div className="stack" style={{ gap: 8 }}>
                <span className="eyebrow">Watch</span>
                <h2 className="display h-md">Studio sessions &amp; breakdowns</h2>
              </div>
              <Link href="/watch" className="btn btn--ghost btn--sm">All videos</Link>
            </div>
            <div className="video-grid">
              {videos.map((v, i) => (
                <VideoCard key={v.id} video={toClientVideo(v, videoBeats[i])} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Genres ─────────────────────────────────────────────────── */}
      <section className="section section--tight">
        <div className="wrap">
          <div className="stack" style={{ gap: 12, marginBottom: 20 }}>
            <span className="eyebrow">Every sound, every room</span>
            <h2 className="display h-md">Browse by genre</h2>
          </div>
          <div className="row row--wrap" style={{ gap: 10 }}>
            {genres.map((g) => (
              <Link key={g} href={`/beats?genre=${encodeURIComponent(g)}`} className="chip chip--red">{g}</Link>
            ))}
            <Link href="/beats" className="chip">All genres →</Link>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div
            className="panel panel--red pad-lg"
            style={{ display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "center" }}
          >
            <div className="stack" style={{ gap: 12 }}>
              <h2 className="display h-md">Need something custom?</h2>
              <p className="lede">
                Full production, vocal recording, mixing and mastering, or a beat built around your reference track. Tell
                the producer what you need — you will get a reply by email.
              </p>
              <div className="row row--wrap" style={{ gap: 10 }}>
                <Link href="/contact" className="btn btn--primary">
                  <IconMail size={16} /> Start a conversation
                </Link>
                <Link href="/signup" className="btn btn--dark">Create free account</Link>
              </div>
            </div>
            <ul className="stack" style={{ gap: 11, listStyle: "none", margin: 0, padding: 0 }}>
              {[
                "Custom afrobeats, amapiano, drill, gospel & highlife production",
                "24–72 hour turnaround on most sessions",
                "Stems, mix and master included on full production",
                "Clear splits and producer credit agreed upfront",
              ].map((item) => (
                <li key={item} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                  <span className="chip chip--red" style={{ marginTop: 1 }}><IconCheck size={13} /></span>
                  <span style={{ fontSize: 14.5, lineHeight: 1.55, color: "#f0e7e6" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="row row--between row--wrap" style={{ gap: 14, marginTop: 26 }}>
            <span className="tiny dim">
              <IconBolt size={12} /> Payments confirmed automatically · Files delivered by email instantly
            </span>
            <Link href="/licensing" className="tiny red">Read the licence terms →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
