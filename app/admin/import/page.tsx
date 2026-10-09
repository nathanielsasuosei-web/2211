import Link from "next/link";
import { scanImportFolder, importDir } from "@/lib/importer";
import { humanBytes } from "@/lib/format";
import { moneyLabel } from "@/lib/config";
import AdminImport from "@/components/AdminImport";
import { IconCheck, IconClock, IconUpload } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Bulk import" };

const ROLE_LABEL: Record<string, string> = {
  preview: "Preview (tagged)",
  master: "Master (untagged)",
  trackout: "Stems ZIP",
  artwork: "Artwork",
  video: "Video",
  extra: "Extra deliverable",
};

export default async function AdminImportPage() {
  const plan = scanImportFolder();
  const dir = importDir();

  return (
    <>
      <section className="stack" style={{ gap: 14 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">
            <IconUpload size={12} /> Bulk import
          </span>
          <h2 className="display h-md">Replace the demo catalogue</h2>
          <p className="lede">
            Drop your real audio, stems, artwork and videos into the import folder and publish them all at once —
            metadata is read from <span className="mono">beat.json</span>, <span className="mono">manifest.json</span> or
            inferred from the file names (<span className="mono">Afrobeats - Accra Nights (142 BPM) (F# min).wav</span>).
          </p>
        </div>

        <div className="panel pad stack" style={{ gap: 10 }}>
          <div className="row row--between row--wrap" style={{ gap: 10 }}>
            <strong style={{ fontSize: 14.5 }}>Import folder</strong>
            <span className={`chip ${plan.exists ? "chip--ok" : "chip--warn"}`}>
              {plan.exists ? <IconCheck size={12} /> : <IconClock size={12} />}
              {plan.exists ? "Found" : "Not created yet"}
            </span>
          </div>
          <span className="tiny mono muted">{dir}</span>
          <pre className="tiny mono" style={{ margin: 0, lineHeight: 1.75, whiteSpace: "pre-wrap", color: "var(--muted)" }}>
{`storage/import/
  accra-nights/            ← one folder per beat
    preview.mp3            ← tagged player preview
    master.wav             ← untagged file buyers receive
    stems.zip              ← trackout (optional)
    artwork.jpg            ← cover (optional)
    beat.json              ← { "title": "Accra Nights", "genre": "Afrobeats",
                               "bpm": 142, "key": "F# minor", "mood": "Dark",
                               "price": 150, "tags": ["afro","guitar"],
                               "licences": "MP3 Lease:150|WAV Lease:260|Trackout:420|Exclusive:1400",
                               "description": "…", "published": true }

  Afrobeats - Velvet Room (140 BPM) (F min).wav   ← or flat files, matched by name
  Afrobeats - Velvet Room (140 BPM) (F min).jpg
  manifest.json            ← optional: explicit list of beats + file paths`}
          </pre>
          <p className="tiny dim" style={{ margin: 0, lineHeight: 1.6 }}>
            Masters and stems are copied into the private upload tree (reachable only through a delivery token);
            previews, artwork and videos go to the public tree. Set <span className="mono">IMPORT_DIR</span> to use a
            different folder.{" "}
            <Link href="/admin/beats" className="red">Prefer uploading one at a time?</Link>
          </p>
        </div>
      </section>

      {!plan.exists ? (
        <div className="empty">
          <h4>Nothing to import yet</h4>
          <p>
            Create the folder above, copy your files in, then reload this page. Everything stays on your server — the
            importer never uploads to a third party.
          </p>
        </div>
      ) : plan.beats.length === 0 && plan.videos.length === 0 ? (
        <div className="empty">
          <h4>The folder is empty</h4>
          <p>Add audio (MP3/WAV/FLAC/AIFF), artwork, stems ZIPs or videos and reload.</p>
        </div>
      ) : (
        <section className="stack" style={{ gap: 14 }}>
          <div className="row row--between row--wrap" style={{ gap: 10 }}>
            <h3 className="display h-sm">
              {plan.beats.length} beat{plan.beats.length === 1 ? "" : "s"}
              {plan.videos.length ? ` · ${plan.videos.length} video${plan.videos.length === 1 ? "" : "s"}` : ""} ready
            </h3>
            {plan.manifestName && <span className="chip chip--info">using {plan.manifestName}</span>}
          </div>

          <AdminImport
            beats={plan.beats.map((b) => ({
              key: b.key,
              title: b.meta.title ?? b.stem,
              slug: b.slug,
              genre: b.meta.genre ?? "—",
              bpm: b.meta.bpm ?? null,
              musical_key: b.meta.key ?? null,
              price: b.meta.price ?? null,
              duration: b.durationSec,
              metaSource: b.metaSource,
              warnings: b.warnings,
              files: b.files.map((f) => ({ role: ROLE_LABEL[f.role] ?? f.role, name: f.name, bytes: f.bytes })),
            }))}
            videos={plan.videos.map((v) => ({
              key: v.key,
              title: v.meta.title ?? v.stem,
              files: v.files.map((f) => ({ role: ROLE_LABEL[f.role] ?? f.role, name: f.name, bytes: f.bytes })),
              warnings: v.warnings,
            }))}
          />
        </section>
      )}

      <section className="stack" style={{ gap: 10 }}>
        <h3 className="display h-sm">After importing</h3>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {[
            { title: "Check the store", body: "Open /beats and play every preview — the player streams from the public upload tree with HTTP Range support.", href: "/beats" },
            { title: "Review licence tiers", body: "Prices come from beat.json or the licences string; otherwise the four default tiers are generated from the base price.", href: "/admin/beats" },
            { title: "Remove the demo beats", body: "Admin → Beats → Delete, or Settings → Reset demo data for a full wipe before importing your catalogue.", href: "/admin/settings" },
          ].map((c) => (
            <article key={c.title} className="panel panel--flat pad stack" style={{ gap: 6 }}>
              <Link href={c.href} className="display" style={{ fontSize: 15.5 }}>{c.title}</Link>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>{c.body}</p>
            </article>
          ))}
        </div>
        <p className="tiny dim">
          Storage used by imported files:{" "}
          {humanBytes(plan.beats.concat(plan.videos).reduce((sum, b) => sum + b.files.reduce((s, f) => s + f.bytes, 0), 0))}
          {" "}· base price default {moneyLabel(10000)}
        </p>
      </section>
    </>
  );
}
