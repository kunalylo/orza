"use client";
import * as React from "react";
import { Pill } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A medicine's photo with a graceful fallback (pill illustration) when there is no photo or it
 * fails to load. `fit="contain"` keeps the whole strip / bottle visible (used on the alarm).
 */
export function MedPhoto({
  src,
  alt,
  className,
  fit = "cover",
  tone = "light",
  iconSize = 22,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  tone?: "light" | "dark";
  iconSize?: number;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — no photo yet`}
        className={cn(
          "flex items-center justify-center overflow-hidden",
          tone === "dark"
            ? "bg-[radial-gradient(circle_at_30%_25%,rgba(255,184,77,0.30),rgba(255,122,106,0.16)_45%,rgba(255,255,255,0.04)_75%)] text-white/80"
            : "bg-[radial-gradient(circle_at_30%_25%,#FFF1EA,#FBE3D8_55%,#F4E6DA)] text-[#E0593F]",
          className
        )}
      >
        <Pill size={iconSize} strokeWidth={1.6} aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(fit === "contain" ? "object-contain" : "object-cover", "bg-[#EFE7DD]", className)}
    />
  );
}
