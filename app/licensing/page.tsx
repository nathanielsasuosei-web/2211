import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Licensing" };

export default function LicensingPage() {
  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 30 }}>
        <h1 className="sr-only">Licensing</h1>

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
