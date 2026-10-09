"use client";

import Link from "next/link";
import { usePlayer, type Track } from "./player-context";
import { IconPause, IconPlay, IconBolt } from "./icons";
import { formatDuration } from "@/lib/view";
import { moneyLabel } from "@/lib/money";

type Props = {
  track: Track;
  /** Full list of tracks on the page — clicking play queues the rest. */
  queue?: Track[];
  compact?: boolean;
};

export default function BeatCard({ track, queue }: Props) {
  const { play, toggle, track: current, isPlaying } = usePlayer();
  const active = current?.id === track.id;
  const playing = active && isPlaying;

  const onPlay = () => {
    if (active) toggle();
    else play(track, queue && queue.length ? queue : [track]);
  };

  return (
    <article className="beat-card" data-active={active}>
      <div className="beat-card__art">
        <Link href={`/beats/${track.slug}`} aria-label={`Open ${track.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={track.artworkUrl} alt={`${track.title} cover art`} loading="lazy" />
        </Link>

        <div className="badge-row">
          {track.bpm ? <span className="chip chip--red">{track.bpm} BPM</span> : <span />}
          {track.musical_key ? <span className="chip">{track.musical_key}</span> : null}
        </div>

        <div className="beat-card__overlay">
          <button
            type="button"
            className="btn-play"
            onClick={onPlay}
            data-playing={playing}
            aria-label={playing ? `Pause ${track.title}` : `Preview ${track.title}`}
            style={{ width: 62, height: 62 }}
          >
            {playing ? <IconPause size={24} /> : <IconPlay size={24} />}
          </button>
        </div>
      </div>

      <div className="beat-card__meta">
        <div className="row row--between" style={{ gap: 8, alignItems: "flex-start" }}>
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <Link href={`/beats/${track.slug}`} className="beat-card__title" title={track.title}>
              {track.title}
            </Link>
            <div className="beat-card__sub">
              <span>{track.genre}</span>
              {track.duration_sec ? <span>· {formatDuration(track.duration_sec)}</span> : null}
            </div>
          </div>
          <span className="beat-card__price nowrap">
            {track.price_cents ? moneyLabel(track.price_cents, track.currency) : "FREE"}
          </span>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 13 }}>
          <Link href={`/beats/${track.slug}`} className="btn btn--primary btn--sm grow">
            <IconBolt size={14} />
            {track.price_cents ? "Buy licence" : "Get free"}
          </Link>
          <button
            type="button"
            className="btn btn--dark btn--sm"
            onClick={onPlay}
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
          </button>
        </div>
      </div>
    </article>
  );
}
