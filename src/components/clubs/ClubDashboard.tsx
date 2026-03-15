"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClub, useMyClubs, useClubMembers, useClubEventsManagement } from "@/hooks/useClubs";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubDashboardHero } from "@/components/clubs/ClubDashboardHero";
import { ClubOverviewTab } from "@/components/clubs/ClubOverviewTab";
import { ClubSettingsTab } from "@/components/clubs/ClubSettingsTab";
import { ClubMembersTab } from "@/components/clubs/ClubMembersTab";
import { ClubEventsTab } from "@/components/clubs/ClubEventsTab";
import { ClubAnalyticsTab } from "@/components/clubs/ClubAnalyticsTab";
import { Rocket, Calendar, Users, BarChart3, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Club } from "@/types";

interface ClubDashboardProps {
  clubId: string;
}

interface MyClubEntry {
  id: string;
  role: "owner" | "organizer";
  club: Club;
  memberCount: number;
}

type DashboardTab = "overview" | "events" | "members" | "analytics" | "settings";

const TAB_ITEMS: {
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
}[] = [
  { id: "overview", label: "Overview", icon: Rocket },
  { id: "events", label: "Events", icon: Calendar },
  { id: "members", label: "Members", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings, ownerOnly: true },
];

export function ClubDashboard({ clubId }: ClubDashboardProps) {
  const router = useRouter();
  const { data: clubData, isLoading: clubLoading, mutate: mutateClub } = useClub(clubId);
  const { data: myClubsData } = useMyClubs();
  const { data: membersData } = useClubMembers(clubId);
  const { events: clubEvents } = useClubEventsManagement(clubId);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const user = useAuthStore((s) => s.user);

  const club: Club | undefined = clubData?.club;
  const followerCount: number = clubData?.followerCount ?? 0;
  const memberCount: number = membersData?.members?.length ?? 0;
  const eventCount: number = clubEvents?.length ?? 0;

  // Determine role from my-clubs data
  const myClubs: MyClubEntry[] = myClubsData?.clubs ?? [];
  const currentEntry = myClubs.find((e) => e.club.id === clubId);
  const isOwner = currentEntry?.role === "owner";

  // Auth guard — use useEffect to avoid rendering-phase navigation
  useEffect(() => {
    if (!user) {
      router.push("/auth/signin");
    }
  }, [user, router]);

  const handleClubUpdate = useCallback(
    (updatedClub: Club) => {
      mutateClub({ club: updatedClub, followerCount }, false);
    },
    [mutateClub, followerCount]
  );

  if (clubLoading || !club) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-[160px] w-full" />
        <div className="px-6 mt-4 space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const visibleTabs = TAB_ITEMS.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="px-4 lg:px-6 pt-4">
        <ClubDashboardHero
          club={club}
          followerCount={followerCount}
          memberCount={memberCount}
          eventCount={eventCount}
          onEditBanner={isOwner ? () => setActiveTab("settings") : undefined}
        />
      </div>

      {/* Sticky horizontal tab bar */}
      <div className="sticky top-0 z-20 bg-background border-b mt-4">
        <nav className="flex items-center gap-1 px-4 lg:px-6 overflow-x-auto">
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors duration-200",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-4 lg:p-6">
        {activeTab === "overview" && (
          <ClubOverviewTab
            club={club}
            followerCount={followerCount}
            memberCount={memberCount}
            clubId={clubId}
            onEditClick={isOwner ? () => setActiveTab("settings") : undefined}
            onNavigate={(tab) => setActiveTab(tab as DashboardTab)}
          />
        )}
        {activeTab === "events" && (
          <ClubEventsTab clubId={clubId} clubName={club.name} />
        )}
        {activeTab === "analytics" && (
          <ClubAnalyticsTab clubId={clubId} />
        )}
        {isOwner && activeTab === "settings" && (
          <ClubSettingsTab club={club} onUpdate={handleClubUpdate} members={membersData?.members ?? []} />
        )}
        {activeTab === "members" && (
          <ClubMembersTab clubId={clubId} clubName={club.name} isOwner={isOwner} />
        )}
      </div>

      {/* Mobile FAB — Create Event */}
      <Link
        href={`/create-event?clubId=${clubId}`}
        className="sm:hidden fixed bottom-6 right-6 z-30 inline-flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all duration-200 active:scale-95"
        aria-label="Create event"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
