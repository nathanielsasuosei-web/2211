"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { IconGrid, IconMusic } from "./icons";

export default function ViewToggle({ view }: { view: "grid" | "list" }) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (next: "grid" | "list") => {
    const q = new URLSearchParams(params.toString());
    if (next === "grid") q.delete("view");
    else q.set("view", "list");
    router.push(`/beats?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="row" style={{ gap: 6 }}>
      <button
        type="button"
        className="btn btn--sm"
        data-active={view === "grid"}
        onClick={() => set("grid")}
        aria-pressed={view === "grid"}
        title="Grid view"
      >
        <IconGrid size={15} /> Grid
      </button>
      <button
        type="button"
        className="btn btn--sm"
        data-active={view === "list"}
        onClick={() => set("list")}
        aria-pressed={view === "list"}
        title="List view"
      >
        <IconMusic size={15} /> List
      </button>
    </div>
  );
}
