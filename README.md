# 2211 BEATS — beat store for a music producer

A complete, production-shaped storefront where a producer publishes beats and videos, artists create
accounts, pay with **M-Pesa (Daraja STK push)**, **Paystack** (card / mobile money / bank / USSD) or
**bank transfer**, and receive their files **by email** the moment payment clears — with every message
mirrored into the artist's Studio inbox.

Dark UI, red accent (`#e10600`), animated canvas hero, persistent bottom player, keyboard-friendly
beat store, and a producer console for uploads, orders, artists, messaging and settings.

> **Brand name:** the store currently ships as **"2211 BEATS"** (a placeholder). Rename it in
> `.env.local` (`APP_NAME`) or in the admin console under **Settings → Storefront copy** — the hero,
> header, footer, emails and licence certificates all read from there.

---

## Quick start

```bash
npm install
npm run setup      # creates storage/ and .env.local from .env.example
npm run dev        # http://localhost:3000
```

The first boot creates the schema and seeds a demo catalogue (8 beats with real synthesised audio,
cover art, 4 licence tiers each, 4 watch-page visualizers, a demo artist and a producer account).
No external services are required to try the whole purchase journey.

**Seeded logins** (change these before going live):

| Role | Email | Password |
| --- | --- | --- |
| Producer / admin | `admin@2211beats.com` | `Admin!2211` |
| Demo artist | `artist@demo.com` | `Artist!2211` |

Useful scripts:

```bash
npm run dev          # dev server on 0.0.0.0:3000
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # tsc --noEmit
npm run db:reset     # wipe database + uploads, then re-seed on next boot
node scripts/mint-session.mjs admin@2211beats.com   # dev helper: print a session JWT
```

---

## What is implemented

### Producer console (`/admin`)
- **Beats** — drag-and-drop upload of preview (tagged), master (untagged), trackout/stems ZIP and
  cover art; genre, mood, key, BPM, tags, description, base price; licence tiers auto-generated from
  the base price or entered as a custom string (`MP3 Lease:120|WAV Lease:220|Trackout:380|Exclusive:1200`);
  publish / feature / make-free toggles; inline editor that can replace any file; delete.
- **Videos** — upload an MP4/WebM, paste a YouTube/Vimeo link, or publish a **canvas visualizer**
  bound to one of your beats (used by the seeded demo so `/watch` works offline).
- **Orders** — filter by status or search a reference; approve a bank transfer (delivers files +
  emails), reject with a reason, re-send the delivery email, mark refunded.
- **Artists** — every registered artist with purchase count, total spend, location, last login;
  message or re-send the welcome email.
- **Messages** — inbox (contact form + artist replies) and sent log; composer with quick templates
  that emails one artist or **all** artists and lands in their Studio inbox.
- **Email outbox** — every email the platform sent, with transport, status, attachments and errors.
- **Settings** — storefront copy (brand, tagline, hero lines, bio, contact details, socials),
  integration status for Paystack / M-Pesa / bank / SMTP / database, webhook URLs, test email,
  demo-data reset.

### Storefront
- `/` animated hero (canvas waveform + equaliser + kinetic type), featured beats, genre shortcuts,
  how-it-works steps, watch strip, licence teaser.
- `/beats` filterable store (search, genre, mood, key, BPM range, price, sort) with **grid and row
  views**; `/beats/[slug]` detail page with waveform player, licence picker, credits and related beats.
- `/watch` video gallery with lightbox; `/licensing` full terms; `/about` producer bio; `/contact`
  enquiry form (emails the producer, auto-replies to the artist, stores the thread).
- Persistent player bar with queue, seek, volume, waveform and play-count tracking.

### Artist accounts
- `/signup`, `/login` (bcrypt + signed `jose` JWT in an `httpOnly` cookie, `next` redirect support).
- `/studio` — overview stats, **Vault** (every purchase with per-file and ZIP download links +
  licence certificate), order history with live status, **Messages** (accordion threads, auto-mark
  read, reply), profile & password settings.

