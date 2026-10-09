import Link from "next/link";
import { Suspense } from "react";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import { getSetting, listBeats, listGenres, listPurchases } from "@/lib/repo";
import { toTrack } from "@/lib/view";
import BeatCard from "@/components/BeatCard";
import BeatRow, { BeatRowHead } from "@/components/BeatRow";
import FilterBar from "@/components/FilterBar";
import ViewToggle from "@/components/ViewToggle";
import type { BeatFilters } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beat store" };

type Search = { [key: string]: string | string[] | undefined };

function one(params: Search, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function toFilters(params: Search): BeatFilters {
  const num = (key: string) => {
    const v = parseInt(one(params, key) ?? "", 10);
    return Number.isFinite(v) ? v : undefined;
  };
  const sort = one(params, "sort") ?? "new";
  return {
    q: one(params, "q") || undefined,
    genre: one(params, "genre") || undefined,
    mood: one(params, "mood") || undefined,
    key: one(params, "key") || undefined,
    bpmMin: num("bpmMin"),
    bpmMax: num("bpmMax"),
    sort: (["new", "popular", "price_asc", "price_desc", "title"] as const).includes(sort as never)
      ? (sort as BeatFilters["sort"])
      : "new",
    limit: 120,
  };
}

export default async function BeatsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await ensureBootstrapped();
  const params = await searchParams;
  const filters = toFilters(params);
  const view = one(params, "view") === "list" ? "list" : "grid";

  const [beats, genres, session, brand] = await Promise.all([
    listBeats(filters),
    listGenres(),
    getSession(),
    getSetting("brand_name", "2211 BEATS"),
  ]);
  const purchases = session ? await listPurchases(session.id) : [];
  const ownedIds = new Set(purchases.map((p) => p.beat_id));
  const queue = beats.map(toTrack);

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 24 }}>
        <header className="stack" style={{ gap: 12 }}>
          <span className="eyebrow">The catalogue</span>
          <h1 className="display h-lg">
            Beat <span className="red">store</span>
          </h1>
          <p className="lede">
            Instrumentals from the {brand} catalogue — all mixed, mastered and cleared for release. Preview free,
            licence instantly, files delivered by email within seconds of payment.
          </p>
        </header>

        <Suspense fallback={<div className="skeleton" style={{ height: 92 }} />}>
          <FilterBar count={beats.length} />
        </Suspense>

        <div className="row row--between row--wrap" style={{ gap: 12 }}>
          <div className="row row--wrap" style={{ gap: 8 }}>
            {genres.slice(0, 7).map((g) => (
              <Link key={g} href={`/beats?genre=${encodeURIComponent(g)}`} className="chip">
                {g}
              </Link>
            ))}
          </div>
          <ViewToggle view={view} />
        </div>

        {beats.length === 0 ? (
          <div className="empty">
            <h4>Nothing matches those filters</h4>
            <p>
              Try another genre or{" "}
              <Link href="/beats" className="red">
                reset the filters
              </Link>
              .
            </p>
          </div>
        ) : view === "list" ? (
          <div className="panel panel--flat pad">
            <BeatRowHead />
            <div className="stack" style={{ gap: 2 }}>
              {beats.map((beat, i) => (
                <BeatRow
                  key={beat.id}
                  track={toTrack(beat)}
                  queue={queue}
                  index={i}
                  owned={ownedIds.has(beat.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="beat-grid">
            {beats.map((beat) => (
              <BeatCard key={beat.id} track={toTrack(beat)} queue={queue} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
