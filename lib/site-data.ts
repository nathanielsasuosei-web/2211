/** Shared, isomorphic constants (safe to import from client components). */

export const NAV_LINKS = [
  { href: "/beats", label: "Beat Store" },
  { href: "/watch", label: "Watch" },
  { href: "/licensing", label: "Licensing" },
  { href: "/about", label: "Producer" },
  { href: "/contact", label: "Contact" },
] as const;

export const GENRES = [
  "Afrobeats",
  "Amapiano",
  "Drill",
  "Trap",
  "Hip Hop",
  "R&B",
  "Gospel",
  "Dancehall",
  "Highlife",
  "Afrofusion",
  "Reggae",
  "Pop",
  "Afro-house",
  "Gospel Choir",
] as const;

export const MOODS = [
  "Warm",
  "Dark",
  "Sensual",
  "Uplifting",
  "Aggressive",
  "Dreamy",
  "Joyful",
  "Hypnotic",
  "Soulful",
  "Confident",
  "Cinematic",
  "Gritty",
] as const;

export const KEYS = [
  "C minor",
  "C major",
  "D minor",
  "D major",
  "E minor",
  "E major",
  "F minor",
  "F major",
  "G minor",
  "G major",
  "A minor",
  "A major",
  "B minor",
  "Bb major",
  "Eb major",
] as const;

export const LICENSE_INCLUDES = ["mp3", "wav", "stems", "trackout", "performance rights"] as const;

/** The subset of site settings the client shell is allowed to see. */
export type PublicSettings = {
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
};
