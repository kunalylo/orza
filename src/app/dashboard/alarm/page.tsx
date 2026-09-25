import { Suspense } from "react";
import type { Metadata } from "next";
import { AlarmView } from "@/components/care/meds/AlarmView";

export const metadata: Metadata = { title: "Medicine alarm" };

/** Full-screen medicine alarm with photos. `?med=<id>&at=<iso>` from notifications / calendar; no params = everything due now. */
export default function AlarmPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[80] bg-orza-hero" aria-hidden />}>
      <AlarmView />
    </Suspense>
  );
}
