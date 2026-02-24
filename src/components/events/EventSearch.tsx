"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
} from "react";
import { Search, X, Loader2, Calendar, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { type Event } from "@/types";
import { EventBadge } from "@/components/events/EventBadge";

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
    const [suggestions, setSuggestions] = useState<Event[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const internalRef = useRef<HTMLInputElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

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

        if (!value.trim()) {
          setSuggestions([]);
          setShowSuggestions(false);
          setIsDebouncing(false);
          return;
        }

        setIsDebouncing(true);
        debounceRef.current = setTimeout(async () => {
          onSearchChange(value);
          
          try {
            const res = await fetch(`/api/events?search=${encodeURIComponent(value)}&limit=8`);
            if (res.ok) {
              const data = await res.json();
              setSuggestions(data.events || []);
              setShowSuggestions(true);
              setActiveIndex(-1);
            }
          } catch (error) {
            console.error("Error fetching suggestions:", error);
          } finally {
            setIsDebouncing(false);
          }
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

    // Handle outside clicks to close the dropdown
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node) &&
          internalRef.current &&
          !internalRef.current.contains(e.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      debouncedSearch(value);
      if (!showSuggestions && value.trim()) {
        setShowSuggestions(true);
      }
    };

    const handleClear = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setSearchQuery("");
      setIsDebouncing(false);
      setSuggestions([]);
      setShowSuggestions(false);
      onSearchChange("");
      internalRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setShowSuggestions(false);
        internalRef.current?.blur();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
      } else if (e.key === "Enter") {
        if (showSuggestions && activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          router.push(`/events/${suggestions[activeIndex].id}`);
          setShowSuggestions(false);
        } else {
          setShowSuggestions(false);
        }
      }
    };

    const renderSuggestions = () => {
      if (!showSuggestions || suggestions.length === 0) return null;
      
      return (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-md border border-border/60 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[160px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar"
        >
          {suggestions.map((event, index) => (
            <button
              key={event.id}
              onClick={() => {
                router.push(`/events/${event.id}`);
                setShowSuggestions(false);
              }}
              className={cn(
                "w-full text-left px-4 py-3 border-b flex flex-col gap-1.5 border-border/40 hover:bg-muted/60 transition-colors group",
                activeIndex === index && "bg-muted/80"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground truncate pl-1 group-hover:text-primary transition-colors">{event.title}</span>
                {event.tags && event.tags.length > 0 && (
                  <EventBadge tag={event.tags[0]} variant="glowing" />
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground pl-1 mt-0.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {formatDate(event.event_date)}
                </span>
                <span className="flex items-center gap-1.5 truncate">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{event.location}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      );
    };

    if (variant === "hero") {
      return (
        <div className={cn("w-full max-w-2xl", className)}>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/50 p-2 flex items-center transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="ml-4 h-5 w-5 text-muted-foreground flex-shrink-0" />
              <input
                suppressHydrationWarning
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
          {renderSuggestions()}
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
        {renderSuggestions()}
      </div>
    );
  }
);
