import "server-only";
import { getDb } from "./db";
import { seedIfEmpty } from "./seed";

let ready: Promise<void> | null = null;

/**
 * Guarantees the database schema exists and demo content is seeded.
 * Runs once per server process (also invoked from instrumentation.ts at boot).
 * 
 * On Vercel / serverless, seeding may fail due to ephemeral storage or DB
 * connectivity. We log but don't throw so the app can still render.
 */
export function ensureBootstrapped(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const started = Date.now();
      try {
        await getDb();
        const seeded = await seedIfEmpty();
        const ms = Date.now() - started;
        if (seeded) console.log(`[bootstrap] seeded demo catalogue in ${ms}ms`);
      } catch (err) {
        console.error("[bootstrap] failed (non-fatal, app will continue):", err);
        // Don't re-throw - allow app to render with empty state
        // The error will be visible in logs but won't crash the page
      }
    })();
  }
  return ready;
}
