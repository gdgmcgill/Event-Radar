"use client";

import { useEventReviews } from "@/hooks/useAnalytics";
import { useAuthStore } from "@/store/useAuthStore";

/** No public average, star display, attendee comments, or submission form.
 * The server and RLS separately restrict this history to author/admin rows.
 */
export function EventReviewsSection({ eventId }: { eventId: string }) {
  const user = useAuthStore((state) => state.user);
  const { data, error, isLoading, mutate } = useEventReviews(eventId, user?.id);
  if (!user || isLoading) return null;
  if (error) return <div role="alert" className="text-sm text-muted-foreground">
    Private review history could not be loaded.
    <button type="button" onClick={() => void mutate()} className="ml-2 underline">Try again</button>
  </div>;
  if (!data?.reviews.length) return null;
  return <section aria-label="Private legacy review history" className="space-y-3 rounded-xl border p-4">
    <h3 className="font-semibold">{user.roles?.includes("admin") ? "Private legacy review history" : "Your private review history"}</h3>
    <p className="text-sm text-muted-foreground">These past responses are kept privately. New legacy reviews are closed.</p>
    {data.reviews.map((review) => <article key={review.id} className="space-y-1 border-t pt-3 text-sm">
      <p>Legacy rating: {review.rating}/5</p>
      {review.comment && <p>{review.comment}</p>}
      <time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time>
    </article>)}
  </section>;
}
