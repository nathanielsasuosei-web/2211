"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "./player-context";
import { IconBolt, IconMute, IconNext, IconPause, IconPlay, IconPrev, IconVolume } from "./icons";

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PlayerBar() {
  const {
    track,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    levels,
    error,
    toggle,
    next,
    prev,
    seekRatio,
    setVolume,
    toggleMute,
    stop,
    queue,
  } = usePlayer();
  const barRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.code === "Space" && track) {
        e.preventDefault();
        toggle();
      }
      if (e.code === "ArrowRight" && e.shiftKey && track) next();
      if (e.code === "ArrowLeft" && e.shiftKey && track) prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, toggle, track]);

  if (!track) return null;

  const progress = duration ? (currentTime / duration) * 100 : 0;

  const onSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    seekRatio((e.clientX - rect.left) / rect.width);
  };

  return (
    <div className="player" role="region" aria-label="Beat player">
      <div className="player__progress" ref={barRef} onClick={onSeekClick} aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      <div className="wrap player__inner">
        <div className="player__meta">
          <div className="player__art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={track.artworkUrl} alt="" />
          </div>
          <div className="stack" style={{ gap: 3, minWidth: 0 }}>
            <Link href={`/beats/${track.slug}`} className="row" style={{ gap: 7, minWidth: 0 }}>
              <strong style={{ fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {track.title}
              </strong>
              <span className="chip chip--red" style={{ padding: "2px 8px", fontSize: 10.5 }}>
                {track.genre}
              </span>
            </Link>
            <span className="tiny dim mono">
              {fmt(currentTime)} / {fmt(duration)}
              {track.bpm ? ` · ${track.bpm} BPM` : ""}
              {track.musical_key ? ` · ${track.musical_key}` : ""}
              {queue.length > 1 ? ` · queue ${queue.length}` : ""}
            </span>
          </div>
        </div>

        <div className="stack" style={{ gap: 8, alignItems: "center" }}>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--ghost btn--icon" onClick={prev} aria-label="Previous beat">
              <IconPrev size={17} />
            </button>
            <button
              type="button"
              className="btn-play"
              onClick={() => toggle()}
              data-playing={isPlaying}
              aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
            >
              {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
            </button>
            <button type="button" className="btn btn--ghost btn--icon" onClick={next} aria-label="Next beat">
              <IconNext size={17} />
            </button>
          </div>

          <div className="player__viz" aria-hidden="true">
            {levels.map((l, i) => (
              <i key={i} style={{ height: `${Math.max(8, l * 100)}%`, opacity: isPlaying ? 1 : 0.35 }} />
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div className="row hide-sm" style={{ gap: 7 }}>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              style={{ width: 36, height: 36 }}
            >
              {muted || volume === 0 ? <IconMute size={16} /> : <IconVolume size={16} />}
            </button>
            <input
              className="slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              aria-label="Volume"
              style={{ width: 82 }}
            />
          </div>

          <Link href={`/beats/${track.slug}`} className="btn btn--primary btn--sm">
            <IconBolt size={15} />
            {track.price_cents ? "Buy licence" : "Free download"}
          </Link>
          <button
            type="button"
            className="btn btn--ghost btn--sm hide-sm"
            onClick={stop}
            aria-label="Close player"
          >
            ✕
          </button>
        </div>
      </div>

      {error && (
        <div className="wrap" style={{ paddingBottom: 8 }}>
          <div className="form-error tiny">{error}</div>
        </div>
      )}
    </div>
  );
}
