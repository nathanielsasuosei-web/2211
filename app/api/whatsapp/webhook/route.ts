import { NextResponse, type NextRequest } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { createMessage } from "@/lib/repo";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * WhatsApp inbound webhook — receives messages from customers via WhatsApp
 * and stores them as inbound messages so the producer sees them in
 * /admin/messages (website inbox) and gets email notification.
 *
 * Supports:
 * - Meta Cloud API verification (GET hub.challenge)
 * - Meta Cloud API messages (POST)
 * - Twilio WhatsApp (POST)
 * - UltraMsg (POST)
 * - Generic custom webhook (POST {from, text, name})
 *
 * Configure WHATSAPP_WEBHOOK_URL in Meta/Twilio/UltraMsg dashboard to:
 * https://your-domain/api/whatsapp/webhook
 *
 * For Meta verification, set META_VERIFY_TOKEN env (or WHATSAPP_VERIFY_TOKEN)
 */

function verifyToken(): string {
  return process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "2211-verify";
}

// Meta verification: GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken()) {
    console.log("[whatsapp webhook] verified");
    return new NextResponse(challenge || "", { status: 200 });
  }
  // Also allow simple health check
  return NextResponse.json({ ok: true, message: "WhatsApp webhook alive", verify: "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=2211-verify&hub.challenge=123" });
}

export async function POST(req: NextRequest) {
  await ensureBootstrapped();

  let body: any = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      // try json anyway
      body = await req.json().catch(async () => {
        const t = await req.text();
        try { return JSON.parse(t); } catch { return { raw: t }; }
      });
    }
  } catch (err) {
    console.error("[whatsapp webhook] parse failed:", err);
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  console.log("[whatsapp webhook] incoming:", JSON.stringify(body).slice(0, 2000));

  try {
    // ── Meta Cloud API format ──
    // { entry: [{ changes: [{ value: { messages: [{ from, text:{body}, ... }], contacts: [...] } }] }] }
    if (body.entry) {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          const messages = value?.messages || [];
          const contacts = value?.contacts || [];
          for (const msg of messages) {
            const from = msg.from || "";
            const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || JSON.stringify(msg).slice(0, 1000);
            const contact = contacts.find((c: any) => c.wa_id === from);
            const name = contact?.profile?.name || from;
            if (text) {
              await createMessage({
                direction: "inbound",
                kind: "whatsapp",
                from_name: name,
                from_email: `${from}@whatsapp`,
                subject: `WhatsApp from ${name}`,
                body: `WhatsApp message from ${name} (${from}):\n\n${text}`,
              });
            }
          }
          // Handle statuses - ignore
        }
      }
      return NextResponse.json({ ok: true });
    }

    // ── Twilio format ──
    // Body, From, ProfileName, WaId
    if (body.Body && body.From) {
      const from = body.From.replace("whatsapp:", "");
      const name = body.ProfileName || from;
      const text = body.Body;
      await createMessage({
        direction: "inbound",
        kind: "whatsapp",
        from_name: name,
        from_email: `${from}@whatsapp`,
        subject: `WhatsApp from ${name}`,
        body: `WhatsApp from ${name} (${from}):\n\n${text}`,
      });
      // Twilio expects TwiML or empty
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // ── UltraMsg format ──
    // { data: { from, body, pushname } } or { from, body }
    if (body.data?.body || body.body) {
      const data = body.data || body;
      const from = data.from || data.phone || data.chatId || "unknown";
      const name = data.pushname || data.name || from;
      const text = data.body || data.text || data.message || "";
      if (text) {
        await createMessage({
          direction: "inbound",
          kind: "whatsapp",
          from_name: name,
          from_email: `${from}@whatsapp`,
          subject: `WhatsApp from ${name}`,
          body: `WhatsApp from ${name} (${from}):\n\n${text}`,
        });
      }
      return NextResponse.json({ ok: true });
    }

    // ── Generic custom format ──
    // { from, name, text, message, body, email }
    const from = body.from || body.phone || body.wa_id || body.WaId || "whatsapp";
    const name = body.name || body.pushname || body.profileName || from;
    const text = body.text || body.message || body.body || body.Body || "";

    if (text) {
      await createMessage({
        direction: "inbound",
        kind: "whatsapp",
        from_name: String(name),
        from_email: body.email || `${String(from).replace(/[^0-9]/g, "")}@whatsapp`,
        subject: body.subject || `WhatsApp from ${name}`,
        body: `WhatsApp from ${name} (${from}):\n\n${text}`,
      });
      // Also email admin if configured
      try {
        const { sendMail } = await import("@/lib/mail");
        const { contactNotificationEmail } = await import("@/lib/emails");
        const notify = await contactNotificationEmail({
          name: String(name),
          email: body.email || `${String(from)}@whatsapp`,
          subject: `WhatsApp: ${String(text).slice(0, 80)}`,
          message: text,
          phone: String(from),
        });
        await sendMail({ to: env.adminMail, subject: notify.subject, html: notify.html, text: notify.text });
      } catch {}
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, message: "No message text found, ignored" });
  } catch (err: any) {
    console.error("[whatsapp webhook] failed:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed" }, { status: 500 });
  }
}
