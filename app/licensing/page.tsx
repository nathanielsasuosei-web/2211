import Link from "next/link";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { listBeats } from "@/lib/repo";
import { moneyLabel } from "@/lib/config";
import { IconCheck, IconClose, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Licensing" };

const TIERS = [
  {
    name: "MP3 Lease",
    mult: "1×",
    summary: "For demos, mixtapes and streaming releases up to 50,000 plays.",
    yes: ["MP3 320kbps (untagged)", "Up to 50,000 streams", "1 music video", "Non-profit live performance", "Producer credit required"],
    no: ["No stems", "No radio/TV", "Not exclusive"],
  },
  {
    name: "WAV Lease",
    mult: "≈1.8×",
    summary: "The standard release licence — lossless quality with higher caps.",
    yes: ["WAV 24-bit + MP3", "Up to 250,000 streams", "2 music videos", "Radio play (regional)", "Live performance", "Producer credit required"],
    no: ["No stems", "Not exclusive"],
  },
  {
    name: "Trackout Lease",
    mult: "≈3×",
    summary: "For artists who want their own engineer to mix the record.",
    yes: ["All stems (ZIP)", "WAV + MP3", "Up to 1,000,000 streams", "Unlimited videos", "Radio + TV", "Live performance"],
    no: ["Not exclusive"],
  },
  {
    name: "Exclusive Rights",
    mult: "≈8×",
    summary: "Full ownership. The beat is removed from the store permanently.",
    yes: ["Everything in Trackout", "Unlimited distribution", "Beat taken down from the store", "Splits negotiable", "No further licences sold"],
    no: ["Previous non-exclusive licences remain valid"],
  },
];

export default async function LicensingPage() {
  await ensureBootstrapped();
  const beats = await listBeats({ limit: 1 });
  const base = beats[0]?.price_cents ?? 12000;
  const currency = beats[0]?.currency ?? "GHS";

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 30 }}>
        <header className="stack" style={{ gap: 12, maxWidth: "70ch" }}>
          <span className="eyebrow">
            <IconShield size={12} /> Clear terms, no surprises
          </span>
          <h1 className="display h-lg">
            Licence <span className="red">tiers</span>
          </h1>
          <p className="lede">
            Every purchase includes a licence certificate by email. Prices below are indicative — the exact price per
            beat is shown on each beat page. Example base price: {moneyLabel(base, currency)}.
          </p>
        </header>

        <div className="license-grid">
          {TIERS.map((tier) => (
            <div key={tier.name} className="license-card">
              <span className="chip chip--red">{tier.mult}</span>
              <h3 className="h-sm display">{tier.name}</h3>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.6 }}>{tier.summary}</p>
              <ul>
                {tier.yes.map((y) => (
                  <li key={y}><IconCheck size={12} className="red" /> {y}</li>
                ))}
                {tier.no.map((n) => (
                  <li key={n} style={{ opacity: 0.55 }}><IconClose size={12} /> {n}</li>
                ))}
              </ul>
              <Link href="/beats" className="btn btn--primary btn--sm btn--block">Find a beat</Link>
            </div>
          ))}
        </div>

        <div className="panel panel--flat pad-lg stack" style={{ gap: 16 }}>
          <h2 className="display h-md">General terms</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <div className="stack" style={{ gap: 8 }}>
              <strong>Ownership</strong>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                The producer retains copyright in the composition and master unless you purchase Exclusive Rights. Your
                licence covers your vocal/lyrical contribution as a derivative work.
              </p>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <strong>Credit</strong>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Credit &quot;Produced by 2211&quot; on all public releases, metadata and video descriptions for
                non-exclusive licences.
              </p>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <strong>Publishing splits</strong>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Standard split is 50% writer / 50% publisher between artist and producer unless agreed otherwise in
                writing. Register the work with your PRO accordingly.
              </p>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <strong>Content ID &amp; fingerprinting</strong>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Do not register the raw instrumental with YouTube Content ID, Audiam or similar. Your released song with
                your vocals is fine to monetise.
              </p>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <strong>Refunds</strong>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Digital goods are non-refundable once delivered. If a file is corrupt or missing, we replace it free of
                charge — message us from your Studio.
              </p>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <strong>Upgrades</strong>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Upgrading from an MP3/WAV lease to Trackout or Exclusive? The amount you already paid is deducted from
                the upgrade price while the beat is still available.
              </p>
            </div>
          </div>
          <Link href="/contact" className="btn btn--outline" style={{ alignSelf: "flex-start" }}>
            Ask a licensing question
          </Link>
        </div>
      </div>
    </div>
  );
}
