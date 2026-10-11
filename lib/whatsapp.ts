import "server-only";
import { env } from "./config";
import { getAllSettings } from "./repo";

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = str(name, "");
  if (!v) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const whatsappEnv = {
  enabled: bool("WHATSAPP_ENABLED", true),
  provider: str("WHATSAPP_PROVIDER", "auto").toLowerCase(), // auto, meta, twilio, ultramsg, webhook, none
  to: str("WHATSAPP_TO", ""), // override producer number
  // Meta Cloud API
  metaToken: str("WHATSAPP_TOKEN", "") || str("META_WHATSAPP_TOKEN", ""),
  metaPhoneId: str("WHATSAPP_PHONE_NUMBER_ID", "") || str("META_PHONE_NUMBER_ID", ""),
  // Twilio
  twilioSid: str("TWILIO_ACCOUNT_SID", ""),
  twilioToken: str("TWILIO_AUTH_TOKEN", ""),
  twilioFrom: str("TWILIO_WHATSAPP_FROM", "") || str("WHATSAPP_FROM", ""), // e.g. whatsapp:+14155238886
  // UltraMsg / similar
  ultramsgInstance: str("ULTRAMSG_INSTANCE_ID", ""),
  ultramsgToken: str("ULTRAMSG_TOKEN", ""),
  // Generic webhook (n8n, Zapier, Make)
  webhookUrl: str("WHATSAPP_WEBHOOK_URL", ""),
};

function normalizePhone(raw: string): string {
  if (!raw) return "";
  // Keep + and digits, remove spaces, dashes, parens
  let p = raw.trim().replace(/[^\d+]/g, "");
  if (!p) return "";
  // If starts with 00, convert to +
  if (p.startsWith("00")) p = "+" + p.slice(2);
  // If Ghana number without country code (0...), try to convert to +233
  // But we keep as is and let provider handle - we just ensure it has +
  if (!p.startsWith("+")) {
    // If it looks like 233..., add +
    if (/^233\d{9}$/.test(p)) p = "+" + p;
    // If 0 + 9 digits (Ghana), convert 0 -> +233
    else if (/^0\d{9}$/.test(p)) p = "+233" + p.slice(1);
    // Otherwise keep as is with +
    else if (/^\d{7,15}$/.test(p)) p = "+" + p;
  }
  return p;
}

function getDigitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export async function getProducerWhatsappNumber(): Promise<string> {
  // Priority: WHATSAPP_TO env > site_settings whatsapp > contact_phone > admin phone
  if (whatsappEnv.to) return normalizePhone(whatsappEnv.to);

  try {
    const settings = await getAllSettings();
    const fromSettings = settings.whatsapp || settings.contact_phone || settings.admin_phone || "";
    if (fromSettings) return normalizePhone(fromSettings);
  } catch {
    // ignore
  }

  // Fallback to env ADMIN_PHONE
  if (env.adminPhone) return normalizePhone(env.adminPhone);
  if (env.adminMail) return ""; // no phone

  return "";
}

export function isWhatsappConfigured(): boolean {
  if (!whatsappEnv.enabled) return false;
  if (whatsappEnv.provider === "none") return false;
  // If webhook URL is set, we can send
  if (whatsappEnv.webhookUrl) return true;
  // Meta
  if (whatsappEnv.metaToken && whatsappEnv.metaPhoneId) return true;
  // Twilio
  if (whatsappEnv.twilioSid && whatsappEnv.twilioToken && whatsappEnv.twilioFrom) return true;
  // UltraMsg
  if (whatsappEnv.ultramsgInstance && whatsappEnv.ultramsgToken) return true;
  // Even without provider, we can at least log wa.me link
  return true; // allow dev mode that logs
}

