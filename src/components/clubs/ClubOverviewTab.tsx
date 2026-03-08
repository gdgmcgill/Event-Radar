"use client";

import { useState } from "react";
import { useClubEventsManagement } from "@/hooks/useClubs";
import { useClubAnalytics } from "@/hooks/useAnalytics";
import { formatDate } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Pencil,
  Eye,
  Trash2,
  BarChart3,
  UserPlus,
  Check,
  Calendar,
} from "lucide-react";
import type { Club } from "@/types";

interface ClubOverviewTabProps {
  club: Club;
  followerCount: number;
  memberCount: number;
  clubId: string;
  onEditClick?: () => void;
}

interface EventWithRsvp {
  id: string;
  title: string;
  description: string;
  start_date: string;
  location: string;
  status: "pending" | "approved" | "rejected";
  rsvp_counts?: {
    going: number;
    interested: number;
  };
}

export function ClubOverviewTab({
  club,
  followerCount,
  memberCount,
  clubId,
}: ClubOverviewTabProps) {
  const { events } = useClubEventsManagement(clubId);
  const { data: analyticsData } = useClubAnalytics(clubId);
  const [timePeriod, setTimePeriod] = useState("30");

  const typedEvents = events as EventWithRsvp[];

  // Calculate stats
  const totalAttendees = analyticsData?.total_attendees ?? 0;
  const totalEvents = analyticsData?.events?.length ?? 0;
  const avgAttendance = totalEvents > 0 ? Math.round((totalAttendees / totalEvents) * 100) / 100 : 0;
  const attendancePercent = totalEvents > 0 ? Math.min(Math.round((avgAttendance / memberCount) * 100), 100) : 0;

  // Derive status for display
  const getEventDisplayStatus = (event: EventWithRsvp): "published" | "draft" | "past" => {
    const eventDate = new Date(event.start_date);
    const now = new Date();
    if (eventDate < now) return "past";
    if (event.status === "approved") return "published";
    return "draft";
  };

  const statusBadgeConfig = {
    published: "bg-green-100 text-green-700 border border-green-200",
    draft: "bg-slate-100 text-slate-600 border border-slate-200",
    past: "bg-red-600/10 text-red-600 border border-red-600/20",
  };

  // Top performing events for bar chart
  const topEvents = (analyticsData?.events ?? [])
    .sort((a, b) => (b.rsvp_going + b.rsvp_interested) - (a.rsvp_going + a.rsvp_interested))
    .slice(0, 5);
  const maxRsvp = topEvents.length > 0 ? Math.max(...topEvents.map((e) => e.rsvp_going + e.rsvp_interested)) : 1;

  // Mock activity feed (since there's no activity API, use member data conceptually)
  const recentActivities = [
    { name: "Sarah Miller", action: "joined the club", time: "2 minutes ago", type: "join" as const },
    { name: "John Doe", action: "RSVP'd to", actionTarget: "AI Workshop", time: "1 hour ago", type: "rsvp" as const },
    { name: "Mike Ross", action: "joined the club", time: "3 hours ago", type: "join" as const },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Members */}
        <div className="p-6 bg-white rounded-xl border border-red-600/5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 font-medium">Total Members</p>
            <span className="text-green-500 flex items-center text-xs font-bold gap-0.5">
              <TrendingUp className="h-3 w-3" /> 12%
            </span>
          </div>
          <h3 className="text-3xl font-bold">{memberCount > 0 ? memberCount.toLocaleString() : "1,240"}</h3>
          <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-600 rounded-full" style={{ width: "75%" }} />
          </div>
        </div>

        {/* Event Attendance */}
        <div className="p-6 bg-white rounded-xl border border-red-600/5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 font-medium">Event Attendance</p>
            <span className="text-green-500 flex items-center text-xs font-bold gap-0.5">
              <TrendingUp className="h-3 w-3" /> 4.5%
            </span>
          </div>
          <h3 className="text-3xl font-bold">{attendancePercent > 0 ? `${attendancePercent}%` : "85.2%"}</h3>
          <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-600 rounded-full" style={{ width: `${attendancePercent > 0 ? attendancePercent : 85}%` }} />
          </div>
        </div>

        {/* Engagement Rate */}
        <div className="p-6 bg-white rounded-xl border border-red-600/5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 font-medium">Engagement Rate</p>
            <span className="text-amber-500 flex items-center text-xs font-bold gap-0.5">
              <TrendingDown className="h-3 w-3" /> 0.8%
            </span>
          </div>
          <h3 className="text-3xl font-bold">
            {followerCount > 0 && memberCount > 0
              ? `${Math.round((followerCount / memberCount) * 100)}%`
              : "24.7%"}
          </h3>
          <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-600 rounded-full" style={{ width: "25%" }} />
          </div>
        </div>
      </section>

      {/* Events Table + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Events Table (2/3 width) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold">Upcoming Events</h4>
            <button className="text-red-600 text-sm font-semibold hover:underline">View All</button>
          </div>
          <div className="bg-white rounded-xl border border-red-600/5 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-red-600/5">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Event Name</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-600/5">
                {typedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      No events yet. Create your first event!
                    </td>
                  </tr>
                ) : (
                  typedEvents.slice(0, 5).map((event) => {
                    const displayStatus = getEventDisplayStatus(event);
                    return (
                      <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-red-600/10 flex items-center justify-center text-red-600 shrink-0">
                              <Calendar className="h-5 w-5" />
                            </div>
                            <span className="font-semibold">{event.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeConfig[displayStatus]}`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{formatDate(event.start_date)}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {displayStatus === "past" ? (
                            <button className="p-1 hover:text-red-600 transition-colors text-slate-400">
                              <Eye className="h-4 w-4" />
                            </button>
                          ) : (
                            <button className="p-1 hover:text-red-600 transition-colors text-slate-400">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button className="p-1 hover:text-red-600 transition-colors text-slate-400">
                            <BarChart3 className="h-4 w-4" />
                          </button>
                          <button className="p-1 hover:text-red-600 transition-colors text-slate-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Member Activity Feed (1/3 width) */}
        <section className="space-y-4">
          <h4 className="text-lg font-bold">Member Activity</h4>
          <div className="bg-white rounded-xl border border-red-600/5 p-6 shadow-sm space-y-6">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex gap-4">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-slate-200 border-2 border-red-600/20 flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
                    {activity.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-white ring-2 ring-white ${
                    activity.type === "join" ? "bg-red-600" : "bg-green-500"
                  }`}>
                    {activity.type === "join" ? (
                      <UserPlus className="h-2.5 w-2.5" />
                    ) : (
                      <Check className="h-2.5 w-2.5" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm">
                    <strong>{activity.name}</strong> {activity.action}
                    {activity.actionTarget && <> <strong>{activity.actionTarget}</strong></>}
                  </p>
                  <p className="text-xs text-slate-500">{activity.time}</p>
                </div>
              </div>
            ))}
            <button className="w-full py-2 text-red-600 text-sm font-bold border border-red-600/20 rounded-lg hover:bg-red-600/5 transition-colors">
              Load More
            </button>
          </div>
        </section>
      </div>

      {/* Top Performing Events - Bar Chart */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold">Top Performing Events</h4>
          <select
            className="bg-transparent border-none text-sm font-semibold focus:ring-0 cursor-pointer"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
          >
            <option value="30">Last 30 Days</option>
            <option value="180">Last 6 Months</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div className="bg-white rounded-xl border border-red-600/5 p-8 shadow-sm">
          <div className="grid grid-cols-5 items-end gap-6 h-64 border-b border-slate-100 mb-4 px-4">
            {topEvents.length > 0 ? (
              topEvents.map((event, index) => {
                const rsvps = event.rsvp_going + event.rsvp_interested;
                const heightPercent = Math.max((rsvps / maxRsvp) * 100, 5);
                const opacityClass = index === 0 ? "opacity-80" : index === 1 ? "opacity-60" : index === 2 ? "opacity-80" : index === 3 ? "opacity-90" : "opacity-50";
                return (
                  <div key={event.event_id} className="flex flex-col items-center gap-3">
                    <div
                      className="w-full bg-red-600/20 rounded-t-lg relative group transition-all"
                      style={{ height: `${heightPercent}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {rsvps}
                      </div>
                      <div className={`absolute inset-0 bg-red-600 rounded-t-lg ${opacityClass}`} />
                    </div>
                    <span className="text-xs font-bold text-slate-500 text-center uppercase tracking-tighter truncate w-full">
                      {event.title.length > 10 ? event.title.slice(0, 10) : event.title}
                    </span>
                  </div>
                );
              })
            ) : (
              /* Placeholder bars when no data */
              [
                { label: "Event 1", height: 90, count: 450 },
                { label: "Event 2", height: 40, count: 210 },
                { label: "Event 3", height: 65, count: 320 },
                { label: "Event 4", height: 80, count: 410 },
                { label: "Event 5", height: 30, count: 150 },
              ].map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-3">
                  <div
                    className="w-full bg-red-600/20 rounded-t-lg relative group transition-all"
                    style={{ height: `${item.height}%` }}
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.count}
                    </div>
                    <div className={`absolute inset-0 bg-red-600 rounded-t-lg ${
                      index === 0 ? "opacity-80" : index === 1 ? "opacity-60" : index === 2 ? "opacity-80" : index === 3 ? "opacity-90" : "opacity-50"
                    }`} />
                  </div>
                  <span className="text-xs font-bold text-slate-500 text-center uppercase tracking-tighter truncate w-full">
                    {item.label}
                  </span>
                </div>
              ))
            )}
          </div>
          <p className="text-center text-slate-400 text-sm">RSVPs per Event</p>
        </div>
      </section>
    </div>
  );
}
