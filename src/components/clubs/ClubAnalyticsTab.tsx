"use client";

import { useClubAnalytics } from "@/hooks/useAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-600/5 shadow-sm py-16 text-center">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <p className="text-lg font-medium text-slate-500">Unable to load analytics</p>
        <p className="text-sm text-slate-400">Please try again later.</p>
      </div>
    );
  }

  if (!data) return null;

  const totalEvents = data.events.length;
  const totalFollowers = data.follower_growth.length > 0 ? data.follower_growth[data.follower_growth.length - 1].count : 0;
  const topTag = data.popular_tags.length > 0 ? data.popular_tags[0].tag : "None";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard icon={CalendarDays} label="Total Events" value={totalEvents} />
        <SummaryCard icon={Users} label="Total Attendees" value={data.total_attendees} />
        <SummaryCard icon={Users} label="Followers" value={totalFollowers} />
        <SummaryCard icon={Tag} label="Top Tag" value={topTag} />
      </div>

      {/* Follower Growth Chart */}
      <div className="bg-white rounded-xl border border-red-600/5 shadow-sm p-6">
        <h4 className="text-lg font-bold mb-4">Follower Growth (Last 30 Days)</h4>
        {data.follower_growth.length > 0 ? (
          <div aria-label="Follower growth chart">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.follower_growth}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={false} name="Followers" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-slate-400">No follower data yet</p>
        )}
      </div>

      {/* Popular Tags Chart */}
      <div className="bg-white rounded-xl border border-red-600/5 shadow-sm p-6">
        <h4 className="text-lg font-bold mb-4">Popular Event Tags</h4>
        {data.popular_tags.length > 0 ? (
          <div aria-label="Popular tags chart">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.popular_tags}>
                <XAxis dataKey="tag" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-slate-400">No event tags yet</p>
        )}
      </div>

      {/* Events Performance Table */}
      <div className="bg-white rounded-xl border border-red-600/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-600/5">
          <h4 className="text-lg font-bold">Event Performance</h4>
        </div>
        {data.events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-red-600/5">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Event</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Views</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Saves</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Going</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Interested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-600/5">
                {data.events.map((event: EventAnalytics) => (
                  <tr key={event.event_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold">{event.title}</td>
                    <td className="px-6 py-4 text-slate-500">{event.event_date}</td>
                    <td className="px-6 py-4 text-right">{event.views}</td>
                    <td className="px-6 py-4 text-right">{event.saves}</td>
                    <td className="px-6 py-4 text-right">{event.rsvp_going}</td>
                    <td className="px-6 py-4 text-right">{event.rsvp_interested}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-12 text-center text-slate-400">No events yet</p>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}

function SummaryCard({ icon: Icon, label, value }: SummaryCardProps) {
  return (
    <div className="p-6 bg-white rounded-xl border border-red-600/5 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className="h-8 w-8 text-red-600/40" />
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
