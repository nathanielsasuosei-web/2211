"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./player-context";

type Props = {
  /** 0..1 base intensity when nothing is playing */
  idle?: number;
  className?: string;
};

/**
 * Animated hero canvas: drifting particles, a pulsing red spectrum driven by
 * the live audio analyser (or procedural noise when idle), plus rotating arcs.
 * Respects prefers-reduced-motion and pauses when off-screen.
 */
export default function HeroCanvas({ idle = 0.35, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { levels, isPlaying } = usePlayer();
  const levelsRef = useRef(levels);
  const playingRef = useRef(isPlaying);
  levelsRef.current = levels;
  playingRef.current = isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let raf = 0;
    let t = 0;
    let visible = true;

    const particles = Array.from({ length: 62 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2.4,
      s: 0.06 + Math.random() * 0.32,
      o: 0.12 + Math.random() * 0.5,
      hue: i % 5 === 0 ? 18 : 4 + Math.random() * 12,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(320, rect.width);
      height = Math.max(320, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(canvas);

    const bars = 96;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      t += reduce ? 0.002 : 0.011;

      ctx.clearRect(0, 0, width, height);

      /* --- rotating arcs (right side) ---------------------------- */
      const cx = width * 0.82;
      const cy = height * 0.42;
      const maxR = Math.min(width, height) * 0.42;
      const audio = playingRef.current ? levelsRef.current : null;
      const energy = audio ? audio.reduce((a, b) => a + b, 0) / audio.length : idle;

      ctx.save();
      ctx.translate(cx, cy);
      for (let ring = 0; ring < 5; ring++) {
        const r = maxR * (0.34 + ring * 0.16) * (1 + energy * 0.06);
        const rot = t * (ring % 2 === 0 ? 1 : -1) * (0.5 + ring * 0.16);
        ctx.rotate(rot * 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0.15 * ring, Math.PI * (1.15 + 0.16 * ring));
        ctx.strokeStyle = `rgba(${225 - ring * 12}, ${30 + ring * 14}, ${20 + ring * 8}, ${0.4 - ring * 0.06})`;
        ctx.lineWidth = 1.4 + ring * 0.4;
        ctx.stroke();
      }
      ctx.restore();

      /* --- glow core ---------------------------------------------- */
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.05);
      glow.addColorStop(0, `rgba(225, 6, 0, ${0.26 + energy * 0.22})`);
      glow.addColorStop(0.45, `rgba(140, 4, 0, ${0.1 + energy * 0.1})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 1.05, 0, Math.PI * 2);
      ctx.fill();

      /* --- particles ---------------------------------------------- */
      for (const p of particles) {
        p.y -= (p.s * (reduce ? 0.2 : 1)) / 900;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        const px = p.x * width + Math.sin(t * 2 + p.y * 8) * 12;
        const py = p.y * height;
        ctx.beginPath();
        ctx.arc(px, py, p.r * (1 + energy * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 96%, ${55 + energy * 12}%, ${p.o * (0.55 + energy)})`;
        ctx.fill();
      }

      /* --- spectrum (bottom) -------------------------------------- */
      const baseY = height * 0.99;
      const bw = width / bars;
      for (let i = 0; i < bars; i++) {
        let amp: number;
        if (audio && audio.length) {
          const idx = Math.floor((i / bars) * audio.length);
          amp = audio[idx] ?? 0.05;
        } else {
          amp =
            (Math.sin(t * 2.1 + i * 0.28) * 0.5 + 0.5) * 0.34 +
            (Math.sin(t * 3.7 + i * 0.11) * 0.5 + 0.5) * 0.2 +
            (Math.sin(t * 1.3 + i * 0.63) * 0.5 + 0.5) * 0.16;
        }
        const h = Math.max(3, amp * height * 0.34);
        const x = i * bw;
        const grad = ctx.createLinearGradient(0, baseY - h, 0, baseY);
        grad.addColorStop(0, `rgba(255, ${90 + amp * 90}, ${80 + amp * 60}, ${0.55 + amp * 0.4})`);
        grad.addColorStop(1, "rgba(120, 3, 0, 0.04)");
        ctx.fillStyle = grad;
        ctx.fillRect(x + bw * 0.18, baseY - h, bw * 0.64, h);
      }

      /* --- horizon line ------------------------------------------- */
      ctx.strokeStyle = `rgba(225, 6, 0, ${0.22 + energy * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseY - 0.5);
      ctx.lineTo(width, baseY - 0.5);
      ctx.stroke();
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [idle]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
