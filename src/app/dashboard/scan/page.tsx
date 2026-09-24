import { Suspense } from "react";
import type { Metadata } from "next";
import { ScanSkeleton, ScanView } from "@/components/meals/ScanView";

export const metadata: Metadata = { title: "Snap & Know" };

/** Snap & Know — photograph a meal, review ÖRZA's estimate, log it. `?date=` / `?meal_type=` supported. */
export default function ScanPage() {
  return (
    <Suspense fallback={<ScanSkeleton />}>
      <ScanView />
    </Suspense>
  );
}
