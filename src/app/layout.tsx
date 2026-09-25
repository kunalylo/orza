import type { Metadata, Viewport } from "next";
import { Figtree, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { SITE, siteOrigin } from "@/lib/site";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    default: "ÖRZA — AI-powered wellness that evolves with you",
    template: "%s · ÖRZA",
  },
  description:
    "Snap your meals, chat naturally, get instant nutritional insights. ÖRZA is an India-first AI wellness platform that learns your lifestyle, respects your choices and helps you thrive — judgment-free.",
  applicationName: SITE.name,
  keywords: ["AI nutrition", "calorie tracker", "Indian food calories", "wellness app", "meal scanner", "Hinglish voice logging"],
  // The image comes from src/app/opengraph-image.tsx. Pages that set their own `openGraph` must use
  // `pageMetadata()` / `OG_BASE` from src/lib/site.ts, or they lose the site name, type and image.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_IN",
    title: `ÖRZA — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F1",
  width: "device-width",
  initialScale: 1,
};

/*
 * Toasts sit above the app's mobile bottom tab bar (below lg) instead of covering it; the offset
 * comes from --orza-toast-bottom in globals.css, which drops back to the normal gap on desktop.
 */
const TOAST_OFFSET = { bottom: "var(--orza-toast-bottom)" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${playfair.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-orza-bg-0 font-sans text-orza antialiased">
        {children}
        <Toaster
          position="bottom-center"
          theme="light"
          offset={TOAST_OFFSET}
          mobileOffset={TOAST_OFFSET}
          toastOptions={{
            style: {
              background: "rgba(255,255,255,0.88)",
              color: "#141414",
              border: "1px solid rgba(20,20,20,0.10)",
              backdropFilter: "blur(22px) saturate(1.35)",
              borderRadius: "16px",
            },
          }}
        />
      </body>
    </html>
  );
}
