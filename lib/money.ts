/**
 * Currency formatting shared by server and client code (no Node-only imports).
 * Server callers usually go through `moneyLabel` in `lib/config`, which defaults
 * the currency to `CURRENCY` from the environment.
 */

const SYMBOLS: Record<string, string> = {
  GHS: "GH₵",
  NGN: "₦",
  KES: "KSh",
  ZAR: "R",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function currencySymbol(currency = "GHS"): string {
  return SYMBOLS[currency?.toUpperCase()] ?? `${currency?.toUpperCase() ?? ""} `.trim();
}

export function moneyLabel(amountCents: number, currency = "GHS"): string {
  const value = (Number(amountCents) || 0) / 100;
  return `${currencySymbol(currency)}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact label for tight UI (chips, table cells): GH₵1.2k / GH₵405 */
export function moneyShort(amountCents: number, currency = "GHS"): string {
  const value = (Number(amountCents) || 0) / 100;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${currencySymbol(currency)}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${currencySymbol(currency)}${(value / 1000).toFixed(1)}k`;
  if (abs >= 1000) return `${currencySymbol(currency)}${(value / 1000).toFixed(2)}k`;
  return `${currencySymbol(currency)}${value.toFixed(Number.isInteger(value) ? 0 : 2)}`;
}
