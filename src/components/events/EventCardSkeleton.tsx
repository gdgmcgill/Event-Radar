/**
 * Loading skeleton for event cards
 */

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function EventCardSkeleton() {
  return (
    <Card 
      className="h-full overflow-hidden border-none shadow-md bg-card rounded-2xl flex flex-col"
      aria-busy="true"
      aria-label="Loading event card"
    >
      {/* Image Skeleton */}
      <div className="relative h-52 w-full overflow-hidden bg-secondary/20">
        <Skeleton className="h-full w-full rounded-none animate-pulse" />
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-grow p-5 gap-3">
        <div className="space-y-2">
          {/* Club Name */}
          <Skeleton className="h-3 w-24 rounded-full animate-pulse" />
          {/* Title */}
          <Skeleton className="h-6 w-full rounded-md animate-pulse" />
          <Skeleton className="h-6 w-3/4 rounded-md animate-pulse" />
        </div>

        {/* Description */}
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-4 w-full rounded-sm animate-pulse" />
          <Skeleton className="h-4 w-5/6 rounded-sm animate-pulse" />
        </div>

        {/* Details (Date, Time, Location) */}
        <div className="mt-auto pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-32 rounded-sm animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-20 rounded-sm animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-40 rounded-sm animate-pulse" />
          </div>
        </div>
      </div>

      {/* Footer / Tags */}
      <div className="px-5 pb-5 pt-0 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-16 rounded-full animate-pulse" />
        <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
        <Skeleton className="h-6 w-14 rounded-full animate-pulse" />
      </div>
    </Card>
  );
}
