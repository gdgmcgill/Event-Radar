"use client";

import { useEffect, useState } from "react";
import { REJECTION_CATEGORIES, type ModerationReview, type RejectionCategory } from "@/types";
import { MessageSquare, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface ReviewThreadProps {
  targetType: "event" | "club";
  targetId: string;
  currentUserId?: string;
}

export function ReviewThread({ targetType, targetId, currentUserId }: ReviewThreadProps) {
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true);
      try {
        const res = await fetch(`/api/moderation/reviews/${targetType}/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, [targetType, targetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Review History
      </h4>
      <div className="space-y-2">
        {reviews.map((review) => {
          const isCurrentUser = review.author_id === currentUserId;
          const roleLabel = review.action === "appeal" ? "You" : "Moderator";

          return (
            <div
              key={review.id}
              className={`rounded-lg border p-3 text-sm ${
                review.action === "rejection"
                  ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
                  : review.action === "appeal"
                  ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20"
                  : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {review.action === "rejection" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                ) : review.action === "appeal" ? (
                  <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {isCurrentUser ? "You" : roleLabel}
                </span>
                {review.action === "rejection" && review.category && (
                  <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                    {REJECTION_CATEGORIES[review.category as RejectionCategory]}
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
                  {review.created_at ? new Date(review.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : ""}
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {review.message}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
