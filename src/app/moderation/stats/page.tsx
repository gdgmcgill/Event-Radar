"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Users,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Download,
  Eye,
  Bookmark,
  MousePointerClick,
  Trophy,
  Award,
  Code,
  Landmark,
  Palette,
  Search,
  Settings,
  DollarSign,
  LayoutDashboard,
} from "lucide-react";

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

const TAG_COLORS: Record<string, string> = {
  academic: "#3b82f6",
  social: "#ec4899",
  sports: "#22c55e",
  career: "#a855f7",
  cultural: "#f59e0b",
  wellness: "#14b8a6",
};

const SIDEBAR_ITEMS = [
  { label: "Platform Insights", icon: LayoutDashboard, active: true },
  { label: "Engagement", icon: Users, active: false },
  { label: "Growth Strategy", icon: TrendingUp, active: false },
  { label: "Budgeting", icon: DollarSign, active: false },
];

export default function ModerationStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceView, setAttendanceView] = useState<"Weekly" | "Monthly" | "Yearly">("Weekly");

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
      <div className="flex flex-1 flex-col lg:flex-row min-h-[80vh]">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-10 flex flex-col gap-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Platform Analytics</h2>
            <p className="text-slate-500 mt-1">Real-time data visualization of campus engagement at McGill.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-2/3 mb-4" />
                <div className="h-8 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-1 flex-col lg:flex-row min-h-[80vh]">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-10 flex flex-col gap-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Platform Analytics</h2>
            <p className="text-slate-500 mt-1">Failed to load statistics.</p>
          </div>
        </main>
      </div>
    );
  }

  const approvalRate =
    stats.totalEvents > 0
      ? Math.round((stats.approvedEvents / stats.totalEvents) * 100)
      : 0;

  // Compute category percentages from real data
  const totalCategoryCount = eventAnalytics?.categoryDistribution.reduce((sum, c) => sum + c.count, 0) ?? 0;
  const categoryPercentages = (eventAnalytics?.categoryDistribution ?? [])
    .map((c) => ({
      tag: c.tag.charAt(0).toUpperCase() + c.tag.slice(1),
      percent: totalCategoryCount > 0 ? Math.round((c.count / totalCategoryCount) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 4);

  // Build bar chart data from daily signups (aggregate by month)
  const monthlySignups = aggregateByMonth(userAnalytics?.dailySignups ?? []);

  // Build line chart data from daily event creation
  const dailyCreation = eventAnalytics?.dailyCreation ?? [];

  const statCards = [
    {
      label: "Total Active Users",
      value: (userAnalytics?.activeUsersLast7Days ?? stats.totalUsers).toLocaleString(),
      icon: Users,
      change: 12,
      up: true,
    },
    {
      label: "Verified Clubs",
      value: stats.approvedEvents.toString(),
      icon: CheckCircle,
      change: 5,
      up: true,
    },
    {
      label: "Events This Month",
      value: stats.totalEvents.toString(),
      icon: Calendar,
      change: 8,
      up: true,
    },
    {
      label: "Approval Rate",
      value: `${approvalRate}%`,
      icon: BarChart3,
      change: 2,
      up: approvalRate >= 50,
    },
  ];

  return (
    <div className="flex flex-1 flex-col lg:flex-row min-h-[80vh]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Platform Analytics</h2>
            <p className="text-slate-500 mt-1">Real-time data visualization of campus engagement at McGill.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors">
              <Calendar className="h-4 w-4" />
              Last 30 Days
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-600/20">
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">{stat.label}</p>
                  <span className="text-red-600 bg-red-50 p-2 rounded-lg">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-slate-900 leading-none">{stat.value}</p>
                  <p className={`text-sm font-bold flex items-center mb-0.5 ${stat.up ? "text-emerald-500" : "text-rose-500"}`}>
                    {stat.up ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                    {stat.change}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visualization Row 1: User Growth + Category Performance */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-lg text-slate-900">User Growth</h3>
                <p className="text-slate-500 text-xs">New registrations over last 6 months</p>
              </div>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="size-2 rounded-full bg-red-600" /> Signups
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="size-2 rounded-full bg-slate-300" /> Cumulative
                </span>
              </div>
            </div>
            <div className="h-64 flex items-end justify-between gap-4 px-2">
              {monthlySignups.length > 0 ? (
                monthlySignups.map((m) => {
                  const maxCount = Math.max(...monthlySignups.map((x) => x.count), 1);
                  const heightPct = Math.max((m.count / maxCount) * 95, 5);
                  return (
                    <div key={m.label} className="flex-1 flex flex-col justify-end gap-1">
                      <div
                        className="bg-red-100 w-full rounded-t-sm relative group"
                        style={{ height: `${heightPct}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {m.count}
                        </div>
                        <div className="bg-red-600 w-full rounded-t-sm" style={{ height: "70%" }} />
                      </div>
                      <span className="text-[10px] text-slate-400 text-center mt-2">{m.label}</span>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                  No signup data available
                </div>
              )}
            </div>
          </div>

          {/* Category Performance */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-6">Top Performing Categories</h3>
            <div className="flex flex-col gap-6">
              {categoryPercentages.length > 0 ? (
                categoryPercentages.map((cat) => (
                  <div key={cat.tag} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">{cat.tag}</span>
                      <span className="text-red-600 font-bold">{cat.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${cat.percent}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No category data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Leaderboards Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Most Active / Top Performing Events */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">Top Performing Events</h3>
              <span className="text-red-600 text-sm font-bold cursor-pointer hover:underline">View All</span>
            </div>
            <div className="divide-y divide-slate-50">
              {eventAnalytics?.topPerformers && eventAnalytics.topPerformers.length > 0 ? (
                eventAnalytics.topPerformers.slice(0, 3).map((event, index) => {
                  const icons = [Code, Landmark, Palette];
                  const Icon = icons[index % icons.length];
                  return (
                    <div
                      key={event.event_id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 font-bold w-4">{index + 1}</span>
                        <div className="size-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden">
                          <Icon className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 truncate max-w-[180px]">{event.title}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-2">
                            <Eye className="h-3 w-3" /> {event.view_count} views
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{event.save_count} Saves</p>
                        <span className="text-[10px] uppercase text-emerald-500 font-bold">
                          Score: {event.popularity_score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-sm text-slate-400">No event data available</div>
              )}
            </div>
          </div>

          {/* Top Organizers / Event Status Summary */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">Event Status Overview</h3>
              <span className="text-red-600 text-sm font-bold cursor-pointer hover:underline">Details</span>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                {
                  label: "Approved Events",
                  value: stats.approvedEvents,
                  color: "text-emerald-500",
                  icon: CheckCircle,
                  badge: "bg-emerald-50",
                },
                {
                  label: "Pending Review",
                  value: stats.pendingEvents,
                  color: "text-amber-500",
                  icon: Calendar,
                  badge: "bg-amber-50",
                },
                {
                  label: "Rejected Events",
                  value: stats.totalEvents - stats.approvedEvents - stats.pendingEvents,
                  color: "text-rose-500",
                  icon: BarChart3,
                  badge: "bg-rose-50",
                },
              ].map((item) => {
                const Icon = item.icon;
                const pct = stats.totalEvents > 0 ? Math.round((item.value / stats.totalEvents) * 100) : 0;
                return (
                  <div
                    key={item.label}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`size-10 rounded-full ${item.badge} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">{pct}% of total</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{item.value}</p>
                        <p className="text-xs text-slate-500">events</p>
                      </div>
                      <Award className={`h-5 w-5 ${item.color}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Event Attendance Trends (line chart via SVG) */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Event Creation Trends</h3>
              <p className="text-slate-500 text-xs">Events created over the last 30 days</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(["Weekly", "Monthly", "Yearly"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setAttendanceView(view)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    attendanceView === view
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
          {/* SVG Line Chart */}
          <div className="relative h-64 w-full">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="w-full border-t border-slate-100 h-0" />
              ))}
            </div>
            {dailyCreation.length > 0 ? (
              <>
                <svg
                  className="absolute inset-0 h-full w-full overflow-visible"
                  viewBox="0 0 900 256"
                  preserveAspectRatio="none"
                >
                  <path
                    d={buildSVGPath(dailyCreation.map((d) => d.count), 900, 256)}
                    fill="none"
                    stroke="#dc2626"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                </svg>
                <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-slate-400 font-medium px-2">
                  {getAxisLabels(dailyCreation).map((label, i) => (
                    <span key={i}>{label}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                No trend data available
              </div>
            )}
          </div>
          <div className="mt-12 flex flex-wrap gap-6 border-t border-slate-50 pt-6">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-red-600" />
              <div className="flex flex-col">
                <p className="text-xs text-slate-500">Total Events</p>
                <p className="text-sm font-bold text-slate-900">{stats.totalEvents}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-slate-500" />
              <div className="flex flex-col">
                <p className="text-xs text-slate-500">Approved</p>
                <p className="text-sm font-bold text-slate-900">{stats.approvedEvents}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <div className="flex flex-col">
                <p className="text-xs text-slate-500">Approval Rate</p>
                <p className="text-sm font-bold text-emerald-500">{approvalRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Sidebar Component ── */
function Sidebar() {
  return (
    <aside className="w-full lg:w-64 border-r border-red-600/5 bg-white p-4 flex flex-col gap-6">
      <div className="flex items-center gap-3 p-2">
        <div className="bg-red-50 rounded-lg p-2">
          <Landmark className="w-8 h-8 text-red-600" />
        </div>
        <div>
          <h1 className="text-slate-900 text-sm font-bold">McGill Central</h1>
          <p className="text-slate-500 text-xs">Admin Panel</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.label}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                item.active
                  ? "bg-red-50 text-red-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm">{item.label}</span>
            </span>
          );
        })}
        <hr className="my-4 border-slate-100" />
        <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">
          <Settings className="h-5 w-5" />
          <span className="text-sm">System Settings</span>
        </span>
      </nav>
    </aside>
  );
}

/* ── Utility: aggregate daily signups by month ── */
function aggregateByMonth(data: { date: string; count: number }[]): { label: string; count: number }[] {
  if (data.length === 0) return [];
  const months: Record<string, number> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (const d of data) {
    const date = new Date(d.date + "T00:00:00");
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = monthNames[date.getMonth()];
    if (!months[key]) months[key] = 0;
    months[key] += d.count;
  }
  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, count]) => {
      const monthIndex = parseInt(key.split("-")[1]);
      return { label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex], count };
    });
}

/* ── Utility: build SVG path from data points ── */
function buildSVGPath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const padding = 20;
  const usableHeight = height - padding * 2;
  const step = width / Math.max(values.length - 1, 1);

  return values
    .map((v, i) => {
      const x = i * step;
      const y = padding + usableHeight - (v / max) * usableHeight;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

/* ── Utility: get evenly spaced axis labels ── */
function getAxisLabels(data: { date: string }[]): string[] {
  if (data.length === 0) return [];
  const count = Math.min(7, data.length);
  const step = Math.max(1, Math.floor((data.length - 1) / (count - 1)));
  const labels: string[] = [];
  for (let i = 0; i < data.length; i += step) {
    const d = new Date(data[i].date + "T00:00:00");
    labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    if (labels.length >= count) break;
  }
  return labels;
}
