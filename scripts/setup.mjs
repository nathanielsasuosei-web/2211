#!/usr/bin/env node
/**
 * Setup / reset helper.
 *
 *   npm run setup      → create the storage tree and .env.local (if missing)
 *   npm run db:reset   → also wipe the database, uploads, deliveries and outbox
 *
 * The schema is created and the demo catalogue is seeded automatically the first
 * time the app boots (see instrumentation.ts → lib/bootstrap.ts), so this script
 * only has to prepare the filesystem.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reset = process.argv.includes("--reset");

const dirs = [
  "storage",
  "storage/uploads/public",
  "storage/uploads/private",
  "storage/deliveries",
  "storage/outbox",
];

for (const dir of dirs) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
  console.log(`  ✓ ${dir}/`);
}

const envFile = path.join(root, ".env.local");
if (!fs.existsSync(envFile)) {
  const example = path.join(root, ".env.example");
  if (fs.existsSync(example)) {
    fs.copyFileSync(example, envFile);
    console.log("  ✓ .env.local created from .env.example — edit it to add payment + SMTP keys");
  }
} else {
  console.log("  ✓ .env.local already exists");
}

if (reset) {
  console.log("\n  resetting demo data…");
  for (const target of ["storage/app.db", "storage/app.db-wal", "storage/app.db-shm"]) {
    const file = path.join(root, target);
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      console.log(`  ✗ removed ${target}`);
    }
  }
  for (const target of ["storage/uploads", "storage/deliveries", "storage/outbox"]) {
    const dir = path.join(root, target);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  ✗ cleared ${target}/`);
    }
  }
}

console.log(`
Done. Next:
  npm run dev      → http://localhost:3000 (schema + demo catalogue are created on first boot)

  Storefront   /            beat store, hero, watch page
  Artist       /signup      create an account, then buy a beat
  Studio       /studio      vault, orders, messages, profile
  Producer     /admin       upload beats & videos, orders, artists, messages, settings

  Seeded logins (change these in .env.local for production):
    admin@2211beats.com / Admin!2211
    artist@demo.com     / Artist!2211
`);
