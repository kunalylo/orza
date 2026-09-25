import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * Catch-all for URLs that match no other route, so they get the branded 404 from `(site)/not-found.tsx`
 * (with the site nav and footer) instead of Next's bare default page. Every defined route is more
 * specific than this one and wins over it.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function UnknownPage() {
  notFound();
}
