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
  Shield,
  Crown,
  CheckCircle2,
  Clock,
  XCircle,
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
        <aside className="w-64 border-r border-border bg-card p-6 space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </aside>
        <main className="flex-1 p-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
    { id: "members", label: "Members", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings, ownerOnly: true },
  ];

  const visibleNavItems = navItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-secondary">
      {/* Side Navigation */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card/80 backdrop-blur-sm flex-col shrink-0">
        {/* Brand */}
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div
            className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground cursor-pointer shadow-md ring-2 ring-primary/20 transition-transform duration-200 hover:scale-105"
            onClick={() => router.push("/")}
          >
            <Rocket className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-foreground text-lg font-bold leading-none">UNI-VERSE</h1>
            <p className="text-primary text-xs font-semibold uppercase tracking-wider">Admin Dashboard</p>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10 border-l-4 border-primary-foreground/30"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "drop-shadow-sm" : ""}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/80">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground overflow-hidden shrink-0 ring-1 ring-border">
              {user?.name
                ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                : user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name || user?.email || "User"}</p>
              <span className={`inline-flex items-center gap-1 text-xs font-medium w-fit px-2 py-0.5 rounded-full ${
                currentEntry?.role === "owner"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {currentEntry?.role === "owner" ? (
                  <><Crown className="h-3 w-3" /> President</>
                ) : (
                  <><Shield className="h-3 w-3" /> Organizer</>
                )}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <nav className="md:hidden flex items-center gap-1 px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm overflow-x-auto shrink-0">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <Users2 className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {club.name}
            </h2>
            {/* Status Badge */}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
              club.status === "approved"
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : club.status === "rejected"
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}>
              {club.status === "approved" ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Approved</>
              ) : club.status === "rejected" ? (
                <><XCircle className="h-3.5 w-3.5" /> Rejected</>
              ) : (
                <><Clock className="h-3.5 w-3.5" /> Pending</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                className="pl-10 pr-4 py-2 rounded-xl bg-secondary border border-border text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow duration-200 text-foreground placeholder:text-muted-foreground"
                placeholder="Search events..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setActiveTab("events")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-200 active:scale-95 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
            >
              <Plus className="h-4 w-4" />
              <span>Create Event</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 md:p-8">
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
            <ClubSettingsTab club={club} onUpdate={handleClubUpdate} />
          )}
          {activeTab === "members" && (
            <ClubMembersTab clubId={clubId} clubName={club.name} isOwner={isOwner} />
          )}
        </div>
      </main>
    </div>
  );
}
