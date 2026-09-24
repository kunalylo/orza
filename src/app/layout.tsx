import type { Metadata, Viewport } from "next";
import { Figtree, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ÖRZA — AI-powered wellness that evolves with you",
    template: "%s · ÖRZA",
  },
  description:
    "Snap your meals, chat naturally, get instant nutritional insights. ÖRZA is an India-first AI wellness platform that learns your lifestyle, respects your choices and helps you thrive — judgment-free.",
  applicationName: "ÖRZA",
  keywords: ["AI nutrition", "calorie tracker", "Indian food calories", "wellness app", "meal scanner", "Hinglish voice logging"],
  openGraph: {
    type: "website",
    siteName: "ÖRZA",
    title: "ÖRZA — Your health, reimagined by AI that evolves with you",
    description: "Snap your meals, chat naturally, get instant nutritional insights. Judgment-free wellness built for Indian households.",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ÖRZA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${playfair.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-orza-bg-0 font-sans text-orza antialiased">
        {children}
        <Toaster
          position="bottom-center"
          theme="light"
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
