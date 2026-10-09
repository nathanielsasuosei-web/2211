"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, IconMenu, IconUser } from "./icons";
import { NAV_LINKS } from "@/lib/site-data";
import type { SessionUser } from "@/lib/types";

export default function Header({
  session,
  brandName,
  unread = 0,
}: {
  session: SessionUser | null;
  brandName: string;
  unread?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="header" data-scrolled={scrolled}>
      <div className="wrap header__inner">
        <Link href="/" className="brand" aria-label={`${brandName} home`}>
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
            {brandName}
            <small>BEAT STORE</small>
          </span>
        </Link>

        <nav className="nav grow" data-open={open} aria-label="Main">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          {session?.role === "admin" && (
            <Link href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined}>
              Admin
            </Link>
          )}
        </nav>

        <div className="row" style={{ gap: 8 }}>
          <Link href="/beats" className="btn btn--ghost btn--sm hide-sm">
            <span className="eq" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            Browse beats
          </Link>

          {session ? (
            <>
              <Link
                href={session.role === "admin" ? "/admin" : "/studio"}
                className="btn btn--dark btn--sm hide-sm"
                title={`${session.name} (${session.email})`}
              >
                <IconUser size={15} />
                {session.name.split(" ")[0]}
                {unread > 0 && (
                  <span className="chip chip--red" style={{ padding: "1px 7px" }}>
                    {unread}
                  </span>
                )}
              </Link>
              <Link href={session.role === "admin" ? "/admin" : "/studio?tab=vault"} className="btn btn--primary btn--sm">
                {session.role === "admin" ? "Admin panel" : "My Vault"}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn--ghost btn--sm hide-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn--primary btn--sm">
                Create account
              </Link>
            </>
          )}

          <button
            type="button"
            className="btn btn--ghost btn--icon nav-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="wrap" style={{ paddingBottom: 16 }}>
          <div className="panel pad stack" style={{ gap: 10 }}>
            {session ? (
              <Link
                href={session.role === "admin" ? "/admin" : "/studio"}
                className="btn btn--primary btn--block"
              >
                <IconUser size={16} /> {session.role === "admin" ? "Admin panel" : "My Studio"}
              </Link>
            ) : (
              <Link href="/login" className="btn btn--dark btn--block">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
