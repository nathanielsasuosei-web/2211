/**
 * Accent-colour (theme) system — isomorphic, no Node APIs, safe to import
 * from both server and client bundles.
 *
 * A single accent hex drives the whole UI: buttons, glows, hero canvas,
 * focus rings, the glass navbar hairline, even the outgoing emails.
 *
 * The palette is derived from one base colour:
 *   accent  — the base colour itself            (≈ red-600)
 *   bright  — base mixed toward white, vivid    (≈ red-500, .red text, gradients)
 *   hot     — lighter tint                      (≈ red-400, prices, hovers)
 *   soft    — pale tint                         (≈ red-300, eyebrows, outlines)
 *   deep    — base mixed toward black           (≈ red-700, gradient ends)
 *   rgb     — "r, g, b" triplet for rgba() usage
 *
 * The admin sets the store-wide default (Admin → Settings → Accent colour,
 * or ACCENT_COLOR in .env). Visitors can override it per-browser with the
 * palette button in the navbar; the choice is applied before first paint by
 * an inline init script (see themeInitScript) so there is no colour flash.
 */

export const DEFAULT_ACCENT = "#e10600";
export const THEME_STORAGE_KEY = "2211beats:accent";
export const THEME_EVENT = "2211beats:themechange";

export type AccentPalette = {
  accent: string;
  bright: string;
  hot: string;
  soft: string;
  deep: string;
  /** "r, g, b" triplet, for use inside rgba(var(--accent-rgb), …) */
  rgb: string;
};

/**
 * NOTE: keep this function fully self-contained (no imports, no closures over
 * module state). Its source is inlined verbatim into the pre-hydration init
 * script via Function#toString, so it must run standalone in the browser.
 */
export function accentPalette(input: string | null | undefined): AccentPalette {
  var hex = (input || "").trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) hex = "#e10600";
  if (hex.length === 4) {
    hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);

  function mix(tr: number, tg: number, tb: number, amount: number): string {
    // amount = fraction of the target colour (white or black)
    var mr = Math.round(tr + (255 - tr) * amount);
    var mg = Math.round(tg + (255 - tg) * amount);
    var mb = Math.round(tb + (255 - tb) * amount);
    return (
      "#" +
      ("0" + Math.max(0, Math.min(255, mr)).toString(16)).slice(-2) +
      ("0" + Math.max(0, Math.min(255, mg)).toString(16)).slice(-2) +
      ("0" + Math.max(0, Math.min(255, mb)).toString(16)).slice(-2)
    );
  }
  function mixBlack(amount: number): string {
    var mr = Math.round(r * (1 - amount));
    var mg = Math.round(g * (1 - amount));
    var mb = Math.round(b * (1 - amount));
    return (
      "#" +
      ("0" + Math.max(0, Math.min(255, mr)).toString(16)).slice(-2) +
      ("0" + Math.max(0, Math.min(255, mg)).toString(16)).slice(-2) +
      ("0" + Math.max(0, Math.min(255, mb)).toString(16)).slice(-2)
    );
  }

  return {
    accent: hex,
    bright: mix(r, g, b, 0.22),
    hot: mix(r, g, b, 0.38),
    soft: mix(r, g, b, 0.62),
    deep: mixBlack(0.38),
    rgb: r + ", " + g + ", " + b,
  };
}

/** Validates/normalises any user input to a #rrggbb hex, falling back to the default. */
export function normalizeAccent(input: string | null | undefined): string {
  return accentPalette(input).accent;
}

/** CSS custom properties for a given accent — spread onto an element's style. */
export function themeCssVars(input: string | null | undefined): Record<string, string> {
  const p = accentPalette(input);
  return {
    "--accent": p.accent,
    "--accent-bright": p.bright,
    "--accent-hot": p.hot,
    "--accent-soft": p.soft,
    "--accent-deep": p.deep,
    "--accent-rgb": p.rgb,
    "--accent-glow": `rgba(${p.rgb}, 0.45)`,
  };
}

