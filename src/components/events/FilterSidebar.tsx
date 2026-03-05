"use client";

import { EventFilters } from "@/components/events/EventFilters";
import type { EventTag } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Props for the FilterSidebar component.
 */
interface FilterSidebarProps {
  /**
   * Callback fired when active filters change within the sidebar.
   */
  onFilterChange?: (filters: {
    tags?: EventTag[];
    dateRange?: { start: Date; end: Date };
    clubId?: string;
  }) => void;
  /**
   * Initial selected tags to pass down to the inner EventFilters component.
   */
  initialTags?: EventTag[];
  /**
   * Determines whether the sidebar filter panel is visible.
   */
  isOpen: boolean;
  /**
   * Callback to toggle the visibility state of the sidebar.
   */
  onToggle: () => void;
  /**
   * Optional CSS class name to apply to the root wrapper.
   */
  className?: string;
}

/**
 * A responsive, slide-out sidebar overlay component containing event filtering options.
 * 
 * On desktop (`lg` and above), this renders as a floating panel on the left side of the screen context.
 * It transitions smoothly into and out of view based on the `isOpen` prop.
 * 
 * @param {FilterSidebarProps} props - The component props.
 * @returns The rendered sidebar containing the EventFilters widget.
 */
export function FilterSidebar({
  onFilterChange,
  initialTags = [],
  isOpen,
  onToggle,
  className,
}: FilterSidebarProps) {
  return (
    <div
      className={cn(
        "absolute top-0 left-0 z-30 h-max transition-all duration-300 ease-in-out",
        isOpen ? "w-[280px] lg:w-[320px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 pointer-events-none",
        className
      )}
    >
      <div className={cn(
        "w-[280px] lg:w-[320px] transition-all duration-300 rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl shadow-2xl p-6", 
        isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}>
        <EventFilters onFilterChange={onFilterChange} initialTags={initialTags} />
      </div>
    </div>
  );
}
