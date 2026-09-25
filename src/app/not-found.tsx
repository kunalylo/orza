import type { Metadata } from "next";
import { SiteNav } from "@/components/orza/SiteNav";
import { SiteFooter } from "@/components/orza/SiteFooter";
import { NotFoundContent } from "@/components/pages/NotFoundContent";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * Root 404: a `notFound()` thrown outside the marketing group (/dashboard, /login, /onboarding …)
 * lands here, so it gets the same branded page as `(site)/not-found.tsx` instead of Next's default.
 */
export default function RootNotFound() {
  return (
    <>
      <SiteNav />
      <main>
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
