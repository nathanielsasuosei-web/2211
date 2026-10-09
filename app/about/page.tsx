import Link from "next/link";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSiteSettings } from "@/lib/site";
import { dashboardStats, listBeats, listGenres } from "@/lib/repo";
import { IconBolt, IconCheck, IconMail, IconMusic, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Producer" };

export default async function AboutPage() {
  await ensureBootstrapped();
  const [settings, stats, beats, genres] = await Promise.all([
    getSiteSettings(),
    dashboardStats(),
    listBeats({ sort: "popular", limit: 6 }),
    listGenres(),
  ]);

  return (
    <div className="section section--tight">
      <div className="wrap stack" style={{ gap: 34 }}>
        <header className="stack" style={{ gap: 14, maxWidth: "74ch" }}>
          <span className="eyebrow">The producer</span>
          <h1 className="display h-lg">
            Sound built for <span className="red">artists who release</span>
          </h1>
          <p className="lede">{settings.producerBio}</p>
        </header>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="stat"><b>{stats.beats}</b><span>Beats in catalogue</span></div>
          <div className="stat"><b>{stats.artists}</b><span>Artists served</span></div>
          <div className="stat"><b>{genres.length}</b><span>Genres covered</span></div>
          <div className="stat"><b>{stats.orders}</b><span>Licences delivered</span></div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
          <div className="panel panel--flat pad-lg stack" style={{ gap: 14 }}>
            <h2 className="display h-sm">Services</h2>
            {[
              ["Beat licensing", "Instant delivery of MP3, WAV and trackout stems with a signed licence."],
              ["Custom production", "A record built around your reference, key and tempo — 24–72 hour turnaround."],
              ["Recording sessions", "Vocal tracking, comping and tuning in the Accra studio or remotely."],
              ["Mix & master", "Streaming-ready masters with stems on request."],
            ].map(([title, body]) => (
              <div key={title} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className="chip chip--red" style={{ marginTop: 2 }}><IconCheck size={13} /></span>
                <div>
                  <strong style={{ fontSize: 14.5 }}>{title}</strong>
                  <p className="tiny muted" style={{ margin: "3px 0 0", lineHeight: 1.6 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="panel panel--flat pad-lg stack" style={{ gap: 14 }}>
            <h2 className="display h-sm">Studio</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7, fontSize: 14.5 }}>
              {settings.studioLocation}
            </p>
            <div className="stack" style={{ gap: 8 }}>
              <span className="row" style={{ gap: 9 }}><IconMail size={15} className="red" /> <a className="muted" href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></span>
              {settings.contactPhone && <span className="row" style={{ gap: 9 }}><IconBolt size={15} className="red" /> <span className="muted">{settings.contactPhone}</span></span>}
              <span className="row" style={{ gap: 9 }}><IconMusic size={15} className="red" /> <span className="muted">{genres.slice(0, 5).join(" · ")}</span></span>
              <span className="row" style={{ gap: 9 }}><IconShield size={15} className="red" /> <span className="muted">Secure checkout · Mobile money accepted</span></span>
            </div>
            <div className="row row--wrap" style={{ gap: 10 }}>
              <Link href="/contact" className="btn btn--primary btn--sm">Book a session</Link>
              <Link href="/beats" className="btn btn--outline btn--sm">Browse beats</Link>
            </div>
          </div>
        </div>

        {beats.length > 0 && (
          <section className="stack" style={{ gap: 16 }}>
            <h2 className="display h-md">Most played this month</h2>
            <div className="row row--wrap" style={{ gap: 10 }}>
              {beats.map((b) => (
                <Link key={b.id} href={`/beats/${b.slug}`} className="chip chip--red">
                  {b.title} · {b.plays} plays
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
