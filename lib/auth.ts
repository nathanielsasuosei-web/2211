import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./config";
import { get, run, nowIso } from "./db";
import type { SessionUser, User } from "./types";

export const SESSION_COOKIE = "t2211_session";
const secretKey = () => new TextEncoder().encode(env.appSecret);
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function startSession(user: SessionUser) {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: MAX_AGE,
  });
  await run("UPDATE users SET last_login_at = $1 WHERE id = $2", [nowIso(), user.id]);
}

export async function endSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const user = await get<User>("SELECT * FROM users WHERE id = $1", [String(payload.sub)]);
    if (!user || !user.is_active) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as SessionUser["role"],
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Please sign in to continue.");
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new AuthError("Admin access required.");
  return session;
}

export class AuthError extends Error {}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    country: user.country,
    city: user.city,
    bio: user.bio,
    avatar: user.avatar,
    email_opt_in: !!user.email_opt_in,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  };
}
