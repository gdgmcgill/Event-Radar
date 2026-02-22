"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
} from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EventSearchProps {
  onSearchChange: (query: string) => void;
  placeholder?: string;
  variant?: "hero" | "compact";
  className?: string;
}

export const EventSearch = forwardRef<HTMLInputElement, EventSearchProps>(
  function EventSearch(
    {
      onSearchChange,
      placeholder = "Search events...",
      variant = "compact",
      className,
    },
    ref
  ) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isDebouncing, setIsDebouncing] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const internalRef = useRef<HTMLInputElement | null>(null);

    // Merge forwarded ref with internal ref
    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    const debouncedSearch = useCallback(
      (value: string) => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        setIsDebouncing(true);
        debounceRef.current = setTimeout(() => {
          onSearchChange(value);
          setIsDebouncing(false);
        }, 300);
      },
      [onSearchChange]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      debouncedSearch(value);
    };

    const handleClear = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setSearchQuery("");
      setIsDebouncing(false);
      onSearchChange("");
      internalRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
        internalRef.current?.blur();
      }
    };

    if (variant === "hero") {
      return (
        <div className={cn("w-full max-w-2xl", className)}>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/50 p-2 flex items-center transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="ml-4 h-5 w-5 text-muted-foreground flex-shrink-0" />
              <input
                ref={setRefs}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none px-4 py-3.5 text-foreground placeholder:text-muted-foreground/70 text-base md:text-lg"
              />
              <div className="flex items-center mr-2">
                {isDebouncing ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : searchQuery ? (
                  <button
                    onClick={handleClear}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                    aria-label="Clear search"
                  >
                    <X className="h-5 w-5" />
                  </button>
                ) : (
                  <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-mono border border-border/50">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Compact variant
    return (
      <div className={cn("relative w-full max-w-md", className)}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={setRefs}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isDebouncing ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : searchQuery ? (
            <button
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }
);
