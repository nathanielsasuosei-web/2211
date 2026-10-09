import "server-only";
import { getDb } from "./db";
import { seedIfEmpty } from "./seed";

let ready: Promise<void> | null = null;

/**
 * Guarantees the database schema exists and demo content is seeded.
 * Runs once per server process (also invoked from instrumentation.ts at boot).
 */
export function ensureBootstrapped(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const started = Date.now();
      await getDb();
      const seeded = await seedIfEmpty();
      const ms = Date.now() - started;
      if (seeded) console.log(`[bootstrap] seeded demo catalogue in ${ms}ms`);
    })().catch((err) => {
      ready = null;
      console.error("[bootstrap] failed:", err);
      throw err;
    });
  }
  return ready;
}