### Checkout & payments
- `/checkout/[ref]` — order summary, method picker (M-Pesa, Paystack, bank transfer, demo),
  4-step timeline, cancel order, 4-second status polling.
- **M-Pesa Daraja**: OAuth token caching, `STK Push` (`Lipa na M-Pesa Online`), phone normalisation
  for `254`/`0`/`+254`, callback at `/api/payments/mpesa/callback` (idempotent, always answers
  `ResultCode 0`), plus a manual polling fallback that queries the STK status.
- **Paystack**: hosted checkout via `transaction/initialize`, return URL
  `/api/payments/paystack/callback` (server-side verify → fulfil → redirect), webhook
  `/api/payments/paystack/webhook` with **HMAC-SHA512 signature verification** and underpayment
  rejection.
- **Bank / mobile money (manual)**: shows your account details, captures the transfer reference,
  puts the order `in_review`, emails the producer, and delivers on approval.
- **Demo mode** (no keys configured): `/checkout/demo/[ref]` simulates approval or decline so the
  full journey can be tested offline.

### Fulfilment & email
- On payment: files are resolved per licence (MP3 / WAV / stems), a **ZIP bundle** is built with a
  licence certificate and README, the order becomes `delivered`, the artist is emailed (ZIP attached
  when under 12 MB, otherwise a secure tokenised download link), the producer is emailed, and a
  message is stored in the artist's inbox.
- `/api/download/[token]` serves the ZIP or a single file (`?file=<index>`), increments the download
  counter and is tied to the delivery token.
- `/api/file/[...path]` streams public media with **HTTP Range** support (206) and immutable caching;
  path traversal is blocked; private masters/stems are never exposed.
- Emails are rendered as responsive HTML (dark, red-accented) with plain-text fallbacks. With SMTP
  configured they are really sent; without it they are written to `storage/outbox/` and logged in
  `email_log` so nothing is lost while developing.

---

## Configuration

Copy `.env.example` to `.env.local`. Everything has a working default — the app boots with an empty
file.

| Variable | Purpose | Default |
| --- | --- | --- |
| `APP_URL` | Public base URL used in emails, callbacks and download links | `http://localhost:3000` |
| `APP_NAME` / `APP_TAGLINE` | Brand shown everywhere | `2211 BEATS` |
| `APP_SECRET` | JWT signing secret — **change in production** | dev value |
| `DATABASE_URL` | `postgres://…` for PostgreSQL; empty → SQLite at `storage/app.db` | empty |
| `CURRENCY` | Store currency (ISO 4217) | `GHS` |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Where files are stored, size cap | `storage/uploads`, `200` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_PHONE` | Producer account created on first boot | see above |
| `SUPPORT_EMAIL` | Reply-to address on every email | `hello@2211beats.com` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM` | Real email delivery | unset → local outbox |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Paystack checkout + webhook verification | unset → demo rail |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORT_CODE`, `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_URL` | Daraja STK push | unset → demo rail |
| `BANK_ENABLED`, `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_BRANCH`, `MOMO_NAME`, `MOMO_NUMBER` | Manual transfer instructions | demo values |

### Going live checklist
1. Set a strong `APP_SECRET` and real `ADMIN_*` credentials.
2. Point `DATABASE_URL` at PostgreSQL (Neon/Supabase/RDS) — the schema is created automatically on
   boot; no migration step needed.
3. Add Paystack keys (test → live) and set the webhook URL to
   `https://your-domain/api/payments/paystack/webhook`.
4. Add Daraja credentials and set `MPESA_CALLBACK_URL` to a publicly reachable
   `https://your-domain/api/payments/mpesa/callback`.
5. Add SMTP credentials and verify with **Admin → Settings → Send test email**.
6. Replace the demo catalogue: **Admin → Settings → Reset demo data**, then upload your own beats.

