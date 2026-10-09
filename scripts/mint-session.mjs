/**
 * Dev helper: mint a session cookie for an existing user so you can inspect
 * authenticated pages from the command line.
 *   node scripts/mint-session.mjs admin@2211beats.com
 */
import { SignJWT } from "jose";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const envFile = path.join(root, ".env.local");
let secret = process.env.APP_SECRET ?? "change-me-in-production";
if (fs.existsSync(envFile)) {
  const m = fs.readFileSync(envFile, "utf8").match(/^APP_SECRET=(.*)$/m);
  if (m) secret = m[1].trim();
}

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/mint-session.mjs <email>");
  process.exit(1);
}

const db = new DatabaseSync(path.join(root, "storage", "app.db"));
const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
if (!user) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}

const token = await new SignJWT({ role: user.role, email: user.email, name: user.name })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(user.id)
  .setIssuedAt()
  .setExpirationTime("30d")
  .sign(new TextEncoder().encode(secret));

console.log(token);
