"use client";

import Link from "next/link";
import { usePlayer, type Track } from "./player-context";
import { IconBolt, IconDownload, IconPause, IconPlay } from "./icons";
import { formatDuration } from "@/lib/view";
import { moneyLabel } from "@/lib/money";

export function BeatRowHead() {
  return (
    <div className="beat-row__head" aria-hidden="true">
      <span>#</span>
      <span></span>
      <span>Title / Genre</span>
      <span>BPM</span>
      <span>Key</span>
      <span>Length</span>
      <span>From</span>
      <span></span>
    </div>
  );
}

export default function BeatRow({
  track,
  queue,
  index,
  owned,
}: {
  track: Track;
  queue?: Track[];
  index?: number;
  owned?: boolean;
}) {
  const { play, toggle, track: current, isPlaying } = usePlayer();
  const active = current?.id === track.id;
  const playing = active && isPlaying;

  const onPlay = () => {
    if (active) toggle();
    else play(track, queue && queue.length ? queue : [track]);
  };

  return (
    <div className="beat-row" data-active={active}>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        onClick={onPlay}
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        style={{ width: 42, height: 42 }}
      >
        {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
      </button>

      <Link href={`/beats/${track.slug}`} className="beat-row__art" aria-hidden="true" tabIndex={-1}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={track.artworkUrl} alt="" loading="lazy" />
      </Link>

      <div className="stack" style={{ gap: 3, minWidth: 0 }}>
        <Link href={`/beats/${track.slug}`} style={{ fontWeight: 700, fontSize: 15 }} className="row" title={track.title}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</span>
          {owned && <span className="chip chip--ok" style={{ padding: "1px 7px" }}>owned</span>}
        </Link>
        <span className="tiny dim uppercase" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {index !== undefined ? `${String(index + 1).padStart(2, "0")} · ` : ""}
          {track.genre}
          {track.artist ? ` · ${track.artist}` : ""}
        </span>
      </div>

      <span className="mono muted">{track.bpm ?? "—"}</span>
      <span className="mono muted">{track.musical_key ?? "—"}</span>
      <span className="mono muted">{formatDuration(track.duration_sec)}</span>

      <span className="beat-card__price" style={{ fontSize: 17 }}>
        {track.price_cents ? moneyLabel(track.price_cents, track.currency) : "FREE"}
      </span>

      <span className="row" style={{ gap: 7 }}>
        {owned && <IconDownload size={15} className="dim" />}
        <Link href={`/beats/${track.slug}`} className="btn btn--primary btn--sm">
          <IconBolt size={13} />
          {track.price_cents ? "Buy" : "Get"}
        </Link>
      </span>
    </div>
  );
}
