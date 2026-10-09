"use client";

import { useActionState, useState } from "react";
import { deleteVideoAction, toggleVideoPublishAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconCheck, IconTrash } from "./icons";

export default function VideoControls({
  video,
}: {
  video: { id: string; title: string; published: boolean };
}) {
  const [toggleState, toggleAction, toggling] = useActionState(toggleVideoPublishAction, undefined);
  const [delState, delAction, deleting] = useActionState(deleteVideoAction, undefined);
  const [confirm, setConfirm] = useState(false);
  useActionToast(toggleState);
  useActionToast(delState);

  return (
    <>
      <form action={toggleAction}>
        <input type="hidden" name="id" value={video.id} />
        <button type="submit" className="btn btn--dark btn--sm" disabled={toggling}>
          <IconCheck size={13} /> {video.published ? "Unpublish" : "Publish"}
        </button>
      </form>

      {confirm ? (
        <span className="row" style={{ gap: 6 }}>
          <form action={delAction}>
            <input type="hidden" name="id" value={video.id} />
            <button type="submit" className="btn btn--primary btn--sm" disabled={deleting}>
              {deleting ? "Deleting…" : "Confirm"}
            </button>
          </form>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm" style={{ color: "#ff9d9d" }} onClick={() => setConfirm(true)}>
          <IconTrash size={13} />
        </button>
      )}
    </>
  );
}
