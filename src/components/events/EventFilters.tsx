"use client";

/**
 * Filter bar component for events
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { EVENT_TAGS, EVENT_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventBadge } from "./EventBadge";

/**
 * Props for the EventFilters component.
 */
interface EventFiltersProps {
  /**
   * Callback fired when the active filters change.
   * Receives an object containing selected filter criteria.
   */
  onFilterChange?: (filters: {
    tags?: EventTag[];
    dateRange?: { start: Date; end: Date };
    clubId?: string;
  }) => void;
  /**
   * Initial tags to populate the selected filters state.
   */
  initialTags?: EventTag[];
}

/**
 * A horizontal filter bar component that allows users to toggle active event categories.
 * 
 * It manages its own selected tag state and synchronizes with the `initialTags` prop.
 * When tags are toggled or cleared, it fires the `onFilterChange` callback to notify parent components.
 * 
 * @param {EventFiltersProps} props - The component props.
 * @returns The rendered horizontal event filter UI.
 */
function areTagsEqual(left: EventTag[], right: EventTag[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((tag, index) => tag === right[index]);
}

export function EventFilters({ onFilterChange, initialTags }: EventFiltersProps) {
  const [selectedTags, setSelectedTags] = useState<EventTag[]>(() => initialTags ?? []);
  const lastSyncedTags = useRef(initialTags);

  // Sync with initial tags if they change
  useEffect(() => {
    if (!initialTags) {
      return;
    }

    if (lastSyncedTags.current && areTagsEqual(initialTags, lastSyncedTags.current)) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTags(initialTags);
    lastSyncedTags.current = initialTags;
  }, [initialTags]);

  const toggleTag = (tag: EventTag) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);

    // Notify parent of filter change
    onFilterChange?.({
      tags: newTags.length > 0 ? newTags : undefined,
    });
  };

  const clearFilters = () => {
    setSelectedTags([]);
    onFilterChange?.({
      tags: undefined,
    });
  };

  return (
    <div className="w-full bg-card p-6 rounded-2xl border border-border/50 shadow-sm flex flex-col md:flex-row gap-6 md:items-start justify-between">
      
      {/* Search / Category Filters */}
      <fieldset className="flex-1 space-y-4 border-0 p-0 m-0">
        {/* legend must be first direct child of fieldset */}
        <legend className="sr-only">Categories</legend>

        <div className="flex items-center justify-between">
          <span
            className="text-sm font-medium text-muted-foreground uppercase tracking-wider"
            aria-hidden="true"
          >
            Categories
          </span>
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive hidden md:flex"
            >
              Clear all filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {EVENT_TAGS.map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                aria-pressed={isSelected}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 border",
                  isSelected
                    ? category.badgeTheme
                    : "bg-secondary/40 text-secondary-foreground border-transparent hover:scale-105 hover:bg-secondary/80"
                )}
                style={!isSelected ? {
                  // Subtle hover effect tinted by the category color when unselected
                } : undefined}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Selected Filters Display (Mobile only, desktop uses the inline clear button) */}
      {selectedTags.length > 0 && (
        <div className="pt-4 border-t border-border/50 md:hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Active:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
            >
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => {
              const category = EVENT_CATEGORIES[tag];
              return (
                <div key={tag} className="flex items-center">
                  <EventBadge tag={tag} className="py-1 px-3 pr-8 relative" />
                  <button
                    onClick={() => toggleTag(tag)}
                    aria-label={`Remove ${category.label} filter`}
                    className="absolute z-10 -ml-7 flex items-center justify-center h-4 w-4 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-colors"
                  >
                    <X className="h-3 w-3 text-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
