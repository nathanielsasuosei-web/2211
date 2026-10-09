import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { env } from "./config";
import { all, asNumber, get, newId, nowIso, run } from "./db";
import { createUser, ensureDefaultLicenses } from "./repo";
import { renderBeat } from "./media/beat.mjs";
import { createZip } from "./media/zip.mjs";
import { coverArtSvg, videoPosterSvg } from "./media/art.mjs";
import { PRIVATE_UPLOAD_ROOT, PUBLIC_UPLOAD_ROOT, ensureDir, relPath } from "./storage";
import type { Beat } from "./types";

/* ------------------------------------------------------------------ */
/* Demo catalogue                                                      */
/* ------------------------------------------------------------------ */

type CatalogueEntry = {
  title: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  tags: string[];
  description: string;
  priceCents: number;
  featured?: boolean;
  withStems?: boolean;
  seed: number;
};

const CATALOGUE: CatalogueEntry[] = [
  {
    title: "Accra Nights",
    genre: "Afrobeats",
    mood: "Warm",
    bpm: 102,
    key: "F minor",
    tags: ["afrobeats", "guitar", "percussion", "radio ready", "warm"],
    description:
      "Sunset-over-the-city afrobeats. Log-drum bassline, muted guitar licks and a shaker groove built for hook-heavy vocalists.",
    priceCents: 12000,
    featured: true,
    withStems: true,
    seed: 11,
  },
  {
    title: "Log Drum Fever",
    genre: "Amapiano",
    mood: "Hypnotic",
    bpm: 112,
    key: "A minor",
    tags: ["amapiano", "log drum", "shakers", "dancefloor"],
    description:
      "Private-school amapiano with a rolling log drum, airy pads and a breakdown that drops the whole room. Instant dancefloor record.",
    priceCents: 15000,
    featured: true,
    withStems: true,
    seed: 27,
  },
  {
    title: "Concrete Psalms",
    genre: "Drill",
    mood: "Dark",
    bpm: 142,
    key: "C minor",
    tags: ["drill", "sliding 808", "dark", "strings"],
    description:
      "UK-flavoured drill with sliding 808s, bell melodies and hi-hat rolls. Written for aggressive, punchline-heavy verses.",
    priceCents: 14000,
    seed: 43,
  },
  {
    title: "Golden Era",
    genre: "Hip Hop",
    mood: "Soulful",
    bpm: 90,
    key: "D minor",
    tags: ["boom bap", "soulful", "rhodes", "swing"],
    description:
      "Boom-bap swing over dusty Rhodes chords and a round bassline. Perfect for storytelling bars and scratch hooks.",
    priceCents: 11000,
    seed: 59,
  },
  {
    title: "Velvet Room",
    genre: "R&B",
    mood: "Sensual",
    bpm: 84,
    key: "E minor",
    tags: ["rnb", "smooth", "late night", "keys"],
    description:
      "Late-night R&B with soft keys, brushed drums and space for a vocalist to breathe. Slow-burn chorus energy.",
    priceCents: 13000,
    featured: true,
    seed: 71,
  },
  {
    title: "Sunday Testimony",
    genre: "Gospel",
    mood: "Uplifting",
    bpm: 76,
    key: "Bb major",
    tags: ["gospel", "organ", "choir", "worship"],
    description:
      "Worship-ready gospel with organ swells, claps and a build that lifts the last chorus. Great for choir stacking.",
    priceCents: 12500,
    seed: 83,
  },
  {
    title: "Dancehall King",
    genre: "Dancehall",
    mood: "Confident",
    bpm: 100,
    key: "A minor",
    tags: ["dancehall", "caribbean", "bass", "club"],
    description:
      "Badman dancehall riddim with a heavy bassline and clap pattern. Built for fast flows and club sound systems.",
    priceCents: 11500,
    seed: 97,
  },
  {
    title: "Highlife Sunrise",
    genre: "Highlife",
    mood: "Joyful",
    bpm: 108,
    key: "G major",
    tags: ["highlife", "guitar", "live feel", "ghana"],
    description:
      "Modern highlife with plucked guitar patterns, live-feel drums and a bright major-key progression. Festival main-stage material.",
    priceCents: 13500,
    featured: true,
    withStems: true,
    seed: 113,
  },
];

