import Link from "next/link";
import type { SiteSettings } from "@/lib/site";
import { GENRES, NAV_LINKS } from "@/lib/site-data";

export default function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  const socials = [
    { label: "Instagram", href: settings.instagram },
    { label: "YouTube", href: settings.youtube },
    { label: "TikTok", href: settings.tiktok },
    {
      label: "WhatsApp",
      href: settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/[^\d]/g, "")}` : "",
    },
  ].filter((s) => s.href);

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div className="stack" style={{ gap: 14 }}>
            <div className="brand">
              <span className="brand__mark">
                <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <g fill="#fff">
                    <rect x="9.5" y="17" width="3.6" height="7" rx="1.8" />
                    <rect x="15.4" y="12" width="3.6" height="17" rx="1.8" />
                    <rect x="21.3" y="8" width="3.6" height="24" rx="1.8" />
                    <rect x="27.2" y="15" width="3.6" height="11" rx="1.8" />
                  </g>
                </svg>
              </span>
              <span>
                {settings.brandName}
                <small>BEAT STORE</small>
              </span>
            </div>
            <p className="lede" style={{ fontSize: 14 }}>
              {settings.tagline}. {settings.studioLocation}
            </p>
            <div className="row row--wrap" style={{ gap: 8 }}>
              <a className="chip" href={`mailto:${settings.contactEmail}`}>
                {settings.contactEmail}
              </a>
              {settings.contactPhone && <span className="chip">{settings.contactPhone}</span>}
            </div>
          </div>

          <div>
            <h5>Browse</h5>
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/studio">Artist studio</Link>
              </li>
            </ul>
          </div>

          <div>
            <h5>Genres</h5>
            <ul>
              {GENRES.slice(0, 6).map((g) => (
                <li key={g}>
                  <Link href={`/beats?genre=${encodeURIComponent(g)}`}>{g} beats</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5>Account</h5>
            <ul>
              <li>
                <Link href="/signup">Create artist account</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
              <li>
                <Link href="/studio?tab=vault">My downloads</Link>
              </li>
              <li>
                <Link href="/contact">Custom production</Link>
              </li>
              {socials.length > 0 && (
                <li className="row row--wrap" style={{ gap: 6, marginTop: 8 }}>
                  {socials.map((s) => (
                    <a key={s.label} className="chip" href={s.href} target="_blank" rel="noreferrer noopener">
                      {s.label}
                    </a>
                  ))}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © {year} {settings.brandName}. All beats remain the property of the producer until an exclusive licence is
            purchased.
          </span>
          <span className="row" style={{ gap: 14 }}>
            <Link href="/licensing">Licence terms</Link>
            <Link href="/contact">Support</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
