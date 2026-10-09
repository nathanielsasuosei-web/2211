"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "./player-context";
import { IconExternal, IconPlay, IconVideo } from "./icons";
import { formatDuration } from "@/lib/view";
import type { ClientVideo } from "@/lib/view";

/**
 * Video card. Supports four sources:
 *  - youtube / vimeo  → embed in a lightbox (or external link)
 *  - file             → inline <video> player
 *  - visualizer       → canvas spectrum driven by the linked beat's audio
 */
export default function VideoCard({ video }: { video: ClientVideo }) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { play, toggle, levels, isPlaying, track } = usePlayer();

  const linkedTrack = video.beat
    ? {
        id: video.beat.id,
        slug: video.beat.slug,
        title: video.beat.title,
        genre: video.beat.genre,
        artworkUrl: video.beat.artworkUrl,
        src: video.beat.previewUrl,
        duration_sec: video.beat.duration_sec,
        bpm: video.beat.bpm,
        musical_key: video.beat.musical_key,
        price_cents: video.beat.price_cents,
        currency: video.beat.currency,
      }
    : null;

  const isVisualizer = video.kind === "visualizer" && linkedTrack;
  const isFile = video.kind === "file" && video.fileUrl;
  const external = (video.kind === "youtube" || video.kind === "vimeo") && video.url;

  /* live spectrum for visualizer videos */
  useEffect(() => {
    if (!isVisualizer || !open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.02;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, w, h);
      const bars = 56;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const live = levels[Math.floor((i / bars) * levels.length)] ?? 0.1;
        const idle = (Math.sin(t * 1.6 + i * 0.32) * 0.5 + 0.5) * 0.3 + 0.08;
        const amp = isPlaying && track?.id === linkedTrack?.id ? live : idle;
        const bh = Math.max(3, amp * h * 0.72);
        const grad = ctx.createLinearGradient(0, h - bh, 0, h);
        grad.addColorStop(0, `rgba(255, ${80 + amp * 120}, ${70 + amp * 60}, ${0.5 + amp * 0.5})`);
        grad.addColorStop(1, "rgba(120,3,0,0.05)");
        ctx.fillStyle = grad;
        ctx.fillRect(i * bw + bw * 0.2, h - bh, bw * 0.6, bh);
      }
    };
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, rect.width * 1.2);
    canvas.height = Math.max(180, rect.height * 1.2);
    draw();
    return () => cancelAnimationFrame(raf);
  }, [isVisualizer, isPlaying, levels, linkedTrack?.id, open, track?.id]);

  const openVideo = () => {
    if (external) {
      window.open(video.url!, "_blank", "noopener,noreferrer");
      return;
    }
    setOpen(true);
    if (isVisualizer && linkedTrack) play(linkedTrack, [linkedTrack]);
  };

  return (
    <>
      <article className="video-card">
        <div className="video-card__frame">
          {video.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.posterUrl} alt={video.title} loading="lazy" />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "var(--dim)" }}>
              <IconVideo size={34} />
            </div>
          )}
          <button type="button" className="video-card__play" onClick={openVideo} aria-label={`Play ${video.title}`}>
            <span>{external ? <IconExternal size={22} /> : <IconPlay size={22} />}</span>
          </button>
        </div>

        <div className="pad stack" style={{ gap: 10 }}>
          <div className="row row--between" style={{ gap: 10 }}>
            <h3 style={{ fontSize: 16.5, lineHeight: 1.25 }}>{video.title}</h3>
            <span className="chip chip--red nowrap">
              {video.kind === "visualizer" ? "Session" : video.kind === "file" ? "Video" : video.kind.toUpperCase()}
            </span>
          </div>
          {video.description && (
            <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {video.description}
            </p>
          )}
          <div className="row row--between" style={{ gap: 10 }}>
            <span className="tiny dim mono">
              {video.duration_sec ? formatDuration(video.duration_sec) : "—"} · {video.views} views
            </span>
            {linkedTrack && (
              <Link href={`/beats/${linkedTrack.slug}`} className="btn btn--outline btn--sm">
                License this beat
              </Link>
            )}
          </div>
        </div>
      </article>

      {open && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={video.title}
          onClick={() => setOpen(false)}
        >
          <div className="lightbox__box" onClick={(e) => e.stopPropagation()}>
            <div className="row row--between" style={{ marginBottom: 12 }}>
              <strong>{video.title}</strong>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
                Close ✕
              </button>
            </div>

            {isFile && (
              <video src={video.fileUrl!} poster={video.posterUrl ?? undefined} controls autoPlay playsInline />
            )}

            {isVisualizer && (
              <div className="stack" style={{ gap: 12 }}>
                <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 14, background: "#07070a" }} />
                <div className="row row--between row--wrap" style={{ gap: 10 }}>
                  <span className="tiny muted">
                    Studio visualizer — audio from “{linkedTrack?.title}”
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn--dark btn--sm"
                      onClick={() => linkedTrack && toggle(linkedTrack)}
                    >
                      {isPlaying && track?.id === linkedTrack?.id ? "Pause audio" : "Play audio"}
                    </button>
                    <Link href={`/beats/${linkedTrack!.slug}`} className="btn btn--primary btn--sm">
                      License this beat
                    </Link>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
