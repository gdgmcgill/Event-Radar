"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScrollRowProps {
  children: React.ReactNode;
}

export function ScrollRow({ children }: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowPrev(el.scrollLeft > 4);
    setShowNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

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

  const scrollPrev = () =>
    scrollRef.current?.scrollBy({ left: -(scrollRef.current.clientWidth * 0.8), behavior: "smooth" });
  const scrollNext = () =>
    scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative group/row">
      {showPrev && (
        <button
          onClick={scrollPrev}
          className="absolute left-0 top-0 bottom-0 w-12 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-r-md hover:bg-white/90 dark:hover:bg-black/70 hover:w-14"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto px-6 md:px-10 lg:px-12 gap-3 pb-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
      {showNext && (
        <button
          onClick={scrollNext}
          className="absolute right-0 top-0 bottom-0 w-12 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-l-md hover:bg-white/90 dark:hover:bg-black/70 hover:w-14"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}
    </div>
  );
}
