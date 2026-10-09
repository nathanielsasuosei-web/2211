"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/lib/actions/admin";
import { useActionToast } from "./Toast";
import { IconCheck } from "./icons";

const FIELDS: Array<{ key: string; label: string; type?: "text" | "textarea" | "email" | "tel"; hint?: string }> = [
  { key: "brand_name", label: "Brand / producer name" },
  { key: "brand_tagline", label: "Tagline" },
  { key: "hero_eyebrow", label: "Hero eyebrow" },
  { key: "hero_line_1", label: "Hero line 1" },
  { key: "hero_line_2", label: "Hero line 2 (red)" },
  { key: "hero_line_3", label: "Hero line 3 (outline)" },
  { key: "hero_sub", label: "Hero paragraph", type: "textarea" },
  { key: "producer_bio", label: "Producer bio (About page)", type: "textarea" },
  { key: "contact_email", label: "Contact email", type: "email" },
  { key: "contact_phone", label: "Contact phone / WhatsApp", type: "tel" },
  { key: "studio_location", label: "Studio location" },
  { key: "instagram", label: "Instagram URL" },
  { key: "youtube", label: "YouTube URL" },
  { key: "tiktok", label: "TikTok URL" },
  { key: "whatsapp", label: "WhatsApp number" },
];

export default function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveSettingsAction, undefined);
  useActionToast(state);

  return (
    <form action={action} className="panel pad-lg stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 6 }}>
        <h3 className="display h-sm">Storefront copy</h3>
        <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>
          These values drive the hero, footer, About page and outgoing emails.
        </p>
      </div>

      <div className="form-grid">
        {FIELDS.map((f) =>
          f.type === "textarea" ? (
            <div className="field" key={f.key} style={{ gridColumn: "1 / -1" }}>
              <label htmlFor={f.key}>{f.label}</label>
              <textarea id={f.key} name={f.key} className="textarea" defaultValue={settings[f.key] ?? ""} />
            </div>
          ) : (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input id={f.key} name={f.key} type={f.type ?? "text"} className="input" defaultValue={settings[f.key] ?? ""} />
            </div>
          ),
        )}
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && state.message && <div className="form-ok">{state.message}</div>}

      <button type="submit" className="btn btn--primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        <IconCheck size={15} /> {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
