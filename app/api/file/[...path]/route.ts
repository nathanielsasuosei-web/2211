import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_UPLOAD_ROOT, guessMime, isInside } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Streams public media (beat previews, artwork, posters, uploaded videos)
 * with HTTP Range support so audio/video seeking works in every browser.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const rel = decodeURIComponent(segments.join("/"));
  const abs = path.resolve(PUBLIC_UPLOAD_ROOT, rel);

  if (!isInside(PUBLIC_UPLOAD_ROOT, abs)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stat = await fsp.stat(abs).catch(() => null);
  if (!stat?.isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const type = guessMime(abs);
  const range = req.headers.get("range");
  const size = stat.size;

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
    if (start >= size || end < start) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
      });
    }
    const stream = Readable.toWeb(fs.createReadStream(abs, { start, end })) as unknown as ReadableStream;
    return new NextResponse(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Content-Type": type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
    );
  }

  const stream = Readable.toWeb(fs.createReadStream(abs)) as unknown as ReadableStream;
  return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Length": String(size),
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
