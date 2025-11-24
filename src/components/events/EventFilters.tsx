"use client";

/**
 * Filter bar component for events
 * TODO: Implement filter logic, tag selection, date range picker, and club filter
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EVENT_TAGS, EVENT_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { X } from "lucide-react";

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
    <div className="space-y-4">
      {/* Tag Filters */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Filter by Category</h3>
        <div className="flex flex-wrap gap-2">
          {EVENT_TAGS.map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            const isSelected = selectedTags.includes(tag);
            return (
              <Button
                key={tag}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleTag(tag)}
                className={isSelected ? category.color : ""}
              >
                {category.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Selected Filters Display */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {selectedTags.map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            return (
              <Badge
                key={tag}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {category.label}
                <button
                  onClick={() => toggleTag(tag)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* TODO: Add date range picker */}
      {/* TODO: Add club filter dropdown */}
    </div>
  );
}


