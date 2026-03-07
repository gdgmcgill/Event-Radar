"use client";

import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StarRating } from "@/components/events/StarRating";
import { useEventReviews } from "@/hooks/useAnalytics";

interface EventReviewsSectionProps {
  eventId: string;
  isOrganizer: boolean;
}

export function EventReviewsSection({
  eventId,
  isOrganizer,
}: EventReviewsSectionProps) {
  const { data, isLoading } = useEventReviews(eventId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.aggregate.total_reviews === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No reviews yet
        </CardContent>
      </Card>
    );
  }

  const { aggregate } = data;
  const maxCount = Math.max(...aggregate.distribution.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average Rating */}
        <div className="flex items-center gap-3">
          <StarRating value={Math.round(aggregate.average_rating)} readonly size="md" />
          <span className="text-lg font-semibold">
            {aggregate.average_rating.toFixed(1)} / 5
          </span>
          <span className="text-sm text-muted-foreground">
            ({aggregate.total_reviews} review{aggregate.total_reviews !== 1 ? "s" : ""})
          </span>
        </div>

        {/* Distribution Bars */}
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((rating) => {
            const item = aggregate.distribution.find((d) => d.rating === rating);
            const count = item?.count ?? 0;
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={rating} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-right text-muted-foreground">
                  {rating}
                </span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Anonymized Comments (Organizer Only) */}
        {isOrganizer && aggregate.comments.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">
              Attendee Comments
            </h4>
            {aggregate.comments.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border bg-muted/30 p-3 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <StarRating value={c.rating} readonly size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">{c.comment}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
