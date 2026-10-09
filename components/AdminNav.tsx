"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBolt,
  IconCard,
  IconGrid,
  IconMail,
  IconMusic,
  IconSettings,
  IconUpload,
  IconUsers,
  IconVideo,
} from "./icons";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: IconGrid, exact: true },
  { href: "/admin/beats", label: "Beats & uploads", icon: IconMusic },
  { href: "/admin/import", label: "Bulk import", icon: IconUpload },
  { href: "/admin/videos", label: "Videos", icon: IconVideo },
  { href: "/admin/orders", label: "Orders & payments", icon: IconCard },
  { href: "/admin/artists", label: "Artists", icon: IconUsers },
  { href: "/admin/messages", label: "Messages", icon: IconMail },
  { href: "/admin/emails", label: "Email outbox", icon: IconBolt },
  { href: "/admin/settings", label: "Settings", icon: IconSettings },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-side panel panel--flat" aria-label="Admin">
      <span className="sep">Console</span>
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            <l.icon size={16} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