function detectProvider(): "meta" | "twilio" | "ultramsg" | "webhook" | "none" {
  const p = whatsappEnv.provider;
  if (p === "meta" || p === "twilio" || p === "ultramsg" || p === "webhook" || p === "none") return p as any;
  // auto-detect
  if (whatsappEnv.webhookUrl) return "webhook";
  if (whatsappEnv.metaToken && whatsappEnv.metaPhoneId) return "meta";
  if (whatsappEnv.twilioSid && whatsappEnv.twilioToken) return "twilio";
  if (whatsappEnv.ultramsgInstance && whatsappEnv.ultramsgToken) return "ultramsg";
  return "none";
}

export async function sendWhatsapp(toRaw: string, message: string): Promise<{ ok: boolean; provider: string; error?: string; id?: string }> {
  const to = normalizePhone(toRaw);
  if (!to) return { ok: false, provider: "none", error: "No recipient phone number" };
  if (!whatsappEnv.enabled) return { ok: false, provider: "none", error: "WhatsApp disabled (WHATSAPP_ENABLED=false)" };

  const provider = detectProvider();
  const digits = getDigitsOnly(to);

  // Always log for dev visibility
  console.log(`[whatsapp] [${provider}] to ${to}: ${message.slice(0, 300)}`);

  try {
    if (provider === "webhook" && whatsappEnv.webhookUrl) {
      const res = await fetch(whatsappEnv.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          to_digits: digits,
          message,
          from: env.appName,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Webhook failed ${res.status}: ${txt.slice(0, 200)}`);
      }
      return { ok: true, provider, id: `wh_${Date.now()}` };
    }

    if (provider === "meta") {
      // Meta Cloud API: POST /{phone-number-id}/messages
      const url = `https://graph.facebook.com/v20.0/${whatsappEnv.metaPhoneId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${whatsappEnv.metaToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits, // Meta expects digits without +
          type: "text",
          text: { body: message },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`Meta API ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
      }
      return { ok: true, provider, id: data?.messages?.[0]?.id || `meta_${Date.now()}` };
    }

    if (provider === "twilio") {
      // Twilio API: POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
      const url = `https://api.twilio.com/2010-04-01/Accounts/${whatsappEnv.twilioSid}/Messages.json`;
      const from = whatsappEnv.twilioFrom.startsWith("whatsapp:") ? whatsappEnv.twilioFrom : `whatsapp:${whatsappEnv.twilioFrom}`;
      const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      const params = new URLSearchParams({
        From: from,
        To: toFormatted,
        Body: message,
      });
      const auth = Buffer.from(`${whatsappEnv.twilioSid}:${whatsappEnv.twilioToken}`).toString("base64");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: params.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`Twilio ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
      }
      return { ok: true, provider, id: data?.sid || `tw_${Date.now()}` };
    }

    if (provider === "ultramsg") {
      // UltraMsg: POST https://api.ultramsg.com/{instance}/messages/chat
      const url = `https://api.ultramsg.com/${whatsappEnv.ultramsgInstance}/messages/chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: whatsappEnv.ultramsgToken,
          to: digits,
          body: message,
        }).toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.sent === "false") {
        throw new Error(`UltraMsg failed: ${JSON.stringify(data).slice(0, 500)}`);
      }
      return { ok: true, provider, id: data?.id || `ultra_${Date.now()}` };
    }

    // none / dev mode: just log and return ok as dev
    // In dev, we still want to show wa.me link in admin panel
    return { ok: true, provider: "dev", id: `dev_${Date.now()}` };
  } catch (err: any) {
    console.error(`[whatsapp] send failed via ${provider}:`, err?.message || err);
    return { ok: false, provider, error: err?.message || String(err) };
  }
}

