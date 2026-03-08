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
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

export default function ModerationStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [statsRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/analytics/users"),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
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
      value: analytics?.activeUsersLast7Days ?? "—",
      icon: CircleUser,
      description: "Active during last 7 days",
    },
    {
      label: "Engaged Users",
      value: analytics?.engagedUsers ?? "—",
      icon: UserPlus,
      description: "Accounts with 3+ saved events",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform Statistics</h2>
        <p className="text-sm text-muted-foreground">
          Overview of platform metrics and activity
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Event Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Approved</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${stats.totalEvents > 0 ? (stats.approvedEvents / stats.totalEvents) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {stats.approvedEvents}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pending</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 rounded-full"
                    style={{
                      width: `${stats.totalEvents > 0 ? (stats.pendingEvents / stats.totalEvents) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {stats.pendingEvents}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Rejected</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{
                      width: `${stats.totalEvents > 0 ? (rejectedEvents / stats.totalEvents) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {rejectedEvents}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* User Growth Chart */}
      {analytics && analytics.dailySignups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>New User Signups (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailySignups}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val: string) => {
                      const d = new Date(val + "T00:00:00");
                      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }}
                    interval="preserveStartEnd"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    labelFormatter={(val) => {
                      const d = new Date(String(val) + "T00:00:00");
                      return d.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    formatter={(value) => [String(value), "New Users"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                    }}
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

      {/* Cumulative User Growth */}
      {analytics && analytics.cumulativeGrowth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Total Users Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.cumulativeGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val: string) => {
                      const d = new Date(val + "T00:00:00");
                      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }}
                    interval="preserveStartEnd"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    labelFormatter={(val) => {
                      const d = new Date(String(val) + "T00:00:00");
                      return d.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    formatter={(value) => [String(value), "Total Users"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                    }}
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
    </div>
  );
}
