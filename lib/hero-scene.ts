/* =====================================================================
   hero-scene — the 3D scene behind the hero, as pure canvas2D drawing.

   Everything projection-related lives here (camera basis, perspective
   project, shot interpolation, painter's-algorithm depth sort, Lambert
   shading) with no DOM or React, so:
     - components/Hero3D.tsx is a thin shell that feeds it size, time,
       live audio levels, the pointer and the current --accent colour;
     - scripts/hero-preview.mjs can rasterise frames headlessly.

   The camera glides through SHOTS with a sine-eased interpolation — a
   looping storyboard animatic rather than a static background.
   ===================================================================== */

export type V3 = { x: number; y: number; z: number };

export type Shot = { label: string; pos: V3; tgt: V3; fov: number; roll: number };

/** One keyframe per camera move; the camera eases between consecutive ones. */
export const SHOTS: Shot[] = [
  {
    label: "WIDE ESTABLISH",
    pos: { x: 0.2, y: 1.85, z: 8.2 },
    tgt: { x: 0, y: 0.98, z: 0 },
    fov: 60,
    roll: 0,
  },
  {
    label: "LOW ORBIT PASS",
    pos: { x: 5.4, y: 0.55, z: 4.1 },
    tgt: { x: 0, y: 1.05, z: -0.3 },
    fov: 52,
    roll: -0.018,
  },
  {
    label: "CRANE OVER DESK",
    pos: { x: -2.6, y: 4.3, z: 5.9 },
    tgt: { x: 0, y: 0.45, z: -0.2 },
    fov: 62,
    roll: 0.014,
  },
  {
    label: "PUSH TO CORE",
    pos: { x: 1.2, y: 0.85, z: 5.6 },
    tgt: { x: 0, y: 1.62, z: 0 },
    fov: 72,
    roll: -0.01,
  },
];

export const HERO_SHOT_LABELS = SHOTS.map((s) => s.label);

const HOLD = 9.5; // seconds per shot
const SCENE_R = 3.9; // radius of the tower ring
const FLOOR_Y = -0.6;
const MAX_BARS = 36;

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** sine ease — zero velocity at every keyframe, so the glide never jerks */
const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(p, 0, 1));

type Cam = {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  ux: number; uy: number; uz: number;
  fx: number; fy: number; fz: number;
  focal: number; cx: number; cy: number; near: number;
};

/**
 * Projected point. `project` writes into a slot you hand it — allocating a
 * handful of these once and reusing them is what keeps the frame allocation
 * free, while still letting a polygon read all four of its corners at once.
 */
export type P3 = { x: number; y: number; d: number; s: number; ok: boolean };

export const p3 = (): P3 => ({ x: 0, y: 0, d: 0, s: 0, ok: false });

/** Scratch slots for single-use projections (consume the result immediately). */
const _a = p3();

function project(cam: Cam, px: number, py: number, pz: number, out: P3 = _a): P3 {
  const dx = px - cam.x;
  const dy = py - cam.y;
  const dz = pz - cam.z;
  const vz = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (vz < cam.near) {
    out.ok = false;
    return out;
  }
  const vx = dx * cam.rx + dy * cam.ry + dz * cam.rz;
  const vy = dx * cam.ux + dy * cam.uy + dz * cam.uz;
  const s = cam.focal / vz;
  out.x = cam.cx + vx * s;
  out.y = cam.cy - vy * s;
  out.d = vz;
  out.s = s;
  out.ok = true;
  return out;
}

function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number, out: number[]) {
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
}

