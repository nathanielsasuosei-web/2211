import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./config";

export const STORAGE_ROOT = path.join(process.cwd(), "storage");
export const UPLOAD_ROOT = path.isAbsolute(env.uploadDir)
  ? env.uploadDir
  : path.join(process.cwd(), env.uploadDir);
/** Publicly streamable media (previews, artwork, posters, videos). */
export const PUBLIC_UPLOAD_ROOT = path.join(UPLOAD_ROOT, "public");
/** Paid deliverables — reachable only through a signed delivery token. */
export const PRIVATE_UPLOAD_ROOT = path.join(UPLOAD_ROOT, "private");
export const OUTBOX_ROOT = path.join(STORAGE_ROOT, "outbox");
export const DELIVERY_ROOT = path.join(STORAGE_ROOT, "deliveries");

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function safeName(name: string): string {
  const base = (name || "file").replace(/\\/g, "/").split("/").pop() ?? "file";
  const ext = path.extname(base).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const stem = path
    .basename(base, path.extname(base))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${stem || "file"}${ext}`;
}

export function relPath(abs: string): string {
  return path.relative(process.cwd(), abs).split(path.sep).join("/");
}

export function absPath(rel: string): string {
  const clean = rel.replace(/^\/+/, "");
  const abs = path.isAbsolute(clean) ? clean : path.join(process.cwd(), clean);
  return abs;
}

/** True when `abs` lives inside `root` (blocks ../ traversal). */
export function isInside(root: string, abs: string): boolean {
  const rel = path.relative(root, abs);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export async function saveUpload(
  file: File,
  subdir: string,
  opts: { prefix?: string; root?: string; visibility?: "public" | "private" } = {},
): Promise<{ rel: string; abs: string; bytes: number; mime: string; name: string }> {
  const root = opts.root ?? (opts.visibility === "private" ? PRIVATE_UPLOAD_ROOT : PUBLIC_UPLOAD_ROOT);
  const dir = path.join(root, subdir.replace(/^\/+/, ""));
  ensureDir(dir);
  const stamp = crypto.randomBytes(4).toString("hex");
  const name = `${opts.prefix ? `${opts.prefix}-` : ""}${stamp}-${safeName(file.name)}`;
  const abs = path.join(dir, name);
  const buf = Buffer.from(await file.arrayBuffer());
  await fsp.writeFile(abs, buf);
  return { rel: relPath(abs), abs, bytes: buf.byteLength, mime: file.type || guessMime(name), name };
}

export async function writeBuffer(rel: string, data: Buffer | string): Promise<string> {
  const abs = absPath(rel);
  ensureDir(path.dirname(abs));
  await fsp.writeFile(abs, data);
  return rel;
}

export function guessMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".json": "application/json",
    ".stems": "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

export async function statFile(abs: string) {
  try {
    const s = await fsp.stat(abs);
    return { size: s.size, isFile: s.isFile() };
  } catch {
    return null;
  }
}

export { humanBytes } from "./format";
