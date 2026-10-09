import Link from "next/link";
import { listBeats, listVideos } from "@/lib/repo";
import { fileUrl, formatDateTime } from "@/lib/view";
import AdminVideoUpload from "@/components/AdminVideoUpload";
import VideoControls from "@/components/VideoControls";
import { IconExternal, IconVideo } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Videos" };

export default async function AdminVideosPage() {
  const [videos, beats] = await Promise.all([
    listVideos(100, true),
    listBeats({ includeUnpublished: true, limit: 100 }),
  ]);
  const beatMap = new Map(beats.map((b) => [b.id, b]));

  return (
    <>
      <section className="stack" style={{ gap: 14 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow"><IconVideo size={12} /> Watch page</span>
          <h2 className="display h-md">Videos</h2>
          <p className="lede">
            Session footage, YouTube premieres and beat visualizers. Everything published here appears on the public
            Watch page and links back to the related beat.
          </p>
        </div>
        <AdminVideoUpload beats={beats.map((b) => ({ id: b.id, title: b.title }))} />
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <h3 className="display h-sm">Published &amp; drafts ({videos.length})</h3>
        {videos.length === 0 ? (
          <div className="empty">
            <h4>No videos yet</h4>
            <p>Add your first session video above.</p>
          </div>
        ) : (
          <div className="video-grid">
            {videos.map((v) => {
              const beat = v.beat_id ? beatMap.get(v.beat_id) : null;
              return (
                <article key={v.id} className="panel panel--flat" style={{ overflow: "hidden" }}>
                  <div className="video-card__frame">
                    {v.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(v.poster) ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--dim)" }}>
                        <IconVideo size={30} />
                      </div>
                    )}
                  </div>
                  <div className="pad stack" style={{ gap: 9 }}>
                    <div className="row row--between" style={{ gap: 8 }}>
                      <strong style={{ fontSize: 15 }}>{v.title}</strong>
                      <span className={`chip ${v.published ? "chip--ok" : "chip--warn"}`}>{v.published ? "Live" : "Draft"}</span>
                    </div>
                    <span className="tiny dim">
                      {v.kind} · {v.views} views · {formatDateTime(v.created_at)}
                      {beat ? ` · ${beat.title}` : ""}
                    </span>
                    {v.description && <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>{v.description}</p>}
                    <div className="row row--wrap" style={{ gap: 7 }}>
                      <Link href="/watch" className="btn btn--ghost btn--sm" target="_blank">
                        <IconExternal size={13} /> Watch page
                      </Link>
                      <VideoControls video={{ id: v.id, title: v.title, published: !!v.published }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
