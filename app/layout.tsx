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
import { normalizeAccent, themeCssVars, themeInitScript } from "@/lib/theme";

export const dynamic = "force-dynamic";

function safeAppUrl(): URL | undefined {
  try {
    return new URL(env.appUrl);
  } catch {
    try {
      return new URL("http://localhost:3000");
    } catch {
      return undefined;
    }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => null);
  const name = settings?.brandName ?? env.appName;
  const base = safeAppUrl();
  return {
    ...(base ? { metadataBase: base } : {}),
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

export async function generateViewport(): Promise<Viewport> {
  const settings = await getSiteSettings().catch(() => null);
  return {
    themeColor: normalizeAccent(settings?.accentColor ?? env.accentColor),
    colorScheme: "dark",
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Bootstrap should never crash the layout
  try {
    await ensureBootstrapped();
  } catch (err) {
    console.error("[layout] bootstrap failed:", err);
  }

  let settings;
  try {
    settings = await getSiteSettings();
  } catch (err) {
    console.error("[layout] getSiteSettings failed:", err);
    settings = {
      brandName: env.appName,
      tagline: env.appTagline,
      accentColor: env.accentColor,
      heroEyebrow: "",
      heroLine1: "BEATS THAT",
      heroLine2: "MOVE",
      heroLine3: "CROWDS",
      heroSub: "",
      producerBio: "",
      contactEmail: env.supportMail,
      contactPhone: env.adminPhone,
      studioLocation: "",
      instagram: "",
      youtube: "",
      tiktok: "",
      whatsapp: "",
      raw: {},
    } as any;
  }

  let session = null;
  try {
    session = await getSession();
  } catch (err) {
    console.error("[layout] getSession failed:", err);
  }

  let unread = 0;
  if (session) {
    try {
      unread = await unreadMessageCount(session.id);
    } catch (err) {
      console.error("[layout] unreadMessageCount failed:", err);
    }
  }

  const accent = normalizeAccent(settings.accentColor);

  return (
    <html lang="en" style={themeCssVars(accent) as React.CSSProperties} suppressHydrationWarning>
      <body>
        {/* Applies a visitor's saved accent colour before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <PlayerProvider>
          <ToastProvider>
            <Header session={session} brandName={settings.brandName} brandAccent={accent} unread={unread} />
            <main id="main">{children}</main>
            <Footer settings={settings} />
            <PlayerBar />
          </ToastProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
