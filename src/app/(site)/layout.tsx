import { SiteNav } from "@/components/orza/SiteNav";
import { SiteFooter } from "@/components/orza/SiteFooter";
import { getSessionUserId } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getSessionUserId());
  return (
    <>
      <SiteNav signedIn={signedIn} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
