import { SiteNav } from "@/components/orza/SiteNav";
import { SiteFooter } from "@/components/orza/SiteFooter";

// No cookie reads here, so marketing pages stay static; SiteNav detects sign-in on the client.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
