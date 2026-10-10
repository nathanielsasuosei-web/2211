"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCENT_PRESETS,
  applyAccent,
  getStoredAccent,
  normalizeAccent,
  storeAccent,
} from "@/lib/theme";
import { IconCheck, IconClose, IconPalette } from "./icons";

/**
 * Navbar accent-colour picker. Lets any visitor restyle the whole store
 * (buttons, glows, hero, navbar hairline) with one tap. The choice persists
 * in localStorage and is re-applied before first paint on the next visit.
 * “Reset” returns to the producer's brand accent from Admin → Settings.
 */
export default function ThemePicker({ brandAccent }: { brandAccent: string }) {
  const brand = normalizeAccent(brandAccent);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(brand);
  const [custom, setCustom] = useState(brand);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Sync with whatever the pre-paint init script applied.
  useEffect(() => {
    const stored = getStoredAccent();
    if (stored) {
      const n = normalizeAccent(stored);
      setActive(n);
      setCustom(n);
    }
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (hex: string) => {
    const n = applyAccent(hex);
    setActive(n);
    setCustom(n);
    storeAccent(n);
  };

  const reset = () => {
    applyAccent(brand);
    setActive(brand);
    setCustom(brand);
    storeAccent(null);
  };

  const isCustomActive = !ACCENT_PRESETS.some((p) => p.hex === active) && active !== brand;

  return (
    <div className="theme-wrap" ref={wrapRef}>
      <button
        type="button"
        className="theme-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change accent colour"
        aria-expanded={open}
        title="Change accent colour"
      >
        <IconPalette size={16} />
        <span className="theme-btn__dot" aria-hidden="true" />
      </button>

      {open && (
        <div className="theme-pop" role="dialog" aria-label="Accent colour">
          <div className="row row--between" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Accent colour</h4>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: 4, width: 30, height: 30, borderRadius: 8 }}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="theme-swatches">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                className="theme-swatch"
                style={{ background: p.hex }}
                data-active={active === p.hex}
                onClick={() => pick(p.hex)}
                aria-label={p.name}
                title={p.name}
              />
            ))}
          </div>

          <div className="row">
            <input
              type="color"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                pick(e.target.value);
              }}
              aria-label="Custom colour"
            />
            <input
              type="text"
              className="input"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={() => pick(custom)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  pick(custom);
                }
              }}
              spellCheck={false}
              aria-label="Custom colour hex"
            />
            {isCustomActive && <IconCheck size={16} className="red" aria-label="Custom colour active" />}
          </div>

          <div className="row row--between" style={{ marginTop: 14 }}>
            <span className="tiny dim">Saved on this device</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              Reset to brand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
