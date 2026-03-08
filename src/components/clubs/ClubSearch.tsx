"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X, ArrowUpDown } from "lucide-react";
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

  const clearCategory = () => {
    updateParams("category", "");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search for clubs, tags, or interests..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-10 text-base focus:ring-2 focus:ring-red-600/20 focus:border-red-600/30 transition-all shadow-sm placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                updateParams("q", "");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <div className="flex gap-2">
          <button className="h-12 px-4 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowUpDown className="h-4 w-4" />
            Sort
          </button>
        </div>
      </div>

      {/* Filter Tag Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={clearCategory}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors",
              !initialCategory
                ? "bg-red-600/10 text-red-600 border-red-600/20"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-red-600/5"
            )}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors",
                initialCategory === cat
                  ? "bg-red-600/10 text-red-600 border-red-600/20"
                  : "bg-slate-100 text-slate-600 border-transparent hover:bg-red-600/5"
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
