import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function round(n: number, digits = 0) {
  const f = 10 ** digits;
  return Math.round((Number(n) || 0) * f) / f;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-IN").format(Math.round(Number(n) || 0));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
