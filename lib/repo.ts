import "server-only";
import crypto from "node:crypto";
import { all, get, run, nowIso, newId, asNumber } from "./db";
import { hashPassword } from "./auth";
import type {
  Beat,
  BeatFile,
  Delivery,
  EmailLogEntry,
  License,
  Message,
  Order,
  OrderStatus,
  User,
  Video,
} from "./types";

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  phone?: string | null;
  role?: "artist" | "admin";
  country?: string | null;
  city?: string | null;
  bio?: string | null;
}): Promise<User> {
  const id = newId("usr");
  const now = nowIso();
  await run(
    `INSERT INTO users (id,email,name,phone,password_hash,role,country,city,bio,email_opt_in,is_active,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,1,$10)`,
    [
      id,
      data.email.toLowerCase().trim(),
      data.name.trim(),
      data.phone ?? null,
      await hashPassword(data.password),
      data.role ?? "artist",
      data.country ?? null,
      data.city ?? null,
      data.bio ?? null,
      now,
    ],
  );
  return (await getUserById(id))!;
}

export const getUserById = (id: string) => get<User>("SELECT * FROM users WHERE id = $1", [id]);
export const getUserByEmail = (email: string) =>
  get<User>("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);

export async function updateUser(id: string, patch: Partial<User>) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (["id", "created_at"].includes(key)) continue;
    fields.push(`${key} = $${fields.length + 1}`);
    values.push(value as string | number | null);
  }
  if (!fields.length) return;
  values.push(id);
  await run(`UPDATE users SET ${fields.join(", ")} WHERE id = $${fields.length + 1}`, values);
}

export const listArtists = (limit = 100) =>
  all<User>(
    "SELECT * FROM users WHERE role = 'artist' ORDER BY created_at DESC LIMIT $1",
    [limit],
  );

export const listUsers = (limit = 200) =>
  all<User>("SELECT * FROM users ORDER BY created_at DESC LIMIT $1", [limit]);

export const countUsers = async () =>
  asNumber((await get<{ c: number }>("SELECT COUNT(*) AS c FROM users"))?.c);

/* ------------------------------------------------------------------ */
/* Beats                                                               */
/* ------------------------------------------------------------------ */

export interface BeatFilters {
  q?: string;
  genre?: string;
  mood?: string;
  key?: string;
  bpmMin?: number;
  bpmMax?: number;
  sort?: "new" | "popular" | "price_asc" | "price_desc" | "title";
  featuredOnly?: boolean;
  includeUnpublished?: boolean;
  limit?: number;
  offset?: number;
}

export async function listBeats(filters: BeatFilters = {}): Promise<Beat[]> {
  const where: string[] = [filters.includeUnpublished ? "1=1" : "published = 1"];
  const params: (string | number)[] = [];
  const push = (clause: string, value: string | number) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };

  if (filters.q) {
    const like = `%${filters.q.toLowerCase()}%`;
    params.push(like);
    const i = params.length;
    where.push(
      `(lower(title) LIKE $${i} OR lower(COALESCE(description,'')) LIKE $${i} OR lower(COALESCE(tags,'')) LIKE $${i} OR lower(genre) LIKE $${i})`,
    );
  }
  if (filters.genre && filters.genre !== "all") push("lower(genre) = lower(?)", filters.genre);
  if (filters.mood && filters.mood !== "all") push("lower(COALESCE(mood,'')) = lower(?)", filters.mood);
  if (filters.key && filters.key !== "all") push("upper(COALESCE(musical_key,'')) = upper(?)", filters.key);
  if (filters.bpmMin) push("COALESCE(bpm,0) >= ?", filters.bpmMin);
  if (filters.bpmMax) push("COALESCE(bpm,0) <= ?", filters.bpmMax);
  if (filters.featuredOnly) where.push("featured = 1");

  const orderBy: Record<string, string> = {
    new: "created_at DESC",
    popular: "plays DESC, downloads DESC",
    price_asc: "price_cents ASC",
    price_desc: "price_cents DESC",
    title: "title ASC",
  };
  const limit = filters.limit ?? 60;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  return all<Beat>(
    `SELECT * FROM beats WHERE ${where.join(" AND ")}
     ORDER BY ${orderBy[filters.sort ?? "new"] ?? orderBy.new}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export const getBeatBySlug = (slug: string) => get<Beat>("SELECT * FROM beats WHERE slug = $1", [slug]);
export const getBeatById = (id: string) => get<Beat>("SELECT * FROM beats WHERE id = $1", [id]);

export async function createBeat(data: Partial<Beat> & { title: string; genre: string }): Promise<Beat> {
  const id = newId("beat");
  const now = nowIso();
  const slug = (data.slug || slugify(data.title)) + "-" + id.slice(-4);
  await run(
    `INSERT INTO beats
      (id,slug,title,description,genre,mood,tags,bpm,musical_key,duration_sec,price_cents,currency,
       artwork,preview_file,full_file,trackout_file,is_free,exclusive_sold,published,featured,
       plays,downloads,likes,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,0,0,0,$21,$21)`,
    [
      id,
      slug,
      data.title,
      data.description ?? null,
      data.genre,
      data.mood ?? null,
      data.tags ?? null,
      data.bpm ?? null,
      data.musical_key ?? null,
      data.duration_sec ?? null,
      data.price_cents ?? 0,
      data.currency ?? process.env.CURRENCY ?? "GHS",
      data.artwork ?? null,
      data.preview_file ?? null,
      data.full_file ?? null,
      data.trackout_file ?? null,
      data.is_free ? 1 : 0,
      data.exclusive_sold ? 1 : 0,
      data.published === 0 ? 0 : 1,
      data.featured ? 1 : 0,
      now,
    ],
  );
  return (await getBeatById(id))!;
}

export async function updateBeat(id: string, patch: Partial<Beat>) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (["id", "created_at", "slug"].includes(key)) continue;
    fields.push(`${key} = $${fields.length + 1}`);
    values.push(value as string | number | null);
  }
  if (!fields.length) return;
  fields.push("updated_at = $1".replace("$1", `$${fields.length + 1}`));
  values.push(nowIso());
  values.push(id);
  await run(`UPDATE beats SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
}

