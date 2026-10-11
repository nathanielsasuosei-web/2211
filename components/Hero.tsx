"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Hero3D, { HERO_SHOT_LABELS } from "./Hero3D";
import AccentBar from "./AccentBar";
import { IconBolt, IconMusic, IconPlay, IconShield, IconUpload } from "./icons";
import type { PublicSettings } from "@/lib/site-data";

type Stat = { value: number; suffix?: string; label: string };

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatBlock({ stat, delay }: { stat: Stat; delay: number }) {
  const value = useCountUp(stat.value);
  return (
    <div className="stat fade-up" style={{ animationDelay: `${delay}s` }}>
      <b>
        {value.toLocaleString()}
        {stat.suffix ?? ""}
      </b>
      <span>{stat.label}</span>
    </div>
  );
}

export default function Hero({
  settings,
  stats,
  genres,
}: {
  settings: PublicSettings;
  stats: { beats: number; artists: number; plays: number; delivered: number };
  genres: string[];
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const [shot, setShot] = useState(0);
  const [shotLabel, setShotLabel] = useState(HERO_SHOT_LABELS[0]);

  /* Pointer parallax — written straight to the transform in a rAF loop so the
     60fps hero never re-renders React while the mouse moves. */
  useEffect(() => {
    const section = sectionRef.current;
    const copy = copyRef.current;
    if (!section || !copy) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      tx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
      ty = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
    };
    const onLeave = () => { tx = 0; ty = 0; };
    const loop = () => {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      copy.style.transform = `translate3d(${(x * -16).toFixed(2)}px, ${(y * -11).toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const onShot = (index: number, label: string) => {
    setShot(index);
    setShotLabel(label);
  };

  return (
    <section className="hero hero--3d" ref={sectionRef}>
      <Hero3D className="hero__canvas" idle={0.3} onShot={onShot} />
      <div className="hero__veil" />
      <div className="hero__grain" />

      {/* animatic slate — which "shot" of the hero loop we're on */}
      <div className="hero__slate" aria-hidden="true">
        <span className="hero__slate-rec" />
        <span className="mono">
          SC {String(shot + 1).padStart(2, "0")}/{String(HERO_SHOT_LABELS.length).padStart(2, "0")}
        </span>
        <span className="hero__slate-label">{shotLabel}</span>
      </div>

      <div className="wrap hero__inner">
        <div className="stack hero__copy" ref={copyRef} style={{ gap: 26, maxWidth: 900 }}>
          <span className="eyebrow fade-up" style={{ animationDelay: "0.05s" }}>
            {settings.heroEyebrow}
          </span>

          <h1 className="display h-xl hero__title">
            <span className="line">
              <span>{settings.heroLine1}</span>
            </span>
            <span className="line">
              <span className="hero__red hero__shine">{settings.heroLine2}</span>
            </span>
            <span className="line">
              <span className="hero__outline">{settings.heroLine3}</span>
            </span>
          </h1>

          <p className="lede fade-up" style={{ animationDelay: "0.42s", maxWidth: "60ch" }}>
            {settings.heroSub}
          </p>

          <div className="row row--wrap fade-up" style={{ gap: 12, animationDelay: "0.52s" }}>
            <Link href="/beats" className="btn btn--primary btn--lg">
              <IconBolt size={17} />
              Browse the beat store
            </Link>
            <Link href="#beat-list" className="btn btn--outline btn--lg">
              <IconMusic size={15} />
              See the beat list
            </Link>
            <Link href="/watch" className="btn btn--ghost btn--lg">
              <IconPlay size={15} />
              Watch sessions
            </Link>
            <Link href="/signup" className="btn btn--ghost btn--lg">
              <IconUpload size={16} />
              Create artist account
            </Link>
          </div>

          <AccentBar brandAccent={settings.accentColor} />

          <div className="hero__stats fade-up" style={{ animationDelay: "0.76s", maxWidth: 760 }}>
            <StatBlock stat={{ value: stats.beats, label: "Beats in the store" }} delay={0.76} />
            <StatBlock stat={{ value: stats.artists, label: "Artists licensed" }} delay={0.84} />
            <StatBlock stat={{ value: stats.plays, suffix: "+", label: "Previews played" }} delay={0.92} />
            <StatBlock stat={{ value: stats.delivered, label: "Files delivered" }} delay={1} />
          </div>

          <div className="row row--wrap fade-up" style={{ gap: 8, animationDelay: "0.86s" }}>
            <span className="chip chip--ok">
              <IconShield size={13} /> Instant email delivery
            </span>
            <span className="chip">MTN MoMo · M-Pesa · Card · Bank</span>
            <span className="chip">Unlimited re-downloads in your Vault</span>
          </div>
        </div>
      </div>

      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          {[0, 1].map((dup) => (
            <span key={dup}>
              {(genres.length ? genres : ["Afrobeats", "Amapiano", "Drill", "R&B", "Gospel", "Highlife"]).join(" · ")} ·
              Licensed worldwide · Stems available · Instant delivery ·{" "}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
