import "server-only";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_ROOT } from "./storage";
import { slugify } from "./repo";

/**
 * Bulk importer.
 *
 * Drop real content into `storage/import/` (or the folder named by IMPORT_DIR)
 * and publish it from /admin/import instead of uploading one beat at a time.
 *
 * Two layouts are supported and can be mixed:
 *
 *   storage/import/
 *     accra-nights/                 ← one folder per beat
 *       preview.mp3                 (tagged / radio edit)
 *       master.wav                  (untagged, delivered on WAV+ licences)
 *       stems.zip                   (trackout, optional)
 *       artwork.jpg                 (optional — generated SVG is used otherwise)
 *       beat.json                   (optional metadata, see ImportMeta)
 *     Afrobeats - Velvet Room (140 BPM) (F min).wav
 *     Afrobeats - Velvet Room (140 BPM) (F min).jpg   ← flat files, matched by stem
 *
 * Flat files are grouped by their filename stem; role words in the name
 * (preview/tagged/demo, master/untagged/full/final, stems/trackout) pick the slot.
 */

const AUDIO_EXT = /\.(mp3|wav|aiff?|flac|m4a|ogg|aac)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg)$/i;
const ARCHIVE_EXT = /\.(zip|rar|7z)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v)$/i;

export type ImportMeta = {
  title?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  key?: string;
  tags?: string[] | string;
  description?: string;
  price?: number; // major units, e.g. 150
  currency?: string;
  licences?: string; // "MP3 Lease:120|WAV Lease:220|Trackout:380|Exclusive:1200"
  published?: boolean;
  featured?: boolean;
  is_free?: boolean;
  duration_sec?: number;
};

export type ImportFile = {
  role: "preview" | "master" | "trackout" | "artwork" | "video" | "extra";
  name: string;
  abs: string;
  bytes: number;
};

export type ImportCandidate = {
  key: string;
  stem: string;
  slug: string;
  meta: ImportMeta;
  metaSource: "beat.json" | "manifest.json" | "filename" | "defaults";
  files: ImportFile[];
  durationSec: number | null;
  warnings: string[];
};

export type ImportPlan = {
  dir: string;
  exists: boolean;
  beats: ImportCandidate[];
  videos: ImportCandidate[];
  manifestName: string | null;
};

export function importDir(): string {
  const custom = process.env.IMPORT_DIR?.trim();
  if (custom) return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  return path.join(process.cwd(), "storage", "import");
}

/* ------------------------------------------------------------------ */
/* Metadata inference                                                  */
/* ------------------------------------------------------------------ */

const ROLE_STRIP =
  /(^|[\s\-_(\[]+)(preview|tagged|radio|demo|edit|master|untagged|stems?|trackout|track-out|artwork|cover|poster|instrumental)([\s\-_)\]]+|$)/gi;

const ROLE_WORDS: Array<[RegExp, ImportFile["role"]]> = [
  [/(preview|tagged|radio|demo|edit)/i, "preview"],
  [/(master|untagged|full|final|clean|wav\s*lease)/i, "master"],
  [/(stem|trackout|track-out|tracks|multitrack)/i, "trackout"],
  [/(cover|art(work)?|poster|thumb)/i, "artwork"],
];

function roleFor(name: string): ImportFile["role"] {
  if (IMAGE_EXT.test(name)) return "artwork";
  if (ARCHIVE_EXT.test(name)) return "trackout";
  if (VIDEO_EXT.test(name)) return "video";
  for (const [re, role] of ROLE_WORDS) if (re.test(name)) return role;
  return AUDIO_EXT.test(name) ? "master" : "extra";
}

