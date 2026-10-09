"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadBeatAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconCheck, IconMusic, IconUpload } from "./icons";
import { GENRES, KEYS, MOODS } from "@/lib/site-data";
import { humanBytes } from "@/lib/format";

type FileSlot = {
  name: string;
  label: string;
  hint: string;
  accept: string;
  required?: boolean;
};

const SLOTS: FileSlot[] = [
  {
    name: "preview_file",
    label: "Tagged preview (MP3/WAV)",
    hint: "What visitors stream in the store. Keep the producer tag on it.",
    accept: "audio/*,.mp3,.wav,.m4a,.flac",
    required: true,
  },
  {
    name: "full_file",
    label: "Untagged master (WAV/MP3)",
    hint: "Delivered to the buyer after payment. Private — never streamed publicly.",
    accept: "audio/*,.mp3,.wav,.m4a,.flac",
  },
  {
    name: "trackout_file",
    label: "Trackout / stems (ZIP)",
    hint: "Included with the Trackout and Exclusive licences.",
    accept: ".zip,.rar,.7z",
  },
  {
    name: "artwork_file",
    label: "Cover art (JPG/PNG/SVG)",
    hint: "Square works best — 1000×1000 or larger.",
    accept: "image/*,.svg",
  },
];

export default function AdminBeatUpload({ defaultCurrency }: { defaultCurrency: string }) {
  const [state, action, pending] = useActionState(uploadBeatAction, undefined);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [extras, setExtras] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string>("Afrobeats");
  const [price, setPrice] = useState("120");
  const [isFree, setIsFree] = useState(false);
  const [licenseMode, setLicenseMode] = useState<"auto" | "custom">("auto");
  const [customLicenses, setCustomLicenses] = useState("MP3 Lease:120|WAV Lease:220|Trackout:380|Exclusive:1200");
  const formRef = useRef<HTMLFormElement | null>(null);
  useActionToast(state);

  useEffect(() => {
    if (state?.ok) {
      setFiles({});
      setExtras([]);
      setTitle("");
      formRef.current?.reset();
    }
  }, [state]);

  const setSlot = (name: string, file: File | null) => setFiles((f) => ({ ...f, [name]: file }));

  return (
    <form ref={formRef} action={action} className="panel pad-lg stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">
          <IconUpload size={12} /> New upload
        </span>
        <h2 className="display h-sm">Upload a beat</h2>
        <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Previews stream publicly; masters and stems stay private and are only released after payment. Everything is
          stored on this server under <span className="mono">storage/uploads</span>.
        </p>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="b-title">Title *</label>
          <input
            id="b-title"
            name="title"
            className="input"
            required
            minLength={2}
            maxLength={90}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Accra Nights"
          />
        </div>
        <div className="field">
          <label htmlFor="b-genre">Genre *</label>
          <select id="b-genre" name="genre" className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="b-mood">Mood</label>
          <select id="b-mood" name="mood" className="select" defaultValue="">
            <option value="">—</option>
            {MOODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="b-key">Key</label>
          <select id="b-key" name="musical_key" className="select" defaultValue="">
            <option value="">—</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="b-bpm">BPM</label>
          <input id="b-bpm" name="bpm" className="input" inputMode="numeric" min={40} max={260} placeholder="102" />
        </div>
        <div className="field">
          <label htmlFor="b-price">Base price ({defaultCurrency})</label>
          <input
            id="b-price"
            name="price"
            className="input"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={isFree ? "0" : price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isFree}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="b-tags">Tags (comma separated)</label>
        <input id="b-tags" name="tags" className="input" placeholder="afrobeats, log drum, radio ready" maxLength={240} />
      </div>

      <div className="field">
        <label htmlFor="b-desc">Description</label>
        <textarea
          id="b-desc"
          name="description"
          className="textarea"
          maxLength={2000}
          placeholder="What makes this beat work — arrangement, instrumentation, who it suits…"
        />
      </div>

      {/* ---- file slots ------------------------------------------------ */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {SLOTS.map((slot) => {
          const file = files[slot.name];
          return (
            <label
              key={slot.name}
              className="dropzone stack"
              data-drag={dragOver === slot.name}
              style={{ gap: 8 }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(slot.name);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) setSlot(slot.name, dropped);
              }}
            >
              <input
                type="file"
                name={slot.name}
                accept={slot.accept}
                onChange={(e) => setSlot(slot.name, e.target.files?.[0] ?? null)}
              />
              <span className="row" style={{ gap: 9, justifyContent: "center" }}>
                <IconUpload size={17} className="red" />
                <strong style={{ fontSize: 13.5 }}>{slot.label}</strong>
              </span>
              <span className="tiny dim" style={{ lineHeight: 1.5 }}>{slot.hint}</span>
              {file ? (
                <span className="chip chip--ok">
                  <IconCheck size={12} /> {file.name} · {humanBytes(file.size)}
                </span>
              ) : (
                <span className="chip">Drop file or click to browse</span>
              )}
            </label>
          );
        })}
      </div>

      {/* ---- extras ---------------------------------------------------- */}
      <div className="field">
        <label htmlFor="b-extras">Extra deliverables (optional, up to 24 files)</label>
        <input
          id="b-extras"
          type="file"
          multiple
          accept=".mp3,.wav,.zip,.pdf,.flac,.m4a,.ogg,.aiff"
          onChange={(e) => setExtras(Array.from(e.target.files ?? []))}
          className="input"
          style={{ padding: 10 }}
        />
        <span className="hint">
          Alternate mixes, bonus loops, PDF contracts… these are attached to the delivery bundle.
        </span>
        {extras.length > 0 && (
          <div className="row row--wrap" style={{ gap: 6, marginTop: 6 }}>
            {extras.map((f) => (
              <span key={`${f.name}-${f.size}`} className="chip chip--red">
                <IconMusic size={11} /> {f.name} · {humanBytes(f.size)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---- licences --------------------------------------------------- */}
      <div className="panel panel--flat pad stack" style={{ gap: 12 }}>
        <div className="row row--between row--wrap" style={{ gap: 10 }}>
          <strong style={{ fontSize: 14.5 }}>Licence tiers</strong>
          <span className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn btn--sm"
              data-active={licenseMode === "auto"}
              onClick={() => setLicenseMode("auto")}
            >
              Automatic (4 tiers)
            </button>
            <button
              type="button"
              className="btn btn--sm"
              data-active={licenseMode === "custom"}
              onClick={() => setLicenseMode("custom")}
            >
              Custom prices
            </button>
          </span>
        </div>

        {licenseMode === "auto" ? (
          <p className="tiny muted" style={{ margin: 0, lineHeight: 1.65 }}>
            Creates MP3 Lease (1×), WAV Lease (1.8×), Trackout (3×) and Exclusive (8×) based on your base price. You can
            edit them later.
          </p>
        ) : (
          <div className="field">
            <label htmlFor="b-licenses">Name:price, separated by |</label>
            <input
              id="b-licenses"
              name="licenses"
              className="input mono"
              value={customLicenses}
              onChange={(e) => setCustomLicenses(e.target.value)}
            />
            <span className="hint">Example: MP3 Lease:120|WAV Lease:220|Trackout:380|Exclusive:1200</span>
          </div>
        )}

        <div className="row row--wrap" style={{ gap: 16 }}>
          <label className="check">
            <input type="checkbox" name="published" value="on" defaultChecked />
            <span>Published (visible in the store)</span>
          </label>
          <label className="check">
            <input type="checkbox" name="featured" value="on" />
            <span>Feature on the home page</span>
          </label>
          <label className="check">
            <input type="checkbox" name="is_free" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            <span>Free download</span>
          </label>
        </div>
      </div>

      <input type="hidden" name="currency" value={defaultCurrency} />
      {licenseMode === "auto" && <input type="hidden" name="licenses" value="" />}

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && state.message && <div className="form-ok">{state.message}</div>}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
        <IconUpload size={17} />
        {pending ? "Uploading & processing…" : "Upload beat"}
      </button>
      <p className="tiny dim center" style={{ margin: 0 }}>
        Maximum {` `}400MB per file. Large sessions are best uploaded as a single ZIP.
      </p>
    </form>
  );
}
