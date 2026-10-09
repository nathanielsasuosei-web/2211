import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getDeliveryByToken, registerDownload, getBeatById, getOrderById, getUserById, getLicense } from "@/lib/repo";
import { buildDeliveryBundle } from "@/lib/fulfillment";
import { absPath, guessMime, DELIVERY_ROOT } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Secure delivery endpoint. The token is emailed to the buyer and stored in the
 * vault, so a purchase can be re-downloaded without exposing paid files.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  await ensureBootstrapped();
  const { token } = await ctx.params;
  const delivery = await getDeliveryByToken(token);
  if (!delivery) return NextResponse.json({ error: "Invalid or expired download link." }, { status: 404 });

  const order = await getOrderById(delivery.order_id);
  const beat = order ? await getBeatById(order.beat_id) : null;
  const buyer = order ? await getUserById(order.user_id) : null;
  const license = order?.license_id ? await getLicense(order.license_id) : null;
  if (!order || !beat || !buyer) return NextResponse.json({ error: "Order data missing." }, { status: 404 });

  await registerDownload(token);

  // ?file=1 downloads one file from the bundle instead of the ZIP.
  const wantFile = req.nextUrl.searchParams.get("file");
  const files = JSON.parse(delivery.files) as { label: string; path: string }[];
  if (wantFile !== null) {
    const idx = parseInt(wantFile, 10);
    const entry = files[idx];
    if (!entry) return NextResponse.json({ error: "File not found in this delivery." }, { status: 404 });
    const abs = absPath(entry.path);
    if (!fs.existsSync(abs)) return NextResponse.json({ error: "File is missing on the server." }, { status: 410 });
    const stream = Readable.toWeb(fs.createReadStream(abs)) as unknown as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": guessMime(abs),
        "Content-Length": String(fs.statSync(abs).size),
        "Content-Disposition": `attachment; filename="${path.basename(abs)}"`,
      },
    });
  }

  const bundle = await buildDeliveryBundle(delivery, { beat, license, order, buyer });
  if (!fs.existsSync(bundle.zipPath)) {
    return NextResponse.json({ error: "Delivery bundle could not be built." }, { status: 500 });
  }
  const stream = Readable.toWeb(fs.createReadStream(bundle.zipPath)) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(bundle.bytes),
      "Content-Disposition": `attachment; filename="${bundle.zipName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

