"use client";

import { useState } from "react";
import Link from "next/link";
import BeatCard from "./BeatCard";
import BeatRow, { BeatRowHead } from "./BeatRow";
import { usePlayer, type Track } from "./player-context";
import { IconGrid, IconMusic, IconPause, IconPlay } from "./icons";

/**
 * The homepage beat list.
 *
 * Everything published is listed here — featured first — as either cover-art
 * cards or a proper numbered tracklist (same row component the beat store
 * uses, so BPM / key / length / price line up). "Play all" queues the whole
 * list into the persistent player, and the list expands in place so the
 * homepage stays short until someone wants the full catalogue.
 */
export default function BeatListing({
  tracks,
  total,
  initial = 8,
}: {
  tracks: Track[];
  total: number;
  initial?: number;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [expanded, setExpanded] = useState(false);
  const { play, toggle, track: current, isPlaying } = usePlayer();

  const shown = expanded ? tracks : tracks.slice(0, initial);
  const inList = !!current && tracks.some((t) => t.id === current.id);
  const playingAll = inList && isPlaying;

  const onPlayAll = () => {
    if (playingAll) {
      toggle();
      return;
    }
    if (inList && current) play(current, tracks);
    else if (tracks.length) play(tracks[0], tracks);
  };

  if (!tracks.length) return null;

  return (
    <div className="listing">
      <div className="listing__bar">
        <button type="button" className="btn btn--primary btn--sm" onClick={onPlayAll}>
          {playingAll ? <IconPause size={14} /> : <IconPlay size={14} />}
          {playingAll ? "Pause" : "Play all"}
        </button>

        <span className="tiny dim mono">
          {shown.length} of {total} listed
        </span>

        <div className="row" style={{ gap: 4, marginLeft: "auto" }}>
          <button
            type="button"
            className="btn btn--sm"
            data-active={view === "grid"}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            title="Cover-art grid"
          >
            <IconGrid size={15} /> Grid
          </button>
          <button
            type="button"
            className="btn btn--sm"
            data-active={view === "list"}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            title="Numbered tracklist"
          >
            <IconMusic size={15} /> List
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="beat-grid">
          {shown.map((track) => (
            <BeatCard key={track.id} track={track} queue={tracks} />
          ))}
        </div>
      ) : (
        <div className="panel panel--flat pad">
          <BeatRowHead />
          <div className="stack" style={{ gap: 2 }}>
            {shown.map((track, i) => (
              <BeatRow key={track.id} track={track} queue={tracks} index={i} />
            ))}
          </div>
        </div>
      )}

      <div className="row row--wrap" style={{ gap: 12, marginTop: 22 }}>
        {tracks.length > initial && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? `Show fewer` : `Show all ${tracks.length} on the homepage`}
          </button>
        )}
        {total > tracks.length && (
          <Link href="/beats" className="btn btn--ghost btn--sm">
            {total - tracks.length} more in the store →
          </Link>
        )}
      </div>
    </div>
  );
}
