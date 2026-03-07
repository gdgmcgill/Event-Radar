"use client";

import { useClubAnalytics } from "@/hooks/useAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Users, CalendarDays, Tag } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import type { EventAnalytics } from "@/types";

interface ClubAnalyticsTabProps {
  clubId: string;
}

export function ClubAnalyticsTab({ clubId }: ClubAnalyticsTabProps) {
  const { data, error, isLoading } = useClubAnalytics(clubId);

  if (isLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[250px] rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg font-medium">Unable to load analytics</p>
        <p className="text-sm">Please try again later.</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const totalEvents = data.events.length;
  const totalFollowers =
    data.follower_growth.length > 0
      ? data.follower_growth[data.follower_growth.length - 1].count
      : 0;
  const topTag =
    data.popular_tags.length > 0 ? data.popular_tags[0].tag : "None";

  return (
    <div className="space-y-6 py-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard
          icon={CalendarDays}
          label="Total Events"
          value={totalEvents}
        />
        <SummaryCard
          icon={Users}
          label="Total Attendees"
          value={data.total_attendees}
        />
        <SummaryCard
          icon={Users}
          label="Followers"
          value={totalFollowers}
        />
        <SummaryCard icon={Tag} label="Top Tag" value={topTag} />
      </div>

      {/* Follower Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Follower Growth (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.follower_growth.length > 0 ? (
            <div aria-label="Follower growth chart">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.follower_growth}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#ED1B2F"
                    strokeWidth={2}
                    dot={false}
                    name="Followers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-muted-foreground">
              No follower data yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Popular Tags Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Popular Event Tags</CardTitle>
        </CardHeader>
        <CardContent>
          {data.popular_tags.length > 0 ? (
            <div aria-label="Popular tags chart">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.popular_tags}>
                  <XAxis dataKey="tag" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="#561c24"
                    radius={[4, 4, 0, 0]}
                    name="Events"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-muted-foreground">
              No event tags yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Events Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {data.events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Event</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 text-right font-medium">Views</th>
                    <th className="pb-3 pr-4 text-right font-medium">Saves</th>
                    <th className="pb-3 pr-4 text-right font-medium">Going</th>
                    <th className="pb-3 text-right font-medium">Interested</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event: EventAnalytics) => (
                    <tr key={event.event_id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {event.title}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {event.event_date}
                      </td>
                      <td className="py-3 pr-4 text-right">{event.views}</td>
                      <td className="py-3 pr-4 text-right">{event.saves}</td>
                      <td className="py-3 pr-4 text-right">
                        {event.rsvp_going}
                      </td>
                      <td className="py-3 text-right">
                        {event.rsvp_interested}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-muted-foreground">
              No events yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}

function SummaryCard({ icon: Icon, label, value }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
