import { EventCardSkeleton } from "./EventCardSkeleton";

interface EventGridSkeletonProps {
  count?: number;
}

export function EventGridSkeleton({ count = 8 }: EventGridSkeletonProps) {
  return (
    <ul
      role="list"
      aria-label="Loading events"
      aria-busy="true"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <EventCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
