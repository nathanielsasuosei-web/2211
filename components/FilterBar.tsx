"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, IconSearch } from "./icons";
import { GENRES, KEYS, MOODS } from "@/lib/site-data";

const SORTS = [
  { value: "new", label: "Newest" },
  { value: "popular", label: "Most played" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "title", label: "A–Z" },
];

export default function FilterBar({ count }: { count: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [genre, setGenre] = useState(params.get("genre") ?? "all");
  const [mood, setMood] = useState(params.get("mood") ?? "all");
  const [key, setKey] = useState(params.get("key") ?? "all");
  const [sort, setSort] = useState(params.get("sort") ?? "new");
  const [bpmMin, setBpmMin] = useState(params.get("bpmMin") ?? "");
  const [bpmMax, setBpmMax] = useState(params.get("bpmMax") ?? "");

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries({ genre, mood, key, sort, q, bpmMin, bpmMax, ...patch })) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/beats?${next.toString()}`, { scroll: false });
  };

  const active = [
    genre !== "all" && `Genre: ${genre}`,
    mood !== "all" && `Mood: ${mood}`,
    key !== "all" && `Key: ${key}`,
    bpmMin && `BPM ≥ ${bpmMin}`,
    bpmMax && `BPM ≤ ${bpmMax}`,
    q && `Search: "${q}"`,
  ].filter(Boolean) as string[];

  return (
    <div className="panel pad stack" style={{ gap: 14 }}>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          apply({});
        }}
      >
        <div className="row" style={{ gap: 8, flex: "1 1 240px" }}>
          <span className="dim">
            <IconSearch size={16} />
          </span>
          <input
            className="input grow"
            type="search"
            name="q"
            placeholder="Search title, tag, genre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search beats"
          />
        </div>

        <select className="select" value={genre} onChange={(e) => apply({ genre: e.target.value })} aria-label="Genre">
          <option value="all">All genres</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select className="select" value={mood} onChange={(e) => apply({ mood: e.target.value })} aria-label="Mood">
          <option value="all">Any mood</option>
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select className="select" value={key} onChange={(e) => apply({ key: e.target.value })} aria-label="Musical key">
          <option value="all">Any key</option>
          {KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <input
          className="input"
          style={{ width: 92 }}
          inputMode="numeric"
          placeholder="BPM min"
          value={bpmMin}
          onChange={(e) => setBpmMin(e.target.value.replace(/\D/g, ""))}
          aria-label="Minimum BPM"
        />
        <input
          className="input"
          style={{ width: 92 }}
          inputMode="numeric"
          placeholder="BPM max"
          value={bpmMax}
          onChange={(e) => setBpmMax(e.target.value.replace(/\D/g, ""))}
          aria-label="Maximum BPM"
        />

        <select className="select" value={sort} onChange={(e) => apply({ sort: e.target.value })} aria-label="Sort by">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button type="submit" className="btn btn--primary btn--sm">
          Apply
        </button>
      </form>

      <div className="row row--between row--wrap" style={{ gap: 10 }}>
        <span className="tiny muted">
          <strong style={{ color: "var(--text)" }}>{count}</strong> beat{count === 1 ? "" : "s"} found
        </span>
        {active.length > 0 && (
          <div className="row row--wrap" style={{ gap: 7 }}>
            {active.map((a) => (
              <span key={a} className="chip chip--red">
                {a}
              </span>
            ))}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => router.push("/beats", { scroll: false })}
            >
              <IconClose size={13} /> Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
