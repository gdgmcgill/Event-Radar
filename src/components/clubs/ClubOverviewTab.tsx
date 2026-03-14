"use client";

import { useClubEventsManagement, useClubInvites } from "@/hooks/useClubs";
import { useClubAnalytics } from "@/hooks/useAnalytics";
import { formatDate } from "@/lib/utils";
import {
  Calendar,
  CalendarPlus,
  Users,
  BarChart3,
  Heart,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { Club } from "@/types";
import ClubCompletionNudge from "@/components/clubs/ClubCompletionNudge";

interface ClubOverviewTabProps {
  club: Club;
  followerCount: number;
  memberCount: number;
  clubId: string;
  onEditClick?: () => void;
  onNavigate?: (tab: string) => void;
}

interface EventWithRsvp {
  id: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
  status: "pending" | "approved" | "rejected";
  rsvp_counts?: {
    going: number;
    interested: number;
    cancelled: number;
  };
}

export function ClubOverviewTab({
  club,
  followerCount,
  memberCount,
  clubId,
  onNavigate,
}: ClubOverviewTabProps) {
  const { events } = useClubEventsManagement(clubId);
  const { data: analyticsData } = useClubAnalytics(clubId);
  const { data: invitesData } = useClubInvites(clubId);

  const typedEvents = events as EventWithRsvp[];
  const pendingInviteCount = Array.isArray(invitesData)
    ? invitesData.filter(
        (inv: { status: string }) => inv.status === "pending"
      ).length
    : 0;

  // Compute stats from real data
  const totalEvents = typedEvents.length;
  const totalRsvps = typedEvents.reduce((sum, e) => {
    const counts = e.rsvp_counts;
    return sum + (counts ? counts.going + counts.interested : 0);
  }, 0);
  const avgRsvps =
    totalEvents > 0 ? Math.round((totalRsvps / totalEvents) * 10) / 10 : 0;

  // Follower growth from analytics (new followers this month)
  const followerGrowth = analyticsData?.follower_growth ?? [];
  const newFollowersThisMonth =
    followerGrowth.length >= 2
      ? followerGrowth[followerGrowth.length - 1].count -
        followerGrowth[0].count
      : 0;

  // Next upcoming event
  const now = new Date();
  const upcomingEvents = typedEvents
    .filter((e) => new Date(e.event_date) >= now && e.status === "approved")
    .sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
  const nextEvent = upcomingEvents[0] ?? null;

  // Countdown helper
  const daysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Recent events with RSVP data (most recent first, up to 5)
  const recentEvents = [...typedEvents]
    .sort(
      (a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    )
    .slice(0, 5);

  const isNewClub = totalEvents === 0;
  const handleNavigate = onNavigate ?? (() => {});

  return (
    <div className="space-y-8">
      {/* Completion Nudge */}
      <ClubCompletionNudge
        club={club}
        memberCount={memberCount}
        eventCount={totalEvents}
        pendingInviteCount={pendingInviteCount}
        onNavigate={handleNavigate}
      />

      {/* Quick action buttons for new clubs */}
      {isNewClub && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleNavigate("events")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <CalendarPlus className="h-4 w-4" />
            Create Your First Event
          </button>
          <button
            onClick={() => handleNavigate("members")}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Users className="h-4 w-4" />
            Invite Co-Organizers
          </button>
        </div>
      )}

      {/* Quick Stats Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Heart}
          value={followerCount}
          label="Total Followers"
        />
        <StatCard
          icon={Calendar}
          value={totalEvents}
          label="Events Hosted"
        />
        <StatCard
          icon={BarChart3}
          value={avgRsvps}
          label="Avg RSVPs / Event"
        />
        <StatCard
          icon={TrendingUp}
          value={newFollowersThisMonth >= 0 ? `+${newFollowersThisMonth}` : `${newFollowersThisMonth}`}
          label="New Followers (30d)"
        />
      </section>

      {/* Next Upcoming Event */}
      <section>
        <h4 className="text-lg font-bold text-foreground mb-4">
          Next Upcoming Event
        </h4>
        {nextEvent ? (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h5 className="font-semibold text-foreground text-lg">
                    {nextEvent.title}
                  </h5>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDate(nextEvent.event_date)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      in {daysUntil(nextEvent.event_date)}{" "}
                      {daysUntil(nextEvent.event_date) === 1 ? "day" : "days"}
                    </span>
                  </div>
                </div>
              </div>

              {/* RSVP summary */}
              <div className="flex items-center gap-6">
                {/* Headcount (biggest number) */}
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">
                    {(nextEvent.rsvp_counts?.going ?? 0) +
                      (nextEvent.rsvp_counts?.interested ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total RSVPs</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                    {nextEvent.rsvp_counts?.going ?? 0} Going
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {nextEvent.rsvp_counts?.interested ?? 0} Interested
                  </span>
                  {(nextEvent.rsvp_counts?.cancelled ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {nextEvent.rsvp_counts?.cancelled} dropped
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">
              No upcoming events
            </p>
            <button
              onClick={() => handleNavigate("events")}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <CalendarPlus className="h-4 w-4" />
              Create an Event
            </button>
          </div>
        )}
      </section>

      {/* Recent Events + Club Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Events (2/3 width) */}
        <section className="lg:col-span-2 space-y-4">
          <h4 className="text-lg font-bold text-foreground">Recent Events</h4>
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Event
                  </th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Date
                  </th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                    Going
                  </th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                    Interested
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentEvents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      No events yet. Create your first event!
                    </td>
                  </tr>
                ) : (
                  recentEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-foreground">
                            {event.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(event.event_date)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                          {event.rsvp_counts?.going ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          {event.rsvp_counts?.interested ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Club Summary Sidebar (1/3 width) */}
        <section className="space-y-4">
          <h4 className="text-lg font-bold text-foreground">Club Summary</h4>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingInviteCount > 0
                    ? `${pendingInviteCount} pending invite${pendingInviteCount > 1 ? "s" : ""}`
                    : "No pending invites"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {followerCount}{" "}
                  {followerCount === 1 ? "follower" : "followers"}
                </p>
                {newFollowersThisMonth > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    +{newFollowersThisMonth} this month
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {totalEvents} {totalEvents === 1 ? "event" : "events"} hosted
                </p>
                <p className="text-xs text-muted-foreground">
                  {upcomingEvents.length} upcoming
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {totalRsvps} total RSVPs
                </p>
                <p className="text-xs text-muted-foreground">
                  {avgRsvps} avg per event
                </p>
              </div>
            </div>

            <button
              onClick={() => handleNavigate("analytics")}
              className="w-full py-2 text-sm font-semibold border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              View Full Analytics
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Stat Card sub-component ─────────────────────────────────────────────── */

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
}

function StatCard({ icon: Icon, value, label }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className="h-8 w-8 text-primary/40" />
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}
