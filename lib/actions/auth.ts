"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, getSession, startSession, verifyPassword, publicUser } from "@/lib/auth";
import { createUser, getUserByEmail, updateUser, createMessage } from "@/lib/repo";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { sendMail } from "@/lib/mail";
import { welcomeEmail } from "@/lib/emails";
import { env } from "@/lib/config";

export type ActionState =
  | { ok: boolean; error?: string; message?: string; field?: string; redirect?: string }
  | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Tell us your artist name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a phone number for mobile money checkout")
    .max(24)
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Use at least 8 characters").max(120),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  terms: z.literal("on", { message: "Please accept the licence terms" }).optional(),
});

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await ensureBootstrapped();
  const parsed = signupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const data = parsed.data;
  if (!data.terms) return { ok: false, error: "Please accept the licence terms to create your account." };

  const existing = await getUserByEmail(data.email);
  if (existing) return { ok: false, error: "An account with that email already exists. Try signing in." };

  let user;
  try {
    user = await createUser({
      email: data.email,
      name: data.name,
      password: data.password,
      phone: data.phone || null,
      country: data.country || null,
      city: data.city || null,
      role: "artist",
    });
  } catch (err) {
    return { ok: false, error: `Could not create the account (${(err as Error).message}).` };
  }

  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role });

  const mail = await welcomeEmail(user);
  await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text, userId: user.id });

  await createMessage({
    direction: "outbound",
    kind: "system",
    to_user_id: user.id,
    from_name: env.appName,
    from_email: env.supportMail,
    subject: mail.subject,
    body: "Welcome! Your account is ready. Every purchase is delivered by email and stored in your Vault.",
  });

  const next = String(formData.get("next") || "/beats");
  redirect(next.startsWith("/") ? next : "/beats");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await ensureBootstrapped();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const user = await getUserByEmail(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
    return { ok: false, error: "That email and password combination does not match our records." };
  }
  if (!user.is_active) return { ok: false, error: "This account has been deactivated. Contact support." };

  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role });

  const next = String(formData.get("next") || (user.role === "admin" ? "/admin" : "/studio"));
  redirect(next.startsWith("/") ? next : "/studio");
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  bio: z.string().trim().max(600).optional().or(z.literal("")),
  email_opt_in: z.string().optional(),
});

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in first." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };

  await updateUser(session.id, {
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    country: parsed.data.country || null,
    city: parsed.data.city || null,
    bio: parsed.data.bio || null,
    email_opt_in: parsed.data.email_opt_in === "on" ? 1 : 0,
  });
  return { ok: true, message: "Profile updated." };
}

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string().min(8, "New password must be at least 8 characters"),
  confirm: z.string().min(8),
});

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in first." };
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  if (parsed.data.next !== parsed.data.confirm) return { ok: false, error: "The new passwords do not match." };

  const user = await getUserByEmail(session.email);
  if (!user || !(await verifyPassword(parsed.data.current, user.password_hash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  const { hashPassword } = await import("@/lib/auth");
  await updateUser(user.id, { password_hash: await hashPassword(parsed.data.next) } as never);
  return { ok: true, message: "Password changed." };
}

export async function currentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await getUserByEmail(session.email);
  return user ? publicUser(user) : null;
}
