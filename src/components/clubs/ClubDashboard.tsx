"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import type { Club } from "@/types";
import { ClubOverviewTab } from "@/components/clubs/ClubOverviewTab";
import { ClubEventsTab } from "@/components/clubs/ClubEventsTab";
import { ClubMembersTab } from "@/components/clubs/ClubMembersTab";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";

interface ClubDashboardProps {
  club: Club;
  role: "owner" | "organizer";
  memberCount: number;
  pendingInvitesCount: number | null;
  initialTab: string;
  userId: string;
}

const VALID_TABS = ["overview", "events", "members", "settings"] as const;
type TabValue = (typeof VALID_TABS)[number];

function isValidTab(value: string): value is TabValue {
  return (VALID_TABS as readonly string[]).includes(value);
}

function ClubDashboardInner({
  club,
  role,
  memberCount,
  pendingInvitesCount,
  initialTab,
  userId,
}: ClubDashboardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get("tab") ?? initialTab;
  const validTab: TabValue = isValidTab(rawTab) ? rawTab : "overview";

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb items={[{ label: "My Clubs", href: "/my-clubs" }, { label: club.name }]} />

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">{club.name}</h1>
          <Badge variant="secondary" className="capitalize">
            {role}
          </Badge>
        </div>
        <p className="text-muted-foreground pl-11">
          Club dashboard
        </p>
      </div>

      {/* Tabbed Navigation */}
      <Tabs value={validTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClubOverviewTab
            club={club}
            memberCount={memberCount}
            pendingInvitesCount={pendingInvitesCount}
            role={role}
          />
        </TabsContent>

        <TabsContent value="events">
          <ClubEventsTab clubId={club.id} />
        </TabsContent>

        <TabsContent value="members">
          <ClubMembersTab clubId={club.id} role={role} userId={userId} />
        </TabsContent>

        <TabsContent value="settings">
          <div className="py-8 text-center text-muted-foreground">
            Club settings coming soon.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ClubDashboard(props: ClubDashboardProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        </div>
      }
    >
      <ClubDashboardInner {...props} />
    </Suspense>
  );
}
