import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { LEGAL_UPDATED } from "@/components/pages/legal/updated";

/** Public marketing pages only; the app, sign-in and API stay out of search results (see robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  // NEXT_PUBLIC_SITE_URL, else the Vercel host; warns in production instead of quietly emitting localhost.
  const base = siteOrigin().origin;
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly"; lastModified?: string }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.8, changeFrequency: "monthly" },
    { path: "/trust", priority: 0.7, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.4, changeFrequency: "yearly", lastModified: LEGAL_UPDATED.iso },
    { path: "/terms", priority: 0.4, changeFrequency: "yearly", lastModified: LEGAL_UPDATED.iso },
  ];
  return pages.map((p) => ({
    url: p.path === "/" ? base : `${base}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    ...(p.lastModified ? { lastModified: p.lastModified } : {}),
  }));
}
