import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  Users,
  Building2,
  LayoutGrid,
  Cpu,
  Palette,
  Music,
  Trophy,
  Heart,
  PlusCircle,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { ClubSearch } from "@/components/clubs/ClubSearch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clubs | Uni-Verse",
  description: "Discover student clubs and organizations at McGill University",
};

const CLUBS_PER_PAGE = 6;

// Sidebar category definitions with Lucide icons
const SIDEBAR_CATEGORIES = [
  { label: "All Clubs", value: "", icon: LayoutGrid },
  { label: "Engineering", value: "Engineering", icon: Cpu },
  { label: "Arts & Design", value: "Arts & Design", icon: Palette },
  { label: "Music", value: "Music", icon: Music },
  { label: "Sports", value: "Sports", icon: Trophy },
  { label: "Social Impact", value: "Social Impact", icon: Heart },
];

// Gradient colors for club cards, cycled through
const CARD_GRADIENTS = [
  "from-red-600/20 to-red-600/5",
  "from-orange-400/20 to-orange-400/5",
  "from-green-400/20 to-green-400/5",
  "from-cyan-400/20 to-cyan-400/5",
  "from-pink-400/20 to-pink-400/5",
  "from-slate-400/20 to-slate-400/5",
  "from-purple-400/20 to-purple-400/5",
  "from-blue-400/20 to-blue-400/5",
];

// Badge color mapping by category
const CATEGORY_BADGE_COLORS: Record<string, string> = {
  Engineering: "bg-blue-100 text-blue-700",
  "Arts & Design": "bg-purple-100 text-purple-700",
  Arts: "bg-purple-100 text-purple-700",
  Music: "bg-green-100 text-green-700",
  Sports: "bg-emerald-100 text-emerald-700",
  "Social Impact": "bg-red-100 text-red-700",
  Academic: "bg-red-100 text-red-700",
  Gaming: "bg-yellow-100 text-yellow-700",
};

function getCategoryBadgeColor(category: string): string {
  return CATEGORY_BADGE_COLORS[category] ?? "bg-slate-100 text-slate-700";
}

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}