export function buildWaMeLink(toRaw: string, message: string): string {
  const digits = getDigitsOnly(normalizePhone(toRaw));
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ------------------------------------------------------------------
// High-level producer notification helpers
// ------------------------------------------------------------------

export type OrderNotificationData = {
  reference: string;
  beatTitle: string;
  beatGenre?: string;
  licenseName?: string;
  amount: string;
  currency: string;
  method: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  bankReference?: string | null;
  status: string;
};

export function formatOrderWhatsappMessage(data: OrderNotificationData, type: "new" | "bank_submitted" | "paid" | "contact"): string {
  const app = env.appName;
  const baseUrl = env.appUrl;

  if (type === "contact") {
    return `📩 *New message from ${app} website*\n\nFrom: ${data.buyerName} <${data.buyerEmail}>\nPhone: ${data.buyerPhone || "—"}\nSubject: ${data.beatTitle}\n\n${data.licenseName || ""}\n\nReply in admin: ${baseUrl}/admin/messages`.trim();
  }

  if (type === "new") {
    return `🎵 *New booking / order* - ${app}\n\n📦 Beat: ${data.beatTitle} (${data.beatGenre || "—"})\n🎫 Licence: ${data.licenseName || "Standard"}\n💰 Amount: ${data.amount} ${data.currency}\n💳 Method: ${data.method}\n👤 Buyer: ${data.buyerName} (${data.buyerEmail})\n📞 Phone: ${data.buyerPhone || "—"}\n🔖 Ref: ${data.reference}\n📌 Status: ${data.status}\n\n👉 View: ${baseUrl}/admin/orders?ref=${data.reference}`.trim();
  }

  if (type === "bank_submitted") {
    return `🏦 *Bank/MoMo payment submitted* - ${app}\n\n📦 Beat: ${data.beatTitle}\n💰 ${data.amount} ${data.currency}\n👤 ${data.buyerName} (${data.buyerEmail})\n🔖 Ref: ${data.reference}\n🏷️ Bank ref: ${data.bankReference || "—"}\n\nPlease verify and approve: ${baseUrl}/admin/orders?ref=${data.reference}`.trim();
  }

  // paid
  return `✅ *Paid order confirmed* - ${app}\n\n📦 ${data.beatTitle} - ${data.licenseName || "Standard"}\n💰 ${data.amount} ${data.currency} via ${data.method}\n👤 ${data.buyerName} (${data.buyerEmail})\n🔖 ${data.reference}\n\nFiles delivered to buyer. View: ${baseUrl}/admin/orders?ref=${data.reference}`.trim();
}

export async function notifyProducerWhatsapp(message: string): Promise<{ ok: boolean; error?: string; waLink?: string }> {
  const to = await getProducerWhatsappNumber();
  if (!to) {
    console.warn("[whatsapp] no producer number configured (WHATSAPP_TO, site_settings whatsapp, or ADMIN_PHONE)");
    return { ok: false, error: "No producer WhatsApp number configured" };
  }

  const result = await sendWhatsapp(to, message);
  const waLink = buildWaMeLink(to, message);

  if (!result.ok) {
    console.error("[whatsapp] notifyProducer failed:", result.error);
    // Still return wa.me link so admin can manually click
    return { ok: false, error: result.error, waLink };
  }

  return { ok: true, waLink };
}

export async function notifyProducerOrder(data: OrderNotificationData, type: "new" | "bank_submitted" | "paid"): Promise<void> {
  if (!isWhatsappConfigured()) {
    console.log("[whatsapp] not configured, skipping order notification");
    return;
  }
  const msg = formatOrderWhatsappMessage(data, type);
  // Fire and forget, but log
  notifyProducerWhatsapp(msg).then((res) => {
    if (res.ok) console.log(`[whatsapp] order ${data.reference} ${type} notified OK`);
    else console.warn(`[whatsapp] order ${data.reference} ${type} failed: ${res.error}, waLink: ${res.waLink}`);
  }).catch((err) => {
    console.error("[whatsapp] notifyProducerOrder error:", err);
  });
}

export async function notifyProducerContact(data: { name: string; email: string; phone?: string; subject: string; message: string }): Promise<void> {
  if (!isWhatsappConfigured()) return;
  const msg = formatOrderWhatsappMessage({
    reference: "",
    beatTitle: data.subject,
    licenseName: data.message.slice(0, 300),
    amount: "",
    currency: "",
    method: "contact",
    buyerName: data.name,
    buyerEmail: data.email,
    buyerPhone: data.phone || null,
    status: "contact",
  }, "contact");
  notifyProducerWhatsapp(msg).catch(() => {});
}
