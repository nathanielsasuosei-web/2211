"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { importBeatsAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { humanBytes } from "@/lib/format";
import { IconCheck, IconMusic, IconUpload, IconVideo } from "./icons";

type BeatRow = {
  key: string;
  title: string;
  slug: string;
  genre: string;
  bpm: number | null;
  musical_key: string | null;
  price: number | null;
  duration: number | null;
  metaSource: string;
  warnings: string[];
  files: { role: string; name: string; bytes: number }[];
};

type VideoRow = { key: string; title: string; files: { role: string; name: string; bytes: number }[]; warnings: string[] };

export default function AdminImport({ beats, videos }: { beats: BeatRow[]; videos: VideoRow[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(importBeatsAction, undefined);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries([...beats, ...videos].map((b) => [b.key, true])),
  );
  const [removeSource, setRemoveSource] = useState(false);
  const [publish, setPublish] = useState(true);
  useActionToast(state);

  const chosen = Object.entries(selected).filter(([, on]) => on).map(([key]) => key);
  const allOn = chosen.length === beats.length + videos.length;

  const toggleAll = () => {
    const next = !allOn;
    setSelected(Object.fromEntries([...beats, ...videos].map((b) => [b.key, next])));
  };

  return (
    <form
      action={action}
      className="panel pad-lg stack"
      style={{ gap: 16 }}
      onSubmit={() => setTimeout(() => router.refresh(), 1200)}
    >
      <div className="row row--between row--wrap" style={{ gap: 10 }}>
        <span className="row" style={{ gap: 9 }}>
          <IconUpload size={15} className="red" />
          <strong style={{ fontSize: 14.5 }}>
            {chosen.length} of {beats.length + videos.length} selected
          </strong>
        </span>
        <span className="row row--wrap" style={{ gap: 8 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={toggleAll}>
            {allOn ? "Clear all" : "Select all"}
          </button>
          <label className="check">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            <input type="hidden" name="publish" value={publish ? "on" : "off"} />
            <span>Publish immediately</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={removeSource} onChange={(e) => setRemoveSource(e.target.checked)} />
            <input type="hidden" name="remove_source" value={removeSource ? "on" : "off"} />
            <span>Delete source files after copy</span>
          </label>
        </span>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {beats.map((b) => (
          <label
            key={b.key}
            className="panel panel--flat pad stack"
            style={{ gap: 10, cursor: "pointer", borderColor: selected[b.key] ? "rgba(var(--accent-rgb), .45)" : undefined }}
          >
            <input type="checkbox" name="key" value={b.key} checked={!!selected[b.key]} onChange={(e) => setSelected((s) => ({ ...s, [b.key]: e.target.checked }))} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
            <div className="row row--between row--wrap" style={{ gap: 10 }}>
              <span className="row" style={{ gap: 10 }}>
                <span className="chip chip--red" style={{ width: 30, height: 30, justifyContent: "center", borderRadius: "50%" }}>
                  {selected[b.key] ? <IconCheck size={13} /> : <IconMusic size={13} />}
                </span>
                <span className="stack" style={{ gap: 2 }}>
                  <strong style={{ fontSize: 15 }}>{b.title}</strong>
                  <span className="tiny dim mono">/{b.slug}</span>
                </span>
              </span>
              <span className="row row--wrap" style={{ gap: 6 }}>
                <span className="chip">{b.genre}</span>
                {b.bpm ? <span className="chip">{b.bpm} BPM</span> : null}
                {b.musical_key ? <span className="chip">{b.musical_key}</span> : null}
                {b.duration ? <span className="chip">{Math.round(b.duration)}s</span> : null}
                {b.price !== null ? <span className="chip chip--ok">base {b.price}</span> : <span className="chip">default price</span>}
                <span className="chip chip--info">{b.metaSource}</span>
              </span>
            </div>

            <div className="row row--wrap" style={{ gap: 6 }}>
              {b.files.map((f) => (
                <span key={`${b.key}-${f.name}`} className="chip" title={f.name}>
                  {f.role} · <span className="mono">{humanBytes(f.bytes)}</span>
                </span>
              ))}
            </div>

            {b.warnings.length > 0 && (
              <ul className="tiny" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: "var(--warn)" }}>
                {b.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </label>
        ))}

        {videos.map((v) => (
          <label
            key={v.key}
            className="panel panel--flat pad row row--between row--wrap"
            style={{ gap: 10, cursor: "pointer", borderColor: selected[v.key] ? "rgba(var(--accent-rgb), .45)" : undefined }}
          >
            <input type="checkbox" name="key" value={v.key} checked={!!selected[v.key]} onChange={(e) => setSelected((s) => ({ ...s, [v.key]: e.target.checked }))} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
            <span className="row" style={{ gap: 10 }}>
              <span className="chip chip--red" style={{ width: 30, height: 30, justifyContent: "center", borderRadius: "50%" }}>
                {selected[v.key] ? <IconCheck size={13} /> : <IconVideo size={13} />}
              </span>
              <span className="stack" style={{ gap: 2 }}>
                <strong style={{ fontSize: 15 }}>{v.title}</strong>
                <span className="tiny dim">Video for the Watch page</span>
              </span>
            </span>
            <span className="row row--wrap" style={{ gap: 6 }}>
              {v.files.map((f) => (
                <span key={`${v.key}-${f.name}`} className="chip">
                  {f.role} · <span className="mono">{humanBytes(f.bytes)}</span>
                </span>
              ))}
            </span>
          </label>
        ))}
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && state.message && <div className="form-ok">{state.message}</div>}

      <div className="row row--wrap" style={{ gap: 10 }}>
        <button type="submit" className="btn btn--primary" disabled={pending || chosen.length === 0}>
          <IconUpload size={15} /> {pending ? "Importing…" : `Import ${chosen.length} item${chosen.length === 1 ? "" : "s"}`}
        </button>
        <span className="tiny dim" style={{ alignSelf: "center" }}>
          Files are copied into the upload tree; licence tiers are generated from each beat&apos;s metadata.
        </span>
      </div>
    </form>
  );
}