const VIDEOS = [
  {
    title: "Studio Session — Accra Nights",
    description: "Behind the boards: building the log-drum bass and guitar counter-melody from scratch.",
    beatTitle: "Accra Nights",
    seed: 5,
  },
  {
    title: "Log Drum Masterclass",
    description: "How the amapiano log drum is layered, tuned and sidechained in this session.",
    beatTitle: "Log Drum Fever",
    seed: 9,
  },
  {
    title: "Velvet Room — Vocal Production",
    description: "Tracking and stacking R&B vocals over a slow-burn instrumental.",
    beatTitle: "Velvet Room",
    seed: 15,
  },
  {
    title: "Highlife Guitar Patterns",
    description: "Breaking down the two-guitar interplay that drives modern highlife.",
    beatTitle: "Highlife Sunrise",
    seed: 21,
  },
];

/* ------------------------------------------------------------------ */
/* Asset generation                                                    */
/* ------------------------------------------------------------------ */

async function writeAsset(rel: string, data: Buffer | string): Promise<string> {
  const abs = path.join(process.cwd(), rel);
  ensureDir(path.dirname(abs));
  await fsp.writeFile(abs, data);
  return relPath(abs);
}

function publicBeatDir(slug: string) {
  return path.join(PUBLIC_UPLOAD_ROOT, "beats", slug);
}

function privateBeatDir(slug: string) {
  return path.join(PRIVATE_UPLOAD_ROOT, "beats", slug);
}

async function generateBeatAssets(entry: CatalogueEntry, slug: string, durationSec: number) {
  const publicDir = publicBeatDir(slug);
  const privateDir = privateBeatDir(slug);
  ensureDir(publicDir);
  ensureDir(privateDir);

  const artworkRel = path.join(PUBLIC_UPLOAD_ROOT, "artwork", `${slug}.svg`);
  ensureDir(path.dirname(artworkRel));
  await fsp.writeFile(
    artworkRel,
    coverArtSvg({
      title: entry.title,
      genre: entry.genre,
      bpm: entry.bpm,
      musicalKey: entry.key,
      seed: entry.seed,
      producer: env.appName,
    }),
    "utf8",
  );

  const preview = renderBeat({
    genre: entry.genre,
    bpm: entry.bpm,
    key: entry.key,
    seed: entry.seed,
    durationSec: Math.min(14, durationSec),
    sampleRate: 22050,
    tag: true,
  });
  const previewRel = path.join(publicDir, "preview.wav");
  await fsp.writeFile(previewRel, preview.mix);

  const full = renderBeat({
    genre: entry.genre,
    bpm: entry.bpm,
    key: entry.key,
    seed: entry.seed + 1,
    durationSec,
    sampleRate: 22050,
    tag: false,
    stems: entry.withStems,
  });
  const fullRel = path.join(privateDir, "full.wav");
  await fsp.writeFile(fullRel, full.mix);

  let trackoutRel: string | null = null;
  if (entry.withStems && full.stems) {
    const names: Array<[string, Buffer]> = [
      ["01-drums.wav", full.stems.drums],
      ["02-bass.wav", full.stems.bass],
      ["03-keys.wav", full.stems.keys],
      ["04-melody.wav", full.stems.melody],
      ["05-full-mix.wav", full.mix],
    ];
    const zip = createZip(names.map(([name, data]) => ({ name, data })));
    trackoutRel = path.join(privateDir, "trackout-stems.zip");
    await fsp.writeFile(trackoutRel, zip);
  }

  return {
    artwork: relPath(artworkRel),
    preview_file: relPath(previewRel),
    full_file: relPath(fullRel),
    trackout_file: trackoutRel ? relPath(trackoutRel) : null,
  };
}

async function generateVideoPoster(title: string, subtitle: string, seed: number) {
  const dir = path.join(PUBLIC_UPLOAD_ROOT, "videos");
  ensureDir(dir);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const abs = path.join(dir, `${slug}-${seed}.svg`);
  await fsp.writeFile(abs, videoPosterSvg({ title, subtitle, seed }), "utf8");
  return relPath(abs);
}

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

