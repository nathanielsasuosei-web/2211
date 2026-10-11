import "server-only";
import { cache } from "react";
import { env } from "./config";
import { normalizeAccent } from "./theme";
import { getAllSettings } from "./repo";
import { ensureBootstrapped } from "./bootstrap";

export type SiteSettings = {
  brandName: string;
  tagline: string;
  accentColor: string;
  heroEyebrow: string;
  heroLine1: string;
  heroLine2: string;
  heroLine3: string;
  heroSub: string;
  producerBio: string;
  contactEmail: string;
  contactPhone: string;
  studioLocation: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  whatsapp: string;
  raw: Record<string, string>;
};

/** Loads editable site settings (admin → settings), falling back to env. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  await ensureBootstrapped();
  const s = await getAllSettings();
  return {
    brandName: s.brand_name || env.appName,
    tagline: s.brand_tagline || env.appTagline,
    accentColor: normalizeAccent(s.accent_color || env.accentColor),
    heroEyebrow: s.hero_eyebrow || "Produced in Accra · Licensed worldwide",
    heroLine1: s.hero_line_1 || "BEATS THAT",
    heroLine2: s.hero_line_2 || "MOVE",
    heroLine3: s.hero_line_3 || "CROWDS",
    heroSub:
      s.hero_sub ||
      "Studio-grade instrumentals in every genre. Preview instantly, pay with mobile money, card or bank transfer, and get your files by email in seconds.",
    producerBio: s.producer_bio || "",
    contactEmail: s.contact_email || env.supportMail,
    contactPhone: s.contact_phone || env.adminPhone,
    studioLocation: s.studio_location || "Accra, Ghana",
    instagram: s.instagram || "",
    youtube: s.youtube || "",
    tiktok: s.tiktok || "",
    whatsapp: s.whatsapp || "",
    raw: s,
  };
});

export { NAV_LINKS } from "./site-data";
