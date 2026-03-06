import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2 } from "lucide-react";
import { ClubSearch } from "@/components/clubs/ClubSearch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clubs | Uni-Verse",
  description: "Discover student clubs and organizations at McGill University",
};

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function ClubsPage({ searchParams }: PageProps) {
  const { q, category } = await searchParams;
  const supabase = await createClient();

  // Fetch all approved clubs with follower counts
  let query = supabase
    .from("clubs")
    .select("*")
    .eq("status", "approved")
    .order("name", { ascending: true });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  if (category) {
    query = query.eq("category", category);
  }

  const { data: clubs } = await query;

  // Fetch distinct categories for filter
  const { data: allClubs } = await supabase
    .from("clubs")
    .select("category")
    .eq("status", "approved")
    .not("category", "is", null);

  const categories = [
    ...new Set((allClubs ?? []).map((c) => c.category as string).filter(Boolean)),
  ].sort();

  // Fetch follower counts for all clubs in parallel
  const clubIds = (clubs ?? []).map((c) => c.id);
  const followerCounts: Record<string, number> = {};

  if (clubIds.length > 0) {
    const { data: followers } = await supabase
      .from("club_followers")
      .select("club_id")
      .in("club_id", clubIds);

    for (const f of followers ?? []) {
      followerCounts[f.club_id] = (followerCounts[f.club_id] ?? 0) + 1;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Clubs Directory
        </h1>
        <p className="text-muted-foreground">
          Discover student clubs and organizations at McGill
        </p>
      </div>

      {/* Search and Filter */}
      <ClubSearch
        initialQuery={q ?? ""}
        initialCategory={category ?? ""}
        categories={categories}
      />

      {/* Results */}
      {!clubs || clubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">
            No clubs found
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {q || category
              ? "Try adjusting your search or filters."
              : "No clubs have been approved yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start gap-4">
                    {club.logo_url ? (
                      <Image
                        src={club.logo_url}
                        alt={`${club.name} logo`}
                        width={56}
                        height={56}
                        className="rounded-xl object-cover w-14 h-14 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-7 w-7 text-primary/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {club.name}
                      </h3>
                      {club.category && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {club.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {club.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                      {club.description}
                    </p>
                  )}

                  <div className="mt-auto pt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {followerCounts[club.id] ?? 0}{" "}
                      {(followerCounts[club.id] ?? 0) === 1
                        ? "follower"
                        : "followers"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
