"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCENT_PRESETS,
  applyAccent,
  hexToHsl,
  hslToHex,
  normalizeAccent,
  storeAccent,
  THEME_EVENT,
  tweenAccent,
} from "@/lib/theme";
import { IconPalette } from "./icons";

/**
 * Adjustable accent colour, right in the hero.
 *
 * One slider set (hue / vividness / tone), the curated presets and a native
 * picker. Everything flows through lib/theme's `--accent-*` variables, so the
 * buttons, glows, ticker, navbar hairline, the 3D hero scene *and* the email
 * templates all follow the same colour. Presets tween (see tweenAccent);
 * dragging applies instantly so it tracks the pointer 1:1.
 *
 * Kept in sync with the navbar picker via THEME_EVENT, and remembered per
 * browser in localStorage. The producer's own default comes from
 * Admin → Settings → Accent colour, and "Brand" jumps back to it.
 */
export default function AccentBar({ brandAccent }: { brandAccent: string }) {
  const brand = normalizeAccent(brandAccent);
  const [accent, setAccent] = useState(brand);
  const [hsl, setHsl] = useState(() => hexToHsl(brand));
  const dragging = useRef(false);
  const storeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow whatever the pre-paint script / navbar picker / admin set.
  useEffect(() => {
    const sync = () => {
      const hex = normalizeAccent(
        getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
      );
      setAccent(hex);
      if (!dragging.current) setHsl(hexToHsl(hex));
    };
    sync();
    document.documentElement.addEventListener(THEME_EVENT, sync);
    return () => document.documentElement.removeEventListener(THEME_EVENT, sync);
  }, []);

  useEffect(
    () => () => {
      if (storeTimer.current) clearTimeout(storeTimer.current);
    },
    [],
  );

  const persistSoon = (hex: string) => {
    if (storeTimer.current) clearTimeout(storeTimer.current);
    storeTimer.current = setTimeout(() => storeAccent(hex), 320);
  };

  const live = (next: { h: number; s: number; l: number }) => {
    setHsl(next);
    const hex = hslToHex(next.h, next.s, next.l);
    setAccent(hex);
    applyAccent(hex);
    persistSoon(hex);
  };

  const pick = (hex: string) => {
    dragging.current = false;
    const n = normalizeAccent(hex);
    setAccent(n);
    setHsl(hexToHsl(n));
    tweenAccent(n);
    storeAccent(n);
  };

  const toBrand = () => {
    dragging.current = false;
    setAccent(brand);
    setHsl(hexToHsl(brand));
    tweenAccent(brand);
    storeAccent(null);
  };

  const onSliderDown = () => { dragging.current = true; };
  const onSliderUp = () => {
    dragging.current = false;
    storeAccent(accent);
  };

  const isBrand = accent === brand;

  return (
    <div className="accent-bar fade-up" style={{ animationDelay: "0.66s" }}>
      <span className="accent-bar__label">
        <IconPalette size={14} />
        <b>Accent</b>
      </span>

      <div className="accent-bar__swatches" role="group" aria-label="Preset accent colours">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            className="accent-dot"
            style={{ background: p.hex }}
            data-active={accent === p.hex}
            onClick={() => pick(p.hex)}
            aria-label={p.name}
            title={`${p.name} · ${p.hex}`}
          />
        ))}
      </div>

      <div className="accent-bar__sliders">
        <label className="accent-slider">
          <span>Hue</span>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={hsl.h}
            aria-label="Accent hue"
            onPointerDown={onSliderDown}
            onPointerUp={onSliderUp}
            onBlur={onSliderUp}
            onChange={(e) => live({ ...hsl, h: Number(e.target.value) })}
            className="accent-range accent-range--hue"
          />
        </label>
        <label className="accent-slider">
          <span>Vivid</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={hsl.s}
            aria-label="Accent saturation"
            onPointerDown={onSliderDown}
            onPointerUp={onSliderUp}
            onBlur={onSliderUp}
            onChange={(e) => live({ ...hsl, s: Number(e.target.value) })}
            className="accent-range"
            style={{
              background: `linear-gradient(90deg, ${hslToHex(hsl.h, 0, hsl.l)}, ${hslToHex(hsl.h, 100, hsl.l)})`,
            }}
          />
        </label>
        <label className="accent-slider">
          <span>Tone</span>
          <input
            type="range"
            min={12}
            max={82}
            step={1}
            value={hsl.l}
            aria-label="Accent lightness"
            onPointerDown={onSliderDown}
            onPointerUp={onSliderUp}
            onBlur={onSliderUp}
            onChange={(e) => live({ ...hsl, l: Number(e.target.value) })}
            className="accent-range"
            style={{
              background: `linear-gradient(90deg, #050507, ${hslToHex(hsl.h, hsl.s, 50)}, #ffffff)`,
            }}
          />
        </label>
      </div>

      <label className="accent-bar__pick" title="Pick any colour">
        <input
          type="color"
          value={accent}
          onChange={(e) => {
            dragging.current = true;
            const n = normalizeAccent(e.target.value);
            setAccent(n);
            setHsl(hexToHsl(n));
            applyAccent(n);
            persistSoon(n);
          }}
          onBlur={() => {
            dragging.current = false;
            storeAccent(accent);
          }}
          aria-label="Custom accent colour"
        />
        <code className="accent-bar__hex">{accent.toUpperCase()}</code>
      </label>

      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={toBrand}
        disabled={isBrand}
        title={isBrand ? "Already using the brand colour" : `Back to ${brand}`}
      >
        Brand
      </button>
    </div>
  );
}
