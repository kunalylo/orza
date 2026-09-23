import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "hero" | "hero-outline" | "danger" | "energy";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap select-none",
    "transition-[background-color,box-shadow,color,border-color,opacity] duration-220 ease-orza",
    "disabled:opacity-50 disabled:pointer-events-none",
    {
      primary: "bg-[#141414] text-orza-bg-0 hover:bg-black shadow-orza-cta",
      secondary: "bg-white/70 text-orza-strong border border-[rgba(20,20,20,0.12)] hover:bg-white backdrop-blur-orza",
      ghost: "text-orza-muted hover:text-orza-strong hover:bg-white/60",
      hero: "bg-white text-[#0B0F14] hover:bg-white/95 shadow-[0_18px_60px_rgba(255,255,255,0.14)]",
      "hero-outline": "border border-white/25 text-white/85 hover:text-white hover:border-white/40",
      danger: "bg-[#B02C2C] text-white hover:bg-[#962424]",
      energy: "bg-orza-energy text-white shadow-[0_14px_40px_rgba(255,122,106,0.35)] hover:opacity-95",
    }[variant],
    {
      sm: "h-9 px-4 text-[13px]",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-6 text-sm",
      icon: "h-10 w-10 p-0",
    }[size],
    className
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonVariants({ variant, size, className })}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link href={href} className={buttonVariants({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}
