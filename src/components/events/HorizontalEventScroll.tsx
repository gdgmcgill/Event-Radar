"use client";

import { useRef, useState, useEffect, useCallback, Children } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HorizontalEventScrollProps {
  children: React.ReactNode;
  onNearEnd?: () => void;
  hasMore?: boolean;
}

export function HorizontalEventScroll({ 
  children, 
  onNearEnd,
  hasMore = false,
}: HorizontalEventScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const nearEndTriggeredRef = useRef(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    
    // Check if we're near the end (within 80% scrolled)
    const scrollPercentage = (el.scrollLeft + el.clientWidth) / el.scrollWidth;
    if (scrollPercentage > 0.8 && hasMore && onNearEnd && !nearEndTriggeredRef.current) {
      nearEndTriggeredRef.current = true;
      onNearEnd();
    } else if (scrollPercentage <= 0.8) {
      // Reset when scrolling back
      nearEndTriggeredRef.current = false;
    }
  }, [hasMore, onNearEnd]);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [checkScroll]);

  // Reset trigger when children change (new items loaded)
  useEffect(() => {
    nearEndTriggeredRef.current = false;
  }, [Children.count(children)]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative group/scroll">
      {/* Left fade + arrow */}
      {canScrollLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm border border-border/50 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>

      {/* Right fade + arrow */}
      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm border border-border/50 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  );
}
