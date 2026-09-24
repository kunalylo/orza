import { Suspense } from "react";
import type { Metadata } from "next";
import { MealLogSkeleton, MealLogView } from "@/components/meals/MealLogView";

export const metadata: Metadata = { title: "Meal log" };

/** Meal log — type or speak meals (English/Hindi/Hinglish), add from the food list, review the day. `?date=` / `?meal_type=` supported. */
export default function MealsPage() {
  return (
    <Suspense fallback={<MealLogSkeleton />}>
      <MealLogView />
    </Suspense>
  );
}