/** Curated swatches for the visitor picker + the admin settings form. */
export const ACCENT_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Crimson", hex: "#e10600" },
  { name: "Sunset", hex: "#ff6a00" },
  { name: "Gold", hex: "#eab308" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Silver", hex: "#9ca3af" },
];

/* ------------------------------------------------------------------ */
/* Browser-side helpers (no-ops on the server)                         */
/* ------------------------------------------------------------------ */

export function getStoredAccent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAccent(hex: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (hex) window.localStorage.setItem(THEME_STORAGE_KEY, normalizeAccent(hex));
    else window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* private mode etc. — theme just won't persist */
  }
}

/** Applies an accent to the document root and notifies listeners (hero canvas…). */
export function applyAccent(hex: string): string {
  const normalized = normalizeAccent(hex);
  if (typeof document !== "undefined") {
    const vars = themeCssVars(normalized);
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value);
    }
    document.documentElement.dispatchEvent(
      new CustomEvent(THEME_EVENT, { detail: { accent: normalized } }),
    );
  }
  return normalized;
}

/**
 * Inline script rendered before hydration: if the visitor picked a custom
 * accent, apply it immediately so the first paint already uses it (no flash
 * of the default colour). The palette function source is inlined via
 * Function#toString so there is exactly one implementation.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=null;try{s=window.localStorage.getItem(k);}catch(e){}if(!s)return;var p=(${accentPalette.toString()})(s);var v={"--accent":p.accent,"--accent-bright":p.bright,"--accent-hot":p.hot,"--accent-soft":p.soft,"--accent-deep":p.deep,"--accent-rgb":p.rgb,"--accent-glow":"rgba("+p.rgb+", 0.45)"};var d=document.documentElement;for(var key in v){d.style.setProperty(key,v[key]);}}catch(e){}})();`;

/* ------------------------------------------------------------------ */
/* Colour maths + smooth accent transitions                            */
/* ------------------------------------------------------------------ */

export function hexToRgb(hex: string | null | undefined): [number, number, number] {
  let h = (hex || "").trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(h)) h = DEFAULT_ACCENT;
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Blend two hex colours, t = 0 → a, t = 1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

/** Hue/saturation/lightness of a hex colour — h in degrees, s/l in percent. */
export function hexToHsl(hex: string | null | undefined): { h: number; s: number; l: number } {
  const [r0, g0, b0] = hexToRgb(hex);
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Inverse of hexToHsl. */
export function hslToHex(h: number, s: number, l: number): string {
  const H = ((h % 360) + 360) % 360;
  const S = Math.max(0, Math.min(100, s)) / 100;
  const L = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let r = 0, g = 0, b = 0;
  if (H < 60) { r = c; g = x; b = 0; }
  else if (H < 120) { r = x; g = c; b = 0; }
  else if (H < 180) { r = 0; g = c; b = x; }
  else if (H < 240) { r = 0; g = x; b = c; }
  else if (H < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Accent tween — the whole store glides to a new colour instead of snapping.
 *
 * CSS can't transition the `--accent-*` custom properties (the derived
 * gradients and canvas colours are not transitionable either), so we
 * interpolate the hex ourselves over ~1 frame each and re-apply. Every
 * consumer — buttons, glows, hero 3D, navbar hairline, body bloom — follows
 * along because they all read the same variables.
 */
let accentTween: number | null = null;

export function tweenAccent(to: string, ms = 520): void {
  if (typeof document === "undefined") return;
  const target = normalizeAccent(to);
  if (accentTween !== null) {
    cancelAnimationFrame(accentTween);
    accentTween = null;
  }
  const fromHex =
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || DEFAULT_ACCENT;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || normalizeAccent(fromHex) === target || ms <= 0) {
    applyAccent(target);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    applyAccent(mixHex(fromHex, target, eased));
    if (p < 1) accentTween = requestAnimationFrame(step);
    else {
      applyAccent(target);
      accentTween = null;
    }
  };
  accentTween = requestAnimationFrame(step);
}
