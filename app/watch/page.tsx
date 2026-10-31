import Link from "next/link";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getBeatById, listVideos } from "@/lib/repo";
import { toClientVideo } from "@/lib/view";
import VideoCard from "@/components/VideoCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watch" };

export default async function WatchPage() {
  await ensureBootstrapped();
  const videos = await listVideos(60);
  const beats = await Promise.all(videos.map((v) => (v.beat_id ? getBeatById(v.beat_id) : Promise.resolve(null))));

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 26 }}>
        <h1 className="sr-only">Videos</h1>

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
