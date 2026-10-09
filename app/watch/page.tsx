import Link from "next/link";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getBeatById, listVideos } from "@/lib/repo";
import { toClientVideo } from "@/lib/view";
import VideoCard from "@/components/VideoCard";
import { IconVideo } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watch" };

export default async function WatchPage() {
  await ensureBootstrapped();
  const videos = await listVideos(60);
  const beats = await Promise.all(videos.map((v) => (v.beat_id ? getBeatById(v.beat_id) : Promise.resolve(null))));

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 26 }}>
        <header className="stack" style={{ gap: 12, maxWidth: "70ch" }}>
          <span className="eyebrow">
            <IconVideo size={12} /> Watch
          </span>
          <h1 className="display h-lg">
            Sessions, breakdowns &amp; <span className="red">visualizers</span>
          </h1>
          <p className="lede">
            See how the records are built. Uploaded videos, YouTube premieres and live audio visualizers all appear here —
            every clip links straight to the beat so you can license it in one tap.
          </p>
        </header>

        {videos.length === 0 ? (
          <div className="empty">
            <h4>No videos yet</h4>
            <p>
              The producer can upload session videos from{" "}
              <Link href="/admin/videos" className="red">Admin → Videos</Link>.
            </p>
          </div>
        ) : (
          <div className="video-grid">
            {videos.map((v, i) => (
              <VideoCard key={v.id} video={toClientVideo(v, beats[i])} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