---

## Architecture

```
app/                     routes (storefront, studio, admin, api)
  api/
    file/[...path]       ranged media streaming (public uploads only)
    art                  generated SVG cover art fallback
    beats/[id]/play      play-count beacon
    download/[token]     secure delivery download (ZIP or single file)
    orders/[ref]/status  checkout polling endpoint
    payments/            paystack webhook + callback, mpesa callback
components/              client components (player context, cards, checkout, admin forms)
lib/
  config.ts              typed env + JWT signing helpers
  db.ts                  portable data layer: PostgreSQL (pg) or node:sqlite, one schema, $n params
  repo.ts                all queries (beats, licences, orders, deliveries, messages, settings)
  auth.ts                bcrypt hashing + jose session cookies
  storage.ts             upload tree, safe paths, mime guessing, size formatting
  fulfillment.ts         licence → files, ZIP bundle, deliver/fail an order
  mail.ts / emails.ts    SMTP or local outbox + every email template
  payments/              mpesa.ts, paystack.ts, options.ts (method availability per order)
  media/                 wav.mjs, zip.mjs, beat.mjs (synthesised demo audio), art.mjs (SVG art)
  actions/               server actions: auth, checkout, admin
  seed.ts                demo catalogue + asset generation
  bootstrap.ts           idempotent schema + seed on boot
instrumentation.ts       runs bootstrap once when the server starts
scripts/                 setup.mjs (storage/.env), mint-session.mjs (dev login helper)
storage/                 gitignored: app.db, uploads/{public,private}, deliveries, outbox
```

### Database portability note
The brief asked for **Next.js + Postgres/Prisma**. Prisma's engines are downloaded from
`binaries.prisma.sh`, which is unreachable in this sandbox, so the data layer is hand-written SQL
through a small driver in `lib/db.ts`: it uses the pure-JS `pg` pool when `DATABASE_URL` points at
PostgreSQL and Node's built-in `node:sqlite` otherwise. The schema is deliberately portable
(TEXT ids, INTEGER cents, ISO-8601 TEXT timestamps, no enums/JSON columns) so the exact same queries
run on both. Swapping Prisma in later is a drop-in replacement for `lib/db.ts` + `lib/repo.ts`.

### Demo media
No `ffmpeg` or Postgres binaries exist in this environment, so demo audio is **synthesised to
16-bit PCM WAV** in Node (`lib/media/beat.mjs` — drums, bass, keys, pads, plus a tagged 320 kbps-style
preview and a stems ZIP) and cover art is generated SVG (`lib/media/art.mjs`). Everything an admin
uploads (audio, artwork, videos, stems) is stored on disk and served through the ranged file API —
so real files behave exactly like the generated ones.

---

## Order lifecycle

```
pending → awaiting_payment → paid → delivered
                ↘ in_review (bank transfer, awaiting producer approval) → paid → delivered
                ↘ failed / cancelled / refunded
```

Payment methods: `mpesa`, `paystack`, `bank`, `demo`. Licence tiers: MP3 Lease (1×), WAV Lease (1.8×),
Trackout Lease (3×), Exclusive Rights (8×, marks the beat sold and unpublishes it).

---

## Testing the journey in five minutes

1. `npm run dev`, open the preview.
2. **Create account** → you land in the store.
3. Open any beat → pick a licence → **Buy** → choose a payment method.
   - *Demo mode*: pick "Simulated payment" → **Simulate approval** → files are delivered instantly.
   - *With keys*: M-Pesa sends a real STK prompt; Paystack opens hosted checkout; bank transfer asks
     for the reference and waits for producer approval in `/admin/orders`.
4. Check the order page: download links, per-file downloads, licence certificate.
5. Sign in as `admin@2211beats.com` → `/admin/emails` shows every email, and
   `storage/outbox/` contains the rendered HTML + attachments when SMTP is not configured.
