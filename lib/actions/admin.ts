"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { env } from "@/lib/config";
import { requireAdmin, getSession } from "@/lib/auth";
import {
  addBeatFile,
  createBeat,
  createLicense,
  createMessage,
  createVideo,
  deleteBeat,
  deleteBeatFile,
  deleteVideo,
  ensureDefaultLicenses,
  getBeatById,
  getMessage,
  getOrderByRef,
  getUserByEmail,
  getUserById,
  getVideoById,
  listArtists,
  listBeatFiles,
  listMessages,
  markMessageRead,
  setSetting,
  slugify,
  updateBeat,
  updateOrder,
  updateVideo,
} from "@/lib/repo";
import type { User } from "@/lib/types";
import { saveUpload } from "@/lib/storage";
import { sendMail } from "@/lib/mail";
import { adminMessageEmail, contactAutoReplyEmail, contactNotificationEmail } from "@/lib/emails";
import { fulfillOrder, failOrder } from "@/lib/fulfillment";
import type { ActionState } from "./auth";

export type { ActionState };

const AUDIO_EXT = /\.(mp3|wav|aiff?|flac|ogg|m4a|aac)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const ARCHIVE_EXT = /\.(zip|rar|7z)$/i;

async function storeFile(
  file: unknown,
  subdir: string,
  allowed: RegExp,
  opts: { prefix?: string; visibility?: "public" | "private" } = {},
) {
  const prefix = opts.prefix;
  if (!(file instanceof File) || file.size === 0) return null;
  if (!allowed.test(file.name)) {
    throw new Error(`"${file.name}" is not a supported file type.`);
  }
  const maxBytes = env.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`"${file.name}" is larger than ${env.maxUploadMb}MB.`);
  return saveUpload(file, subdir, { prefix, visibility: opts.visibility });
}

/* ------------------------------------------------------------------ */
/* Beats                                                               */
/* ------------------------------------------------------------------ */

