"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./player-context";
import { THEME_EVENT, hexToRgb } from "@/lib/theme";
import { HERO_SHOT_LABELS, createScene, renderFrame, sizeScene } from "@/lib/hero-scene";

/* =====================================================================
   Hero3D — the shell around lib/hero-scene.

   Owns the canvas, sizing (DPR + pixel budget), pause-when-off-screen,
   prefers-reduced-motion, the pointer and the live accent colour, and
   feeds the pure renderer one frame at a time. All the 3D/animatic logic
   (camera shots, towers, gem, grid, shading) lives in lib/hero-scene.ts,
   headless-renderable via scripts/hero-preview.mjs.
   ===================================================================== */

export { HERO_SHOT_LABELS };

type Props = {
  /** 0..1 base intensity while nothing is playing */
  idle?: number;
  className?: string;
  /** fired when the camera starts travelling into a new shot (for the slate) */
  onShot?: (index: number, label: string) => void;
};

/** keep the fill-rate sane on huge / retina displays */
const PIXEL_BUDGET = 2_600_000;

export default function Hero3D({ idle = 0.3, className, onShot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { levels, isPlaying } = usePlayer();
  const levelsRef = useRef(levels);
  const playingRef = useRef(isPlaying);
  const shotCbRef = useRef(onShot);
  levelsRef.current = levels;
  playingRef.current = isPlaying;
  shotCbRef.current = onShot;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = (canvas as HTMLCanvasElement).getContext("2d", { alpha: true }) as
      | CanvasRenderingContext2D
      | null;
    if (!ctx) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let shot = -1;

    const scene = createScene(canvas.getBoundingClientRect().width || 1200, 620);

    /* --- live accent --------------------------------------------- */
    const accent: [number, number, number] = [225, 6, 0];
    const readAccent = () => {
      const hex = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const rgb = hexToRgb(hex || "#e10600");
      accent[0] = rgb[0];
      accent[1] = rgb[1];
      accent[2] = rgb[2];
    };
    readAccent();
    document.documentElement.addEventListener(THEME_EVENT, readAccent);

    /* --- pointer parallax (damped inside the scene, no React state) */
    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / Math.max(1, r.width) - 0.5));
      pointer.y = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / Math.max(1, r.height) - 0.5));
    };
    const onLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    /* --- sizing --------------------------------------------------- */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(320, rect.width);
      const cssH = Math.max(280, rect.height);
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixels = cssW * cssH * dpr * dpr;
      if (pixels > PIXEL_BUDGET) dpr = Math.max(1, dpr * Math.sqrt(PIXEL_BUDGET / pixels));
      width = cssW;
      height = cssH;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeScene(scene, cssW, cssH);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
      last = now;
      if (!visible || !width) return;

      const idx = renderFrame(ctx, scene, {
        width,
        height,
        dt,
        accent,
        idle,
        levels: playingRef.current ? levelsRef.current : null,
        pointer,
        reduce,
      });

      if (idx !== shot) {
        shot = idx;
        shotCbRef.current?.(idx, HERO_SHOT_LABELS[idx] ?? "");
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener(THEME_EVENT, readAccent);
    };
  }, [idle]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
