"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  const clearAll = () => {
    setQuery("");
    router.push("/clubs");
  };

  const hasFilters = initialQuery || initialCategory;

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clubs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              updateParams("q", "");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat} onClick={() => toggleCategory(cat)}>
              <Badge
                variant={initialCategory === cat ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  initialCategory === cat && "bg-primary text-primary-foreground"
                )}
              >
                {cat}
              </Badge>
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
