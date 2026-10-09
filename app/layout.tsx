import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PlayerProvider } from "@/components/player-context";
import { ToastProvider } from "@/components/Toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayerBar from "@/components/PlayerBar";
import { getSiteSettings } from "@/lib/site";
import { getSession } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/repo";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => null);
  const name = settings?.brandName ?? env.appName;
  return {
    metadataBase: new URL(env.appUrl),
    title: {
      default: `${name} — ${settings?.tagline ?? env.appTagline}`,
      template: `%s · ${name}`,
    },
    description:
      settings?.heroSub ??
      "Buy exclusive and non-exclusive beats online. Preview instantly, pay with mobile money, card or bank transfer, and get your files by email.",
    keywords: [
      "buy beats online",
      "beat store",
      "instrumentals",
      "afrobeats beats",
      "amapiano beats",
      "type beats",
      "mobile money beats",
      "beat licence",
    ],
    openGraph: {
      title: `${name} — ${settings?.tagline ?? env.appTagline}`,
      description: settings?.heroSub ?? "Studio-grade beats, instant delivery by email.",
      type: "website",
      siteName: name,
    },
    twitter: { card: "summary_large_image", title: name },
    icons: { icon: "/icon.svg" },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureBootstrapped();
  const [settings, session] = await Promise.all([getSiteSettings(), getSession()]);
  const unread = session ? await unreadMessageCount(session.id) : 0;

  return (
    <html lang="en">
      <body>
        <PlayerProvider>
          <ToastProvider>
            <Header session={session} brandName={settings.brandName} unread={unread} />
            <main id="main">{children}</main>
            <Footer settings={settings} />
            <PlayerBar />
          </ToastProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
