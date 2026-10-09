import "server-only";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { env } from "./config";
import { newId, nowIso, run } from "./db";
import { OUTBOX_ROOT, ensureDir, humanBytes } from "./storage";

export interface Attachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
  userId?: string | null;
  orderId?: string | null;
  replyTo?: string;
}

let transporterPromise: Promise<nodemailer.Transporter | null> | null = null;

export function smtpConfigured(): boolean {
  return Boolean(env.smtp.host);
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (!smtpConfigured()) return null;
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const t = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure || env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      });
      await t.verify();
      return t;
    })().catch((err) => {
      console.error("[mail] SMTP verify failed:", err.message);
      transporterPromise = null;
      return null;
    });
  }
  return transporterPromise;
}

/**
 * Sends an email. With SMTP configured it goes out for real; otherwise the
 * message is captured in the in-app outbox (visible at /admin/emails) and
 * written to storage/outbox so nothing is ever silently lost.
 */
export async function sendMail(input: MailInput): Promise<{ status: string; error?: string }> {
  const transport = (await getTransporter()) ?? null;
  let status: "sent" | "dev" | "failed" = "dev";
  let error: string | null = null;

  const attachments = (input.attachments ?? []).filter(Boolean);

  if (transport) {
    try {
      await transport.sendMail({
        from: env.mailFrom,
        to: input.to,
        replyTo: input.replyTo || env.mailReplyTo || undefined,
        subject: input.subject,
        html: input.html,
        text: input.text ?? stripHtml(input.html),
        attachments: attachments.map((a) => ({
          filename: a.filename,
          path: a.path,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      status = "sent";
    } catch (err) {
      status = "failed";
      error = (err as Error).message;
      console.error("[mail] send failed:", error);
    }
  } else {
    // Dev outbox: persist to disk so the flow is still inspectable.
    try {
      ensureDir(OUTBOX_ROOT);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dir = path.join(OUTBOX_ROOT, `${stamp}-${safeSlug(input.to)}`);
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, "email.html"), input.html, "utf8");
      fs.writeFileSync(path.join(dir, "email.txt"), input.text ?? stripHtml(input.html), "utf8");
      fs.writeFileSync(
        path.join(dir, "meta.json"),
        JSON.stringify(
          {
            to: input.to,
            subject: input.subject,
            attachments: attachments.map((a) => a.filename),
            note: "SMTP not configured — set SMTP_HOST in .env.local to deliver for real.",
            created_at: nowIso(),
          },
          null,
          2,
        ),
        "utf8",
      );
      for (const a of attachments) {
        if (a.path) fs.copyFileSync(a.path, path.join(dir, a.filename));
        else if (a.content) fs.writeFileSync(path.join(dir, a.filename), a.content as string | Buffer);
      }
      status = "dev";
    } catch (err) {
      error = (err as Error).message;
      status = "failed";
    }
  }

  const totalBytes = attachments.reduce((sum, a) => sum + (attachmentSize(a) ?? 0), 0);

  await run(
    `INSERT INTO email_log
       (id, to_address, subject, status, transport, error, attachments, body_preview, user_id, order_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      newId("eml"),
      input.to,
      input.subject,
      status,
      transport ? `smtp:${env.smtp.host}` : "dev-outbox",
      error,
      attachments.length
        ? JSON.stringify(attachments.map((a) => ({ name: a.filename, bytes: attachmentSize(a) })))
        : null,
      stripHtml(input.html).slice(0, 400),
      input.userId ?? null,
      input.orderId ?? null,
      nowIso(),
    ],
  );

  return { status, error: error ?? undefined };
}

function attachmentSize(a: Attachment): number | null {
  try {
    if (a.path) return fs.statSync(a.path).size;
    if (typeof a.content === "string") return Buffer.byteLength(a.content);
    if (Buffer.isBuffer(a.content)) return a.content.byteLength;
  } catch {
    /* ignore */
  }
  return null;
}

export function describeAttachments(list: Attachment[]): string {
  if (!list.length) return "no attachments";
  return list
    .map((a) => {
      const size = attachmentSize(a);
      return size ? `${a.filename} (${humanBytes(size)})` : a.filename;
    })
    .join(", ");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeSlug(input: string): string {
  return input.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase().slice(0, 60);
}