function lookAt(
  cam: Cam,
  px: number, py: number, pz: number,
  tx: number, ty: number, tz: number,
  fovDeg: number,
  roll: number,
  width: number,
  height: number,
) {
  let fx = tx - px, fy = ty - py, fz = tz - pz;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;

  const tmp: number[] = [0, 0, 0];
  cross(fx, fy, fz, 0, 1, 0, tmp); // right = forward × worldUp
  let rx = tmp[0], ry = tmp[1], rz = tmp[2];
  const rl = Math.hypot(rx, ry, rz);
  if (rl < 1e-4) { rx = 1; ry = 0; rz = 0; } else { rx /= rl; ry /= rl; rz /= rl; }

  cross(rx, ry, rz, fx, fy, fz, tmp); // up = right × forward
  let ux = tmp[0], uy = tmp[1], uz = tmp[2];
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;

  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    cross(fx, fy, fz, rx, ry, rz, tmp);
    const nrx = rx * c + tmp[0] * s, nry = ry * c + tmp[1] * s, nrz = rz * c + tmp[2] * s;
    cross(fx, fy, fz, ux, uy, uz, tmp);
    const nux = ux * c + tmp[0] * s, nuy = uy * c + tmp[1] * s, nuz = uz * c + tmp[2] * s;
    rx = nrx; ry = nry; rz = nrz; ux = nux; uy = nuy; uz = nuz;
  }

  cam.x = px; cam.y = py; cam.z = pz;
  cam.fx = fx; cam.fy = fy; cam.fz = fz;
  cam.rx = rx; cam.ry = ry; cam.rz = rz;
  cam.ux = ux; cam.uy = uy; cam.uz = uz;
  cam.focal = height / 2 / Math.tan((fovDeg * Math.PI) / 360);
  cam.near = 0.14;
  // park the scene right of the hero copy on wide screens, centred on narrow
  const bias = width > 1020 ? 0.72 : width > 760 ? 0.67 : 0.5;
  cam.cx = width * bias;
  cam.cy = height * (width > 760 ? 0.57 : 0.49);
}

/** Octahedron (the gem core). */
const GEM_V: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const GEM_F: [number, number, number][] = [
  [0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0],
  [0, 3, 5], [5, 3, 1], [1, 3, 4], [4, 3, 0],
];
const GEM_E: [number, number][] = [
  [0, 4], [4, 1], [1, 5], [5, 0],
  [2, 0], [2, 4], [2, 1], [2, 5],
  [3, 0], [3, 4], [3, 1], [3, 5],
];

export type SceneParams = {
  width: number;
  height: number;
  /** seconds since the last frame (clamped by the caller) */
  dt: number;
  /** target accent, 0-255 rgb — the scene eases toward it */
  accent: [number, number, number];
  /** 0..1 base intensity when nothing is playing */
  idle: number;
  /** live analyser levels (0..1); null when nothing is playing */
  levels: number[] | null;
  /** -0.5..0.5 normalised pointer offset */
  pointer: { x: number; y: number };
  reduce?: boolean;
};

export type Scene = {
  t: number;
  shot: number;
  cam: Cam;
  cur: [number, number, number];
  /** damped pointer offset — the target arrives through SceneParams.pointer */
  ptr: { x: number; y: number };
  bars: { a: number; h: number; v: number; d: number }[];
  order: number[];
  dust: { x: number; y: number; z: number; r: number; o: number; w: number }[];
  waves: { r: number; life: number }[];
  bassAvg: number;
  lastWave: number;
  barCount: number;
  small: boolean;
  primed: boolean;
};

export function createScene(width: number, height: number): Scene {
  const small = width < 720;
  const bars = Array.from({ length: MAX_BARS }, () => ({ a: 0, h: 0.2, v: 0, d: 0 }));
  return {
    t: 0,
    shot: -1,
    cam: {
      x: 0, y: 2, z: 9, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0,
      fx: 0, fy: 0, fz: -1, focal: 600, cx: 0, cy: 0, near: 0.14,
    },
    cur: [225, 6, 0],
    ptr: { x: 0, y: 0 },
    bars,
    order: Array.from({ length: MAX_BARS }, (_, i) => i),
    dust: Array.from({ length: small ? 60 : 110 }, () => ({
      x: (Math.random() - 0.5) * 26,
      y: FLOOR_Y + Math.random() * 9,
      z: (Math.random() - 0.5) * 26,
      r: 0.35 + Math.random() * 1.6,
      o: 0.1 + Math.random() * 0.42,
      w: 0.1 + Math.random() * 0.5,
    })),
    waves: [],
    bassAvg: 0,
    lastWave: -1,
    barCount: small ? 24 : MAX_BARS,
    small,
    primed: false,
  };
}

