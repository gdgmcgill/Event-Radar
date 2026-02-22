"use client";

import { EventFilters } from "@/components/events/EventFilters";
import type { EventTag } from "@/types";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilterSidebarProps {
  onFilterChange?: (filters: {
    tags?: EventTag[];
    dateRange?: { start: Date; end: Date };
    clubId?: string;
  }) => void;
  initialTags?: EventTag[];
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

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
