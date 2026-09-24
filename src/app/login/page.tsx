import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthHeroPanel } from "@/components/auth/AuthHeroPanel";
import { destinationFor, parseAuthMode, safeNextPath } from "@/components/auth/safe-next";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const mode = parseAuthMode((await searchParams).mode);
  return {
    title: mode === "signup" ? "Create your account" : "Sign in",
    description: "Sign in to ÖRZA — snap your meals, chat naturally and get instant nutritional insights. 100 AI credits included.",
    robots: { index: mode === "signin", follow: true },
  };
}

/** /login — split screen: dark brand panel + cream panel with the auth card. `?mode=signup`, `?next=/path`. */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const mode = parseAuthMode(params.mode);
  const next = safeNextPath(params.next);

  // Signed-in visitors skip the form entirely.
  const user = await getCurrentUser();
  if (user) redirect(destinationFor(user, next));

  return (
    <main className="relative min-h-dvh bg-orza-bg-0 lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)]">
      <AuthHeroPanel />

      <section aria-label={mode === "signup" ? "Create your account" : "Sign in"} className="relative isolate flex flex-col">
        {/* Cream canvas: grain + a faint warm wash toward the brand side */}
        <div aria-hidden className="orza-canvas-grain pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 0% 30%, rgba(255,180,84,0.10) 0%, rgba(251,247,241,0) 55%)," +
              "radial-gradient(ellipse at 100% 100%, rgba(11,190,220,0.06) 0%, rgba(251,247,241,0) 50%)",
          }}
        />

        <div className="-mt-6 flex flex-1 items-start justify-center px-4 pb-12 sm:px-6 lg:mt-0 lg:items-center lg:px-10 lg:py-16">
          {/* Mode/next come from the awaited searchParams; `key` resets the form on soft navigation between modes. */}
          <AuthForm key={mode} initialMode={mode} next={next} />
        </div>
      </section>
    </main>
  );
}
