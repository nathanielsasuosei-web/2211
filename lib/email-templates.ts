import { env } from "./config";

/**
 * Shared HTML shell for every outgoing email — red/black brand, works in
 * Gmail, Outlook and Apple Mail (tables + inline styles only).
 */

const RED = "#e10600";
const DARK = "#0b0b0d";

export function emailShell(opts: {
  title: string;
  preheader?: string;
  body: string;
  cta?: { label: string; url: string };
  footnote?: string;
}): string {
  const { title, preheader = "", body, cta, footnote } = opts;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#111114;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f5f5f7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111114;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:${DARK};border:1px solid #23232a;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(120deg, ${RED} 0%, #7a0300 55%, ${DARK} 100%);padding:26px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:22px;font-weight:800;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">
                      ${escapeHtml(env.appName)}
                    </td>
                    <td align="right" style="font-size:12px;letter-spacing:1.5px;color:#ffd9d7;text-transform:uppercase;">
                      Beat Store
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#ffffff;">${escapeHtml(title)}</h1>
                <div style="font-size:15px;line-height:1.7;color:#c9c9d2;">${body}</div>
                ${
                  cta
                    ? `<div style="margin:26px 0 6px;">
                        <a href="${escapeAttr(cta.url)}" style="display:inline-block;background:${RED};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px;">${escapeHtml(cta.label)}</a>
                       </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid #1e1e24;font-size:12px;line-height:1.7;color:#8b8b96;">
                ${footnote ?? `You are receiving this email because you have an account at ${escapeHtml(env.appName)}.`}
                <br />
                <a href="${env.appUrl}" style="color:${RED};text-decoration:none;">${env.appUrl.replace(/^https?:\/\//, "")}</a>
                &nbsp;·&nbsp;
                <a href="mailto:${env.supportMail}" style="color:${RED};text-decoration:none;">${env.supportMail}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(input: unknown): string {
  return escapeHtml(input);
}

export function paragraphs(text: string): string {
  return String(text || "")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function keyValueTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #23232a;border-radius:12px;overflow:hidden;">
    ${rows
      .map(
        ([k, v]) => `<tr>
          <td style="padding:10px 14px;background:#131318;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8b8b96;width:38%;">${escapeHtml(k)}</td>
          <td style="padding:10px 14px;font-size:14px;color:#f5f5f7;font-weight:600;">${escapeHtml(v)}</td>
        </tr>`,
      )
      .join("")}
  </table>`;
}

export function fileList(items: Array<{ label: string; url?: string; note?: string }>): string {
  if (!items.length) return "";
  return `<ul style="margin:14px 0;padding-left:20px;">
    ${items
      .map(
        (f) =>
          `<li style="margin-bottom:8px;font-size:14px;color:#e6e6ee;">
            ${f.url ? `<a href="${escapeAttr(f.url)}" style="color:#ff6a63;text-decoration:underline;">${escapeHtml(f.label)}</a>` : escapeHtml(f.label)}
            ${f.note ? `<span style="color:#8b8b96;"> — ${escapeHtml(f.note)}</span>` : ""}
          </li>`,
      )
      .join("")}
  </ul>`;
}

export function alertBox(text: string, tone: "warn" | "ok" = "warn"): string {
  const bg = tone === "ok" ? "#0f2a17" : "#2a1010";
  const border = tone === "ok" ? "#1f7a3d" : RED;
  return `<div style="margin:16px 0;padding:14px 16px;border-left:4px solid ${border};background:${bg};border-radius:8px;font-size:14px;color:#e6e6ee;">${text}</div>`;
}