export async function deleteBeat(id: string) {
  await run("DELETE FROM beat_files WHERE beat_id = $1", [id]);
  await run("DELETE FROM licenses WHERE beat_id = $1", [id]);
  await run("DELETE FROM beats WHERE id = $1", [id]);
}

export async function bumpBeatStat(id: string, column: "plays" | "downloads" | "likes", by = 1) {
  const safe = ["plays", "downloads", "likes"].includes(column) ? column : "plays";
  await run(`UPDATE beats SET ${safe} = COALESCE(${safe},0) + $1 WHERE id = $2`, [by, id]);
}

export async function ensureDefaultLicenses(beatId: string, basePrice: number, currency: string) {
  const existing = await all<{ c: number }>("SELECT COUNT(*) AS c FROM licenses WHERE beat_id = $1", [beatId]);
  if (asNumber(existing[0]?.c) > 0) return;
  const now = nowIso();
  const tiers = [
    {
      name: "MP3 Lease",
      tier: 1,
      mult: 1,
      description: "Tagged-free high-quality MP3 for streaming and demos.",
      perks: ["MP3 (320kbps)", "Up to 50,000 streams", "Music video use", "Non-exclusive"],
      exclusive: 0,
      included: JSON.stringify(["mp3"]),
    },
    {
      name: "WAV Lease",
      tier: 2,
      mult: 1.8,
      description: "Unlimited-quality WAV plus higher streaming caps.",
      perks: ["WAV + MP3", "Up to 250,000 streams", "Radio play", "Non-exclusive"],
      exclusive: 0,
      included: JSON.stringify(["wav", "mp3"]),
    },
    {
      name: "Trackout Lease",
      tier: 3,
      mult: 3,
      description: "Every stem for a proper mix, plus WAV and MP3.",
      perks: ["All stems (ZIP)", "WAV + MP3", "Up to 1,000,000 streams", "Mix & master friendly"],
      exclusive: 0,
      included: JSON.stringify(["stems", "wav", "mp3"]),
    },
    {
      name: "Exclusive Rights",
      tier: 4,
      mult: 8,
      description: "Full ownership transfer. Beat is removed from the store after purchase.",
      perks: ["Exclusive rights", "All stems + WAV + MP3", "Unlimited distribution", "Beat taken down"],
      exclusive: 1,
      included: JSON.stringify(["stems", "wav", "mp3"]),
    },
  ];
  for (const t of tiers) {
    await run(
      `INSERT INTO licenses (id,beat_id,name,tier,price_cents,currency,description,perks,allows_exclusive,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        newId("lic"),
        beatId,
        t.name,
        t.tier,
        Math.max(0, Math.round((basePrice * t.mult) / 100) * 100),
        currency,
        t.description,
        JSON.stringify(t.perks),
        t.exclusive,
        now,
      ],
    );
  }
}

export const listLicenses = (beatId: string) =>
  all<License>("SELECT * FROM licenses WHERE beat_id = $1 ORDER BY tier ASC", [beatId]);
export const getLicense = (id: string) => get<License>("SELECT * FROM licenses WHERE id = $1", [id]);

export async function createLicense(beatId: string, data: Partial<License> & { name: string; price_cents: number }) {
  const id = newId("lic");
  await run(
    `INSERT INTO licenses (id,beat_id,name,tier,price_cents,currency,description,perks,allows_exclusive,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      beatId,
      data.name,
      data.tier ?? 1,
      data.price_cents,
      data.currency ?? "GHS",
      data.description ?? null,
      data.perks ?? null,
      data.allows_exclusive ? 1 : 0,
      nowIso(),
    ],
  );
  return id;
}

export const listBeatFiles = (beatId: string) =>
  all<BeatFile>("SELECT * FROM beat_files WHERE beat_id = $1 ORDER BY created_at ASC", [beatId]);

export async function addBeatFile(beatId: string, data: Partial<BeatFile> & { label: string; file_path: string }) {
  const id = newId("bfile");
  await run(
    `INSERT INTO beat_files (id,beat_id,label,file_path,mime,bytes,included_in,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      beatId,
      data.label,
      data.file_path,
      data.mime ?? null,
      data.bytes ?? null,
      data.included_in ?? null,
      nowIso(),
    ],
  );
  return id;
}

export async function deleteBeatFile(id: string) {
  await run("DELETE FROM beat_files WHERE id = $1", [id]);
}

export async function listGenres(): Promise<string[]> {
  const rows = await all<{ genre: string; c: number }>(
    "SELECT genre, COUNT(*) AS c FROM beats WHERE published = 1 GROUP BY genre ORDER BY c DESC, genre ASC",
  );
  return rows.map((r) => r.genre);
}

/* ------------------------------------------------------------------ */
/* Videos                                                              */
/* ------------------------------------------------------------------ */

export const listVideos = (limit = 50, includeUnpublished = false) =>
  all<Video>(
    `SELECT * FROM videos ${includeUnpublished ? "" : "WHERE published = 1"} ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );

export const getVideoBySlug = (slug: string) => get<Video>("SELECT * FROM videos WHERE slug = $1", [slug]);
export const getVideoById = (id: string) => get<Video>("SELECT * FROM videos WHERE id = $1", [id]);

export async function createVideo(data: Partial<Video> & { title: string }) {
  const id = newId("vid");
  const slug = (data.slug || slugify(data.title)) + "-" + id.slice(-4);
  await run(
    `INSERT INTO videos (id,slug,title,description,kind,url,file_path,poster,duration_sec,beat_id,published,views,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12)`,
    [
      id,
      slug,
      data.title,
      data.description ?? null,
      data.kind ?? "file",
      data.url ?? null,
      data.file_path ?? null,
      data.poster ?? null,
      data.duration_sec ?? null,
      data.beat_id ?? null,
      data.published === 0 ? 0 : 1,
      nowIso(),
    ],
  );
  return id;
}

export async function updateVideo(id: string, patch: Partial<Video>) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (["id", "created_at", "slug"].includes(key)) continue;
    fields.push(`${key} = $${fields.length + 1}`);
    values.push(value as string | number | null);
  }
  if (!fields.length) return;
  values.push(id);
  await run(`UPDATE videos SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
}

export async function deleteVideo(id: string) {
  await run("DELETE FROM videos WHERE id = $1", [id]);
}

export async function bumpVideoViews(id: string) {
  await run("UPDATE videos SET views = COALESCE(views,0) + 1 WHERE id = $1", [id]);
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export function makeReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `2211-${stamp}-${rand}`;
}

export async function createOrder(data: {
  user_id: string;
  beat_id: string;
  license_id?: string | null;
  amount_cents: number;
  currency: string;
  method: Order["method"];
  phone?: string | null;
  status?: OrderStatus;
  provider?: string | null;
  provider_ref?: string | null;
  expires_in_minutes?: number;
}): Promise<Order> {
  const id = newId("ord");
  const now = nowIso();
  const expires = data.expires_in_minutes
    ? new Date(Date.now() + data.expires_in_minutes * 60_000).toISOString()
    : null;
  await run(
    `INSERT INTO orders
      (id,reference,user_id,beat_id,license_id,amount_cents,currency,method,status,provider,provider_ref,
       phone,expires_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
    [
      id,
      makeReference(),
      data.user_id,
      data.beat_id,
      data.license_id ?? null,
      data.amount_cents,
      data.currency,
      data.method,
      data.status ?? "pending",
      data.provider ?? null,
      data.provider_ref ?? null,
      data.phone ?? null,
      expires,
      now,
    ],
  );
  return (await getOrderById(id))!;
}

export const getOrderById = (id: string) => get<Order>("SELECT * FROM orders WHERE id = $1", [id]);
export const getOrderByRef = (reference: string) =>
  get<Order>("SELECT * FROM orders WHERE reference = $1", [reference]);

export async function updateOrder(id: string, patch: Partial<Order>) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (["id", "created_at", "reference"].includes(key)) continue;
    fields.push(`${key} = $${fields.length + 1}`);
    values.push(value as string | number | null);
  }
  if (!fields.length) return;
  fields.push(`updated_at = $${fields.length + 1}`);
  values.push(nowIso());
  values.push(id);
  await run(`UPDATE orders SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
}

export async function listOrders(opts: { userId?: string; status?: string; limit?: number } = {}) {
  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];
  if (opts.userId) {
    params.push(opts.userId);
    where.push(`user_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }
  params.push(opts.limit ?? 100);
  return all<Order>(
    `SELECT * FROM orders WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
}

/* ------------------------------------------------------------------ */
/* Deliveries                                                          */
/* ------------------------------------------------------------------ */

export async function createDelivery(data: {
  order_id: string;
  user_id: string;
  files: { label: string; path: string; kind?: string }[];
  license_name?: string | null;
}): Promise<Delivery> {
  const existing = await get<Delivery>("SELECT * FROM deliveries WHERE order_id = $1", [data.order_id]);
  if (existing) return existing;
  const id = newId("dlv");
  const token = crypto.randomBytes(24).toString("base64url");
  await run(
    `INSERT INTO deliveries (id,order_id,user_id,token,files,license_name,download_count,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,0,$7)`,
    [id, data.order_id, data.user_id, token, JSON.stringify(data.files), data.license_name ?? null, nowIso()],
  );
  return (await get<Delivery>("SELECT * FROM deliveries WHERE id = $1", [id]))!;
}

export const getDeliveryByToken = (token: string) =>
  get<Delivery>("SELECT * FROM deliveries WHERE token = $1", [token]);
export const getDeliveryByOrder = (orderId: string) =>
  get<Delivery>("SELECT * FROM deliveries WHERE order_id = $1", [orderId]);

export const listDeliveries = (userId: string) =>
  all<Delivery>("SELECT * FROM deliveries WHERE user_id = $1 ORDER BY created_at DESC", [userId]);

export type Purchase = {
  delivery_id: string;
  token: string;
  files: string;
  download_count: number;
  last_download_at: string | null;
  delivered_at: string;
  reference: string;
  amount_cents: number;
  currency: string;
  method: string;
  order_status: string;
  ordered_at: string;
  beat_id: string;
  beat_title: string;
  beat_slug: string;
  beat_genre: string;
  beat_artwork: string | null;
  beat_bpm: number | null;
  beat_key: string | null;
  license_name: string | null;
  license_tier: number | null;
};

/** Everything an artist has bought — beats, licences and their delivery tokens. */
export async function listPurchases(userId: string): Promise<Purchase[]> {
  return all<Purchase>(
    `SELECT d.id AS delivery_id, d.token, d.files, d.download_count, d.last_download_at,
            d.created_at AS delivered_at, o.reference, o.amount_cents, o.currency, o.method,
            o.status AS order_status, o.created_at AS ordered_at,
            b.id AS beat_id, b.title AS beat_title, b.slug AS beat_slug, b.genre AS beat_genre,
            b.artwork AS beat_artwork, b.bpm AS beat_bpm, b.musical_key AS beat_key,
            l.name AS license_name, l.tier AS license_tier
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN beats b ON b.id = o.beat_id
       LEFT JOIN licenses l ON l.id = o.license_id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC`,
    [userId],
  );
}

export async function registerDownload(token: string) {
  await run(
    "UPDATE deliveries SET download_count = download_count + 1, last_download_at = $2 WHERE token = $1",
    [token, nowIso()],
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export async function createMessage(data: {
  direction?: "inbound" | "outbound";
  kind?: Message["kind"];
  from_user_id?: string | null;
  to_user_id?: string | null;
  from_name?: string | null;
  from_email?: string | null;
  subject: string;
  body: string;
  order_id?: string | null;
  beat_id?: string | null;
  thread_id?: string | null;
}): Promise<string> {
  const id = newId("msg");
  await run(
    `INSERT INTO messages
      (id,thread_id,direction,kind,from_user_id,to_user_id,from_name,from_email,subject,body,is_read,order_id,beat_id,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13)`,
    [
      id,
      data.thread_id ?? null,
      data.direction ?? "inbound",
      data.kind ?? "message" as Message["kind"],
      data.from_user_id ?? null,
      data.to_user_id ?? null,
      data.from_name ?? null,
      data.from_email ?? null,
      data.subject,
      data.body,
      data.order_id ?? null,
      data.beat_id ?? null,
      nowIso(),
    ],
  );
  return id;
}

export const listMessages = (opts: { userId?: string; limit?: number } = {}) => {
  if (opts.userId) {
    return all<Message>(
      "SELECT * FROM messages WHERE to_user_id = $1 OR from_user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [opts.userId, opts.limit ?? 50],
    );
  }
  return all<Message>("SELECT * FROM messages ORDER BY created_at DESC LIMIT $1", [opts.limit ?? 100]);
};

export const getMessage = (id: string) => get<Message>("SELECT * FROM messages WHERE id = $1", [id]);

export async function markMessageRead(id: string) {
  await run("UPDATE messages SET is_read = 1 WHERE id = $1", [id]);
}

export const unreadMessageCount = async (userId?: string) => {
  const row = userId
    ? await get<{ c: number }>(
        "SELECT COUNT(*) AS c FROM messages WHERE to_user_id = $1 AND is_read = 0",
        [userId],
      )
    : await get<{ c: number }>("SELECT COUNT(*) AS c FROM messages WHERE is_read = 0");
  return asNumber(row?.c);
};

/* ------------------------------------------------------------------ */
/* Email log                                                           */
/* ------------------------------------------------------------------ */

export const listEmails = (limit = 60) =>
  all<EmailLogEntry>("SELECT * FROM email_log ORDER BY created_at DESC LIMIT $1", [limit]);

/* ------------------------------------------------------------------ */
/* Site settings                                                       */
/* ------------------------------------------------------------------ */

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await get<{ value: string | null }>("SELECT value FROM site_settings WHERE key = $1", [key]);
  return row?.value ?? fallback;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string | null }>("SELECT key, value FROM site_settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

export async function setSetting(key: string, value: string) {
  await run(
    `INSERT INTO site_settings (key,value,updated_at) VALUES ($1,$2,$3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, value, nowIso()],
  );
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export async function dashboardStats() {
  const [beats, artists, orders, revenue, pending, videos, emails] = await Promise.all([
    get<{ c: number }>("SELECT COUNT(*) AS c FROM beats"),
    get<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE role = 'artist'"),
    get<{ c: number }>("SELECT COUNT(*) AS c FROM orders"),
    get<{ c: number }>("SELECT COALESCE(SUM(amount_cents),0) AS c FROM orders WHERE status IN ('paid','delivered')"),
    get<{ c: number }>("SELECT COUNT(*) AS c FROM orders WHERE status IN ('pending','awaiting_payment','in_review')"),
    get<{ c: number }>("SELECT COUNT(*) AS c FROM videos"),
    get<{ c: number }>("SELECT COUNT(*) AS c FROM email_log"),
  ]);
  return {
    beats: asNumber(beats?.c),
    artists: asNumber(artists?.c),
    orders: asNumber(orders?.c),
    revenueCents: asNumber(revenue?.c),
    pendingOrders: asNumber(pending?.c),
    videos: asNumber(videos?.c),
    emails: asNumber(emails?.c),
  };
}

