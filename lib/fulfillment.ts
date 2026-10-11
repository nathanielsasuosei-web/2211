import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { env, moneyLabel } from "./config";
import { absPath, ensureDir, humanBytes } from "./storage";
import { createZip } from "./media/zip.mjs";
import { newId, nowIso } from "./db";
import {
  createDelivery,
  createMessage,
  getBeatById,
  getLicense,
  getOrderById,
  getUserById,
  updateBeat,
  updateOrder,
  listBeatFiles,
  bumpBeatStat,
  getDeliveryByOrder,
} from "./repo";
import type { Beat, Delivery, License, Order, User } from "./types";
import { sendMail } from "./mail";
import { deliveryEmail, adminOrderEmail } from "./emails";

export interface DeliveryFile {
  label: string;
  path: string;
}

/** Which files a licence entitles the buyer to. */
export function resolveFilesForLicense(beat: Beat, license: License | null): DeliveryFile[] {
  const files: DeliveryFile[] = [];
  const push = (label: string, p?: string | null) => {
    if (p && !files.some((f) => f.path === p)) files.push({ label, path: p });
  };

  const master = beat.full_file ?? beat.preview_file;
  push(`${beat.title} — Master (WAV)`, master && /\.wav$/i.test(master) ? master : null);
  push(`${beat.title} — Master (MP3)`, master && /\.mp3$/i.test(master) ? master : null);
  if (!files.length) push(`${beat.title} — Master`, master);

  const tier = license?.tier ?? 2;
  if (tier >= 3) push(`${beat.title} — Trackout / Stems`, beat.trackout_file);
  push(`${beat.title} — Cover art`, beat.artwork);

  return files.filter((f) => {
    try {
      return fs.existsSync(absPath(f.path));
    } catch {
      return false;
    }
  });
}

export function licenseCertificate(opts: {
  buyer: User;
  beat: Beat;
  license: License | null;
  order: Order;
}): Buffer {
  const { buyer, beat, license, order } = opts;
  const perks = license?.perks ? (JSON.parse(license.perks) as string[]) : ["Standard licence"];
  const lines = [
    `${env.appName.toUpperCase()} — LICENCE CERTIFICATE`,
    "=".repeat(58),
    "",
    `Order reference : ${order.reference}`,
    `Date issued     : ${new Date().toDateString()}`,
    `Licensed to     : ${buyer.name} <${buyer.email}>`,
    "",
    `Work            : "${beat.title}"`,
    `Genre / BPM / Key: ${beat.genre} / ${beat.bpm ?? "—"} / ${beat.musical_key ?? "—"}`,
    `Licence         : ${license?.name ?? "Standard Lease"}`,
    `Fee paid        : ${moneyLabel(order.amount_cents, order.currency)}`,
    `Payment method  : ${order.method.toUpperCase()}`,
    "",
    "GRANTED RIGHTS",
    ...perks.map((p) => `  • ${p}`),
    "",
    "TERMS",
    `  • This licence is ${license?.allows_exclusive ? "EXCLUSIVE" : "NON-EXCLUSIVE"} and non-transferable.`,
    "  • Credit the producer as: \"Produced by 2211\" on all public releases.",
    "  • Register the work with your PRO and list the producer as a 50% writer",
    "    unless your exclusive agreement states otherwise.",
    "  • Redistribution of the raw beat or stems as your own product is prohibited.",
    "",
    `Verify this licence at ${env.appUrl}/studio (sign in and open your Vault).`,
    "",
    `Thank you for supporting independent production — ${env.supportMail}`,
  ];
  return Buffer.from(lines.join("\n"), "utf8");
}

