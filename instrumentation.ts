/**
 * Runs once when the Next.js server boots: creates the schema and seeds the
 * demo catalogue so the very first request is fast and never empty.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureBootstrapped } = await import("@/lib/bootstrap");
    await ensureBootstrapped().catch((err) => console.error("[instrumentation] bootstrap failed:", err));
  }
}