export async function recentOrders(limit = 8) {
  const orders = await all<Order>("SELECT * FROM orders ORDER BY created_at DESC LIMIT $1", [limit]);
  return decorateOrders(orders);
}

export async function decorateOrders(orders: Order[]) {
  const ids = [...new Set(orders.map((o) => o.beat_id))];
  const beats = ids.length
    ? await all<Beat>(`SELECT id,title,slug,artwork FROM beats WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(",")})`, ids)
    : [];
  const beatMap = new Map(beats.map((b) => [b.id, b]));
  const userIds = [...new Set(orders.map((o) => o.user_id))];
  const users = userIds.length
    ? await all<User>(
        `SELECT id,name,email FROM users WHERE id IN (${userIds.map((_, i) => `$${i + 1}`).join(",")})`,
        userIds,
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return orders.map((o) => ({
    ...o,
    beat: beatMap.get(o.beat_id) ?? null,
    buyer: userMap.get(o.user_id) ?? null,
  }));
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

export async function recordPlay(beatId: string, userId?: string | null) {
  await bumpBeatStat(beatId, "plays");
  await run(
    `INSERT INTO play_events (id,beat_id,user_id,ip_hash,created_at) VALUES ($1,$2,$3,$4,$5)`,
    [newId("play"), beatId, userId ?? null, null, nowIso()],
  );
}