const beatSchema = z.object({
  title: z.string().trim().min(2, "Give the beat a title").max(90),
  genre: z.string().trim().min(2, "Pick a genre").max(40),
  mood: z.string().trim().max(40).optional().or(z.literal("")),
  bpm: z.coerce.number().int().min(40).max(260).optional(),
  musical_key: z.string().trim().max(20).optional().or(z.literal("")),
  tags: z.string().trim().max(240).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(1_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  published: z.string().optional(),
  featured: z.string().optional(),
  is_free: z.string().optional(),
});

export async function uploadBeatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "You must be signed in as the producer to upload beats." };
  }
  await ensureBootstrapped();

  const parsed = beatSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const data = parsed.data;

  let slug = slugify(data.title);

  try {
    const preview = await storeFile(formData.get("preview_file"), `beats/${slug}/preview`, AUDIO_EXT, { prefix: "preview" });
    const full = await storeFile(formData.get("full_file"), `beats/${slug}/master`, AUDIO_EXT, { prefix: "master", visibility: "private" });
    const trackout = await storeFile(formData.get("trackout_file"), `beats/${slug}/trackout`, ARCHIVE_EXT, { prefix: "trackout", visibility: "private" });
    const artwork = await storeFile(formData.get("artwork_file"), `artwork`, IMAGE_EXT, { prefix: slug });

    if (!preview && !full) {
      return { ok: false, error: "Attach at least one audio file — a tagged preview or the full master." };
    }

    const isFree = data.is_free === "on" || (data.price ?? 0) === 0;
    const priceCents = Math.round((data.price ?? 0) * 100);

    const beat = await createBeat({
      title: data.title,
      slug,
      genre: data.genre,
      mood: data.mood || null,
      tags: (data.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .join(","),
      description: data.description || null,
      bpm: data.bpm ?? null,
      musical_key: data.musical_key || null,
      price_cents: isFree ? 0 : priceCents || 10000,
      currency: (data.currency ?? env.currency).toUpperCase(),
      artwork: artwork?.rel ?? null,
      preview_file: preview?.rel ?? full?.rel ?? null,
      full_file: full?.rel ?? preview?.rel ?? null,
      trackout_file: trackout?.rel ?? null,
      is_free: isFree ? 1 : 0,
      published: data.published === "off" ? 0 : 1,
      featured: data.featured === "on" ? 1 : 0,
      duration_sec: null,
    });
    slug = beat.slug;

    // Extra deliverable files (stems, alternates, PDFs …)
    const extras = formData.getAll("extra_files").filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of extras.slice(0, 24)) {
      const stored = await storeFile(file, `beats/${slug}/extras`, /\.(mp3|wav|zip|pdf|flac|m4a|aiff?|ogg)$/i, {
        visibility: "private",
      });
      if (!stored) continue;
      await addBeatFile(beat.id, {
        label: file.name.replace(/\.[^.]+$/, ""),
        file_path: stored.rel,
        mime: stored.mime,
        bytes: stored.bytes,
        included_in: String(formData.get("extra_include") || "wav,stems"),
      });
    }

    if (!isFree) {
      const custom = String(formData.get("licenses") || "").trim();
      if (custom) {
        // "MP3 Lease:120|WAV Lease:220|Trackout:380|Exclusive:1200"
        const entries = custom
          .split("|")
          .map((e) => e.trim())
          .filter(Boolean);
        let tier = 1;
        for (const entry of entries) {
          const [name, price] = entry.split(":");
          const cents = Math.round(parseFloat(price ?? "0") * 100);
          if (!name || !Number.isFinite(cents)) continue;
          await createLicense(beat.id, {
            name: name.trim(),
            price_cents: cents,
            tier: tier++,
            currency: (data.currency ?? env.currency).toUpperCase(),
            allows_exclusive: /exclusive/i.test(name) ? 1 : 0,
            description: `${name.trim()} licence for "${data.title}".`,
          });
        }
      } else {
        await ensureDefaultLicenses(beat.id, beat.price_cents, beat.currency);
      }
    }

    revalidatePath("/beats");
    revalidatePath("/");
    revalidatePath("/admin/beats");
    return { ok: true, message: `"${data.title}" is live in the store.` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateBeatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const id = String(formData.get("id") ?? "");
  const beat = await getBeatById(id);
  if (!beat) return { ok: false, error: "Beat not found." };

  const patch: Record<string, unknown> = {};
  const strFields = ["title", "genre", "mood", "musical_key", "tags", "description"] as const;
  for (const f of strFields) {
    const v = String(formData.get(f) ?? "").trim();
    patch[f] = v === "" ? null : v;
  }
  const bpm = Number(formData.get("bpm"));
  patch.bpm = Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null;
  const price = Number(formData.get("price"));
  if (Number.isFinite(price)) patch.price_cents = Math.round(price * 100);
  patch.published = formData.get("published") === "on" ? 1 : 0;
  patch.featured = formData.get("featured") === "on" ? 1 : 0;
  patch.is_free = formData.get("is_free") === "on" ? 1 : 0;

  try {
    const preview = await storeFile(formData.get("preview_file"), `beats/${beat.slug}/preview`, AUDIO_EXT, { prefix: "preview" });
    const full = await storeFile(formData.get("full_file"), `beats/${beat.slug}/master`, AUDIO_EXT, { prefix: "master", visibility: "private" });
    const trackout = await storeFile(formData.get("trackout_file"), `beats/${beat.slug}/trackout`, ARCHIVE_EXT, { prefix: "trackout", visibility: "private" });
    const artwork = await storeFile(formData.get("artwork_file"), "artwork", IMAGE_EXT, { prefix: beat.slug });
    if (preview) patch.preview_file = preview.rel;
    if (full) patch.full_file = full.rel;
    if (trackout) patch.trackout_file = trackout.rel;
    if (artwork) patch.artwork = artwork.rel;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  await updateBeat(id, patch as never);
  revalidatePath("/beats");
  revalidatePath(`/beats/${beat.slug}`);
  revalidatePath("/admin/beats");
  return { ok: true, message: `"${beat.title}" updated.` };
}

export async function deleteBeatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const id = String(formData.get("id") ?? "");
  const beat = await getBeatById(id);
  if (!beat) return { ok: false, error: "Beat not found." };
  await deleteBeat(id);
  revalidatePath("/beats");
  revalidatePath("/admin/beats");
  revalidatePath("/");
  return { ok: true, message: `"${beat.title}" deleted.` };
}

export async function toggleBeatFlagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const id = String(formData.get("id") ?? "");
  const flag = String(formData.get("flag") ?? "");
  if (!["published", "featured", "is_free", "exclusive_sold"].includes(flag)) {
    return { ok: false, error: "Unknown flag." };
  }
  const beat = await getBeatById(id);
  if (!beat) return { ok: false, error: "Beat not found." };
  const current = (beat as unknown as Record<string, number>)[flag] ?? 0;
  await updateBeat(id, { [flag]: current ? 0 : 1 } as never);
  revalidatePath("/admin/beats");
  revalidatePath("/beats");
  return { ok: true, message: `${flag} ${current ? "disabled" : "enabled"}.` };
}

