import { Suspense } from "react";
import type { Metadata } from "next";
import { MedicinesSkeleton, MedicinesView } from "@/components/care/meds/MedicinesView";

export const metadata: Metadata = { title: "Medicines" };

/** Medicines — today's doses with photos, 7-day adherence, medicine list, add/edit. `?add=1` / `?edit=<id>` open the sheet. */
export default function MedicinesPage() {
  return (
    <Suspense fallback={<MedicinesSkeleton />}>
      <MedicinesView />
    </Suspense>
  );
}
