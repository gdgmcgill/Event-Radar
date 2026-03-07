"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const isInteractive = !readonly && !!onChange;
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  const displayValue = hoverValue || value;

  return (
    <div role="group" aria-label="Rating" className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;

        if (isInteractive) {
          return (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star !== 1 ? "s" : ""}`}
              className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverValue(star)}
              onMouseLeave={() => setHoverValue(0)}
            >
              <Star
                className={cn(
                  sizeClass,
                  "transition-colors",
                  filled
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                )}
              />
            </button>
          );
        }

        return (
          <Star
            key={star}
            className={cn(
              sizeClass,
              filled
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            )}
          />
        );
      })}
    </div>
  );
}