export async function deleteBeatFileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const id = String(formData.get("id") ?? "");
  const beatId = String(formData.get("beat_id") ?? "");
  await deleteBeatFile(id);
  revalidatePath(`/admin/beats?beat=${beatId}`);
  return { ok: true, message: "File removed." };
}

export const listBeatFilesFor = listBeatFiles;

/* ------------------------------------------------------------------ */
/* Videos                                                              */
/* ------------------------------------------------------------------ */

export async function uploadVideoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  await ensureBootstrapped();

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Give the video a title." };
  const description = String(formData.get("description") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const beatId = String(formData.get("beat_id") ?? "").trim();
  const published = formData.get("published") !== "off";

  try {
    const file = await storeFile(formData.get("video_file"), "videos", VIDEO_EXT, { prefix: slugify(title) });
    const poster = await storeFile(formData.get("poster_file"), "videos/posters", IMAGE_EXT, { prefix: slugify(title) });

    let kind: "file" | "youtube" | "vimeo" | "visualizer" = "visualizer";
    if (file) kind = "file";
    else if (/youtu\.?be/i.test(url)) kind = "youtube";
    else if (/vimeo\.com/i.test(url)) kind = "vimeo";
    else if (url) kind = "youtube";

    if (!file && !url && !beatId) {
      return { ok: false, error: "Upload a video file, paste a YouTube/Vimeo link, or link one of your beats." };
    }

    const linkedBeat = beatId ? await getBeatById(beatId) : null;
    await createVideo({
      title,
      slug: slugify(title),
      description: description || null,
      kind,
      url: url || null,
      file_path: file?.rel ?? linkedBeat?.preview_file ?? null,
      poster: poster?.rel ?? linkedBeat?.artwork ?? null,
      duration_sec: linkedBeat?.duration_sec ?? null,
      beat_id: linkedBeat?.id ?? null,
      published: published ? 1 : 0,
    });

    revalidatePath("/watch");
    revalidatePath("/admin/videos");
    revalidatePath("/");
    return { ok: true, message: `"${title}" added to the Watch page.` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteVideoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const id = String(formData.get("id") ?? "");
  await deleteVideo(id);
  revalidatePath("/watch");
  revalidatePath("/admin/videos");
  return { ok: true, message: "Video deleted." };
}

export async function toggleVideoPublishAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const id = String(formData.get("id") ?? "");
  const video = await getVideoById(id);
  if (!video) return { ok: false, error: "Video not found." };
  await updateVideo(id, { published: video.published ? 0 : 1 });
  revalidatePath("/watch");
  revalidatePath("/admin/videos");
  return { ok: true, message: video.published ? "Video unpublished." : "Video published." };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export async function approveOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const reference = String(formData.get("reference") ?? "");
  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  if (["paid", "delivered"].includes(order.status)) return { ok: true, message: "Already delivered." };

  await updateOrder(order.id, { status: "paid", provider: order.provider ?? "bank", provider_ref: order.bank_reference });
  const result = await fulfillOrder(order.id);
  revalidatePath("/admin/orders");
  revalidatePath("/studio");
  const buyer = await getUserById(order.user_id);
  return {
    ok: true,
    message: `Payment confirmed — files emailed to ${buyer?.email ?? "the artist"}.`,
  };
}

export async function rejectOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const reference = String(formData.get("reference") ?? "");
  const reason = String(formData.get("reason") ?? "Payment could not be verified.").trim();
  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  await failOrder(order.id, reason);
  revalidatePath("/admin/orders");
  return { ok: true, message: `Order marked as failed: ${reason}` };
}

