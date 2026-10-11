/**
 * Tiny portable SQL layer.
 *
 * - Production: PostgreSQL (set DATABASE_URL) via the `pg` driver.
 * - Local/dev : SQLite file at storage/app.db via Node's built-in `node:sqlite`
 *               (zero native dependencies, zero setup).
 *
 * All SQL is written with `$1, $2 ...` placeholders; the SQLite driver rewrites
 * them to `?`. Values are normalised so the same code works on both engines.
 */
import fs from "node:fs";
import path from "node:path";
import { env } from "./config";

export type Row = Record<string, unknown>;
export type Param = string | number | boolean | null | Date | undefined;

export interface RunResult {
  changes: number;
  insertId?: string | number;
}

export interface Database {
  dialect: "sqlite" | "postgres";
  all<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: Param[]): Promise<T | null>;
  run(sql: string, params?: Param[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'artist',
  country TEXT,
  city TEXT,
  bio TEXT,
  avatar TEXT,
  email_opt_in INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS beats (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT NOT NULL,
  mood TEXT,
  tags TEXT,
  bpm INTEGER,
  musical_key TEXT,
  duration_sec INTEGER,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GHS',
  artwork TEXT,
  preview_file TEXT,
  full_file TEXT,
  trackout_file TEXT,
  is_free INTEGER NOT NULL DEFAULT 0,
  exclusive_sold INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_beats_genre ON beats(genre);
CREATE INDEX IF NOT EXISTS idx_beats_created ON beats(created_at);

CREATE TABLE IF NOT EXISTS beat_files (
  id TEXT PRIMARY KEY,
  beat_id TEXT NOT NULL,
  label TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime TEXT,
  bytes INTEGER,
  included_in TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_beat_files_beat ON beat_files(beat_id);

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  beat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  description TEXT,
  perks TEXT,
  allows_exclusive INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_beat ON licenses(beat_id);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'file',
  url TEXT,
  file_path TEXT,
  poster TEXT,
  duration_sec INTEGER,
  beat_id TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  beat_id TEXT NOT NULL,
  license_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_ref TEXT,
  provider_payload TEXT,
  phone TEXT,
  bank_reference TEXT,
  bank_note TEXT,
  failure_reason TEXT,
  delivered_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  files TEXT NOT NULL,
  license_name TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_download_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliveries_user ON deliveries(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  kind TEXT NOT NULL DEFAULT 'message',
  from_user_id TEXT,
  to_user_id TEXT,
  from_name TEXT,
  from_email TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  order_id TEXT,
  beat_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  transport TEXT NOT NULL,
  error TEXT,
  attachments TEXT,
  body_preview TEXT,
  user_id TEXT,
  order_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_created ON email_log(created_at);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS play_events (
  id TEXT PRIMARY KEY,
  beat_id TEXT NOT NULL,
  user_id TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_play_events_beat ON play_events(beat_id);
`;

/* ------------------------------------------------------------------ */
/* Normalisation helpers                                               */
/* ------------------------------------------------------------------ */

function normalise(param: Param): string | number | null {
  if (param === undefined || param === null) return null;
  if (typeof param === "boolean") return param ? 1 : 0;
  if (param instanceof Date) return param.toISOString();
  return param as string | number;
}

/**
 * SQLite binds positionally, so every `$n` occurrence must push its own value in
 * order of appearance (statements like `... VALUES ($2) ON CONFLICT DO UPDATE SET
 * value = $2` reuse placeholders).
 */
function toSqlite(sql: string, params: Param[]): { sql: string; params: (string | number | null)[] } {
  if (!sql.includes("$")) return { sql, params: params.map(normalise) };
  const bound: (string | number | null)[] = [];
  const rewritten = sql.replace(/\$(\d+)/g, (_match, idx: string) => {
    bound.push(normalise(params[Number(idx) - 1]));
    return "?";
  });
  return { sql: rewritten, params: bound };
}

/* ------------------------------------------------------------------ */
/* SQLite driver                                                       */
/* ------------------------------------------------------------------ */

function createSqliteDriver(file: string): Database {
  let DatabaseSync: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    DatabaseSync = (require("node:sqlite") as any).DatabaseSync;
    if (!DatabaseSync) throw new Error("DatabaseSync not found");
  } catch (err: any) {
    console.error(
      `[db] node:sqlite not available (Node <22.5 or runtime restriction). Using memory fallback. Original error: ${err?.message || err}`,
    );
    // Return memory fallback so the app doesn't crash with 500
    // Data will be empty but pages will render
    return createMemoryDriver();
  }

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } catch (err: any) {
    console.error(`[db] mkdir failed for ${file}: ${err?.message}`);
    // If mkdir fails (read-only FS), try /tmp
    if (file !== "/tmp/storage/app.db" && process.env.VERCEL) {
      const fallback = "/tmp/storage/app.db";
      console.warn(`[db] trying fallback path ${fallback}`);
      fs.mkdirSync(path.dirname(fallback), { recursive: true });
      return createSqliteDriver(fallback);
    }
    throw err;
  }

  let db: any;
  try {
    db = new DatabaseSync(file);
  } catch (err: any) {
    console.error(`[db] failed to open ${file}: ${err?.message}`);
    if (file !== "/tmp/storage/app.db" && process.env.VERCEL) {
      const fallback = "/tmp/storage/app.db";
      console.warn(`[db] trying fallback path ${fallback}`);
      fs.mkdirSync(path.dirname(fallback), { recursive: true });
      db = new DatabaseSync(fallback);
    } else {
      throw err;
    }
  }

  try {
    db.exec("PRAGMA journal_mode = WAL;");
  } catch {
    // WAL may fail on some FS, ignore
  }
  try {
    db.exec("PRAGMA foreign_keys = ON;");
  } catch {}

  type Statement = ReturnType<InstanceType<typeof DatabaseSync>["prepare"]>;
  const cache = new Map<string, Statement>();
  const prepare = (sql: string) => {
    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  };

  return {
    dialect: "sqlite",
    async all<T = Row>(sql: string, params: Param[] = []) {
      const bound = toSqlite(sql, params);
      // node:sqlite returns null-prototype rows; Next.js refuses to pass those
      // (or anything built from them) from a Server to a Client Component.
      return (prepare(bound.sql).all(...bound.params) as Row[]).map((row) => ({ ...row })) as T[];
    },
    async get<T = Row>(sql: string, params: Param[] = []) {
      const bound = toSqlite(sql, params);
      const row = prepare(bound.sql).get(...bound.params) as Row | undefined;
      return row ? ({ ...row } as T) : null;
    },
    async run(sql: string, params: Param[] = []) {
      const bound = toSqlite(sql, params);
      const res = prepare(bound.sql).run(...bound.params);
      return { changes: Number(res.changes), insertId: Number(res.lastInsertRowid) };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  };
}


/* ------------------------------------------------------------------ */
/* In-memory fallback driver (when node:sqlite unavailable)            */
/* ------------------------------------------------------------------ */

function createMemoryDriver(): Database {
  console.warn("[db] Using in-memory fallback driver - data will be empty and not persisted. Set DATABASE_URL to Postgres for production, or use Node 22.5+ for SQLite.");
  const store = new Map<string, any[]>();
  return {
    dialect: "sqlite",
    async all<T = Row>(sql: string, params: Param[] = []): Promise<T[]> {
      // Very naive: return empty for most queries, but handle site_settings and basic counts
      if (/FROM\s+site_settings/i.test(sql)) {
        return [] as T[];
      }
      if (/COUNT\(\*\)/i.test(sql)) {
        return [{ c: 0 } as unknown as T];
      }
      return [] as T[];
    },
    async get<T = Row>(sql: string, params: Param[] = []): Promise<T | null> {
      if (/COUNT\(\*\)/i.test(sql)) {
        return { c: 0 } as unknown as T;
      }
      return null;
    },
    async run(sql: string, params: Param[] = []): Promise<RunResult> {
      return { changes: 0 };
    },
    async exec(sql: string): Promise<void> {
      // no-op
    },
  };
}

/* ------------------------------------------------------------------ */
/* Postgres driver                                                     */
/* ------------------------------------------------------------------ */

async function createPostgresDriver(url: string): Promise<Database> {
  const pg = await import("pg");
  const pool = new pg.default.Pool({
    connectionString: url,
    max: Number(process.env.PGPOOL_MAX ?? 10),
    ssl: /sslmode=require/.test(url) || url.includes("postgresql+ssl") ? { rejectUnauthorized: false } : undefined,
  });

  const clean = (params: Param[]) => params.map((p) => (p instanceof Date ? p.toISOString() : normalise(p)));

  return {
    dialect: "postgres",
    async all<T = Row>(sql: string, params: Param[] = []) {
      const res = await pool.query(sql, clean(params));
      return res.rows as T[];
    },
    async get<T = Row>(sql: string, params: Param[] = []) {
      const res = await pool.query(sql, clean(params));
      return (res.rows[0] as T) ?? null;
    },
    async run(sql: string, params: Param[] = []) {
      const res = await pool.query(sql, clean(params));
      return { changes: res.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Singleton                                                           */
/* ------------------------------------------------------------------ */

const globalForDb = globalThis as unknown as { __db?: Database; __dbReady?: Promise<Database> };

export function dbFile(): string {
  if (process.env.SQLITE_FILE) return process.env.SQLITE_FILE;
  // On Vercel the only writable directory is /tmp
  if (process.env.VERCEL) return "/tmp/storage/app.db";
  return path.join(process.cwd(), "storage", "app.db");
}

async function makeDb(): Promise<Database> {
  if (env.databaseUrl.startsWith("postgres")) {
    try {
      return await createPostgresDriver(env.databaseUrl);
    } catch (err: any) {
      console.error(`[db] Postgres connection failed: ${err?.message}. Falling back to SQLite if possible.`);
      try {
        return createSqliteDriver(process.env.VERCEL ? "/tmp/storage/app.db" : dbFile());
      } catch (e) {
        console.error(`[db] SQLite fallback also failed: ${(e as any)?.message}. Using memory fallback.`);
        return createMemoryDriver();
      }
    }
  }
  try {
    return createSqliteDriver(dbFile());
  } catch (err: any) {
    console.error(`[db] SQLite driver failed: ${err?.message}. Using memory fallback.`);
    return createMemoryDriver();
  }
}

export async function getDb(): Promise<Database> {
  if (globalForDb.__db) return globalForDb.__db;
  if (!globalForDb.__dbReady) {
    globalForDb.__dbReady = makeDb()
      .then(async (db) => {
        try {
          for (const statement of SCHEMA.split(/;\s*\n/)) {
            const sql = statement.trim();
            if (sql) await db.exec(sql);
          }
        } catch (err) {
          console.error("[db] schema creation failed (non-fatal):", err);
        }
        globalForDb.__db = db;
        return db;
      })
      .catch((err) => {
        console.error("[db] getDb failed, using memory fallback:", err);
        const mem = createMemoryDriver();
        globalForDb.__db = mem;
        return mem;
      });
  }
  return globalForDb.__dbReady;
}

/** Convenience: run a query without holding a reference to the driver. */
export async function all<T = Row>(sql: string, params: Param[] = []): Promise<T[]> {
  return (await getDb()).all<T>(sql, params);
}
export async function get<T = Row>(sql: string, params: Param[] = []): Promise<T | null> {
  return (await getDb()).get<T>(sql, params);
}
export async function run(sql: string, params: Param[] = []): Promise<RunResult> {
  return (await getDb()).run(sql, params);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = ""): string {
  const raw = require("node:crypto").randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${raw.slice(0, 20)}` : raw;
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}