export default async function ClubsPage({ searchParams }: PageProps) {
  const { q, category, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const supabase = await createClient();

  // Fetch all approved clubs with follower counts
  let query = supabase
    .from("clubs")
    .select("*", { count: "exact" })
    .eq("status", "approved")
    .order("name", { ascending: true });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  if (category) {
    query = query.eq("category", category);
  }

  // Apply pagination
  const from = (currentPage - 1) * CLUBS_PER_PAGE;
  const to = from + CLUBS_PER_PAGE - 1;
  query = query.range(from, to);

  const { data: clubs, count: totalCount } = await query;

  const totalPages = Math.ceil((totalCount ?? 0) / CLUBS_PER_PAGE);

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

  // Build pagination URL helper
  function buildPageUrl(pageNum: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (pageNum > 1) params.set("page", pageNum.toString());
    const qs = params.toString();
    return `/clubs${qs ? `?${qs}` : ""}`;
  }

  // Generate page numbers for pagination display
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

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-40 py-10">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Navigation & Filters */}
        <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            {/* Category Nav */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                Categories
              </h3>
              <nav className="flex flex-col gap-1">
                {SIDEBAR_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = (category ?? "") === cat.value;
                  return (
                    <Link
                      key={cat.label}
                      href={
                        cat.value
                          ? `/clubs?category=${encodeURIComponent(cat.value)}`
                          : "/clubs"
                      }
                      className={
                        isActive
                          ? "flex items-center gap-3 px-3 py-2 rounded-lg bg-red-600 text-white font-medium"
                          : "flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-600/10 text-slate-700 transition-colors"
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm">{cat.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Lead a Community CTA */}
            <div className="p-5 rounded-xl bg-red-600/5 border border-red-600/10 flex flex-col gap-4">
              <div className="h-10 w-10 rounded-lg bg-red-600 flex items-center justify-center text-white">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Lead a Community</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Starting a new club is easy. We&apos;ll provide the tools.
                </p>
              </div>
              <Link
                href="/clubs/create"
                className="w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-red-600/90 transition-colors text-center"
              >
                Register New Club
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-8">
          {/* Header & My Clubs Button */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-black tracking-tight text-slate-900">
                Clubs Directory
              </h1>
              <p className="text-slate-500 text-lg max-w-md">
                Find your community and make the most of your student life.
              </p>
            </div>
            <Link
              href="/my-clubs"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-slate-200 shadow-sm text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              <UserCheck className="h-4 w-4" />
              My Clubs
            </Link>
          </div>

          {/* Search, Sort, and Filter Pills */}
          <ClubSearch
            initialQuery={q ?? ""}
            initialCategory={category ?? ""}
            categories={categories}
          />

          {/* Clubs Grid */}
          {!clubs || clubs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-12 w-12 text-slate-300 mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">
                No clubs found
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {q || category
                  ? "Try adjusting your search or filters."
                  : "No clubs have been approved yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {clubs.map((club, index) => {
                const gradient =
                  CARD_GRADIENTS[index % CARD_GRADIENTS.length];
                const memberCount = followerCounts[club.id] ?? 0;

                return (
                  <Link key={club.id} href={`/clubs/${club.id}`}>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden group hover:border-red-600/30 hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                      {/* Gradient Header with Logo */}
                      <div
                        className={`h-32 bg-gradient-to-r ${gradient} relative`}
                      >
                        <div className="absolute -bottom-6 left-6 h-14 w-14 rounded-xl bg-white border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
                          {club.logo_url ? (
                            <Image
                              src={club.logo_url}
                              alt={`${club.name} logo`}
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="h-7 w-7 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="pt-10 pb-6 px-6 flex flex-col gap-4 flex-1">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-black text-lg text-slate-900 group-hover:text-red-600 transition-colors truncate">
                              {club.name}
                            </h3>
                            {club.category && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tight whitespace-nowrap ml-2 ${getCategoryBadgeColor(club.category)}`}
                              >
                                {club.category}
                              </span>
                            )}
                          </div>
                          {club.description && (
                            <p className="text-sm text-slate-500 line-clamp-2">
                              {club.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <User className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">
                              {memberCount}{" "}
                              {memberCount === 1 ? "member" : "members"}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-red-600 px-3 py-1.5 rounded-lg border border-red-600/20 hover:bg-red-600 hover:text-white transition-all">
                            Join Club
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              {/* Previous */}
              {currentPage > 1 ? (
                <Link
                  href={buildPageUrl(currentPage - 1)}
                  className="h-10 w-10 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-red-600/5 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              ) : (
                <span className="h-10 w-10 rounded-lg flex items-center justify-center border border-slate-200 text-slate-300 cursor-not-allowed">
                  <ChevronLeft className="h-5 w-5" />
                </span>
              )}

              {/* Page Numbers */}
              {getPageNumbers().map((p, i) =>
                p === "ellipsis" ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-slate-400">
                    ...
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={buildPageUrl(p)}
                    className={
                      p === currentPage
                        ? "h-10 w-10 rounded-lg flex items-center justify-center bg-red-600 text-white font-bold"
                        : "h-10 w-10 rounded-lg flex items-center justify-center hover:bg-red-600/5 font-semibold transition-colors"
                    }
                  >
                    {p}
                  </Link>
                )
              )}

              {/* Next */}
              {currentPage < totalPages ? (
                <Link
                  href={buildPageUrl(currentPage + 1)}
                  className="h-10 w-10 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-red-600/5 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </Link>
              ) : (
                <span className="h-10 w-10 rounded-lg flex items-center justify-center border border-slate-200 text-slate-300 cursor-not-allowed">
                  <ChevronRight className="h-5 w-5" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
