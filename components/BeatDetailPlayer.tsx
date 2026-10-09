"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePlayer, type Track } from "./player-context";
import { IconCheck, IconDownload, IconPause, IconPlay } from "./icons";
import { formatDuration } from "@/lib/view";

const BARS = 64;

/** Big artwork + live waveform for a single beat page. */
export default function BeatDetailPlayer({
  beat,
  artworkUrl,
  owned,
}: {
  beat: Track;
  artworkUrl: string;
  owned?: boolean;
}) {
  const { play, toggle, isPlaying, track, currentTime, duration, levels } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = track?.id === beat.id;
  const playing = active && isPlaying;

  /* static-ish waveform shape, highlighted by playback progress */
  const shapeRef = useRef<number[]>([]);
  if (!shapeRef.current.length) {
    let seed = beat.id.split("").reduce((a, c) => a + c.charCodeAt(0), 7);
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };
    shapeRef.current = Array.from({ length: BARS }, (_, i) => {
      const base = Math.sin((i / BARS) * Math.PI) * 0.55 + 0.25;
      return Math.max(0.12, Math.min(1, base * (0.55 + rnd() * 0.85)));
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      const progress = active && duration ? currentTime / duration : 0;
      const bw = w / BARS;
      for (let i = 0; i < BARS; i++) {
        const base = shapeRef.current[i] ?? 0.3;
        const live = active && playing ? (levels[Math.floor((i / BARS) * levels.length)] ?? 0.2) : 0;
        const amp = Math.min(1, base * (playing ? 0.72 : 1) + live * 0.65);
        const bh = Math.max(3, amp * h * 0.86);
        const x = i * bw + bw * 0.22;
        const on = i / BARS <= progress;
        ctx.fillStyle = on
          ? `rgba(255, ${70 + amp * 90}, ${60 + amp * 60}, ${0.85})`
          : `rgba(255,255,255,${0.13 + amp * 0.12})`;
        ctx.beginPath();
        const r = Math.min(bw * 0.28, 3);
        ctx.roundRect(x, (h - bh) / 2, bw * 0.56, bh, r);
        ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active, currentTime, duration, levels, playing]);

  const onPlay = () => {
    if (active) toggle();
    else play(beat, [beat]);
  };

  return (
    <div className="panel panel--flat pad-lg stack" style={{ gap: 18 }}>
      <div className="grid" style={{ gridTemplateColumns: "minmax(160px, 240px) minmax(0,1fr)", gap: 20, alignItems: "center" }}>
        <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", aspectRatio: "1" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artworkUrl} alt={`${beat.title} cover art`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <button
            type="button"
            className="btn-play"
            onClick={onPlay}
            data-playing={playing}
            aria-label={playing ? `Pause ${beat.title}` : `Play ${beat.title}`}
            style={{ position: "absolute", inset: 0, margin: "auto", width: 74, height: 74 }}
          >
            {playing ? <IconPause size={28} /> : <IconPlay size={28} />}
          </button>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="wave" style={{ height: 78 }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
          <div className="row row--between row--wrap" style={{ gap: 10 }}>
            <span className="mono muted">
              {formatDuration(active ? currentTime : 0)} / {formatDuration(active && duration ? duration : beat.duration_sec)}
            </span>
            <span className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--dark btn--sm" onClick={onPlay}>
                {playing ? <IconPause size={14} /> : <IconPlay size={14} />} {playing ? "Pause" : "Preview"}
              </button>
              {owned && (
                <Link href="/studio?tab=vault" className="btn btn--outline btn--sm">
                  <IconDownload size={14} /> My download
                </Link>
              )}
            </span>
          </div>
          <p className="tiny dim" style={{ margin: 0 }}>
            <IconCheck size={11} /> Previews are tagged. Your delivered files are clean and untagged.
          </p>
        </div>
      </div>
    </div>
  );
}
