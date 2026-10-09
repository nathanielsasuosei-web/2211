import { env, moneyLabel } from "./config";
import {
  alertBox,
  emailShell,
  escapeHtml,
  fileList,
  keyValueTable,
  paragraphs,
} from "./email-templates";
import type { Beat, License, Order, User } from "./types";
import { stripHtml } from "./mail";

const url = (p: string) => `${env.appUrl}${p}`;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function render(subject: string, html: string): RenderedEmail {
  return { subject, html, text: stripHtml(html) };
}

/* ------------------------------------------------------------------ */

export function welcomeEmail(user: User): RenderedEmail {
  const html = emailShell({
    title: `Welcome to ${env.appName}, ${user.name.split(" ")[0]} 👋`,
    preheader: "Your artist account is live — browse the catalogue and license a beat today.",
    body: `
      ${paragraphs(`Your artist account is ready. You can now license beats, pay with mobile money, card or bank transfer, and every purchase is delivered straight to this inbox plus your private Vault.`)}
      ${keyValueTable([
        ["Account", user.email],
        ["Artist name", user.name],
        ["Member since", new Date(user.created_at).toDateString()],
      ])}
      ${alertBox("Tip: complete your profile with your phone number so M-Pesa / MoMo checkout is one tap.", "ok")}
    `,
    cta: { label: "Browse the beats", url: url("/beats") },
  });
  return render(`Welcome to ${env.appName} — your artist account is live`, html);
}

/* ------------------------------------------------------------------ */

export function orderCreatedEmail(opts: { order: Order; beat: Beat; license: License | null; user: User }): RenderedEmail {
  const { order, beat, license, user } = opts;
  const html = emailShell({
    title: `Order ${order.reference} created`,
    preheader: `Complete payment to receive "${beat.title}".`,
    body: `
      ${paragraphs(`Hi ${user.name.split(" ")[0]}, we reserved "${beat.title}" for you. Finish the payment and the files are delivered to this inbox instantly.`)}
      ${keyValueTable([
        ["Beat", beat.title],
        ["Licence", license?.name ?? "Standard"],
        ["Amount", moneyLabel(order.amount_cents, order.currency)],
        ["Payment method", methodLabel(order.method)],
        ["Order reference", order.reference],
        ["Status", order.status.replace("_", " ")],
      ])}
      ${alertBox(`Hold your order open — unpaid orders expire after 60 minutes.`)}
    `,
    cta: { label: "Complete payment", url: url(`/checkout/${order.reference}`) },
  });
  return render(`Complete your payment — ${beat.title} (${order.reference})`, html);
}

/* ------------------------------------------------------------------ */

export function bankTransferEmail(opts: { order: Order; beat: Beat; user: User }): RenderedEmail {
  const { order, beat, user } = opts;
  const b = env.bank;
  const html = emailShell({
    title: "Bank / mobile money transfer details",
    preheader: `Send ${moneyLabel(order.amount_cents, order.currency)} and confirm your reference.`,
    body: `
      ${paragraphs(`Hi ${user.name.split(" ")[0]}, here are the payment details for "${beat.title}". Use your order reference as the payment description so we can match it fast.`)}
      ${keyValueTable([
        ["Amount due", moneyLabel(order.amount_cents, order.currency)],
        ["Order reference", order.reference],
        ["Bank", b.name],
        ["Account name", b.accountName],
        ["Account number", b.accountNumber],
        ["Branch", b.branch],
        ["SWIFT", b.swift],
        ["Mobile money", `${b.momoName} — ${b.momoNumber}`],
      ])}
      ${paragraphs(b.instructions)}
      ${alertBox("After sending, submit the transaction reference below. We verify payments within a few minutes and your files are emailed automatically.", "ok")}
    `,
    cta: { label: "I have paid — confirm", url: url(`/checkout/${order.reference}`) },
  });
  return render(`Bank transfer details — order ${order.reference}`, html);
}

/* ------------------------------------------------------------------ */

export function deliveryEmail(opts: {
  order: Order;
  beat: Beat;
  buyer: User;
  license: License | null;
  bundle: { zipName: string; bytes: number };
  downloadUrl: string;
  studioUrl: string;
}): RenderedEmail {
  const { order, beat, buyer, license, bundle, downloadUrl, studioUrl } = opts;
  const html = emailShell({
    title: `Paid ✅ "${beat.title}" is yours`,
    preheader: `Your ${license?.name ?? "licence"} files are attached, plus a secure download link.`,
    body: `
      ${paragraphs(`Payment received, ${buyer.name.split(" ")[0]}. Everything you need is attached to this email — and the same files are waiting in your Vault if you prefer to download later.`)}
      ${keyValueTable([
        ["Order", order.reference],
        ["Beat", beat.title],
        ["Licence", license?.name ?? "Standard"],
        ["Paid", moneyLabel(order.amount_cents, order.currency)],
        ["Method", methodLabel(order.method)],
        ["Date", new Date().toUTCString()],
      ])}
      <p style="margin:0 0 8px;font-weight:700;color:#fff;">In this delivery</p>
      ${fileList([
        { label: bundle.zipName, note: "attached to this email" },
        { label: "Licence certificate (TXT)", note: "inside the ZIP" },
        ...(license?.perks ? (JSON.parse(license.perks) as string[]).map((p) => ({ label: p })) : []),
      ])}
      ${alertBox(`Secure download: <a href="${escapeHtml(downloadUrl)}" style="color:#ff6a63;">${escapeHtml(downloadUrl)}</a><br/>Keep it private — it is tied to your account.`, "ok")}
    `,
    cta: { label: "Open my Vault", url: studioUrl },
    footnote: `Questions about splits, stems or an exclusive buy-out? Reply to this email — the producer reads every message.`,
  });
  return render(`Your beat is here — ${beat.title} (${license?.name ?? "licence"})`, html);
}

