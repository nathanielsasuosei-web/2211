"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import HeroCanvas from "./HeroCanvas";
import { IconBolt, IconPlay, IconShield, IconUpload } from "./icons";
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

function StatBlock({ stat }: { stat: Stat }) {
  const value = useCountUp(stat.value);
  return (
    <div className="stat fade-up">
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
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      setPointer({
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section className="hero" ref={ref}>
      <HeroCanvas className="hero__canvas" idle={0.32} />
      <div className="hero__veil" />
      <div className="hero__grain" />

      <div className="wrap hero__inner">
        <div
          className="stack"
          style={{ gap: 26, maxWidth: 900, transform: `translate3d(${pointer.x * -14}px, ${pointer.y * -10}px, 0)` }}
        >
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
            <Link href="/signup" className="btn btn--outline btn--lg">
              <IconUpload size={16} />
              Create artist account
            </Link>
            <Link href="/watch" className="btn btn--ghost btn--lg">
              <IconPlay size={15} />
              Watch sessions
            </Link>
          </div>

          <div className="hero__stats fade-up" style={{ animationDelay: "0.62s", maxWidth: 760 }}>
            <StatBlock stat={{ value: stats.beats, label: "Beats in the store" }} />
            <StatBlock stat={{ value: stats.artists, label: "Artists licensed" }} />
            <StatBlock stat={{ value: stats.plays, suffix: "+", label: "Previews played" }} />
            <StatBlock stat={{ value: stats.delivered, label: "Files delivered" }} />
          </div>

          <div className="row row--wrap fade-up" style={{ gap: 8, animationDelay: "0.72s" }}>
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
