/**
 * Deterministic SVG cover-art generator — dark/red artwork per beat,
 * no image assets or network needed.
 */
import { makeRandom } from "./wav.mjs";

const PALETTES = [
  ["#ff1f1f", "#7a0300", "#15010a"],
  ["#ff3b30", "#a30d0d", "#0b0b0d"],
  ["#e10600", "#4a0404", "#100407"],
  ["#ff5a4e", "#8c0f0f", "#0d0a0f"],
  ["#f43f5e", "#7f1d1d", "#0a0a0c"],
];

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * @param {{title:string, genre?:string, bpm?:number, musicalKey?:string, seed?:number, producer?:string, size?:number}} opts
 */
export function coverArtSvg({ title, genre = "", bpm, musicalKey = "", seed = 1, producer = "2211 BEATS", size = 1000 }) {
  const random = makeRandom(seed * 7919 + 13);
  const [hot, mid, dark] = PALETTES[Math.floor(random() * PALETTES.length)];
  const bars = 46;
  const barWidth = size / bars;
  const wave = Array.from({ length: bars }, (_, i) => {
    const base = Math.sin((i / bars) * Math.PI * (1.4 + random())) * 0.5 + 0.5;
    return 0.18 + base * (0.42 + random() * 0.4);
  });

  const shapes = Array.from({ length: 7 }, () => ({
    cx: Math.round(random() * size),
    cy: Math.round(random() * size),
    r: Math.round(60 + random() * 240),
    o: (0.05 + random() * 0.14).toFixed(3),
  }));

  const gridLines = Array.from({ length: 9 }, (_, i) => Math.round((size / 9) * (i + 1)));
  const badge = [bpm ? `${bpm} BPM` : null, musicalKey || null].filter(Boolean).join(" · ");
  const uid = `art${seed}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(title)} cover art">
  <defs>
    <linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/>
      <stop offset="55%" stop-color="#120407"/>
      <stop offset="100%" stop-color="#050506"/>
    </linearGradient>
    <radialGradient id="${uid}-glow" cx="30%" cy="22%" r="78%">
      <stop offset="0%" stop-color="${hot}" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="${mid}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${uid}-wave" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${hot}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#ff8f86" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="${uid}-soft"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>

  <rect width="${size}" height="${size}" fill="url(#${uid}-bg)"/>
  <rect width="${size}" height="${size}" fill="url(#${uid}-glow)"/>

  ${shapes
    .map(
      (s) =>
        `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${hot}" opacity="${s.o}" filter="url(#${uid}-soft)"/>`,
    )
    .join("\n  ")}

  <g stroke="#ffffff" stroke-opacity="0.045" stroke-width="1">
    ${gridLines.map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="${size}"/>`).join("")}
    ${gridLines.map((y) => `<line x1="0" y1="${y}" x2="${size}" y2="${y}"/>`).join("")}
  </g>

  <g>
    ${wave
      .map((h, i) => {
        const height = Math.round(h * size * 0.42);
        const x = Math.round(i * barWidth + barWidth * 0.18);
        const w = Math.max(2, Math.round(barWidth * 0.55));
        const y = Math.round(size * 0.62 - height / 2);
        return `<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="${Math.round(w / 2)}" fill="url(#${uid}-wave)" opacity="${(0.35 + h * 0.6).toFixed(2)}"/>`;
      })
      .join("\n    ")}
  </g>

  <rect x="0" y="${Math.round(size * 0.78)}" width="${size}" height="${Math.round(size * 0.22)}" fill="#050506" opacity="0.72"/>
  <text x="${Math.round(size * 0.06)}" y="${Math.round(size * 0.875)}" font-family="Impact, 'Arial Black', Haettenschweiler, sans-serif" font-size="${Math.round(size * 0.088)}" fill="#ffffff" letter-spacing="-1">${esc(title.toUpperCase().slice(0, 16))}</text>
  <text x="${Math.round(size * 0.062)}" y="${Math.round(size * 0.935)}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${Math.round(size * 0.032)}" fill="#ff9d95" letter-spacing="6">${esc(genre.toUpperCase())}${badge ? " · " + esc(badge.toUpperCase()) : ""}</text>

  <g transform="rotate(-90 ${Math.round(size * 0.955)} ${Math.round(size * 0.14)})">
    <text x="${Math.round(size * 0.955)}" y="${Math.round(size * 0.14)}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${Math.round(size * 0.03)}" fill="#ffffff" fill-opacity="0.62" letter-spacing="8">${esc(producer.toUpperCase())}</text>
  </g>

  <rect x="1" y="1" width="${size - 2}" height="${size - 2}" fill="none" stroke="${hot}" stroke-opacity="0.55" stroke-width="3"/>
</svg>`;
}

