#!/usr/bin/env node
/**
 * Dev helper: rasterise the hero's 3D animatic to PNGs so the scene can be
 * reviewed without a browser (the geometry is pure canvas2D in
 * lib/hero-scene.ts, so this is the same code the site runs).
 *
 *   npm i -D @napi-rs/canvas          # optional, dev-only
 *   node scripts/hero-preview.mjs             → .hero-preview/*.png (desktop + phone)
 *   node scripts/hero-preview.mjs --accent '#0ea5e9' --shots 4 --level 0.7
 *
 * Frames are sampled at the start of every camera shot, plus a mid-transition
 * frame, so you can eyeball the whole loop in one go.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(import.meta.url);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ACCENT = arg("accent", "#e10600");
const SHOTS = Number(arg("shots", 4));
const LEVEL = Number(arg("level", 0.62));
const SCALE = Number(arg("scale", 1));
const OUT_DIR = path.join(root, ".hero-preview");
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ---- transpile the scene module (no build step needed) -------------- */
let canvas;
try {
  canvas = require("@napi-rs/canvas");
} catch {
  console.error("This preview needs the optional dev dep:  npm i -D @napi-rs/canvas");
  process.exit(1);
}
const ts = require(path.join(root, "node_modules", "typescript"));
const src = fs.readFileSync(path.join(root, "lib", "hero-scene.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = path.join(OUT_DIR, "hero-scene.cjs");
fs.writeFileSync(tmp, js);
const { createScene, renderFrame, HERO_SHOT_LABELS } = require(tmp);

/* ---- helpers -------------------------------------------------------- */
const hexToRgb = (hex) => {
  let h = String(hex).trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(h)) h = "#e10600";
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};

// a plausible groove: kick-heavy lows, airy highs
const levels = Array.from({ length: 28 }, (_, i) => {
  const low = i < 6 ? 0.9 - i * 0.05 : 0;
  const mid = i >= 6 && i < 18 ? 0.35 + Math.sin(i * 1.7) * 0.22 : 0;
  const high = i >= 18 ? 0.24 - (i - 18) * 0.012 : 0;
  return Math.max(0.05, (low + mid + high) * LEVEL);
});

function shoot(w, h, seconds, tag, playing) {
  const { createCanvas } = canvas;
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  const scene = createScene(w, h);
  const accent = hexToRgb(ACCENT);
  const dt = 1 / 60;
  for (let s = 0; s < seconds; s += dt) {
    renderFrame(ctx, scene, {
      width: w,
      height: h,
      dt,
      accent,
      idle: 0.3,
      levels: playing ? levels : null,
      pointer: { x: 0.1, y: -0.05 },
    });
  }
  // composite the (transparent) canvas over the site's ink colour
  const bg = createCanvas(w, h);
  const bctx = bg.getContext("2d");
  bctx.fillStyle = "#050507";
  bctx.fillRect(0, 0, w, h);
  bctx.drawImage(c, 0, 0);
  let out = bg;
  if (SCALE !== 1) {
    out = createCanvas(Math.round(w * SCALE), Math.round(h * SCALE));
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.drawImage(bg, 0, 0, out.width, out.height);
  }
  const file = path.join(OUT_DIR, `${tag}.png`);
  fs.writeFileSync(file, out.toBuffer("image/png"));
  console.log(`wrote ${path.relative(root, file)}  shot=${HERO_SHOT_LABELS[scene.shot] ?? scene.shot}`);
}

const perShot = 9.5;
for (let i = 0; i < SHOTS; i++) {
  shoot(1280, 640, i * perShot + 0.2, `shot-${i + 1}-start`, true);
  if (i + 1 < SHOTS) shoot(1280, 640, (i + 1) * perShot - 2.4, `shot-${i + 1}-transition`, true);
}
shoot(1280, 640, 3.1, "idle-no-audio", false);
shoot(414, 760, 1.0, "phone-shot-1", true);
shoot(414, 760, 20.0, "phone-shot-3", true);
console.log(`\n${OUT_DIR}`);
