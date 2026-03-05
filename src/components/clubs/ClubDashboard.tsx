"use client";

import { useState, useCallback } from "react";
import { useClub, useMyClubs, useClubMembers } from "@/hooks/useClubs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { ClubQuickSwitch } from "@/components/clubs/ClubQuickSwitch";
import { ClubOverviewTab } from "@/components/clubs/ClubOverviewTab";
import { ClubSettingsTab } from "@/components/clubs/ClubSettingsTab";
import { ClubMembersTab } from "@/components/clubs/ClubMembersTab";
import { ClubEventsTab } from "@/components/clubs/ClubEventsTab";
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

export function ClubDashboard({ clubId }: ClubDashboardProps) {
  const { data: clubData, isLoading: clubLoading, mutate: mutateClub } = useClub(clubId);
  const { data: myClubsData } = useMyClubs();
  const { data: membersData } = useClubMembers(clubId);
  const [activeTab, setActiveTab] = useState("overview");

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
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AppBreadcrumb
        items={[
          { label: "My Clubs", href: "/my-clubs" },
          { label: club.name },
        ]}
      />

      {/* Header with quick switch */}
      <div className="mb-6">
        <ClubQuickSwitch
          currentClubId={clubId}
          currentClubName={club.name}
          currentClubLogo={club.logo_url}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          {isOwner && (
            <TabsTrigger value="settings">Settings</TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="members">Members</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <ClubOverviewTab
            club={club}
            followerCount={followerCount}
            memberCount={memberCount}
            onEditClick={isOwner ? () => setActiveTab("settings") : undefined}
          />
        </TabsContent>

        <TabsContent value="events">
          <ClubEventsTab clubId={clubId} clubName={club.name} />
        </TabsContent>

        {isOwner && (
          <TabsContent value="settings">
            <ClubSettingsTab club={club} onUpdate={handleClubUpdate} />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="members">
            <ClubMembersTab
              clubId={clubId}
              clubName={club.name}
              isOwner={isOwner}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
