"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/orza/primitives";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";

const COLUMNS = [
  {
    title: "Product",
    items: [
      { label: "Features", href: "/#features" },
      { label: "Snap & Know", href: "/#features" },
      { label: "Voice AI", href: "/#voice" },
      { label: "Household modes", href: "/#household" },
    ],
  },
  {
    title: "Understand",
    items: [
      { label: "Pricing", href: "/pricing" },
      { label: "Trust & Safety", href: "/trust" },
      { label: "FAQ", href: "/faq" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Get Started", href: "/login?mode=signup" },
      { label: "Sign In", href: "/login" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/leads", { email: email.trim(), source: "footer" });
      toast.success("You're on the list. We'll keep you posted.");
      setEmail("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="relative w-full border-t border-[rgba(20,20,20,0.08)] bg-orza-bg-2">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-16">
          <div>
            <BrandMark showPronunciation={false} className="text-orza-strong [&>span:nth-child(2)]:text-[22px]" />
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-orza-muted">
              AI-powered wellness that evolves with you. Snap your meals, chat naturally, and thrive — judgment-free.
            </p>
            <form onSubmit={onSubscribe} className="mt-6 flex max-w-md gap-2">
              <label htmlFor="footer-email" className="sr-only">Email address</label>
              <Input
                id="footer-email"
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-full bg-white/80"
              />
              <Button type="submit" loading={busy} className="h-11 shrink-0">
                Stay updated
              </Button>
            </form>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-orza-subtle">{c.title}</div>
              <ul className="mt-4 space-y-3">
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link href={i.href} className="group inline-flex items-center gap-1 text-[15px] text-orza-muted transition-colors hover:text-orza-strong">
                      {i.label}
                      <ArrowUpRight size={12} className="opacity-0 transition-opacity group-hover:opacity-60" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-[rgba(20,20,20,0.08)] pt-6 text-[13px] text-orza-subtle sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ÖRZA. All rights reserved.</span>
          <span className="italic">General wellness guidance, not medical advice. Always consult a doctor for medical concerns.</span>
        </div>
      </div>
    </footer>
  );
}
