import * as React from "react";
import { Skeleton } from "@/components/ui/form";

/** Loading placeholder mirroring the Today layout. `withHeader` for the route-level fallback. */
export function TodaySkeleton({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading your day">
      {withHeader && (
        <div className="mb-6 flex flex-col gap-5 sm:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-9 w-72 max-w-full sm:h-11" />
            <Skeleton className="mt-3 h-6 w-40 rounded-full" />
          </div>
          <Skeleton className="h-11 w-52 rounded-full" />
        </div>
      )}

      <Skeleton className="h-[112px] w-full rounded-orza-md sm:h-[130px]" />

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1.45fr_1fr] lg:gap-6">
        <div className="rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/50 p-5 sm:p-7">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <Skeleton className="h-[208px] w-[208px] shrink-0 rounded-full" />
            <div className="w-full flex-1 space-y-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-40" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[196px] w-full rounded-orza-md" />
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[92px] rounded-orza-md lg:h-[68px]" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={i === 2 ? "h-[260px] rounded-orza-md sm:col-span-2 lg:col-span-1" : "h-[260px] rounded-orza-md"} />
        ))}
      </div>

      <div className="mt-10">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-8 w-52" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[140px] rounded-orza-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