/** "Afrobeats - Accra Nights (142 BPM) (F# min)" → genre/title/bpm/key */
export function parseStem(stem: string): { genre?: string; title: string; bpm?: number; key?: string } {
  let rest = stem;
  const out: { genre?: string; title: string; bpm?: number; key?: string } = { title: stem };

  const bpm = rest.match(/\(?\[?(\d{2,3})\s*bpm\)?\]?/i) ?? rest.match(/\(?\[(\d{2,3})\]\)?/);
  if (bpm) {
    const n = Number(bpm[1]);
    if (n >= 40 && n <= 260) out.bpm = n;
    rest = rest.replace(bpm[0], " ");
  }

  const key = rest.match(/\(?\[?\b([A-G][#b]?)\s*(maj(?:or)?|min(?:or)?|m)?\b\)?\]?/i);
  if (key && /[A-G]/.test(key[1])) {
    const mode = (key[2] ?? "").toLowerCase().startsWith("maj") ? "major" : "minor";
    out.key = `${key[1]} ${mode}`;
    rest = rest.replace(key[0], " ");
  }

  // drop role words ("preview", "master", "stems"…) so titles stay clean
  let stripped = "";
  while (rest !== stripped) {
    stripped = rest;
    rest = rest.replace(ROLE_STRIP, " ");
  }

  // "Genre - Title"
  const parts = rest.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const maybeGenre = parts[0].trim();
    if (maybeGenre.length <= 24) {
      out.genre = maybeGenre;
      rest = parts.slice(1).join(" - ");
    }
  }

  out.title = rest.replace(/[_]+/g, " ").replace(/\s+/g, " ").replace(/[()\[\]]+/g, " ").trim() || stem;
  out.title = out.title.replace(/\.\w{2,4}$/, "");
  return out;
}

/* ------------------------------------------------------------------ */
/* Audio duration                                                      */
/* ------------------------------------------------------------------ */

/** Exact for PCM WAV; estimated from the first frame for MP3; null otherwise. */
export function probeDuration(abs: string): number | null {
  try {
    const fd = fs.openSync(abs, "r");
    const allocated = Buffer.alloc(64);
    const read = fs.readSync(fd, allocated, 0, 64, 0);
    const head = allocated.subarray(0, read);

    if (head.subarray(0, 4).toString("latin1") === "RIFF") {
      const size = fs.fstatSync(fd).size;
      // find the "fmt " chunk
      const buf = Buffer.alloc(Math.min(size, 4096));
      fs.readSync(fd, buf, 0, buf.length, 0);
      const fmtAt = buf.indexOf("fmt ");
      if (fmtAt > 0) {
        const channels = buf.readUInt16LE(fmtAt + 10);
        const sampleRate = buf.readUInt32LE(fmtAt + 12);
        const byteRate = buf.readUInt32LE(fmtAt + 16);
        const dataAt = buf.indexOf("data");
        const dataStart = dataAt > 0 ? dataAt + 8 : 44;
        if (byteRate > 0 && sampleRate > 0 && channels > 0) {
          const dataSize = Math.max(0, size - dataStart);
          fs.closeSync(fd);
          return Math.round((dataSize / byteRate) * 10) / 10;
        }
      }
      fs.closeSync(fd);
      return null;
    }

    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      // ID3v2 — skip the tag, then look for a frame header
      const tagSize = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
      const size = fs.fstatSync(fd).size;
      const audioBytes = Math.max(0, size - (tagSize + 10));
      const probe = Buffer.alloc(4);
      fs.readSync(fd, probe, 0, 4, tagSize + 10);
      fs.closeSync(fd);
      const bitrate = mp3Bitrate(probe);
      return bitrate ? Math.round((audioBytes * 8) / (bitrate * 1000)) : null;
    }

    if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
      const size = fs.fstatSync(fd).size;
      fs.closeSync(fd);
      const bitrate = mp3Bitrate(head);
      return bitrate ? Math.round((size * 8) / (bitrate * 1000)) : null;
    }

    fs.closeSync(fd);
  } catch {
    /* ignore — duration is optional */
  }
  return null;
}

function mp3Bitrate(frame: Buffer): number | null {
  if (frame.length < 4 || frame[0] !== 0xff || (frame[1] & 0xe0) !== 0xe0) return null;
  const versionBits = (frame[1] >> 3) & 0x03; // 00 = MPEG2.5, 10 = MPEG2, 11 = MPEG1
  const layerBits = (frame[1] >> 1) & 0x03; // 01 = layer III
  const bitrateIndex = (frame[2] >> 4) & 0x0f;
  if (layerBits !== 0x01 || bitrateIndex === 0 || bitrateIndex === 15) return null;
  const v1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const v2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  return (versionBits === 0x03 ? v1 : v2)[bitrateIndex] ?? null;
}

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */

function readJson(abs: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normaliseMeta(raw: Record<string, unknown> | null): ImportMeta {
  if (!raw) return {};
  const meta: ImportMeta = {};
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : undefined);
  const num = (k: string) => (typeof raw[k] === "number" && Number.isFinite(raw[k] as number) ? (raw[k] as number) : undefined);
  const bool = (k: string) => (typeof raw[k] === "boolean" ? (raw[k] as boolean) : undefined);

  meta.title = str("title");
  meta.genre = str("genre");
  meta.mood = str("mood");
  meta.key = str("key") ?? str("musical_key");
  meta.description = str("description");
  meta.currency = str("currency");
  meta.licences = str("licences") ?? str("licenses");
  const bpm = num("bpm");
  if (bpm) meta.bpm = bpm;
  const price = num("price") ?? num("price_cents");
  if (price !== undefined) meta.price = num("price") ?? price / 100;
  const tags = raw.tags;
  if (Array.isArray(tags)) meta.tags = tags.map(String);
  else if (typeof tags === "string") meta.tags = tags;
  const published = bool("published");
  if (published !== undefined) meta.published = published;
  const featured = bool("featured");
  if (featured !== undefined) meta.featured = featured;
  const free = bool("is_free") ?? bool("free");
  if (free !== undefined) meta.is_free = free;
  const dur = num("duration_sec") ?? num("duration");
  if (dur) meta.duration_sec = dur;
  return meta;
}

function fileEntry(abs: string, role: ImportFile["role"]): ImportFile {
  return { role, name: path.basename(abs), abs, bytes: fs.statSync(abs).size };
}

function candidate(
  stem: string,
  files: ImportFile[],
  meta: ImportMeta,
  metaSource: ImportCandidate["metaSource"],
): ImportCandidate {
  const warnings: string[] = [];
  const fromName = parseStem(stem);
  const title = (meta.title ?? fromName.title ?? stem).trim();
  const slug = slugify(title) || slugify(stem) || `beat-${Date.now().toString(36)}`;

  const preview = files.find((f) => f.role === "preview");
  const master = files.find((f) => f.role === "master");
  if (!preview && master) warnings.push("No tagged preview — the master will be used for the store player.");
  if (!preview && !master) warnings.push("No audio file found; this beat cannot be published.");
  if (!files.some((f) => f.role === "artwork")) warnings.push("No artwork — a generated cover will be used.");
  if (!files.some((f) => f.role === "trackout")) warnings.push("No stems ZIP — Trackout/Exclusive licences will deliver WAV only.");
  if (meta.bpm && (meta.bpm < 40 || meta.bpm > 260)) warnings.push(`BPM ${meta.bpm} looks wrong.`);

  const audioForDuration = master ?? preview;
  const durationSec =
    meta.duration_sec ?? (audioForDuration ? probeDuration(audioForDuration.abs) : null);

  return {
    key: slug,
    stem,
    slug,
    meta: {
      ...meta,
      title,
      genre: meta.genre ?? fromName.genre ?? "Afrobeats",
      bpm: meta.bpm ?? fromName.bpm,
      key: meta.key ?? fromName.key,
    },
    metaSource,
    files,
    durationSec,
    warnings,
  };
}

/**
 * Group key for a flat file name: role words, BPM and key annotations are
 * stripped so `X - preview.wav`, `X - master.wav` and `X - artwork.jpg` land in
 * one group.
 */
export function groupKey(stem: string): string {
  let out = stem;
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(ROLE_STRIP, " ");
  }
  out = out
    .replace(/\(?\[?\d{2,3}\s*bpm\)?\]?/gi, " ")
    .replace(/\(?\[?\b[A-G][#b]?\s*(maj(?:or)?|min(?:or)?|m)\b\)?\]?/gi, " ")
    .replace(/\(?\[?\d{2,3}\]?\)?/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–—]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
  return out || stem.trim();
}

/** Scan the import folder and return everything that can be published. */
export function scanImportFolder(): ImportPlan {
  const dir = importDir();
  const empty: ImportPlan = { dir, exists: false, beats: [], videos: [], manifestName: null };
  if (!fs.existsSync(dir)) return empty;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const beats: ImportCandidate[] = [];
  const videos: ImportCandidate[] = [];

  // manifest.json → explicit list of beats (highest priority per beat)
  const manifestAbs = path.join(dir, "manifest.json");
  const manifest = fs.existsSync(manifestAbs) ? readJson(manifestAbs) : null;
  const manifestBeats = Array.isArray((manifest as { beats?: unknown[] } | null)?.beats)
    ? ((manifest as { beats: Record<string, unknown>[] }).beats)
    : Array.isArray(manifest)
      ? (manifest as Record<string, unknown>[])
      : [];

  for (const entry of manifestBeats) {
    const meta = normaliseMeta(entry);
    const fileMap = (entry.files ?? entry) as Record<string, unknown>;
    const files: ImportFile[] = [];
    for (const role of ["preview", "master", "trackout", "artwork", "video"] as const) {
      const rel = typeof fileMap[role] === "string" ? (fileMap[role] as string) : null;
      if (!rel) continue;
      const abs = path.isAbsolute(rel) ? rel : path.join(dir, rel);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) files.push(fileEntry(abs, role));
    }
    const stem = meta.title ?? path.basename(String(fileMap.master ?? fileMap.preview ?? meta.title ?? "beat"));
    const cand = candidate(String(stem).replace(/\.\w{2,4}$/, ""), files, meta, "manifest.json");
    if (cand.files.some((f) => f.role === "video")) videos.push(cand);
    else beats.push(cand);
  }

  const manifestStems = new Set(beats.concat(videos).map((b) => b.slug));
  /** Absolute paths already claimed by the manifest — never imported twice. */
  const claimed = new Set<string>(
    beats.concat(videos).flatMap((b) => b.files.map((f) => path.resolve(f.abs))),
  );

  // one folder per beat
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const folder = path.join(dir, entry.name);
    const inner = fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((f) => f.isFile() && !claimed.has(path.resolve(path.join(folder, f.name))));
    if (inner.length === 0) continue;
    const beatJson = inner.find((f) => f.name.toLowerCase() === "beat.json");
    const meta = normaliseMeta(beatJson ? readJson(path.join(folder, beatJson.name)) : null);
    const files = inner
      .filter((f) => !f.name.toLowerCase().endsWith(".json"))
      .map((f) => fileEntry(path.join(folder, f.name), roleFor(f.name)));
    if (!files.length) continue;
    const cand = candidate(entry.name, files, meta, beatJson ? "beat.json" : "filename");
    if (manifestStems.has(cand.slug)) continue;
    if (cand.files.some((f) => f.role === "video") && !cand.files.some((f) => f.role === "master" || f.role === "preview")) {
      videos.push(cand);
    } else {
      beats.push(cand);
    }
  }

  // flat files, grouped by a normalised stem (metadata still parsed from the real name)
  const flat = new Map<string, { original: string; paths: string[]; audio: boolean }>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.toLowerCase().endsWith(".json")) continue;
    const abs = path.join(dir, entry.name);
    if (claimed.has(abs)) continue;
    const ext = path.extname(entry.name);
    const original = path.basename(entry.name, ext);
    const key = groupKey(original);
    const group = flat.get(key) ?? { original, paths: [], audio: AUDIO_EXT.test(ext) };
    // prefer a name that still carries the annotations (audio before artwork)
    if (AUDIO_EXT.test(ext) && !group.audio) {
      group.original = original;
      group.audio = true;
    }
    group.paths.push(abs);
    flat.set(key, group);
  }

  for (const [, group] of flat) {
    const files = group.paths.map((abs) => fileEntry(abs, roleFor(path.basename(abs))));
    // an image-only group is artwork for a beat of the same name (already handled)
    if (!files.some((f) => AUDIO_EXT.test(f.name) || VIDEO_EXT.test(f.name))) continue;
    const cand = candidate(group.original, files, {}, "filename");
    if (manifestStems.has(cand.slug)) continue;
    if (beats.some((b) => b.slug === cand.slug)) continue;
    if (cand.files.some((f) => f.role === "video") && !cand.files.some((f) => f.role === "master" || f.role === "preview")) {
      videos.push(cand);
    } else {
      beats.push(cand);
    }
  }

  const publishable = beats.filter((b) => b.files.some((f) => f.role === "preview" || f.role === "master"));
  const skipped = beats.filter((b) => !publishable.includes(b));

  return {
    dir,
    exists: true,
    beats: publishable.concat(skipped),
    videos,
    manifestName: manifest ? path.basename(manifestAbs) : null,
  };
}

/** Where an imported file should live inside the upload tree. */
export function importTargets(slug: string, role: ImportFile["role"]): { subdir: string; visibility: "public" | "private" } {
  switch (role) {
    case "preview":
      return { subdir: `beats/${slug}/preview`, visibility: "public" };
    case "master":
      return { subdir: `beats/${slug}/master`, visibility: "private" };
    case "trackout":
      return { subdir: `beats/${slug}/trackout`, visibility: "private" };
    case "artwork":
      return { subdir: "artwork", visibility: "public" };
    case "video":
      return { subdir: "videos", visibility: "public" };
    default:
      return { subdir: `beats/${slug}/extras`, visibility: "private" };
  }
}

export function uploadRoot(): string {
  return UPLOAD_ROOT;
}