/** Build (and cache) the ZIP a buyer downloads / receives by email. */
export async function buildDeliveryBundle(delivery: Delivery, ctx: { beat: Beat; license: License | null; order: Order; buyer: User }) {
  const dir = path.join(process.cwd(), "storage", "deliveries", delivery.token);
  ensureDir(dir);
  const zipName = `${ctx.beat.slug}-${(ctx.license?.name ?? "licence").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
  const zipPath = path.join(dir, zipName);
  if (fs.existsSync(zipPath)) return { zipPath, zipName, bytes: fs.statSync(zipPath).size };

  const files = (JSON.parse(delivery.files) as DeliveryFile[]).filter((f) => fs.existsSync(absPath(f.path)));
  const entries: { name: string; data: Uint8Array }[] = files.map((f) => ({
    name: path.basename(f.path).replace(/^[a-f0-9]{8}-/, ""),
    data: new Uint8Array(fs.readFileSync(absPath(f.path))),
  }));
  entries.push({
    name: "LICENCE-CERTIFICATE.txt",
    data: new Uint8Array(licenseCertificate({ buyer: ctx.buyer, beat: ctx.beat, license: ctx.license, order: ctx.order })),
  });
  entries.push({
    name: "README.txt",
    data: new Uint8Array(Buffer.from(
      [
        `${env.appName} — delivery for order ${ctx.order.reference}`,
        "",
        `Beat      : ${ctx.beat.title}`,
        `Licence   : ${ctx.license?.name ?? "Standard"}`,
        `Purchased : ${new Date(ctx.order.created_at).toUTCString()}`,
        "",
        ...files.map((f) => `• ${f.label}`),
        "",
        `Need stems or a custom mix? Reply to ${env.supportMail}.`,
      ].join("\n"),
      "utf8",
    )),
  });

  const zip = createZip(entries);
  await fsp.writeFile(zipPath, zip);
  return { zipPath, zipName, bytes: zip.byteLength };
}

/**
 * Called once a payment is confirmed (webhook, STK callback, bank approval or
 * demo checkout). Creates the delivery bundle, emails the files to the artist
 * and notifies the producer.
 */
export async function fulfillOrder(orderId: string, opts: { silent?: boolean } = {}) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (["paid", "delivered", "refunded"].includes(order.status)) {
    const existing = await getDeliveryByOrder(order.id);
    if (existing) return { order, delivery: existing, alreadyFulfilled: true };
  }

  const beat = await getBeatById(order.beat_id);
  const buyer = await getUserById(order.user_id);
  if (!beat || !buyer) throw new Error("Order is missing its beat or buyer");
  const license = order.license_id ? await getLicense(order.license_id) : null;

  const files = resolveFilesForLicense(beat, license);
  const delivery = await createDelivery({
    order_id: order.id,
    user_id: buyer.id,
    license_name: license?.name ?? "Standard Lease",
    files,
  });

  const bundle = await buildDeliveryBundle(delivery, { beat, license, order, buyer });

  await updateOrder(order.id, {
    status: "delivered",
    delivered_at: nowIso(),
    provider_payload: order.provider_payload,
  });

  if (license?.allows_exclusive) {
    await updateBeat(beat.id, { exclusive_sold: 1, published: 0 });
  }
  await bumpBeatStat(beat.id, "downloads");

  const downloadUrl = `${env.appUrl}/api/download/${delivery.token}`;
  const studioUrl = `${env.appUrl}/studio?tab=vault`;

  if (!opts.silent) {
    const mail = await deliveryEmail({ order, beat, buyer, license, bundle, downloadUrl, studioUrl });
    const attach = bundle.bytes <= 12 * 1024 * 1024 ? [{ filename: bundle.zipName, path: bundle.zipPath }] : [];
    await sendMail({
      to: buyer.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: attach,
      userId: buyer.id,
      orderId: order.id,
    });

    await createMessage({
      direction: "outbound",
      kind: "order",
      from_user_id: null,
      to_user_id: buyer.id,
      from_name: env.appName,
      from_email: env.supportMail,
      subject: mail.subject,
      body: `Your purchase of "${beat.title}" (${license?.name ?? "Standard"}) is confirmed. Files emailed to ${buyer.email} and available in your Vault: ${downloadUrl}`,
      order_id: order.id,
      beat_id: beat.id,
    });

    const adminMail = await adminOrderEmail({ order, beat, buyer, license });
    await sendMail({
      to: env.adminMail,
      subject: adminMail.subject,
      html: adminMail.html,
      text: adminMail.text,
      orderId: order.id,
    });
  }

  return { order: { ...order, status: "delivered" as const }, delivery, bundle, files };
}

export async function failOrder(orderId: string, reason: string) {
  await updateOrder(orderId, { status: "failed", failure_reason: reason.slice(0, 500) });
  const order = await getOrderById(orderId);
  if (!order) return;
  const buyer = await getUserById(order.user_id);
  if (buyer) {
    await createMessage({
      direction: "outbound",
      kind: "order",
      to_user_id: buyer.id,
      from_name: env.appName,
      from_email: env.supportMail,
      subject: `Payment not completed — ${order.reference}`,
      body: `We could not complete your payment for order ${order.reference}. Reason: ${reason}. You can retry any time from your Studio.`,
      order_id: order.id,
      beat_id: order.beat_id,
    });
  }
}

export function describeBundle(bundle: { zipName: string; bytes: number }): string {
  return `${bundle.zipName} (${humanBytes(bundle.bytes)})`;
}

export { newId, nowIso };
