"use client";

/**
 * Search component for events
 * TODO: Implement search functionality with debouncing and search suggestions
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface EventSearchProps {
  onSearchChange?: (query: string) => void;
  placeholder?: string;
}

export function EventSearch({
  onSearchChange,
  placeholder = "Search events...",
}: EventSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // TODO: Implement debouncing
    // TODO: Call onSearchChange with debounced value
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={searchQuery}
        onChange={handleChange}
        className="pl-10"
      />
    </div>
  );
}



