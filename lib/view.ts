import type { Track } from "@/components/player-context";
import type { Beat, License, Order, Video } from "./types";
import { moneyLabel } from "./money";

/** URL for a stored file (served by /api/file/[...path]). */
export function fileUrl(p?: string | null): string | null {
  if (!p) return null;
  const rel = String(p).replace(/^storage\//, "").replace(/^\/+/, "");
  return `/api/file/${rel}`;
}

export function artworkUrl(beat: { artwork?: string | null }, fallbackTitle = "Beat"): string {
  return fileUrl(beat.artwork) ?? `/api/art?title=${encodeURIComponent(fallbackTitle)}&seed=${encodeURIComponent(fallbackTitle.length.toString())}`;
}

export type ClientBeat = {
  id: string;
  slug: string;
  title: string;
  genre: string;
  mood: string | null;
  bpm: number | null;
  musical_key: string | null;
  duration_sec: number | null;
  price_cents: number;
  currency: string;
  artworkUrl: string;
  previewUrl: string | null;
  plays: number;
  is_free: boolean;
  exclusive_sold: boolean;
};

export function toClientBeat(beat: Beat): ClientBeat {
  return {
    id: beat.id,
    slug: beat.slug,
    title: beat.title,
    genre: beat.genre,
    mood: beat.mood,
    bpm: beat.bpm,
    musical_key: beat.musical_key,
    duration_sec: beat.duration_sec,
    price_cents: beat.price_cents,
    currency: beat.currency,
    artworkUrl: artworkUrl(beat, beat.title),
    previewUrl: fileUrl(beat.preview_file),
    plays: beat.plays ?? 0,
    is_free: !!beat.is_free,
    exclusive_sold: !!beat.exclusive_sold,
  };
}

export type ClientVideo = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: Video["kind"];
  url: string | null;
  fileUrl: string | null;
  posterUrl: string | null;
  beat: ClientBeat | null;
  duration_sec: number | null;
  views: number;
};

export function toClientVideo(video: Video, beat: Beat | null): ClientVideo {
  return {
    id: video.id,
    slug: video.slug,
    title: video.title,
    description: video.description,
    kind: video.kind,
    url: video.url,
    fileUrl: fileUrl(video.file_path),
    posterUrl: fileUrl(video.poster),
    beat: beat ? toClientBeat(beat) : null,
    duration_sec: video.duration_sec,
    views: video.views ?? 0,
  };
}

/** Shape consumed by the client-side audio player. */
export function toTrack(beat: Beat): Track {
  const b = toClientBeat(beat);
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    genre: b.genre,
    artworkUrl: b.artworkUrl,
    src: b.previewUrl,
    duration_sec: b.duration_sec,
    bpm: b.bpm,
    musical_key: b.musical_key,
    price_cents: b.price_cents,
    currency: b.currency,
  };
}

export function formatDuration(sec?: number | null): string {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusChip(status: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    pending: { label: "Pending", tone: "chip--warn" },
    awaiting_payment: { label: "Awaiting payment", tone: "chip--warn" },
    in_review: { label: "In review", tone: "chip--info" },
    paid: { label: "Paid", tone: "chip--ok" },
    delivered: { label: "Delivered", tone: "chip--ok" },
    failed: { label: "Failed", tone: "chip--bad" },
    cancelled: { label: "Cancelled", tone: "" },
    refunded: { label: "Refunded", tone: "" },
    sent: { label: "Sent", tone: "chip--ok" },
    dev: { label: "Outbox (no SMTP)", tone: "chip--info" },
    queued: { label: "Queued", tone: "chip--warn" },
  };
  return map[status] ?? { label: status, tone: "" };
}

export function methodChip(method: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    mpesa: { label: "M-Pesa", tone: "chip--ok" },
    paystack: { label: "Paystack", tone: "chip--info" },
    bank: { label: "Bank / MoMo", tone: "chip--warn" },
    demo: { label: "Demo", tone: "" },
    free: { label: "Free", tone: "" },
  };
  return map[method] ?? { label: method, tone: "" };
}

export function licensePerks(license: License | null): string[] {
  if (!license?.perks) return [];
  try {
    const parsed = JSON.parse(license.perks);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function deliveryFiles(delivery: { files: string } | null): { label: string; path: string }[] {
  if (!delivery?.files) return [];
  try {
    const parsed = JSON.parse(delivery.files);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function orderSummary(order: Order, beat: Beat | null, license: License | null) {
  return {
    reference: order.reference,
    beat: beat?.title ?? "Beat",
    license: license?.name ?? "Standard",
    amount: moneyLabel(order.amount_cents, order.currency),
    method: order.method,
    status: order.status,
  };
}

export function initials(name: string): string {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