export async function seedIfEmpty(): Promise<boolean> {
  const row = await get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
  if (asNumber(row?.c) > 0) return false;

  const now = nowIso();

  /* ---- users ---------------------------------------------------- */
  const admin = await createUser({
    email: env.adminEmail,
    name: env.adminName,
    password: env.adminPassword,
    phone: env.adminPhone,
    role: "admin",
    country: "Ghana",
    city: "Accra",
    bio: "Producer, mix engineer and owner of this catalogue.",
  });

  const demoArtist = await createUser({
    email: "artist@demo.com",
    name: "Kwame Ace",
    password: "Artist!2211",
    phone: "+233244000111",
    role: "artist",
    country: "Ghana",
    city: "Accra",
    bio: "Afro-fusion vocalist looking for radio-ready instrumentals.",
  });

  /* ---- settings -------------------------------------------------- */
  const settings: Record<string, string> = {
    brand_name: env.appName,
    brand_tagline: env.appTagline,
    hero_eyebrow: "Produced in Accra · Licensed worldwide",
    hero_line_1: "BEATS THAT",
    hero_line_2: "MOVE",
    hero_line_3: "CROWDS",
    hero_sub:
      "Studio-grade instrumentals across every genre. Preview instantly, pay with mobile money, card or bank transfer, and get your files by email in seconds.",
    producer_bio:
      `${env.adminName} is a Ghanaian producer and mix engineer with 10+ years behind the desk. Credits span afrobeats, amapiano, drill, gospel and highlife — with a sound built on live instrumentation, hard-hitting drums and vocal-first arrangements.`,
    contact_email: env.supportMail,
    contact_phone: env.adminPhone,
    studio_location: "Accra, Ghana · Remote sessions worldwide",
    instagram: "https://instagram.com/",
    youtube: "https://youtube.com/",
    tiktok: "https://tiktok.com/",
    whatsapp: env.adminPhone,
    seeded_at: now,
  };
  for (const [key, value] of Object.entries(settings)) {
    await run(
      `INSERT INTO site_settings (key,value,updated_at) VALUES ($1,$2,$3)
       ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
      [key, value, now],
    );
  }

  /* ---- beats ----------------------------------------------------- */
  const createdBeats: Beat[] = [];
  for (const entry of CATALOGUE) {
    const slug = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let assets: Awaited<ReturnType<typeof generateBeatAssets>>;
    try {
      assets = await generateBeatAssets(entry, slug, 22);
    } catch (err) {
      console.error(`[seed] audio generation failed for ${entry.title}:`, (err as Error).message);
      assets = { artwork: "", preview_file: "", full_file: "", trackout_file: null };
    }

    await run(
      `INSERT INTO beats
        (id,slug,title,description,genre,mood,tags,bpm,musical_key,duration_sec,price_cents,currency,
         artwork,preview_file,full_file,trackout_file,is_free,exclusive_sold,published,featured,
         plays,downloads,likes,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,0,0,1,$17,$18,0,$19,$20,$20)`,
      [
        newId("beat"),
        slug,
        entry.title,
        entry.description,
        entry.genre,
        entry.mood,
        entry.tags.join(","),
        entry.bpm,
        entry.key,
        22,
        entry.priceCents,
        env.currency,
        assets.artwork || null,
        assets.preview_file || null,
        assets.full_file || null,
        assets.trackout_file || null,
        entry.featured ? 1 : 0,
        200 + entry.seed * 13,
        entry.seed * 3,
        now,
      ],
    );
    const beat = (await get<Beat>("SELECT * FROM beats WHERE slug = $1", [slug]))!;
    createdBeats.push(beat);
    await ensureDefaultLicenses(beat.id, beat.price_cents, beat.currency);
  }

  /* ---- videos ---------------------------------------------------- */
  for (const video of VIDEOS) {
    const beat = createdBeats.find((b) => b.title === video.beatTitle) ?? null;
    const slug = video.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const poster = await generateVideoPoster(video.title, env.appName, video.seed);
    await run(
      `INSERT INTO videos (id,slug,title,description,kind,url,file_path,poster,duration_sec,beat_id,published,views,created_at)
       VALUES ($1,$2,$3,$4,'visualizer',$5,$6,$7,$8,$9,1,$10,$11)`,
      [
        newId("vid"),
        slug,
        video.title,
        video.description,
        null,
        beat?.preview_file ?? null,
        poster,
        beat?.duration_sec ?? 22,
        beat?.id ?? null,
        40 + video.seed * 7,
        now,
      ],
    );
  }

  /* ---- a completed purchase so the artist vault isn't empty ------ */
  try {
    const { fulfillOrder } = await import("./fulfillment");
    const beat = createdBeats[0];
    const licenses = await all<{ id: string; name: string; price_cents: number }>(
      "SELECT id,name,price_cents FROM licenses WHERE beat_id = $1 ORDER BY tier ASC",
      [beat.id],
    );
    const license = licenses[1] ?? licenses[0];
    const order = await createSeedOrder({
      userId: demoArtist.id,
      beatId: beat.id,
      licenseId: license?.id ?? null,
      amount: license?.price_cents ?? beat.price_cents,
      method: "paystack",
      status: "paid",
      providerRef: "psk_demo_seed",
      phone: demoArtist.phone,
    });
    await fulfillOrder(order.id, { silent: true });

    const bankBeat = createdBeats[2];
    const bankLicenses = await all<{ id: string; price_cents: number }>(
      "SELECT id,price_cents FROM licenses WHERE beat_id = $1 ORDER BY tier ASC",
      [bankBeat.id],
    );
    await createSeedOrder({
      userId: demoArtist.id,
      beatId: bankBeat.id,
      licenseId: bankLicenses[0]?.id ?? null,
      amount: bankLicenses[0]?.price_cents ?? bankBeat.price_cents,
      method: "bank",
      status: "in_review",
      bankReference: "MTN-778812345",
      bankNote: "Sent from MTN MoMo, please confirm.",
      phone: demoArtist.phone,
    });
  } catch (err) {
    console.error("[seed] demo order failed:", (err as Error).message);
  }

  /* ---- messages -------------------------------------------------- */
  await run(
    `INSERT INTO messages (id,thread_id,direction,kind,from_user_id,to_user_id,from_name,from_email,subject,body,is_read,order_id,beat_id,created_at)
     VALUES ($1,NULL,'outbound','system',$2,$3,$4,$5,$6,$7,1,NULL,NULL,$8)`,
    [
      newId("msg"),
      admin.id,
      demoArtist.id,
      env.appName,
      env.supportMail,
      "Welcome to the family",
      `Hi ${demoArtist.name.split(" ")[0]} — your account is live. Every purchase is delivered by email and stored in your Vault. Reply to any email and it lands straight in my inbox.`,
      now,
    ],
  );

  await run(
    `INSERT INTO messages (id,thread_id,direction,kind,from_user_id,to_user_id,from_name,from_email,subject,body,is_read,order_id,beat_id,created_at)
     VALUES ($1,NULL,'inbound','contact',NULL,$2,$3,$4,$5,$6,0,NULL,NULL,$7)`,
    [
      newId("msg"),
      admin.id,
      "Ama Serwaa",
      "ama@example.com",
      "Custom afrobeat production",
      "Hi! I need a 2-minute afrobeat instrumental for my single dropping next month. Do you take custom work, and what is the turnaround?",
      now,
    ],
  );

  console.log(
    `[seed] created admin (${admin.email}), demo artist (${demoArtist.email}), ${createdBeats.length} beats, ${VIDEOS.length} videos`,
  );
  return true;
}

async function createSeedOrder(data: {
  userId: string;
  beatId: string;
  licenseId: string | null;
  amount: number;
  method: "mpesa" | "paystack" | "bank";
  status: string;
  providerRef?: string;
  bankReference?: string;
  bankNote?: string;
  phone?: string | null;
}) {
  const id = newId("ord");
  const now = nowIso();
  const reference = `2211-SEED-${id.slice(-6).toUpperCase()}`;
  await run(
    `INSERT INTO orders
      (id,reference,user_id,beat_id,license_id,amount_cents,currency,method,status,provider,provider_ref,
       phone,bank_reference,bank_note,delivered_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
    [
      id,
      reference,
      data.userId,
      data.beatId,
      data.licenseId,
      data.amount,
      env.currency,
      data.method,
      data.status,
      data.method,
      data.providerRef ?? null,
      data.phone ?? null,
      data.bankReference ?? null,
      data.bankNote ?? null,
      data.status === "paid" ? now : null,
      now,
    ],
  );
  return { id };
}

/** Wipes catalogue + uploads so the next boot reseeds from scratch. */
export async function resetDemoData() {
  for (const table of [
    "play_events",
    "email_log",
    "messages",
    "deliveries",
    "orders",
    "beat_files",
    "licenses",
    "videos",
    "beats",
    "site_settings",
    "users",
  ]) {
    await run(`DELETE FROM ${table}`);
  }
  try {
    for (const root of [PUBLIC_UPLOAD_ROOT, PRIVATE_UPLOAD_ROOT]) {
      await fsp.rm(path.join(root, "beats"), { recursive: true, force: true });
      await fsp.rm(path.join(root, "artwork"), { recursive: true, force: true });
      await fsp.rm(path.join(root, "videos"), { recursive: true, force: true });
    }
    await fsp.rm(path.join(process.cwd(), "storage", "deliveries"), { recursive: true, force: true });
    await fsp.rm(path.join(process.cwd(), "storage", "outbox"), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return seedIfEmpty();
}

export { fs, CATALOGUE };
