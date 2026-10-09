"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadVideoAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconCheck, IconUpload, IconVideo } from "./icons";
import { humanBytes } from "@/lib/format";

export default function AdminVideoUpload({
  beats,
}: {
  beats: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(uploadVideoAction, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [mode, setMode] = useState<"upload" | "link" | "visualizer">("upload");
  const formRef = useRef<HTMLFormElement | null>(null);
  useActionToast(state);

  useEffect(() => {
    if (state?.ok) {
      setFile(null);
      setPoster(null);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="panel pad-lg stack" style={{ gap: 18 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">
          <IconVideo size={12} /> Watch page
        </span>
        <h2 className="display h-sm">Add a video</h2>
        <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Upload an MP4/WebM, paste a YouTube or Vimeo link, or publish a live audio visualizer for one of your beats.
        </p>
      </div>

      <div className="row row--wrap" style={{ gap: 8 }}>
        {(["upload", "link", "visualizer"] as const).map((m) => (
          <button key={m} type="button" className="btn btn--sm" data-active={mode === m} onClick={() => setMode(m)}>
            {m === "upload" ? "Upload file" : m === "link" ? "YouTube / Vimeo link" : "Beat visualizer"}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="v-title">Title *</label>
          <input id="v-title" name="title" className="input" required minLength={2} placeholder="Studio session — Accra Nights" />
        </div>
        <div className="field">
          <label htmlFor="v-beat">Link to a beat (optional)</label>
          <select id="v-beat" name="beat_id" className="select" defaultValue="" required={mode === "visualizer"}>
            <option value="">—</option>
            {beats.map((b) => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="v-desc">Description</label>
        <textarea id="v-desc" name="description" className="textarea" placeholder="What happens in this video?" />
      </div>

      {mode === "link" && (
        <div className="field">
          <label htmlFor="v-url">YouTube / Vimeo URL *</label>
          <input id="v-url" name="url" className="input" placeholder="https://www.youtube.com/watch?v=…" required={mode === "link"} />
          <span className="hint">Opens in a new tab from the Watch page.</span>
        </div>
      )}

      {mode === "upload" && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
          <label className="dropzone stack" style={{ gap: 8 }}>
            <input type="file" name="video_file" accept="video/*,.mp4,.webm,.mov,.mkv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <span className="row" style={{ gap: 9, justifyContent: "center" }}>
              <IconUpload size={16} className="red" />
              <strong style={{ fontSize: 13.5 }}>Video file (MP4/WebM/MOV)</strong>
            </span>
            {file ? (
              <span className="chip chip--ok"><IconCheck size={12} /> {file.name} · {humanBytes(file.size)}</span>
            ) : (
              <span className="chip">Drop file or click to browse</span>
            )}
          </label>

          <label className="dropzone stack" style={{ gap: 8 }}>
            <input type="file" name="poster_file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
            <span className="row" style={{ gap: 9, justifyContent: "center" }}>
              <IconUpload size={16} className="red" />
              <strong style={{ fontSize: 13.5 }}>Poster image (optional)</strong>
            </span>
            {poster ? (
              <span className="chip chip--ok"><IconCheck size={12} /> {poster.name}</span>
            ) : (
              <span className="chip">Shown before playback</span>
            )}
          </label>
        </div>
      )}

      {mode === "visualizer" && (
        <div className="form-ok" style={{ lineHeight: 1.6 }}>
          The video card will play the selected beat with a live canvas visualizer — perfect for session teasers without
          rendering a video file.
        </div>
      )}

      <label className="check">
        <input type="checkbox" name="published" value="on" defaultChecked />
        <span>Published on the Watch page</span>
      </label>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && state.message && <div className="form-ok">{state.message}</div>}

      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
        <IconVideo size={16} /> {pending ? "Uploading…" : "Add video"}
      </button>
    </form>
  );
}
