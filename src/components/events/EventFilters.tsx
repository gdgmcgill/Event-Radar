"use client";

/**
 * Filter bar component for events
 * TODO: Implement filter logic, tag selection, date range picker, and club filter
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EVENT_TAGS, EVENT_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventFiltersProps {
  onFilterChange?: (filters: {
    tags?: EventTag[];
    dateRange?: { start: Date; end: Date };
    clubId?: string;
  }) => void;
}

export function EventFilters({ onFilterChange }: EventFiltersProps) {
  const [selectedTags, setSelectedTags] = useState<EventTag[]>([]);

  const toggleTag = (tag: EventTag) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    // TODO: Call onFilterChange with updated filters
  };

  const clearFilters = () => {
    setSelectedTags([]);
    // TODO: Reset all filters and call onFilterChange
  };

  return (
    <div className="space-y-6 bg-card p-6 rounded-xl border border-border/50 shadow-sm">
      <div className="flex items-center gap-2 text-primary font-semibold">
        <Filter className="h-4 w-4" />
        <span>Filters</span>
      </div>

      {/* Tag Filters */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Categories</h3>
        <div className="flex flex-wrap gap-2">
          {EVENT_TAGS.map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            const isSelected = selectedTags.includes(tag);
            return (
              <Button
                key={tag}
                variant="ghost"
                size="sm"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full px-4 transition-all duration-200",
                  isSelected 
                    ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {category.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Selected Filters Display */}
      {selectedTags.length > 0 && (
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Active filters:</span>
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
                <Badge
                  key={tag}
                  variant="outline"
                  className="flex items-center gap-1 pl-2 pr-1 py-1 bg-background"
                >
                  {category.label}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* TODO: Add date range picker */}
      {/* TODO: Add club filter dropdown */}
    </div>
  );
}
