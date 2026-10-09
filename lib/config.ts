import crypto from "node:crypto";

/**
 * Central configuration. Every value has a sane default so the app runs
 * immediately; real credentials are picked up from `.env.local`.
 */
function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = str(name, "");
  if (!v) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function int(name: string, fallback: number): number {
  const v = parseInt(str(name, ""), 10);
  return Number.isFinite(v) ? v : fallback;
}

function list(name: string, fallback: string[]): string[] {
  const v = str(name, "");
  if (!v) return fallback;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: str("NODE_ENV", "development"),
  isProd: str("NODE_ENV", "development") === "production",

  appName: str("APP_NAME", "2211 BEATS"),
  appTagline: str("APP_TAGLINE", "Premium beats for serious artists"),
  appUrl: str("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  appSecret: str("APP_SECRET", "dev-secret-please-change-me-in-production-2211"),

  databaseUrl: str("DATABASE_URL", ""),
  currency: str("CURRENCY", "GHS").toUpperCase(),

  // admin seeded on first run
  adminEmail: str("ADMIN_EMAIL", "admin@2211beats.com").toLowerCase(),
  adminName: str("ADMIN_NAME", "2211 Producer"),
  adminPassword: str("ADMIN_PASSWORD", "Admin!2211"),
  adminPhone: str("ADMIN_PHONE", "+233200000000"),

  // mail
  smtp: {
    host: str("SMTP_HOST", ""),
    port: int("SMTP_PORT", 587),
    secure: bool("SMTP_SECURE", false),
    user: str("SMTP_USER", ""),
    pass: str("SMTP_PASS", ""),
  },
  mailFrom: str("MAIL_FROM", "2211 BEATS <hello@2211beats.com>"),
  mailReplyTo: str("MAIL_REPLY_TO", ""),
  adminMail: str("ADMIN_MAIL", "admin@2211beats.com"),
  supportMail: str("SUPPORT_MAIL", "hello@2211beats.com"),

  // paystack
  paystack: {
    secretKey: str("PAYSTACK_SECRET_KEY", ""),
    publicKey: str("PAYSTACK_PUBLIC_KEY", ""),
    webhookUrl: str("PAYSTACK_WEBHOOK_URL", ""),
    get enabled() {
      return Boolean(str("PAYSTACK_SECRET_KEY", ""));
    },
  },

  // m-pesa (daraja)
  mpesa: {
    environment: str("MPESA_ENV", "sandbox"),
    consumerKey: str("MPESA_CONSUMER_KEY", ""),
    consumerSecret: str("MPESA_CONSUMER_SECRET", ""),
    shortCode: str("MPESA_SHORTCODE", "174379"),
    passkey: str("MPESA_PASSKEY", ""),
    callbackUrl: str("MPESA_CALLBACK_URL", ""),
    transactionType: str("MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline"),
    get enabled() {
      return Boolean(str("MPESA_CONSUMER_KEY", "")) && Boolean(str("MPESA_CONSUMER_SECRET", ""));
    },
    get baseUrl() {
      return this.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";
    },
  },

  bank: {
    enabled: bool("BANK_ENABLED", true),
    name: str("BANK_NAME", "Ecobank Ghana"),
    accountName: str("BANK_ACCOUNT_NAME", "2211 Beats Ltd"),
    accountNumber: str("BANK_ACCOUNT_NUMBER", "1441000221199"),
    branch: str("BANK_BRANCH", "Accra Central"),
    swift: str("BANK_SWIFT", "ECOCGHAC"),
    momoName: str("BANK_MOBILE_MONEY_NAME", "MTN MoMo"),
    momoNumber: str("BANK_MOBILE_MONEY_NUMBER", "+233 20 000 0000"),
    instructions: str(
      "BANK_INSTRUCTIONS",
      "Send the exact amount, then enter the transaction reference below so we can match your payment.",
    ),
  },

  uploadDir: str("UPLOAD_DIR", "storage/uploads"),
  maxUploadMb: int("MAX_UPLOAD_MB", 400),
  demoMode: bool("DEMO_PAYMENTS", true),
  allowedCurrencies: list("ALLOWED_CURRENCIES", ["GHS", "NGN", "KES", "USD", "EUR", "GBP"]),
} as const;

export const secrets = {
  /** Deterministic, rotating-free signing helper for download links. */
  sign(payload: string): string {
    return crypto.createHmac("sha256", env.appSecret).update(payload).digest("base64url");
  },
  verify(payload: string, signature: string): boolean {
    const expected = secrets.sign(payload);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature || "");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};

/**
 * Money formatting lives in ./money so client components can share it without
 * pulling Node-only config into the browser bundle. This wrapper keeps the
 * store currency as the default for server-side call sites.
 */
import { moneyLabel as formatMoney, moneyShort as formatMoneyShort, currencySymbol } from "./money";

export { currencySymbol };

export function moneyLabel(cents: number, currency?: string): string {
  return formatMoney(cents, currency ?? env.currency);
}

export function moneyShort(cents: number, currency?: string): string {
  return formatMoneyShort(cents, currency ?? env.currency);
}