export async function resendDeliveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const reference = String(formData.get("reference") ?? "");
  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  if (!["paid", "delivered"].includes(order.status)) {
    return { ok: false, error: "Only paid orders can be re-delivered." };
  }
  await fulfillOrder(order.id);
  revalidatePath("/admin/orders");
  return { ok: true, message: "Delivery email re-sent." };
}

export async function refundOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const reference = String(formData.get("reference") ?? "");
  const order = await getOrderByRef(reference);
  if (!order) return { ok: false, error: "Order not found." };
  await updateOrder(order.id, { status: "refunded", failure_reason: "Refunded by producer" });
  const buyer = await getUserById(order.user_id);
  if (buyer) {
    await createMessage({
      direction: "outbound",
      kind: "order",
      to_user_id: buyer.id,
      from_name: env.appName,
      from_email: env.supportMail,
      subject: `Order ${order.reference} refunded`,
      body: `Your payment for order ${order.reference} has been refunded. The licence is no longer active.`,
      order_id: order.id,
      beat_id: order.beat_id,
    });
    const { emailShell, paragraphs } = await import("@/lib/email-templates");
    await sendMail({
      to: buyer.email,
      subject: `Refund processed — order ${order.reference}`,
      html: emailShell({
        title: "Refund processed",
        body: paragraphs(
          `Your payment for order ${order.reference} has been refunded to the original payment method. Allow 3–7 working days for it to appear.`,
        ),
      }),
      userId: buyer.id,
      orderId: order.id,
    });
  }
  revalidatePath("/admin/orders");
  return { ok: true, message: "Order refunded and the artist notified." };
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export async function sendArtistMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const to = String(formData.get("to") ?? "").trim().toLowerCase();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const beatId = String(formData.get("beat_id") ?? "").trim();
  if (subject.length < 3) return { ok: false, error: "Add a subject." };
  if (body.length < 3) return { ok: false, error: "Write a message." };

  let targets: User[] = [];
  if (!to || to === "all") {
    targets = await listArtists(500);
  } else {
    const byId = await getUserById(to);
    const byEmail = byId ?? (await getUserByEmail(to));
    targets = byEmail ? [byEmail] : [];
  }
  if (!targets.length) return { ok: false, error: "No matching artist account." };

  const session = await getSession();
  const includeBeat = beatId ? await getBeatById(beatId) : null;
  const fromName = session?.name ?? env.adminName;
  let sent = 0;

  for (const target of targets) {
    const mail = adminMessageEmail({ to: target, subject, body, fromName, includeBeat });
    const result = await sendMail({
      to: target.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      userId: target.id,
    });
    if (result.status !== "failed") sent++;
    await createMessage({
      direction: "outbound",
      kind: "admin",
      from_user_id: session?.id ?? null,
      to_user_id: target.id,
      from_name: fromName,
      from_email: env.supportMail,
      subject,
      body,
      beat_id: includeBeat?.id ?? null,
    });
  }

  revalidatePath("/admin/messages");
  revalidatePath("/admin/emails");
  return { ok: true, message: `Message emailed to ${sent} artist${sent === 1 ? "" : "s"}.` };
}

export async function markThreadReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in." };
  const id = String(formData.get("id") ?? "");
  const message = await getMessage(id);
  if (!message) return { ok: false, error: "Message not found." };
  await markMessageRead(id);
  revalidatePath(session.role === "admin" ? "/admin/messages" : "/studio");
  return { ok: true };
}

export async function replyToMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in." };
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) return { ok: false, error: "Write a reply." };

  const original = await getMessage(id);
  if (!original) return { ok: false, error: "Message not found." };

  const isAdmin = session.role === "admin";
  // Who are we replying to?
  const counterpartId = isAdmin ? (original.from_user_id ?? original.to_user_id) : null;
  const counterpart = counterpartId ? await getUserById(counterpartId) : null;
  const toEmail = isAdmin
    ? (original.from_email ?? counterpart?.email ?? null)
    : env.adminMail;
  const toName = isAdmin ? (original.from_name ?? counterpart?.name ?? "there") : env.adminName;
  const subject = original.subject.startsWith("Re:") ? original.subject : `Re: ${original.subject}`;

  await createMessage({
    direction: isAdmin ? "outbound" : "inbound",
    kind: isAdmin ? "admin" : "contact",
    from_user_id: session.id,
    to_user_id: isAdmin ? counterpartId : null,
    from_name: session.name,
    from_email: session.email,
    subject,
    body,
    thread_id: original.thread_id ?? original.id,
    order_id: original.order_id,
    beat_id: original.beat_id,
  });

  if (toEmail) {
    const mail = adminMessageEmail({ to: { name: toName, email: toEmail }, subject, body, fromName: session.name });
    await sendMail({
      to: toEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      userId: counterpart?.id ?? null,
      replyTo: session.email,
    });
  }

  await markMessageRead(id);
  revalidatePath(isAdmin ? "/admin/messages" : "/studio");
  revalidatePath("/admin/emails");
  return { ok: true, message: "Reply sent by email." };
}

