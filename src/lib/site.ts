import type { Metadata } from "next";

/**
 * Site-wide constants. Override the contact email with NEXT_PUBLIC_SUPPORT_EMAIL and the public
 * origin with NEXT_PUBLIC_SITE_URL (required in production: canonical links, Open Graph, sitemap,
 * calendar feed and notification links all build on it).
 */
export const SITE = {
  name: "ÖRZA",
  tagline: "Your health, reimagined by AI that evolves with you",
  description: "Snap your meals, chat naturally, get instant nutritional insights. Judgment-free wellness built for Indian households.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@orza.app",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100",
};

let warnedAboutOrigin = false;

/**
 * Public origin for server-side metadata (`metadataBase`, sitemap, robots). Uses
 * NEXT_PUBLIC_SITE_URL, then Vercel's production / deployment host, and only falls back to
 * localhost outside production — with a loud warning in production, because canonical and
 * og:url pointing at localhost would tell search engines to drop the real pages.
 */
export function siteOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      console.error(`[orza] NEXT_PUBLIC_SITE_URL is not a valid URL: "${configured}"`);
    }
  }
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return new URL(`https://${vercelHost.replace(/^https?:\/\//, "")}`);
  if (process.env.NODE_ENV === "production" && !warnedAboutOrigin) {
    warnedAboutOrigin = true;
    console.warn(
      "[orza] NEXT_PUBLIC_SITE_URL is not set — canonical links, Open Graph URLs and the sitemap will point at http://localhost:3100. Set it to the public https:// origin."
    );
  }
  return new URL("http://localhost:3100");
}

/** Social preview image (src/app/opengraph-image.tsx), listed explicitly because a page-level `openGraph` replaces the root one. */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "ÖRZA — AI-powered wellness that evolves with you",
} as const;

/** Open Graph fields every page shares. Spread it into page-level `openGraph` so site name, type, locale and image survive. */
export const OG_BASE = {
  type: "website",
  siteName: SITE.name,
  locale: "en_IN",
  images: [OG_IMAGE],
} as const;

/**
 * Metadata for a public page: title, description, canonical URL, and Open Graph / Twitter cards
 * that keep the shared site name and image (Next replaces — not merges — nested `openGraph`).
 *
 *   export const metadata = pageMetadata({ title: "Pricing", description: "…", path: "/pricing" });
 */
export function pageMetadata(opts: {
  /** Page title; the root layout's template adds " · ÖRZA". */
  title: string;
  description: string;
  /** Path of the page, e.g. "/pricing". */
  path: string;
  /** Title for social cards when it should differ from `title` (defaults to "<title> · ÖRZA"). */
  socialTitle?: string;
  /** Shorter description for social cards (defaults to `description`). */
  socialDescription?: string;
  /** Use `title` as-is, skipping the root "%s · ÖRZA" template (for titles that already carry the brand). */
  absoluteTitle?: boolean;
}): Metadata {
  const socialTitle = opts.socialTitle ?? (opts.absoluteTitle ? opts.title : `${opts.title} · ${SITE.name}`);
  const socialDescription = opts.socialDescription ?? opts.description;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: { ...OG_BASE, images: [...OG_BASE.images], url: opts.path, title: socialTitle, description: socialDescription },
    twitter: { card: "summary_large_image", title: socialTitle, description: socialDescription, images: [OG_IMAGE.url] },
  };
}
