"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Instagram, Loader2, Search, Plus } from "lucide-react";
import Link from "next/link";
import type { Club } from "@/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventTag } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";

const CLUB_CATEGORIES = Object.entries(EVENT_CATEGORIES).map(([key, val]) => ({
  value: key,
  label: val.label,
}));

export default function BrowseClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    async function fetchClubs() {
      try {
        const res = await fetch("/api/clubs");
        if (res.ok) {
          const data = await res.json();
          setClubs(data.clubs ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchClubs();
  }, []);

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      const matchesSearch =
        !searchQuery ||
        club.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        !selectedCategory || club.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [clubs, searchQuery, selectedCategory]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Clubs
          </h1>
          <p className="text-muted-foreground">
            Discover student clubs and organizations at McGill
          </p>
        </div>
        {user && (
          <Link href="/clubs/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Club
            </Button>
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {CLUB_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.value ? null : cat.value
                )
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredClubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mb-6" />
          <p className="text-xl font-semibold mb-2 text-foreground">
            No clubs found
          </p>
          <p className="text-base text-muted-foreground max-w-md">
            {searchQuery || selectedCategory
              ? "Try adjusting your search or filters."
              : "No clubs have been added yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClubs.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border/60 hover:border-primary/30 h-full">
                <div className="flex items-start gap-3 mb-3">
                  {club.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {club.name}
                    </h3>
                    {club.category && EVENT_CATEGORIES[club.category as EventTag] && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {EVENT_CATEGORIES[club.category as EventTag].label}
                      </Badge>
                    )}
                  </div>
                </div>

                {club.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {club.description}
                  </p>
                )}

                {club.instagram_handle && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Instagram className="h-3.5 w-3.5" />
                    <span>@{club.instagram_handle.replace("@", "")}</span>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
