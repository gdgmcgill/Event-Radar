"use client";

import { useState, useEffect } from "react";
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
  // Use a small delay for mounting content to allow animation to feel smoother
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={cn(
        "relative transition-all duration-300 ease-in-out shrink-0",
        isOpen ? "w-[280px] lg:w-[320px] opacity-100 mr-6" : "w-0 opacity-0 mr-0 overflow-hidden",
        className
      )}
    >
      <div className={cn("w-[280px] lg:w-[320px] transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0")}>
        {mounted && (
          <EventFilters onFilterChange={onFilterChange} initialTags={initialTags} />
        )}
      </div>
    </div>
  );
}
