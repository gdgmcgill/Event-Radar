"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Users, Calendar, Crown, Shield } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useMyClubs } from "@/hooks/useClubs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Club } from "@/types";

type TabValue = "discover" | "my-clubs";

interface MyClubEntry {
  id: string;
  role: "owner" | "organizer";
  created_at: string;
  club: Club;
  memberCount: number;
  followerCount: number;
  upcomingEventCount: number;
}

// ── My Clubs Content ─────────────────────────────────────────────────────────

function MyClubsContent() {
  const router = useRouter();
  const { data, isLoading, error } = useMyClubs();

  const clubs: MyClubEntry[] = data?.clubs ?? [];

  // Single club: auto-redirect
  useEffect(() => {
    if (!isLoading && clubs.length === 1) {
      router.push(`/my-clubs/${clubs[0].club.id}`);
    }
  }, [isLoading, clubs, router]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold">Failed to load your clubs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Please try again later.
        </p>
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold">No clubs yet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You&apos;re not part of any clubs.
        </p>
      </div>
    );
  }

  // Single club will redirect above, but render nothing while it happens
  if (clubs.length === 1) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {clubs.map((entry) => {
        const { club, role, followerCount, upcomingEventCount } = entry;
        const roleLabel = role === "owner" ? "President" : "Organizer";
        const RoleIcon = role === "owner" ? Crown : Shield;

        return (
          <button
            key={club.id}
            onClick={() => router.push(`/my-clubs/${club.id}`)}
            className="text-left bg-card rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden flex flex-col h-full group"
          >
            <div className="p-6 flex-1">
              {/* Header: logo + name + role */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-full border-2 border-border shadow-sm overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                  {club.logo_url ? (
                    <Image
                      src={club.logo_url}
                      alt={`${club.name} logo`}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {club.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-tight truncate group-hover:text-primary transition-colors">
                    {club.name}
                  </h3>
                  <Badge
                    variant="secondary"
                    className="mt-1.5 gap-1"
                  >
                    <RoleIcon className="h-3 w-3" />
                    {roleLabel}
                  </Badge>
                </div>
              </div>

              {/* Status badge if not approved */}
              {club.status && club.status !== "approved" && (
                <Badge
                  variant={club.status === "pending" ? "outline" : "destructive"}
                  className="mb-3"
                >
                  {club.status === "pending" ? "Pending Approval" : "Rejected"}
                </Badge>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {followerCount} follower{followerCount !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {upcomingEventCount} upcoming
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Tabs Wrapper ──────────────────────────────────────────────────────────────

interface ClubsPageTabsProps {
  children: React.ReactNode;
}

export function ClubsPageTabs({ children }: ClubsPageTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const hasClubs = useAuthStore((s) => s.hasClubs);

  const initialTab = searchParams.get("tab") === "my-clubs" ? "my-clubs" : "discover";
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  // Sync tab from URL changes (e.g. browser back/forward)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "my-clubs") {
      setActiveTab("my-clubs");
    } else {
      setActiveTab("discover");
    }
  }, [searchParams]);

  const handleTabChange = useCallback(
    (tab: TabValue) => {
      setActiveTab(tab);
      if (tab === "my-clubs") {
        router.push("/clubs?tab=my-clubs", { scroll: false });
      } else {
        router.push("/clubs", { scroll: false });
      }
    },
    [router]
  );

  // If not authenticated or no clubs, just render the discover content
  if (!user || !hasClubs) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Tab Bar */}
      <div className="px-6 lg:px-10 pt-4">
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => handleTabChange("discover")}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "discover"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => handleTabChange("my-clubs")}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "my-clubs"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Clubs
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "discover" ? (
        children
      ) : (
        <main className="px-6 lg:px-10 py-6 lg:py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">My Clubs</h2>
          </div>
          <MyClubsContent />
        </main>
      )}
    </>
  );
}