/** Re-derive the resolution-dependent parts of the scene. */
export function sizeScene(scene: Scene, width: number, height: number) {
  scene.small = width < 720;
  scene.barCount = scene.small ? 24 : MAX_BARS;
  void height;
}

/**
 * Advance the scene by `dt` and paint one frame.
 * Returns the shot index the camera is now travelling into.
 */
export function renderFrame(ctx: CanvasRenderingContext2D, scene: Scene, p: SceneParams): number {
  const { width, height, dt, idle, levels } = p;
  const reduce = !!p.reduce;
  const cam = scene.cam;

  if (!width || !height) return scene.shot;

  scene.t += dt * (reduce ? 0.18 : 1);
  const t = scene.t;

  // ease the accent rather than snapping to it
  const kA = Math.min(1, dt * 5.5);
  if (!scene.primed) {
    scene.cur = [p.accent[0], p.accent[1], p.accent[2]];
    scene.primed = true;
  } else {
    scene.cur[0] = lerp(scene.cur[0], p.accent[0], kA);
    scene.cur[1] = lerp(scene.cur[1], p.accent[1], kA);
    scene.cur[2] = lerp(scene.cur[2], p.accent[2], kA);
  }
  const R = scene.cur[0], G = scene.cur[1], B = scene.cur[2];
  const lit = (m: number): [number, number, number] => [R + (255 - R) * m, G + (255 - G) * m, B + (255 - B) * m];
  const dark = (m: number): [number, number, number] => [R * (1 - m), G * (1 - m), B * (1 - m)];
  const col = (r: number, g: number, b: number, a: number) =>
    `rgba(${clamp(r, 0, 255) | 0}, ${clamp(g, 0, 255) | 0}, ${clamp(b, 0, 255) | 0}, ${clamp(a, 0, 1).toFixed(3)})`;

  const small = scene.small;
  const barCount = scene.barCount;
  const bars = scene.bars;
  const order = scene.order;
  const waves = scene.waves;
  const keyX = 0.5, keyY = 0.72, keyZ = -0.48;

  /** reusable projection slots — one per polygon corner */
  const _q: P3[] = [p3(), p3(), p3(), p3()];

  /* --- camera: eased glide through the shot list ------------------ */
  const pk = Math.min(1, dt * 3);
  scene.ptr.x = lerp(scene.ptr.x, p.pointer.x, pk);
  scene.ptr.y = lerp(scene.ptr.y, p.pointer.y, pk);

  let idx = 1; // reduced motion pins the camera on SHOTS[0] (wide establish)
  let local = 0;
  if (!reduce) {
    const seg = ((t % (SHOTS.length * HOLD)) / HOLD);
    idx = (Math.floor(seg) + 1) % SHOTS.length;
    local = seg - Math.floor(seg);
  }
  const from = SHOTS[(idx - 1 + SHOTS.length) % SHOTS.length];
  const to = SHOTS[idx];
  const e = easeInOut(local);
  const drift = reduce ? 0 : 1;

  const cpx = lerp(from.pos.x, to.pos.x, e) + (reduce ? 0 : scene.ptr.x * -1.6) + Math.sin(t * 0.31) * 0.14 * drift;
  const cpy = lerp(from.pos.y, to.pos.y, e) + (reduce ? 0 : scene.ptr.y * -0.75) + Math.sin(t * 0.23 + 1.1) * 0.09 * drift;
  const cpz = lerp(from.pos.z, to.pos.z, e) + Math.sin(t * 0.17) * 0.1 * drift;
  const ctx0 = lerp(from.tgt.x, to.tgt.x, e);
  const cty = lerp(from.tgt.y, to.tgt.y, e);
  const ctz = lerp(from.tgt.z, to.tgt.z, e);
  const fov = lerp(from.fov, to.fov, e) + Math.sin(t * 0.43) * 0.8 * drift;
  const roll = lerp(from.roll, to.roll, e) + Math.sin(t * 0.19) * 0.0035 * drift;

  lookAt(cam, cpx, cpy, cpz, ctx0, cty, ctz, fov, roll, width, height);

  const liveIdx = reduce ? 0 : idx;
  scene.shot = liveIdx;

  /* --- audio energy ---------------------------------------------- */
  const lv = levels && levels.length ? levels : null;
  let energy = idle;
  if (lv) {
    let sum = 0;
    for (let i = 0; i < lv.length; i++) sum += lv[i];
    energy = clamp(sum / lv.length, 0, 1);
  }
  let bass: number;
  if (lv) {
    const n = Math.min(6, lv.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += lv[i];
    bass = s / n;
  } else {
    bass = idle * 0.8 + Math.sin(t * 1.9) * 0.15 + Math.sin(t * 0.77) * 0.08;
  }
  bass = clamp(bass, 0, 1);
  const kick = bass - scene.bassAvg;
  scene.bassAvg = lerp(scene.bassAvg, bass, Math.min(1, dt * 6));

  if (!reduce && kick > 0.085 && t - scene.lastWave > 0.4) {
    scene.lastWave = t;
    waves.push({ r: 0.5, life: 1 });
    if (waves.length > 5) waves.shift();
  }

  const ampOf = (i: number) => {
    if (lv) return lv[Math.floor((i / barCount) * lv.length)] ?? 0.06;
    // procedural groove: detuned sines so idle motion never looks looped
    const a = (i / barCount) * TAU;
    return (
      (Math.sin(t * 2.1 + a * 3) * 0.5 + 0.5) * 0.36 +
      (Math.sin(t * 1.31 + a * 5.7) * 0.5 + 0.5) * 0.22 +
      (Math.sin(t * 3.13 - a * 2) * 0.5 + 0.5) * 0.14
    );
  };

  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* --- horizon bloom --------------------------------------------- */
  const far = project(cam, cam.x, FLOOR_Y, cam.z - 500);
  const hy = far.ok ? far.y : cam.cy;
  const bloom = ctx.createRadialGradient(cam.cx, hy, 0, cam.cx, hy, Math.max(width, height) * 0.7);
  bloom.addColorStop(0, col(R, G, B, 0.26 + energy * 0.26));
  const [d1, d2, d3] = dark(0.45);
  bloom.addColorStop(0.36, col(d1, d2, d3, 0.1 + energy * 0.1));
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);

  /* --- perspective floor grid ------------------------------------ */
  const EXT = 16;
  const STEP = 1.7;
  for (let g = -EXT; g <= EXT; g += STEP) {
    const a1 = project(cam, g, FLOOR_Y, 7, _q[0]);
    const a2 = project(cam, g, FLOOR_Y, -EXT, _q[1]);
    if (a1.ok && a2.ok) {
      const pulse = 0.5 + 0.5 * Math.sin(Math.abs(g) * 0.5 - t * 1.7);
      const [lr, lg, lb] = lit(0.12);
      ctx.strokeStyle = col(lr, lg, lb, 0.075 + pulse * 0.19 * (0.5 + energy));
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
    }
    const b1 = project(cam, -EXT, FLOOR_Y, g * 0.8, _q[0]);
    const b2 = project(cam, EXT, FLOOR_Y, g * 0.8, _q[1]);
    if (b1.ok && b2.ok) {
      const fade = clamp(1 - (b1.d + b2.d) / 60, 0, 1);
      const ripple = 0.5 + 0.5 * Math.sin(Math.abs(g) * 0.7 - t * 2.4);
      const [lr, lg, lb] = lit(0.06);
      ctx.strokeStyle = col(lr, lg, lb, (0.05 + ripple * 0.17 * (0.4 + energy)) * fade);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
    }
  }

  /* --- atmospheric haze band on the horizon ---------------------- */
  const fog = ctx.createLinearGradient(0, hy - height * 0.1, 0, hy + height * 0.22);
  fog.addColorStop(0, "rgba(5,5,7,0)");
  fog.addColorStop(0.34, "rgba(5,5,7,0.5)");
  fog.addColorStop(1, "rgba(5,5,7,0)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, hy - height * 0.1, width, height * 0.32);

  /* --- floor shockwaves ------------------------------------------ */
  for (let i = waves.length - 1; i >= 0; i--) {
    const wv = waves[i];
    wv.r += dt * 6.4;
    wv.life -= dt * 0.6;
    if (wv.life <= 0) { waves.splice(i, 1); continue; }
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= 46; s++) {
      const a = (s / 46) * TAU;
      const q = project(cam, Math.cos(a) * wv.r, FLOOR_Y + 0.015, Math.sin(a) * wv.r);
      if (!q.ok) { started = false; continue; }
      if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
    }
    const [wr, wg, wb] = lit(0.3);
    ctx.strokeStyle = col(wr, wg, wb, 0.28 * wv.life * (0.4 + bass));
    ctx.lineWidth = 1 + 2.6 * wv.life;
    ctx.stroke();
  }

  /* --- equaliser towers ------------------------------------------- */
  const ringR = SCENE_R + bass * 0.18;
  const easeK = Math.min(1, dt * (lv ? 17 : 5.5));
  for (let i = 0; i < MAX_BARS; i++) {
    const b = bars[i];
    if (i >= barCount) {
      b.d = 1e9; // parked beyond any real depth → sorts out of the visible slice
      continue;
    }
    b.a = (i / barCount) * TAU + t * 0.05;
    const target = 0.15 + ampOf(i) * (small ? 1.75 : 2.35) * (0.76 + energy * 0.55);
    b.v = Math.max(0, target - b.h);
    b.h = lerp(b.h, target, easeK);
    const q = project(cam, Math.sin(b.a) * ringR, FLOOR_Y, Math.cos(b.a) * ringR);
    b.d = q.ok ? q.d : 1e9;
  }
  order.sort((a, b) => bars[b].d - bars[a].d);

  const halfW = small ? 0.16 : 0.2;
  const lx = [-halfW, halfW, halfW, -halfW];
  const lz = [-halfW, -halfW, halfW, halfW];
  const wx: number[] = [0, 0, 0, 0];
  const wz: number[] = [0, 0, 0, 0];

  for (let oi = 0; oi < barCount; oi++) {
    const b = bars[order[oi]];
    const h = b.h;
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    const ccx = sa * ringR, ccz = ca * ringR;
    for (let c = 0; c < 4; c++) {
      wx[c] = ccx + lx[c] * ca + lz[c] * sa;
      wz[c] = ccz - lx[c] * sa + lz[c] * ca;
    }
    const bright = clamp(h / 1.9, 0, 1);
    const glow = bright * 0.6 + b.v * 2.2;
    // one gradient per tower, shared by its visible faces: dark at the floor,
    // hot toward the cap — this is what sells the volume
    const capY = FLOOR_Y + h;
    const g0 = project(cam, ccx, FLOOR_Y, ccz, _q[0]);
    const g1 = project(cam, ccx, capY, ccz, _q[1]);
    let body: string | CanvasGradient = "";
    if (g0.ok && g1.ok && Math.abs(g1.y - g0.y) > 1) {
      const grad = ctx.createLinearGradient(g0.x, g0.y, g1.x, g1.y);
      const [br0, bg0, bb0] = dark(0.86);
      const [br1, bg1, bb1] = dark(1 - (0.3 + 0.42 * bright));
      grad.addColorStop(0, col(br0, bg0, bb0, 0.26));
      grad.addColorStop(0.55, col(br1, bg1, bb1, 0.62));
      grad.addColorStop(1, col(br1 + 26, bg1 + 10, bb1 + 8, 0.8));
      body = grad;
    }

    for (let c = 0; c < 4; c++) {
      const n = (c + 1) % 4;
      // outward normal = face midpoint direction from the bar axis (exact for a box)
      const nx = (wx[c] + wx[n]) * 0.5 - ccx;
      const nz = (wz[c] + wz[n]) * 0.5 - ccz;
      const nl = Math.hypot(nx, nz) || 1;
      const nnx = nx / nl, nnz = nz / nl;
      if (nnx * (cam.x - ccx) + nnz * (cam.z - ccz) <= 0) continue; // backface
      const lam = clamp(nnx * keyX + nnz * keyZ + keyY * 0.5, 0, 1);
      const shade = 0.34 + lam * 0.6;
      const p1 = project(cam, wx[c], FLOOR_Y, wz[c], _q[0]); if (!p1.ok) continue;
      const p2 = project(cam, wx[n], FLOOR_Y, wz[n], _q[1]); if (!p2.ok) continue;
      const p3t = project(cam, wx[n], FLOOR_Y + h, wz[n], _q[2]); if (!p3t.ok) continue;
      const p4 = project(cam, wx[c], FLOOR_Y + h, wz[c], _q[3]); if (!p4.ok) continue;
      const fogK = clamp(1 - (p1.d - 2.5) / 30, 0.25, 1);
      const [sr, sg, sb] = dark(1 - shade);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3t.x, p3t.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      // lit faces get the gradient, unlit side faces stay flat and dark
      ctx.fillStyle =
        body && lam > 0.34 ? body : col(sr + glow * 74, sg + glow * 26, sb + glow * 24, 0.7 * fogK);
      ctx.fill();
      const [er, eg, eb] = lit(0.28 + glow * 0.55);
      ctx.strokeStyle = col(er, eg, eb, 0.5 * fogK);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p4.x, p4.y);
      ctx.lineTo(p3t.x, p3t.y);
      ctx.stroke();
    }

    // glowing cap
    const q1 = project(cam, wx[0], FLOOR_Y + h, wz[0], _q[0]);
    const q2 = project(cam, wx[1], FLOOR_Y + h, wz[1], _q[1]);
    const q3 = project(cam, wx[2], FLOOR_Y + h, wz[2], _q[2]);
    const q4 = project(cam, wx[3], FLOOR_Y + h, wz[3], _q[3]);
    if (q1.ok && q2.ok && q3.ok && q4.ok) {
      const fogK = clamp(1 - (q1.d - 2.5) / 30, 0.3, 1);
      ctx.beginPath();
      ctx.moveTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.lineTo(q3.x, q3.y);
      ctx.lineTo(q4.x, q4.y);
      ctx.closePath();
      const [tr, tg, tb] = lit(0.24 + bright * 0.62);
      ctx.fillStyle = col(tr, tg, tb, (0.44 + bright * 0.5) * fogK);
      ctx.fill();
      const [rr, rg, rb] = lit(0.7 + bright * 0.3);
      ctx.strokeStyle = col(rr, rg, rb, 0.9 * fogK);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (bright > 0.4) {
        const mx = (q1.x + q2.x + q3.x + q4.x) / 4;
        const my = (q1.y + q2.y + q3.y + q4.y) / 4;
        const shaft = ctx.createLinearGradient(mx, my, mx, my - 40);
        shaft.addColorStop(0, col(tr, tg, tb, 0.18 * fogK * bright));
        shaft.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = shaft;
        ctx.fillRect(mx - 8, my - 40, 16, 40);
      }
    }
  }

  /* --- gem core ---------------------------------------------------- */
  const gemY = 2.28 + Math.sin(t * 0.72) * 0.1;
  const gemR = (small ? 0.52 : 0.64) * (1 + scene.bassAvg * 0.34);
  const yaw = t * 0.34;
  const pitch = 0.32 + Math.sin(t * 0.24) * 0.3;
  const cY = Math.cos(yaw), sY = Math.sin(yaw);
  const cX = Math.cos(pitch), sX = Math.sin(pitch);
  const gx: number[] = new Array(6).fill(0);
  const gy: number[] = new Array(6).fill(0);
  const gz: number[] = new Array(6).fill(0);
  const gpx: number[] = new Array(6).fill(0);
  const gpy: number[] = new Array(6).fill(0);
  const gok: boolean[] = new Array(6).fill(false);
  for (let i = 0; i < 6; i++) {
    const v = GEM_V[i];
    const ax = v[0] * gemR, ay = v[1] * gemR, az = v[2] * gemR;
    const bx = ax * cY + az * sY;
    const bz = -ax * sY + az * cY;
    const by = ay * cX - bz * sX;
    const bz2 = ay * sX + bz * cX;
    gx[i] = bx; gy[i] = gemY + by; gz[i] = bz2;
    const q = project(cam, gx[i], gy[i], gz[i]);
    gpx[i] = q.x; gpy[i] = q.y; gok[i] = q.ok;
  }
  for (let f = 0; f < GEM_F.length; f++) {
    const [a, b, c] = GEM_F[f];
    if (!gok[a] || !gok[b] || !gok[c]) continue;
    // screen-space winding → cheap, exact backface cull for a convex solid
    const area = (gpx[b] - gpx[a]) * (gpy[c] - gpy[a]) - (gpy[b] - gpy[a]) * (gpx[c] - gpx[a]);
    const front = area > 0;
    const ex1 = gx[b] - gx[a], ey1 = gy[b] - gy[a], ez1 = gz[b] - gz[a];
    const ex2 = gx[c] - gx[a], ey2 = gy[c] - gy[a], ez2 = gz[c] - gz[a];
    const nx = ey1 * ez2 - ez1 * ey2, ny = ez1 * ex2 - ex1 * ez2, nz = ex1 * ey2 - ey1 * ex2;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = clamp((nx * keyX + ny * keyY + nz * keyZ) / nl, 0, 1) * (front ? 1 : 0.24);
    const [fr, fg, fb] = lit(0.12 + lam * 0.5);
    ctx.beginPath();
    ctx.moveTo(gpx[a], gpy[a]);
    ctx.lineTo(gpx[b], gpy[b]);
    ctx.lineTo(gpx[c], gpy[c]);
    ctx.closePath();
    ctx.fillStyle = col(fr, fg, fb, front ? 0.3 + lam * 0.42 : 0.1 + lam * 0.2);
    ctx.fill();
  }
  ctx.beginPath();
  for (let eidx = 0; eidx < GEM_E.length; eidx++) {
    const [a, b] = GEM_E[eidx];
    if (!gok[a] || !gok[b]) continue;
    ctx.moveTo(gpx[a], gpy[a]);
    ctx.lineTo(gpx[b], gpy[b]);
  }
  const [er2, eg2, eb2] = lit(0.62);
  ctx.strokeStyle = col(er2, eg2, eb2, 0.66);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const core = project(cam, 0, gemY, 0);
  if (core.ok) {
    const rad = Math.max(26, core.s * gemR * 2.6);
    const g2 = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, rad);
    const [c1, c2, c3] = lit(0.55);
    g2.addColorStop(0, col(c1, c2, c3, 0.3 + scene.bassAvg * 0.4));
    g2.addColorStop(0.5, col(R, G, B, 0.14 + scene.bassAvg * 0.16));
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(core.x, core.y, rad, 0, TAU);
    ctx.fill();
  }

  /* --- orbit rings ------------------------------------------------- */
  for (let ring = 0; ring < 3; ring++) {
    const rr = 2.35 + ring * 0.62;
    const spin = t * (ring % 2 === 0 ? 1 : -1) * (0.28 + ring * 0.13);
    const tilt = 0.4 + ring * 0.26 + Math.sin(t * 0.21 + ring) * 0.1;
    const cS = Math.cos(spin), sS = Math.sin(spin);
    const cT = Math.cos(tilt), sT = Math.sin(tilt);
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= 56; s++) {
      const a = (s / 56) * TAU;
      const vx0 = Math.cos(a) * rr, vz0 = Math.sin(a) * rr;
      const bx = vx0 * cS + vz0 * sS;
      const bz = -vx0 * sS + vz0 * cS;
      const by = -bz * sT;
      const bz2 = bz * cT;
      const q = project(cam, bx, gemY + by, bz2);
      if (!q.ok) { started = false; continue; }
      if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
    }
    const [or1, or2, or3] = lit(0.22 + ring * 0.12);
    ctx.strokeStyle = col(or1, or2, or3, 0.26 - ring * 0.05 + energy * 0.2);
    ctx.lineWidth = 1.4 - ring * 0.22;
    ctx.stroke();
  }

  /* --- dust with real depth --------------------------------------- */
  for (const d of scene.dust) {
    d.y += dt * d.w * 0.55 * (reduce ? 0.2 : 1);
    if (d.y > 7.4) { d.y = FLOOR_Y; d.x = (Math.random() - 0.5) * 26; d.z = (Math.random() - 0.5) * 26; }
    const q = project(cam, d.x + Math.sin(t * 0.5 + d.z) * 0.22, d.y, d.z);
    if (!q.ok || q.x < -20 || q.x > width + 20) continue;
    const fade = clamp(1 - (q.d - 2) / 32, 0, 1);
    const rad = clamp(q.s * d.r * 0.014, 0.35, 3.4);
    const [dr1, dg1, db1] = lit(0.35);
    ctx.beginPath();
    ctx.arc(q.x, q.y, rad, 0, TAU);
    ctx.fillStyle = col(dr1, dg1, db1, d.o * fade * (0.5 + energy));
    ctx.fill();
  }

  /* --- bottom spectrum skirt -------------------------------------- */
  const skirt = small ? 30 : 48;
  const bw = width / skirt;
  const baseY = height * 0.997;
  const skirtH = Math.max(26, height * 0.15);
  const sg = ctx.createLinearGradient(0, baseY - skirtH, 0, baseY);
  const [sk1, sk2, sk3] = lit(0.3);
  const [sk4, sk5, sk6] = dark(0.62);
  sg.addColorStop(0, col(sk1, sk2, sk3, 0.5));
  sg.addColorStop(1, col(sk4, sk5, sk6, 0.03));
  ctx.fillStyle = sg;
  for (let i = 0; i < skirt; i++) {
    const amp = lv
      ? (lv[Math.floor((i / skirt) * lv.length)] ?? 0.04)
      : (Math.sin(t * 1.9 + i * 0.33) * 0.5 + 0.5) * 0.3 + (Math.sin(t * 3.1 - i * 0.11) * 0.5 + 0.5) * 0.15;
    const bh = Math.max(2, amp * skirtH);
    ctx.fillRect(i * bw + bw * 0.22, baseY - bh, bw * 0.56, bh);
  }

  /* --- legibility scrim ------------------------------------------ */
  if (small) {
    // narrow screens put the copy right on top of the scene: wash it evenly
    const vs = ctx.createLinearGradient(0, 0, 0, height);
    vs.addColorStop(0, "rgba(5,5,7,0.46)");
    vs.addColorStop(0.55, "rgba(5,5,7,0.28)");
    vs.addColorStop(1, "rgba(5,5,7,0.5)");
    ctx.fillStyle = vs;
    ctx.fillRect(0, 0, width, height);
  } else {
    const vg = ctx.createLinearGradient(0, 0, width * 0.72, 0);
    vg.addColorStop(0, "rgba(5,5,7,0.44)");
    vg.addColorStop(0.5, "rgba(5,5,7,0.18)");
    vg.addColorStop(1, "rgba(5,5,7,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width * 0.72, height);
  }

  return liveIdx;
}
