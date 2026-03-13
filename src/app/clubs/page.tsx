import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Building2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { ClubSearch } from "@/components/clubs/ClubSearch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clubs | UNI-VERSE",
  description:
    "Discover student clubs and organizations at McGill University",
};

const CLUBS_PER_PAGE = 9;

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}

export default async function ClubsPage({ searchParams }: PageProps) {
  const { q, category, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const supabase = await createClient();

  // ── Fetch approved clubs ──────────────────────────────────────────────
  let query = supabase
    .from("clubs")
    .select("*", { count: "exact" })
    .eq("status", "approved")
    .order("name", { ascending: true });

  if (q) query = query.ilike("name", `%${q}%`);
  if (category) query = query.eq("category", category);

  const from = (currentPage - 1) * CLUBS_PER_PAGE;
  const to = from + CLUBS_PER_PAGE - 1;
  query = query.range(from, to);

  const { data: clubs, count: totalCount } = await query;
  const totalPages = Math.ceil((totalCount ?? 0) / CLUBS_PER_PAGE);

  // ── Fetch distinct categories ─────────────────────────────────────────
  const { data: allClubs } = await supabase
    .from("clubs")
    .select("category")
    .eq("status", "approved")
    .not("category", "is", null);

  const categories = [
    ...new Set(
      (allClubs ?? []).map((c) => c.category as string).filter(Boolean)
    ),
  ].sort();

  // ── Fetch follower counts ─────────────────────────────────────────────
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

  // ── Fetch next upcoming event per club ────────────────────────────────
  const upcomingEvents: Record<
    string,
    { title: string; event_date: string; location: string }
  > = {};

  if (clubIds.length > 0) {
    const today = new Date().toISOString().split("T")[0];
    const { data: events } = await supabase
      .from("events")
      .select("club_id, title, event_date, location")
      .in("club_id", clubIds)
      .eq("status", "approved")
      .gte("event_date", today)
      .order("event_date", { ascending: true });

    // Keep only the first (nearest) event per club
    for (const ev of events ?? []) {
      if (ev.club_id && !upcomingEvents[ev.club_id]) {
        upcomingEvents[ev.club_id] = {
          title: ev.title,
          event_date: ev.event_date,
          location: ev.location,
        };
      }
    }
  }

  // ── Featured club (most followers among visible clubs) ────────────────
  const featuredClub =
    clubs && clubs.length > 0
      ? clubs.reduce((best, club) =>
          (followerCounts[club.id] ?? 0) > (followerCounts[best.id] ?? 0)
            ? club
            : best
        )
      : null;

  // ── Pagination helpers ────────────────────────────────────────────────
  function buildPageUrl(pageNum: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (pageNum > 1) params.set("page", pageNum.toString());
    const qs = params.toString();
    return `/clubs${qs ? `?${qs}` : ""}`;
  }

  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [1];
    if (currentPage > 3) pages.push("ellipsis");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  // ── Format date for event badge ───────────────────────────────────────
  function formatEventDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return {
      month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      day: d.getDate().toString(),
    };
  }

  return (
    <div className="flex-1 min-w-0">
      {/* ── Hero Section (matches homepage HeroSection style) ────── */}
      {!q && !category && currentPage === 1 && (
        <section className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url("/club_hero.jpeg")' }}
          />
          {/* Gradient overlay for text readability (both modes) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/80 via-[15%] via-black/50 via-[50%] to-black/20 to-100%" />
          {/* Bottom blend into page background */}
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background from-10% via-background/40 via-50% to-transparent" />

          <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-28 md:pb-32">
            <span className="inline-block px-5 py-2 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-6 border border-white/30 dark:border-white/15 shadow-xl [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
              Clubs Directory
            </span>

            <h2 className="text-white text-4xl sm:text-5xl lg:text-7xl font-black leading-[0.9] tracking-tighter mb-6 drop-shadow-2xl">
              Find Your Community
            </h2>

            <p className="text-white/90 text-lg lg:text-xl font-medium max-w-xl mb-8 leading-relaxed drop-shadow-lg">
              Discover student clubs and organizations at McGill. Join a community that matches your passions.
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="#clubs-feed"
                className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white text-base md:text-lg font-bold rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center gap-3"
              >
                Explore Clubs
              </Link>
              <Link
                href="/clubs/create"
                className="px-6 md:px-8 py-4 md:py-5 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white font-bold border border-white/30 dark:border-white/15 rounded-2xl hover:bg-white/30 dark:hover:bg-white/20 transition-all flex items-center gap-3 shadow-lg"
              >
                Start a Club
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Search & Category Filters (below hero) ──────────────── */}
      <div id="clubs-feed" className="px-6 lg:px-10 pt-6 lg:pt-8">
        <ClubSearch
          initialQuery={q ?? ""}
          initialCategory={category ?? ""}
          categories={categories}
        />
      </div>

      <main className="px-6 lg:px-10 py-6 lg:py-8">

        {/* ── Section Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            {q
              ? `Results for "${q}"`
              : category
                ? `${category} Clubs`
                : "Trending Clubs"}
          </h2>
          {totalCount !== null && totalCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalCount} club{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Club Cards Grid ───────────────────────────────────────── */}
        {!clubs || clubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold">No clubs found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {q || category
                ? "Try adjusting your search or filters."
                : "No clubs have been approved yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs.map((club) => {
              const followers = followerCounts[club.id] ?? 0;
              const nextEvent = upcomingEvents[club.id];

              return (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <div className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full group">
                    {/* Card Body — centered layout */}
                    <div className="p-6 pb-4 flex flex-col items-center text-center flex-1">
                      {/* Round Club Logo */}
                      <div className="w-20 h-20 rounded-full border-4 border-card shadow-sm mb-4 overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                        {club.logo_url ? (
                          <Image
                            src={club.logo_url}
                            alt={`${club.name} logo`}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="h-8 w-8 text-muted-foreground/50" />
                        )}
                      </div>

                      {/* Club Name */}
                      <h3 className="text-lg font-bold leading-tight mb-1 group-hover:text-primary transition-colors">
                        {club.name}
                      </h3>

                      {/* Description */}
                      {club.description && (
                        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                          {club.description}
                        </p>
                      )}

                      {/* Tag Pills */}
                      <div className="flex flex-wrap justify-center gap-2 mb-5">
                        {club.category && (
                          <span className="px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-xs font-medium">
                            {club.category}
                          </span>
                        )}
                        {followers > 0 && (
                          <span className="px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-xs font-medium">
                            {followers} follower{followers !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Follow Club Button */}
                      <span className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 hover:border-primary transition-colors py-2 rounded-lg font-semibold text-sm text-center block mt-auto">
                        Follow Club
                      </span>
                    </div>

                    {/* Upcoming Event Footer */}
                    {nextEvent && (
                      <div className="border-t border-border bg-secondary/30 p-4 mt-auto">
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                          Upcoming Event
                        </p>
                        <div className="flex items-center gap-3 bg-card p-2.5 rounded-lg border border-border shadow-sm">
                          <div className="bg-primary/10 text-primary rounded-md p-2 flex flex-col items-center justify-center min-w-[40px]">
                            <span className="text-[10px] font-bold uppercase leading-none">
                              {formatEventDate(nextEvent.event_date).month}
                            </span>
                            <span className="text-sm font-bold leading-none mt-0.5">
                              {formatEventDate(nextEvent.event_date).day}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold truncate">
                              {nextEvent.title}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {nextEvent.location}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* No event fallback — keep cards consistent height */}
                    {!nextEvent && (
                      <div className="border-t border-border bg-secondary/30 p-4 mt-auto">
                        <div className="flex items-center gap-2 text-muted-foreground/50">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="text-xs">No upcoming events</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {currentPage > 1 ? (
              <Link
                href={buildPageUrl(currentPage - 1)}
                className="h-10 w-10 rounded-lg flex items-center justify-center border border-border hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            ) : (
              <span className="h-10 w-10 rounded-lg flex items-center justify-center border border-border text-muted-foreground/30 cursor-not-allowed">
                <ChevronLeft className="h-5 w-5" />
              </span>
            )}

            {getPageNumbers().map((p, i) =>
              p === "ellipsis" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-2 text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <Link
                  key={p}
                  href={buildPageUrl(p)}
                  className={
                    p === currentPage
                      ? "h-10 w-10 rounded-lg flex items-center justify-center bg-primary text-primary-foreground font-bold"
                      : "h-10 w-10 rounded-lg flex items-center justify-center hover:bg-secondary font-semibold transition-colors"
                  }
                >
                  {p}
                </Link>
              )
            )}

            {currentPage < totalPages ? (
              <Link
                href={buildPageUrl(currentPage + 1)}
                className="h-10 w-10 rounded-lg flex items-center justify-center border border-border hover:bg-secondary transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            ) : (
              <span className="h-10 w-10 rounded-lg flex items-center justify-center border border-border text-muted-foreground/30 cursor-not-allowed">
                <ChevronRight className="h-5 w-5" />
              </span>
            )}
          </div>
        )}

        {/* ── Register CTA ──────────────────────────────────────────── */}
        <div className="mt-16 mb-4 rounded-2xl border border-border bg-card p-8 md:p-10 text-center">
          <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
            Don&apos;t see your club?
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            If your club isn&apos;t listed yet, register it in under a minute and start reaching students across campus.
          </p>
          <Link
            href="/clubs/create"
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            Register Your Club
          </Link>
        </div>
      </main>
    </div>
  );
}
