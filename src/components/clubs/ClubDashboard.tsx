"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useClub, useMyClubs, useClubMembers } from "@/hooks/useClubs";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubOverviewTab } from "@/components/clubs/ClubOverviewTab";
import { ClubSettingsTab } from "@/components/clubs/ClubSettingsTab";
import { ClubMembersTab } from "@/components/clubs/ClubMembersTab";
import { ClubEventsTab } from "@/components/clubs/ClubEventsTab";
import { ClubAnalyticsTab } from "@/components/clubs/ClubAnalyticsTab";
import {
  Calendar,
  Users,
  BarChart3,
  Settings,
  Rocket,
  Search,
  Plus,
  Users2,
} from "lucide-react";
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

export function ClubDashboard({ clubId }: ClubDashboardProps) {
  const router = useRouter();
  const { data: clubData, isLoading: clubLoading, mutate: mutateClub } = useClub(clubId);
  const { data: myClubsData } = useMyClubs();
  const { data: membersData } = useClubMembers(clubId);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const user = useAuthStore((s) => s.user);

  const club: Club | undefined = clubData?.club;
  const followerCount: number = clubData?.followerCount ?? 0;
  const memberCount: number = membersData?.members?.length ?? 0;

  // Determine role from my-clubs data
  const myClubs: MyClubEntry[] = myClubsData?.clubs ?? [];
  const currentEntry = myClubs.find((e) => e.club.id === clubId);
  const isOwner = currentEntry?.role === "owner";

  const handleClubUpdate = useCallback(
    (updatedClub: Club) => {
      mutateClub({ club: updatedClub, followerCount }, false);
    },
    [mutateClub, followerCount]
  );

  if (clubLoading || !club) {
    return (
      <div className="flex h-screen overflow-hidden">
        <aside className="w-64 border-r bg-white p-6 space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </aside>
        <main className="flex-1 p-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </main>
      </div>
    );
  }

  const navItems: { id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }>; ownerOnly?: boolean }[] = [
    { id: "overview", label: "Events", icon: Calendar },
    { id: "members", label: "Members", icon: Users, ownerOnly: true },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings, ownerOnly: true },
  ];

  const visibleNavItems = navItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f6f6]">
      {/* Side Navigation */}
      <aside className="w-64 border-r border-red-600/10 bg-white flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-6 flex items-center gap-3 border-b border-red-600/5">
          <div
            className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center text-white cursor-pointer"
            onClick={() => router.push("/")}
          >
            <Rocket className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-slate-900 text-lg font-bold leading-none">Uni-Verse</h1>
            <p className="text-red-600 text-xs font-semibold uppercase tracking-wider">Admin Dashboard</p>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left font-medium transition-colors ${
                  isActive
                    ? "bg-red-600 text-white"
                    : "text-slate-700 hover:bg-red-600/10"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-red-600/5">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-100">
            <div className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center text-sm font-medium text-slate-600 overflow-hidden shrink-0">
              {user?.name
                ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                : user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || user?.email || "User"}</p>
              <p className="text-xs text-slate-500 truncate">
                {currentEntry?.role === "owner" ? "President" : "Organizer"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b border-red-600/5 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <Users2 className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-bold tracking-tight">{club.name}</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                className="pl-10 pr-4 py-2 rounded-lg bg-slate-100 border-none text-sm w-64 focus:outline-none focus:ring-2 focus:ring-red-600/30"
                placeholder="Search events..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setActiveTab("events")}
              className="bg-red-600 hover:bg-red-600/90 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-red-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Create Event</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
          {activeTab === "overview" && (
            <ClubOverviewTab
              club={club}
              followerCount={followerCount}
              memberCount={memberCount}
              clubId={clubId}
              onEditClick={isOwner ? () => setActiveTab("settings") : undefined}
            />
          )}
          {activeTab === "events" && (
            <ClubEventsTab clubId={clubId} clubName={club.name} />
          )}
          {activeTab === "analytics" && (
            <ClubAnalyticsTab clubId={clubId} />
          )}
          {isOwner && activeTab === "settings" && (
            <ClubSettingsTab club={club} onUpdate={handleClubUpdate} />
          )}
          {isOwner && activeTab === "members" && (
            <ClubMembersTab clubId={clubId} clubName={club.name} isOwner={isOwner} />
          )}
        </div>
      </main>
    </div>
  );
}
