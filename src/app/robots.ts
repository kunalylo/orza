import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/** Crawl the marketing site; keep the signed-in app, onboarding, sign-in and API out of search engines. */
export default function robots(): MetadataRoute.Robots {
  // NEXT_PUBLIC_SITE_URL, else the Vercel host; warns in production instead of quietly emitting localhost.
  const base = siteOrigin().origin;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/onboarding", "/login"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