/* ------------------------------------------------------------------ */

export function adminOrderEmail(opts: { order: Order; beat: Beat; buyer: User; license: License | null }): RenderedEmail {
  const { order, beat, buyer, license } = opts;
  const html = emailShell({
    title: "New paid order 🎉",
    preheader: `${buyer.name} paid ${moneyLabel(order.amount_cents, order.currency)} for "${beat.title}".`,
    body: `
      ${keyValueTable([
        ["Buyer", `${buyer.name} <${buyer.email}>`],
        ["Phone", buyer.phone ?? "—"],
        ["Beat", `${beat.title} (${beat.genre})`],
        ["Licence", license?.name ?? "Standard"],
        ["Amount", moneyLabel(order.amount_cents, order.currency)],
        ["Method", methodLabel(order.method)],
        ["Reference", order.reference],
      ])}
      ${paragraphs("The delivery email with the files has already been sent to the artist.")}
    `,
    cta: { label: "Open admin orders", url: url("/admin/orders") },
  });
  return render(`Paid: ${moneyLabel(order.amount_cents, order.currency)} — ${beat.title} (${order.reference})`, html);
}

/* ------------------------------------------------------------------ */

export function pendingBankOrderAdminEmail(opts: { order: Order; beat: Beat; buyer: User }): RenderedEmail {
  const { order, beat, buyer } = opts;
  const html = emailShell({
    title: "Bank transfer awaiting review",
    preheader: `${buyer.name} submitted a transfer reference for "${beat.title}".`,
    body: `
      ${keyValueTable([
        ["Buyer", `${buyer.name} <${buyer.email}>`],
        ["Beat", beat.title],
        ["Amount", moneyLabel(order.amount_cents, order.currency)],
        ["Bank reference", order.bank_reference ?? "—"],
        ["Note", order.bank_note ?? "—"],
        ["Order", order.reference],
      ])}
      ${alertBox("Confirm the money landed in your account, then mark the order as received to release the files.")}
    `,
    cta: { label: "Review order", url: url(`/admin/orders?ref=${order.reference}`) },
  });
  return render(`Review bank payment — ${order.reference} (${moneyLabel(order.amount_cents, order.currency)})`, html);
}

/* ------------------------------------------------------------------ */

export function adminMessageEmail(opts: {
  to: { name: string; email: string };
  subject: string;
  body: string;
  fromName: string;
  includeBeat?: Beat | null;
}): RenderedEmail {
  const { to, subject, body, fromName, includeBeat } = opts;
  void to;
  const html = emailShell({
    title: subject,
    preheader: body.slice(0, 120),
    body: `
      ${paragraphs(body)}
      ${includeBeat ? keyValueTable([["Beat", includeBeat.title], ["Listen", url(`/beats/${includeBeat.slug}`)]]) : ""}
      <p style="margin:20px 0 0;color:#8b8b96;font-size:14px;">— ${escapeHtml(fromName)}, ${escapeHtml(env.appName)}</p>
    `,
    cta: includeBeat ? { label: "Open this beat", url: url(`/beats/${includeBeat.slug}`) } : { label: "Go to my studio", url: url("/studio") },
  });
  return render(subject, html);
}

/* ------------------------------------------------------------------ */

export function contactNotificationEmail(opts: { name: string; email: string; subject: string; message: string; phone?: string }): RenderedEmail {
  const html = emailShell({
    title: "New message from the website",
    preheader: `${opts.name} — ${opts.subject}`,
    body: `
      ${keyValueTable([
        ["From", `${opts.name} <${opts.email}>`],
        ["Phone", opts.phone ?? "—"],
        ["Subject", opts.subject],
        ["Received", new Date().toUTCString()],
      ])}
      ${paragraphs(opts.message)}
    `,
    cta: { label: "Reply from admin", url: url("/admin/messages") },
  });
  return render(`Website message: ${opts.subject}`, html);
}

/* ------------------------------------------------------------------ */

export function contactAutoReplyEmail(opts: { name: string; subject: string }): RenderedEmail {
  const html = emailShell({
    title: "We got your message",
    preheader: "The producer will get back to you shortly.",
    body: `
      ${paragraphs(`Hi ${opts.name}, thanks for reaching out about "${opts.subject}". Messages land directly with the producer — expect a reply within 24 hours.`)}
      ${alertBox("Need files for a session today? Browse ready-to-license beats in the store.", "ok")}
    `,
    cta: { label: "Browse beats", url: url("/beats") },
  });
  return render(`Re: ${opts.subject}`, html);
}

/* ------------------------------------------------------------------ */

export function passwordResetEmail(opts: { user: User; token: string }): RenderedEmail {
  const link = url(`/reset-password?token=${encodeURIComponent(opts.token)}`);
  const html = emailShell({
    title: "Reset your password",
    preheader: "This link expires in 30 minutes.",
    body: `
      ${paragraphs(`Hi ${opts.user.name.split(" ")[0]}, we received a request to reset the password for ${opts.user.email}.`)}
      ${alertBox(`If you did not request this, ignore this email — your password stays the same.`)}
    `,
    cta: { label: "Choose a new password", url: link },
  });
  return render(`Reset your ${env.appName} password`, html);
}

/* ------------------------------------------------------------------ */

export function methodLabel(method: string): string {
  const map: Record<string, string> = {
    mpesa: "M-Pesa (STK push)",
    paystack: "Paystack — card / mobile money / bank",
    bank: "Bank or mobile money transfer",
    demo: "Demo checkout",
    free: "Free download",
  };
  return map[method] ?? method;
}
