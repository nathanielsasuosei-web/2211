"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { deleteBeatAction, toggleBeatFlagAction, updateBeatAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconCheck, IconExternal, IconTrash, IconUpload } from "./icons";
import { GENRES, KEYS, MOODS } from "@/lib/site-data";

type BeatDraft = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  mood: string | null;
  bpm: number | null;
  musical_key: string | null;
  tags: string | null;
  description: string | null;
  price: number;
  currency: string;
  published: boolean;
  featured: boolean;
  is_free: boolean;
};

export default function BeatRowControls({ beat }: { beat: BeatDraft }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flagState, flagAction, flagPending] = useActionState(toggleBeatFlagAction, undefined);
  const [editState, editAction, editPending] = useActionState(updateBeatAction, undefined);
  const [delState, delAction, delPending] = useActionState(deleteBeatAction, undefined);
  useActionToast(flagState);
  useActionToast(editState);
  useActionToast(delState);

  const FlagButton = ({ flag, label }: { flag: "published" | "featured" | "is_free"; label: string }) => (
    <form action={flagAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={beat.id} />
      <input type="hidden" name="flag" value={flag} />
      <button type="submit" className="btn btn--ghost btn--sm" disabled={flagPending}>
        <IconCheck size={13} /> {label}
      </button>
    </form>
  );

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row row--wrap" style={{ gap: 8 }}>
        <FlagButton flag="published" label={beat.published ? "Unpublish" : "Publish"} />
        <FlagButton flag="featured" label={beat.featured ? "Unfeature" : "Feature"} />
        <FlagButton flag="is_free" label={beat.is_free ? "Make paid" : "Make free"} />
        <button type="button" className="btn btn--dark btn--sm" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close editor" : "Edit details"}
        </button>
        <Link href={`/beats/${beat.slug}`} className="btn btn--ghost btn--sm" target="_blank">
          <IconExternal size={13} /> View page
        </Link>

        {confirmDelete ? (
          <span className="row" style={{ gap: 6 }}>
            <form action={delAction}>
              <input type="hidden" name="id" value={beat.id} />
              <button type="submit" className="btn btn--primary btn--sm" disabled={delPending}>
                <IconTrash size={13} /> {delPending ? "Deleting…" : "Confirm delete"}
              </button>
            </form>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" style={{ color: "#ff9d9d" }} onClick={() => setConfirmDelete(true)}>
            <IconTrash size={13} /> Delete
          </button>
        )}
      </div>

      {editing && (
        <form action={editAction} className="panel pad stack" style={{ gap: 14 }}>
          <input type="hidden" name="id" value={beat.id} />
          <div className="form-grid">
            <div className="field">
              <label htmlFor={`t-${beat.id}`}>Title</label>
              <input id={`t-${beat.id}`} name="title" className="input" defaultValue={beat.title} required />
            </div>
            <div className="field">
              <label htmlFor={`g-${beat.id}`}>Genre</label>
              <select id={`g-${beat.id}`} name="genre" className="select" defaultValue={beat.genre}>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`m-${beat.id}`}>Mood</label>
              <select id={`m-${beat.id}`} name="mood" className="select" defaultValue={beat.mood ?? ""}>
                <option value="">—</option>
                {MOODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`k-${beat.id}`}>Key</label>
              <select id={`k-${beat.id}`} name="musical_key" className="select" defaultValue={beat.musical_key ?? ""}>
                <option value="">—</option>
                {KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`b-${beat.id}`}>BPM</label>
              <input id={`b-${beat.id}`} name="bpm" className="input" defaultValue={beat.bpm ?? ""} inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor={`p-${beat.id}`}>Base price ({beat.currency})</label>
              <input id={`p-${beat.id}`} name="price" className="input" defaultValue={beat.price} inputMode="decimal" step="0.01" />
            </div>
          </div>

          <div className="field">
            <label htmlFor={`tags-${beat.id}`}>Tags</label>
            <input id={`tags-${beat.id}`} name="tags" className="input" defaultValue={beat.tags ?? ""} />
          </div>

          <div className="field">
            <label htmlFor={`d-${beat.id}`}>Description</label>
            <textarea id={`d-${beat.id}`} name="description" className="textarea" defaultValue={beat.description ?? ""} />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {([
              ["preview_file", "Replace preview (audio)"],
              ["full_file", "Replace master (audio)"],
              ["trackout_file", "Replace trackout (ZIP)"],
              ["artwork_file", "Replace cover art (image)"],
            ] as const).map(([name, label]) => (
              <label key={name} className="dropzone stack" style={{ gap: 6 }}>
                <input type="file" name={name} accept={name === "artwork_file" ? "image/*" : name === "trackout_file" ? ".zip" : "audio/*"} />
                <span className="row" style={{ gap: 8, justifyContent: "center" }}>
                  <IconUpload size={15} className="red" />
                  <span className="tiny">{label}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="row row--wrap" style={{ gap: 16 }}>
            <label className="check">
              <input type="checkbox" name="published" defaultChecked={beat.published} />
              <span>Published</span>
            </label>
            <label className="check">
              <input type="checkbox" name="featured" defaultChecked={beat.featured} />
              <span>Featured on home</span>
            </label>
            <label className="check">
              <input type="checkbox" name="is_free" defaultChecked={beat.is_free} />
              <span>Free download</span>
            </label>
          </div>

          {editState?.error && <div className="form-error">{editState.error}</div>}
          {editState?.ok && editState.message && <div className="form-ok">{editState.message}</div>}

          <button type="submit" className="btn btn--primary btn--sm" disabled={editPending} style={{ alignSelf: "flex-start" }}>
            {editPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
    </div>
  );
}
