"use client";

import { useClubAnalytics } from "@/hooks/useAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Users,
  CalendarDays,
  Tag,
  TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import type { EventAnalytics } from "@/types";

interface ClubAnalyticsTabProps {
  clubId: string;
}

export function ClubAnalyticsTab({ clubId }: ClubAnalyticsTabProps) {
  const { data, error, isLoading } = useClubAnalytics(clubId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[250px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border shadow-sm py-16 text-center">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg font-medium text-muted-foreground">
          Unable to load analytics
        </p>
        <p className="text-sm text-muted-foreground/60">
          Please try again later.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const totalEvents = data.events.length;
  const totalFollowers =
    data.follower_growth.length > 0
      ? data.follower_growth[data.follower_growth.length - 1].count
      : 0;
  const topTag =
    data.popular_tags.length > 0 ? data.popular_tags[0].tag : "None";

  // Compute churn / drop-off rate across all events
  const totals = data.events.reduce(
    (acc, ev) => ({
      going: acc.going + ev.rsvp_going,
      interested: acc.interested + ev.rsvp_interested,
      cancelled: acc.cancelled + ev.rsvp_cancelled,
    }),
    { going: 0, interested: 0, cancelled: 0 }
  );
  const totalRsvps = totals.going + totals.interested + totals.cancelled;
  const dropOffRate = totalRsvps > 0 ? (totals.cancelled / totalRsvps) * 100 : null;

  const dropOffColor =
    dropOffRate === null
      ? "text-muted-foreground"
      : dropOffRate > 10
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
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
        <SummaryCard
          icon={TrendingDown}
          label="Avg Drop-off Rate"
          value={dropOffRate !== null ? `${dropOffRate.toFixed(1)}%` : "N/A"}
          valueClassName={dropOffColor}
        />
      </div>

      {/* Follower Growth Chart */}
      <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-6">
        <h4 className="text-lg font-bold text-foreground mb-4">
          Follower Growth (Last 30 Days)
        </h4>
        {data.follower_growth.length > 0 ? (
          <div aria-label="Follower growth chart">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.follower_growth}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
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
      </div>

      {/* Popular Tags Chart */}
      <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-6">
        <h4 className="text-lg font-bold text-foreground mb-4">
          Popular Event Tags
        </h4>
        {data.popular_tags.length > 0 ? (
          <div aria-label="Popular tags chart">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.popular_tags}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="tag"
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
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
      </div>

      {/* Events Performance Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h4 className="text-lg font-bold text-foreground">
            Event Performance
          </h4>
        </div>
        {data.events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Event
                  </th>
                  <th className="px-6 py-4 text-left font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Date
                  </th>
                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Views
                  </th>
                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Saves
                  </th>
                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Going
                  </th>
                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Interested
                  </th>
                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Cancelled
                  </th>
                  <th className="px-6 py-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs">
                    Churn %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.events.map((event: EventAnalytics) => {
                  const evTotal =
                    event.rsvp_going +
                    event.rsvp_interested +
                    event.rsvp_cancelled;
                  const churn =
                    evTotal > 0
                      ? ((event.rsvp_cancelled / evTotal) * 100).toFixed(1)
                      : "—";
                  const churnNum = evTotal > 0 ? event.rsvp_cancelled / evTotal * 100 : 0;

                  return (
                    <tr
                      key={event.event_id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {event.title}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {event.event_date}
                      </td>
                      <td className="px-6 py-4 text-right text-foreground">
                        {event.views}
                      </td>
                      <td className="px-6 py-4 text-right text-foreground">
                        {event.saves}
                      </td>
                      <td className="px-6 py-4 text-right text-foreground">
                        {event.rsvp_going}
                      </td>
                      <td className="px-6 py-4 text-right text-foreground">
                        {event.rsvp_interested}
                      </td>
                      <td className="px-6 py-4 text-right text-foreground">
                        {event.rsvp_cancelled}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-medium ${
                          churnNum > 10
                            ? "text-amber-600 dark:text-amber-400"
                            : churnNum > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {churn === "—" ? churn : `${churn}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            No events yet
          </p>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  valueClassName?: string;
}

function SummaryCard({ icon: Icon, label, value, valueClassName }: SummaryCardProps) {
  return (
    <div className="p-6 bg-card rounded-xl border shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className="h-8 w-8 text-primary/40" />
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className={`text-2xl font-bold ${valueClassName ?? "text-foreground"}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