export async function listInbox(limit = 100) {
  return listMessages({ limit });
}

/* ------------------------------------------------------------------ */
/* Public contact form                                                 */
/* ------------------------------------------------------------------ */

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please add your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  subject: z.string().trim().min(3, "Add a subject").max(140),
  message: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(4000),
});

export async function contactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await ensureBootstrapped();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const data = parsed.data;

  const session = await getSession();

  await createMessage({
    direction: "inbound",
    kind: "contact",
    from_user_id: session?.id ?? null,
    from_name: data.name,
    from_email: data.email,
    subject: data.subject,
    body: data.message,
  });

  const notify = contactNotificationEmail({
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
    phone: data.phone,
  });
  await sendMail({ to: env.adminMail, subject: notify.subject, html: notify.html, text: notify.text });

  const auto = contactAutoReplyEmail({ name: data.name, subject: data.subject });
  await sendMail({ to: data.email, subject: auto.subject, html: auto.html, text: auto.text });

  revalidatePath("/admin/messages");
  return { ok: true, message: "Message sent — the producer replies to every enquiry, usually within 24 hours." };
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const allowed = [
    "brand_name",
    "brand_tagline",
    "hero_eyebrow",
    "hero_line_1",
    "hero_line_2",
    "hero_line_3",
    "hero_sub",
    "producer_bio",
    "contact_email",
    "contact_phone",
    "studio_location",
    "instagram",
    "youtube",
    "tiktok",
    "whatsapp",
  ];
  let count = 0;
  for (const key of allowed) {
    const value = formData.get(key);
    if (typeof value === "string") {
      await setSetting(key, value.trim());
      count++;
    }
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { ok: true, message: `Saved ${count} setting${count === 1 ? "" : "s"}.` };
}

export async function sendTestEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const to = String(formData.get("to") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(to)) return { ok: false, error: "Enter a valid email address." };
  const { emailShell, paragraphs } = await import("@/lib/email-templates");
  const result = await sendMail({
    to,
    subject: `${env.appName} — test email`,
    html: emailShell({
      title: "Test email ✅",
      body: paragraphs(
        `If you can read this, outbound email is working. Transport: ${env.smtp.host ? `SMTP ${env.smtp.host}` : "in-app outbox (SMTP not configured)"}.`,
      ),
      cta: { label: "Open the store", url: env.appUrl },
    }),
  });
  revalidatePath("/admin/emails");
  return result.status === "failed"
    ? { ok: false, error: `SMTP error: ${result.error}` }
    : { ok: true, message: `Test email ${result.status === "sent" ? "sent" : "captured in the outbox"} → ${to}` };
}

export async function resendWelcomeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  const id = String(formData.get("id") ?? "");
  const user = await getUserById(id);
  if (!user) return { ok: false, error: "Artist not found." };
  const { welcomeEmail } = await import("@/lib/emails");
  const mail = welcomeEmail(user);
  await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text, userId: user.id });
  revalidatePath("/admin/emails");
  return { ok: true, message: `Welcome email re-sent to ${user.email}.` };
}

/* ------------------------------------------------------------------ */
/* Demo tools                                                          */
/* ------------------------------------------------------------------ */

export async function resetDemoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }
  if (String(formData.get("confirm") ?? "") !== "RESET") {
    return { ok: false, error: 'Type RESET in the confirmation field to wipe and re-seed demo data.' };
  }
  const { resetDemoData } = await import("@/lib/seed");
  await resetDemoData();
  revalidatePath("/", "layout");
  redirect("/admin");
}
