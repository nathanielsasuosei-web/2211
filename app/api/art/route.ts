import { NextResponse, type NextRequest } from "next/server";
import { coverArtSvg } from "@/lib/media/art.mjs";

export const runtime = "nodejs";

/** Fallback cover art generator — /api/art/cover.svg?title=...&genre=...&seed=1 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const svg = coverArtSvg({
    title: p.get("title") ?? "Beat",
    genre: p.get("genre") ?? "",
    bpm: p.get("bpm") ? Number(p.get("bpm")) : undefined,
    musicalKey: p.get("key") ?? "",
    seed: Number(p.get("seed") ?? 1),
    producer: p.get("producer") ?? "2211 BEATS",
    size: Number(p.get("size") ?? 600),
  });
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
