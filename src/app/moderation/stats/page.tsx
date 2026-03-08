"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  Users,
  CheckCircle,
  FileQuestion,
  TrendingUp,
  BarChart3,
  CircleUser,
  UserPlus,
  Eye,
  Bookmark,
  MousePointerClick,
  Trophy,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

const TAG_COLORS: Record<string, string> = {
  academic: "#3b82f6",
  social: "#ec4899",
  sports: "#22c55e",
  career: "#a855f7",
  cultural: "#f59e0b",
  wellness: "#14b8a6",
};

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
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics | null>(null);
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
        <h2 className="text-2xl font-semibold">Platform Statistics</h2>
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Platform Statistics</h2>
        <div className="text-center py-12 text-muted-foreground">
          Failed to load statistics.
        </div>
      </div>
    );
  }

  const approvalRate =
    stats.totalEvents > 0
      ? Math.round((stats.approvedEvents / stats.totalEvents) * 100)
      : 0;

  const rejectedEvents =
    stats.totalEvents - stats.approvedEvents - stats.pendingEvents;

  const statCards = [
    {
      label: "Total Events",
      value: stats.totalEvents,
      icon: Calendar,
      description: "All events on the platform",
    },
    {
      label: "Pending Review",
      value: stats.pendingEvents,
      icon: FileQuestion,
      description: "Events awaiting moderation",
    },
    {
      label: "Approved",
      value: stats.approvedEvents,
      icon: CheckCircle,
      description: "Events visible to users",
    },
    {
      label: "Rejected",
      value: rejectedEvents,
      icon: BarChart3,
      description: "Events not approved",
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      description: "Registered accounts",
    },
    {
      label: "Approval Rate",
      value: `${approvalRate}%`,
      icon: TrendingUp,
      description: "Percentage of approved events",
    },
    {
      label: "Active Users",
      value: userAnalytics?.activeUsersLast7Days ?? "—",
      icon: CircleUser,
      description: "Active during last 7 days",
    },
    {
      label: "Engaged Users",
      value: userAnalytics?.engagedUsers ?? "—",
      icon: UserPlus,
      description: "Accounts with 3+ saved events",
    },
  ];

  const formatDateAxis = (val: string) => {
    const d = new Date(val + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDateTooltip = (val: unknown) => {
    const d = new Date(String(val) + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const tooltipStyle = {
    borderRadius: "8px",
    border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform Statistics</h2>
        <p className="text-sm text-muted-foreground">
          Overview of platform metrics and activity
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Event Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Event Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: "Approved", value: stats.approvedEvents, color: "bg-green-500" },
              { label: "Pending", value: stats.pendingEvents, color: "bg-yellow-500" },
              { label: "Rejected", value: rejectedEvents, color: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm">{item.label}</span>
                <div className="flex items-center gap-3">
                  <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{
                        width: `${stats.totalEvents > 0 ? (item.value / stats.totalEvents) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row: User Signups + Event Creation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Signups Chart */}
        {userAnalytics && userAnalytics.dailySignups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>New User Signups (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userAnalytics.dailySignups}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={formatDateAxis}
                      interval="preserveStartEnd"
                      className="text-muted-foreground"
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      labelFormatter={formatDateTooltip}
                      formatter={(value) => [String(value), "New Users"]}
                      contentStyle={tooltipStyle}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#ED1B2F"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#ED1B2F" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Creation Chart */}
        {eventAnalytics && eventAnalytics.dailyCreation.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Events Created (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={eventAnalytics.dailyCreation}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={formatDateAxis}
                      interval="preserveStartEnd"
                      className="text-muted-foreground"
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      labelFormatter={formatDateTooltip}
                      formatter={(value) => [String(value), "Events Created"]}
                      contentStyle={tooltipStyle}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#561c24"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#561c24" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row: Cumulative Growth + Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative User Growth */}
        {userAnalytics && userAnalytics.cumulativeGrowth.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Total Users Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userAnalytics.cumulativeGrowth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={formatDateAxis}
                      interval="preserveStartEnd"
                      className="text-muted-foreground"
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      labelFormatter={formatDateTooltip}
                      formatter={(value) => [String(value), "Total Users"]}
                      contentStyle={tooltipStyle}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#c7c7a3"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#c7c7a3" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Distribution */}
        {eventAnalytics && eventAnalytics.categoryDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Events by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventAnalytics.categoryDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis
                      type="category"
                      dataKey="tag"
                      tick={{ fontSize: 12 }}
                      width={80}
                      className="text-muted-foreground"
                      tickFormatter={(val: string) => val.charAt(0).toUpperCase() + val.slice(1)}
                    />
                    <Tooltip
                      formatter={(value) => [String(value), "Events"]}
                      labelFormatter={(val) => String(val).charAt(0).toUpperCase() + String(val).slice(1)}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {eventAnalytics.categoryDistribution.map((entry) => (
                        <Cell key={entry.tag} fill={TAG_COLORS[entry.tag] ?? "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Performing Events Leaderboard */}
      {eventAnalytics && eventAnalytics.topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <CardTitle>Top Performing Events</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {eventAnalytics.topPerformers.map((event, index) => (
                <div
                  key={event.event_id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: `${TAG_COLORS[tag] ?? "#6b7280"}20`,
                            color: TAG_COLORS[tag] ?? "#6b7280",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1" title="Views">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{event.view_count}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Clicks">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{event.click_count}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Saves">
                      <Bookmark className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{event.save_count}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Popularity">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">
                        {event.popularity_score.toFixed(1)}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
