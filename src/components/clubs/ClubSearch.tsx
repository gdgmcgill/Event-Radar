"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClubSearchProps {
  initialQuery: string;
  initialCategory: string;
  categories: string[];
}

export function ClubSearch({
  initialQuery,
  initialCategory,
  categories,
}: ClubSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 on filter change
      params.delete("page");
      router.push(`/clubs?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams("q", query);
  };

  const toggleCategory = (cat: string) => {
    updateParams("category", initialCategory === cat ? "" : cat);
  };

  const clearCategory = () => {
    updateParams("category", "");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search clubs, faculties, interests..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-10 bg-secondary/60 dark:bg-secondary border border-border rounded-full pl-10 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              updateParams("q", "");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {/* Horizontal Category Pills */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">
          <button
            onClick={clearCategory}
            className={cn(
              "flex h-9 shrink-0 items-center justify-center px-5 rounded-full text-sm font-semibold transition-all",
              !initialCategory
                ? "bg-foreground text-background shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={cn(
                "flex h-9 shrink-0 items-center justify-center px-5 rounded-full text-sm font-medium transition-all",
                initialCategory === cat
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
