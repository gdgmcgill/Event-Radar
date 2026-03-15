"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Users,
  CheckCircle,
  BarChart3,
  Eye,
  Bookmark,
  Trophy,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Stats {
  totalEvents: number;
  pendingEvents: number;
  approvedEvents: number;
  totalUsers: number;
  activeUsers: number;
  engagedUsers: number;
}

interface UserAnalytics {
  dailySignups: { date: string; count: number }[];
  cumulativeGrowth: { date: string; total: number }[];
  activeUsersLast7Days: number;
  engagedUsers: number;
  totalUsers: number;
}

interface TopPerformer {
  event_id: string;
  title: string;
  tags: string[];
  popularity_score: number;
  view_count: number;
  save_count: number;
  click_count: number;
}

interface EventAnalytics {
  dailyCreation: { date: string; count: number }[];
  categoryDistribution: { tag: string; count: number }[];
  statusBreakdown: Record<string, number>;
  topPerformers: TopPerformer[];
  totalApproved: number;
}

export default function ModerationStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(
    null
  );
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [statsRes, userRes, eventRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/analytics/users"),
        fetch("/api/admin/analytics/events"),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (userRes.ok) setUserAnalytics(await userRes.json());
      if (eventRes.ok) setEventAnalytics(await eventRes.json());
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Analytics
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Platform performance and engagement metrics.
          </p>
        </div>
        {/* Stat card skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 animate-pulse"
            >
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3 mb-4" />
              <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
            </div>
          ))}
        </div>
        {/* Chart skeletons */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 animate-pulse"
            >
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-6" />
              <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 animate-pulse"
            >
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-6" />
              <div className="h-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Analytics
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Failed to load statistics.
          </p>
        </div>
      </div>
    );
  }

  const approvalRate =
    stats.totalEvents > 0
      ? Math.round((stats.approvedEvents / stats.totalEvents) * 100)
      : 0;

  // Aggregate daily signups by month for bar chart
  const monthlySignups = aggregateByMonth(userAnalytics?.dailySignups ?? []);

  // Daily event creation for line chart
  const dailyCreation = (eventAnalytics?.dailyCreation ?? []).map((d) => ({
    date: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    count: d.count,
  }));

  // Category distribution sorted descending
  const totalCategoryCount =
    eventAnalytics?.categoryDistribution.reduce(
      (sum, c) => sum + c.count,
      0
    ) ?? 0;
  const categoryData = (eventAnalytics?.categoryDistribution ?? [])
    .map((c) => ({
      tag: c.tag.charAt(0).toUpperCase() + c.tag.slice(1),
      count: c.count,
      percent:
        totalCategoryCount > 0
          ? Math.round((c.count / totalCategoryCount) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Top performers
  const topPerformers = eventAnalytics?.topPerformers ?? [];

  // Status breakdown
  const rejectedCount =
    stats.totalEvents - stats.approvedEvents - stats.pendingEvents;

  const statCards = [
    {
      label: "Active Users",
      value: (
        userAnalytics?.activeUsersLast7Days ?? stats.activeUsers
      ).toLocaleString(),
      icon: Users,
      accent: "border-l-blue-500",
      iconBg: "bg-blue-50 dark:bg-blue-900/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Verified Clubs",
      value: stats.approvedEvents.toString(),
      icon: CheckCircle,
      accent: "border-l-emerald-500",
      iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total Events",
      value: stats.totalEvents.toString(),
      icon: Calendar,
      accent: "border-l-violet-500",
      iconBg: "bg-violet-50 dark:bg-violet-900/20",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      label: "Approval Rate",
      value: `${approvalRate}%`,
      icon: BarChart3,
      accent: "border-l-amber-500",
      iconBg: "bg-amber-50 dark:bg-amber-900/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Analytics
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Platform performance and engagement metrics.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 border-l-4 ${stat.accent}`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </p>
                <span
                  className={`${stat.iconBg} p-2 rounded-lg`}
                >
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </span>
              </div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1: User Growth + Event Creation Trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* User Growth */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            User Growth
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
            Monthly new registrations
          </p>
          {monthlySignups.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySignups}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-zinc-200 dark:text-zinc-700"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  className="text-zinc-400 dark:text-zinc-500"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  className="text-zinc-400 dark:text-zinc-500"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--color-zinc-200)",
                    fontSize: "12px",
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar
                  dataKey="count"
                  name="Signups"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
              No signup data available
            </div>
          )}
        </div>

        {/* Event Creation Trends */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Event Creation Trends
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
            Daily events created over the last 30 days
          </p>
          {dailyCreation.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyCreation}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-zinc-200 dark:text-zinc-700"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-zinc-400 dark:text-zinc-500"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  className="text-zinc-400 dark:text-zinc-500"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--color-zinc-200)",
                    fontSize: "12px",
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Events"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
              No trend data available
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2: Category Distribution + Top Performing Events */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
            Category Distribution
          </h3>
          {categoryData.length > 0 ? (
            <div className="flex flex-col gap-4">
              {categoryData.map((cat) => (
                <div key={cat.tag} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      {cat.tag}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                      {cat.count} events ({cat.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${cat.percent}%`,
                        backgroundColor: "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
              No category data available
            </div>
          )}
        </div>

        {/* Top Performing Events */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Top Performing Events
            </h3>
          </div>
          {topPerformers.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Saves
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {topPerformers.slice(0, 5).map((event, index) => (
                  <tr
                    key={event.event_id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                        {event.title}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-right text-zinc-600 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {event.view_count}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-zinc-600 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <Bookmark className="h-3 w-3" />
                        {event.save_count}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        <Trophy className="h-3 w-3" />
                        {event.popularity_score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500">
              <Activity className="h-8 w-8 mb-2" />
              <p className="text-sm">No event data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Event Status Breakdown */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
          Event Status Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Approved",
              value: stats.approvedEvents,
              icon: CheckCircle,
              accent: "border-l-emerald-500",
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
            {
              label: "Pending",
              value: stats.pendingEvents,
              icon: Calendar,
              accent: "border-l-amber-500",
              color: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-50 dark:bg-amber-900/20",
            },
            {
              label: "Rejected",
              value: rejectedCount,
              icon: BarChart3,
              accent: "border-l-red-500",
              color: "text-red-600 dark:text-red-400",
              bg: "bg-red-50 dark:bg-red-900/20",
            },
          ].map((item) => {
            const Icon = item.icon;
            const pct =
              stats.totalEvents > 0
                ? Math.round((item.value / stats.totalEvents) * 100)
                : 0;
            return (
              <div
                key={item.label}
                className={`border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 border-l-4 ${item.accent}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className={`${item.bg} p-2 rounded-lg`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </span>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {item.label}
                  </p>
                </div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {item.value}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {pct}% of total
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -- Utility: aggregate daily signups by month -- */
function aggregateByMonth(
  data: { date: string; count: number }[]
): { label: string; count: number }[] {
  if (data.length === 0) return [];
  const months: Record<string, number> = {};
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  for (const d of data) {
    const date = new Date(d.date + "T00:00:00");
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
    if (!months[key]) months[key] = 0;
    months[key] += d.count;
  }
  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, count]) => {
      const monthIndex = parseInt(key.split("-")[1]);
      return { label: monthNames[monthIndex], count };
    });
}
