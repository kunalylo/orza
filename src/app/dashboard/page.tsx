"use client";
import { Suspense } from "react";
import { TodaySkeleton } from "@/components/today/TodaySkeleton";
import { TodayView } from "./_today/TodayView";

/** Today — calories ring, macros, ÖRZA's one-liner, water/steps/weight and the day's meals. `?date=` browses past days. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<TodaySkeleton withHeader />}>
      <TodayView />
    </Suspense>
  );
}
