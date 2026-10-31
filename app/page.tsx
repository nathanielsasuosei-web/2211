import Link from "next/link";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { dashboardStats, getBeatById, listBeats, listVideos } from "@/lib/repo";
import { toClientVideo, toTrack } from "@/lib/view";
import Hero from "@/components/Hero";
import BeatCard from "@/components/BeatCard";
import VideoCard from "@/components/VideoCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    await ensureBootstrapped();
  } catch (err) {
    console.error("[home] bootstrap failed:", err);
  }

  let stats, featured, fresh, videos;
  try {
    [stats, featured, fresh, videos] = await Promise.all([
      dashboardStats(),
      listBeats({ featuredOnly: true, limit: 4 }),
      listBeats({ sort: "new", limit: 8 }),
      listVideos(3),
    ]);
  } catch (err) {
    console.error("[home] data fetch failed, using empty defaults:", err);
    stats = { beats: 0, artists: 0, orders: 0, revenueCents: 0, pendingOrders: 0, videos: 0, emails: 0 };
    featured = [];
    fresh = [];
    videos = [];
  }

  const shown = featured.length >= 4 ? featured : [...featured, ...fresh].slice(0, 8);
  const queue = shown.map(toTrack);
  let videoBeats: any[] = [];
  try {
    videoBeats = await Promise.all(videos.map((v) => (v.beat_id ? getBeatById(v.beat_id) : Promise.resolve(null))));
  } catch (err) {
    console.error("[home] video beats fetch failed:", err);
  }

  return (
    <>
      <Hero
        stats={{
          beats: stats.beats,
          artists: stats.artists,
          plays: shown.reduce((sum, b) => sum + (b.plays ?? 0), 0) + stats.orders * 37,
        }}
      />

      {/* ── Featured beats ─────────────────────────────────────────── */}
      <section className="section" id="featured" aria-label="Featured beats">
        <div className="wrap">
          <div className="row" style={{ justifyContent: "flex-end", marginBottom: 26 }}>
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

      {/* ── Watch ──────────────────────────────────────────────────── */}
      {videos.length > 0 && (
        <section className="section section--tight" aria-label="Videos">
          <div className="wrap">
            <div className="row" style={{ justifyContent: "flex-end", marginBottom: 22 }}>
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
    </>
  );
}