/** Wide 16:9 poster used by the Watch page. */
export function videoPosterSvg({ title, subtitle = "", seed = 1, size = [1280, 720] }) {
  const random = makeRandom(seed * 104729 + 7);
  const [w, h] = size;
  const [hot, mid, dark] = PALETTES[Math.floor(random() * PALETTES.length)];
  const bars = 60;
  const uid = `vid${seed}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/><stop offset="60%" stop-color="#0d0407"/><stop offset="100%" stop-color="#050506"/>
    </linearGradient>
    <radialGradient id="${uid}-glow" cx="70%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${hot}" stop-opacity="0.6"/><stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${uid}-bg)"/>
  <rect width="${w}" height="${h}" fill="url(#${uid}-glow)"/>
  <g>
    ${Array.from({ length: bars }, (_, i) => {
      const bh = Math.round((0.1 + random() * 0.75) * h * 0.5);
      const x = Math.round((w / bars) * i + 3);
      const bw = Math.max(3, Math.round(w / bars - 7));
      return `<rect x="${x}" y="${Math.round((h - bh) / 2)}" width="${bw}" height="${bh}" rx="${Math.round(bw / 2)}" fill="${i % 3 === 0 ? "#ffffff" : hot}" opacity="${(0.12 + random() * 0.5).toFixed(2)}"/>`;
    }).join("")}
  </g>
  <circle cx="${Math.round(w * 0.5)}" cy="${Math.round(h * 0.44)}" r="${Math.round(h * 0.09)}" fill="${hot}" opacity="0.92"/>
  <path d="M ${Math.round(w * 0.5 - h * 0.03)} ${Math.round(h * 0.44 - h * 0.05)} L ${Math.round(w * 0.5 - h * 0.03)} ${Math.round(h * 0.44 + h * 0.05)} L ${Math.round(w * 0.5 + h * 0.055)} ${Math.round(h * 0.44)} Z" fill="#0b0b0d"/>
  <text x="${Math.round(w * 0.05)}" y="${Math.round(h * 0.87)}" font-family="Impact, 'Arial Black', sans-serif" font-size="${Math.round(h * 0.085)}" fill="#fff">${esc(title.toUpperCase().slice(0, 26))}</text>
  ${subtitle ? `<text x="${Math.round(w * 0.052)}" y="${Math.round(h * 0.945)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.036)}" fill="#ff9d95" letter-spacing="4">${esc(subtitle.toUpperCase())}</text>` : ""}
</svg>`;
}

/** Small monochrome logo mark used in the header + emails. */
export function logoSvg({ size = 40, color = "#e10600" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none">
  <rect x="1.5" y="1.5" width="37" height="37" rx="11" stroke="${color}" stroke-width="2.5"/>
  <g fill="${color}">
    <rect x="9" y="16" width="3.4" height="8" rx="1.7"/>
    <rect x="15" y="11" width="3.4" height="18" rx="1.7"/>
    <rect x="21" y="7" width="3.4" height="26" rx="1.7"/>
    <rect x="27" y="14" width="3.4" height="12" rx="1.7"/>
  </g>
</svg>`;
}
