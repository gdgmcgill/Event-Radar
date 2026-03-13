"use client";

import { useRef, useState, useCallback, useEffect, Children } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollRowProps {
  children: React.ReactNode;
  className?: string;
  onNearEnd?: () => void;
  hasMore?: boolean;
}

export function ScrollRow({ children, className, onNearEnd, hasMore = false }: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const nearEndTriggeredRef = useRef(false);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowPrev(el.scrollLeft > 4);
    setShowNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);

    // Near-end detection for infinite loading
    if (onNearEnd && hasMore) {
      const scrollPercentage = (el.scrollLeft + el.clientWidth) / el.scrollWidth;
      if (scrollPercentage > 0.8 && !nearEndTriggeredRef.current) {
        nearEndTriggeredRef.current = true;
        onNearEnd();
      } else if (scrollPercentage <= 0.8) {
        nearEndTriggeredRef.current = false;
      }
    }
  }, [onNearEnd, hasMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      ro.disconnect();
    };
  }, [children, updateButtons]);

  // Reset near-end trigger when children change (new items loaded)
  const childCount = Children.count(children);
  useEffect(() => {
    nearEndTriggeredRef.current = false;
  }, [childCount]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -(el.clientWidth * 0.8) : el.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative group/row">
      {showPrev && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-2/3 w-10 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-r-xl hover:bg-white/90 dark:hover:bg-black/60"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div
        ref={scrollRef}
        className={cn(
          "flex overflow-x-auto gap-3 pb-4 scroll-smooth",
          className,
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
      {showNext && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-2/3 w-10 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-l-xl hover:bg-white/90 dark:hover:bg-black/60"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
