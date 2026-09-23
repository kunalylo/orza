"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/orza/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For families", href: "/#household" },
  { label: "Pricing", href: "/pricing" },
  { label: "Trust", href: "/trust" },
  { label: "FAQ", href: "/faq" },
];

/**
 * Floating glass pill nav. On the home page it starts transparent over the dark hero
 * and turns into frosted glass after 24px of scroll.
 */
export function SiteNav({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  React.useEffect(() => setOpen(false), [pathname]);

  const isHome = pathname === "/";
  const dark = isHome && !scrolled;

  return (
    <>
      <motion.header
        initial={reduce ? false : { y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn(
          "fixed left-1/2 top-3 z-40 w-[min(1200px,calc(100%-24px))] -translate-x-1/2 rounded-full",
          "transition-[background-color,box-shadow,border-color,color] duration-220 ease-orza",
          dark
            ? "border border-transparent bg-transparent text-white/90"
            : "border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.62)] text-orza-strong shadow-orza-floating backdrop-blur-orza"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 sm:h-16 sm:px-5">
          <Link href="/" aria-label="ÖRZA home" className="flex items-center">
            <BrandMark tone={dark ? "dark" : "light"} />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((l) => {
              const active = !l.href.includes("#") && pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "text-sm transition-colors duration-150 ease-orza",
                    dark ? "text-white/75 hover:text-white" : "text-orza-muted hover:text-orza-strong",
                    active && "text-orza-strong underline decoration-[rgba(11,190,220,0.55)] underline-offset-8"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link
                href="/dashboard"
                className={cn(
                  "hidden h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-220 ease-orza sm:inline-flex sm:h-10 sm:px-5",
                  dark ? "bg-white text-[#141414] hover:bg-white/90" : "bg-[#141414] text-orza-bg-0 shadow-orza-cta hover:bg-black"
                )}
              >
                Open ÖRZA <ArrowUpRight size={14} strokeWidth={1.75} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(
                    "hidden h-9 items-center rounded-full px-3 text-sm transition-colors duration-150 ease-orza sm:inline-flex",
                    dark ? "text-white/80 hover:text-white" : "text-orza-muted hover:text-orza-strong"
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href="/login?mode=signup"
                  className={cn(
                    "hidden h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-220 ease-orza sm:inline-flex sm:h-10 sm:px-5",
                    dark
                      ? "bg-white text-[#141414] shadow-[0_10px_24px_rgba(255,255,255,0.14)] hover:bg-white/90"
                      : "bg-[#141414] text-orza-bg-0 shadow-orza-cta hover:bg-black"
                  )}
                >
                  Get Started <ArrowUpRight size={14} strokeWidth={1.75} />
                </Link>
              </>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-150 ease-orza lg:hidden",
                    dark
                      ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
                      : "border-[rgba(20,20,20,0.12)] bg-white/60 text-orza-strong hover:bg-white/80"
                  )}
                >
                  <Menu size={18} strokeWidth={1.75} />
                </button>
              </DialogTrigger>
              <DialogContent side="right" title="ÖRZA" description="Your health, reimagined.">
                <div className="flex flex-col gap-1">
                  {NAV_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-orza-sm px-3 py-3 text-base font-medium text-orza-muted transition-colors hover:bg-white/70 hover:text-orza-strong"
                    >
                      {l.label}
                      <ArrowUpRight size={14} strokeWidth={1.75} className="opacity-40" />
                    </Link>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-2 border-t border-[rgba(20,20,20,0.08)] pt-6">
                  {signedIn ? (
                    <Link href="/dashboard" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#141414] text-sm font-medium text-orza-bg-0">
                      Open ÖRZA <ArrowUpRight size={14} />
                    </Link>
                  ) : (
                    <>
                      <Link href="/login?mode=signup" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#141414] text-sm font-medium text-orza-bg-0">
                        Get Started <ArrowUpRight size={14} />
                      </Link>
                      <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white/70 text-sm font-medium text-orza-strong">
                        Sign In
                      </Link>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.header>
      {!isHome && <div className="h-20 sm:h-24" aria-hidden />}
    </>
  );
}
