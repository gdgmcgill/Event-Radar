"use client";

import { useCallback } from "react";
import {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
  Check,
  Music,
  Cpu,
  UtensilsCrossed,
  HandHeart,
  Paintbrush,
  Handshake,
  Code,
  Award,
  Mic,
  Wrench,
  PartyPopper,
  Dumbbell,
  Info,
} from "lucide-react";
import { EVENT_TAGS, EVENT_CATEGORIES, EXTRA_INTEREST_TAGS, QUICK_FILTER_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TAG_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
  Music,
  Cpu,
  UtensilsCrossed,
  HandHeart,
  Paintbrush,
  Handshake,
  Code,
  Award,
  Mic,
  Wrench,
  PartyPopper,
  Dumbbell,
  Info,
};


type InterestTagSelectorProps = {
  selected: string[];
  onChange: (tags: string[]) => void;
  min?: number;
  max?: number;
};

export default function InterestTagSelector({
  selected,
  onChange,
  min = 3,
  max = 8,
}: InterestTagSelectorProps) {
  const toggle = useCallback(
    (tag: string) => {
      if (selected.includes(tag)) {
        onChange(selected.filter((t) => t !== tag));
      } else if (selected.length < max) {
        onChange([...selected, tag]);
      }
    },
    [selected, onChange, max]
  );

  const count = selected.length;
  const isValid = count >= min && count <= max;

  const renderTag = (tag: string, category: { label: string; icon: string; borderColor: string; selectedBg: string; checkColor: string; color: string }) => {
    const Icon = TAG_ICONS[category.icon];
    const isSelected = selected.includes(tag);
    const atMax = count >= max && !isSelected;

    return (
      <button
        key={tag}
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        aria-label={`${category.label}${isSelected ? " (selected)" : ""}`}
        disabled={atMax}
        onClick={() => toggle(tag)}
        className={cn(
          "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isSelected
            ? cn(category.borderColor, category.selectedBg, "shadow-sm scale-[1.03]")
            : "border-border bg-card hover:border-primary/40 hover:bg-accent/50",
          atMax && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Checkmark badge */}
        <span
          className={cn(
            "absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200",
            isSelected
              ? cn(category.checkColor, "scale-100")
              : "bg-muted scale-0"
          )}
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>

        {/* Icon */}
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
            isSelected ? category.color : "bg-muted text-muted-foreground"
          )}
        >
          {Icon && <Icon className="h-5 w-5" />}
        </span>

        {/* Label */}
        <span
          className={cn(
            "text-sm font-medium transition-colors duration-200",
            isSelected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {category.label}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Broad categories */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Categories</p>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          role="group"
          aria-label="Category interest tags"
        >
          {EVENT_TAGS.map((tag) => renderTag(tag, EVENT_CATEGORIES[tag]))}
        </div>
      </div>

      {/* Quick filter tags */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">More Interests</p>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          role="group"
          aria-label="Additional interest tags"
        >
          {EXTRA_INTEREST_TAGS.map((tag) => renderTag(tag, QUICK_FILTER_CATEGORIES[tag]))}
        </div>
      </div>

      {/* Counter */}
      <p
        className={cn(
          "text-sm text-center transition-colors duration-200",
          isValid ? "text-muted-foreground" : "text-muted-foreground"
        )}
        aria-live="polite"
      >
        <span className={cn("font-semibold", isValid ? "text-primary" : "text-foreground")}>
          {count}
        </span>{" "}
        selected{" "}
        <span className="text-muted-foreground">
          ({min}–{max} required)
        </span>
      </p>
    </div>
  );
}
