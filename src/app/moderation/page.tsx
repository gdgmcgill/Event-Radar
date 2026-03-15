import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  CalendarCheck,
  Building2,
  History,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

interface AuditEntry {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PendingClub {
  id: string;
  name: string;
  category: string | null;
  created_at: string;
  created_by: string | null;
}

export default async function ModerationDashboardPage() {
  const supabase = await createClient();

  const [pending, users, approved, pendingClubsCount, recentEvents, recentClubs, auditLogRes] =
    await Promise.all([
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase
        .from("clubs")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("events")
        .select("id, title, location, organizer, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("clubs")
        .select("id, name, category, created_at, created_by")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("admin_audit_log")
        .select("id, admin_email, action, target_type, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(10) as Promise<{ data: AuditEntry[] | null }>,
    ]);

  const pendingCount = pending.count ?? 0;
  const usersCount = users.count ?? 0;
  const approvedCount = approved.count ?? 0;
  const pendingClubCount = pendingClubsCount.count ?? 0;
  const pendingEvents = recentEvents.data ?? [];
  const pendingClubs = (recentClubs.data ?? []) as PendingClub[];
  const auditEntries = auditLogRes.data ?? [];

  function formatTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getActionColor(action: string): string {
    if (action === "approved" || action === "bulk_approved")
      return "bg-green-500";
    if (action === "rejected" || action === "bulk_rejected" || action === "deleted")
      return "bg-red-500";
    if (action === "created")
      return "bg-blue-500";
    if (action === "updated")
      return "bg-amber-500";
    return "bg-zinc-400";
  }

  const stats = [
    {
      label: "Pending Events",
      value: pendingCount,
      icon: Clock,
      accent: "border-l-amber-500",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Pending Clubs",
      value: pendingClubCount,
      icon: Building2,
      accent: "border-l-amber-500",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Registered Users",
      value: usersCount,
      icon: Users,
      accent: "border-l-blue-500",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Approved Events",
      value: approvedCount,
      icon: CalendarCheck,
      accent: "border-l-green-500",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-zinc-900 dark:text-zinc-100 text-3xl font-bold tracking-tight">
          Moderation Dashboard
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Overview of pending content and recent moderation activity.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 border-l-4 ${stat.accent}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {stat.value}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Events Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-zinc-900 dark:text-zinc-100 font-semibold">
                Pending Events
              </h2>
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            </div>
            <Link
              href="/moderation/events?status=pending"
              className="text-sm text-red-600 dark:text-red-400 font-medium hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Event</th>
                  <th className="px-6 py-3 font-medium">Organizer</th>
                  <th className="px-6 py-3 font-medium hidden md:table-cell">Location</th>
                  <th className="px-6 py-3 font-medium hidden sm:table-cell">Submitted</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pendingEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                        No pending events &mdash; you&apos;re all caught up!
                      </p>
                    </td>
                  </tr>
                ) : (
                  pendingEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                          {event.title}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-zinc-600 dark:text-zinc-300">
                        {event.organizer ?? "Unknown"}
                      </td>
                      <td className="px-6 py-3 hidden md:table-cell">
                        <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location ?? "TBD"}
                        </span>
                      </td>
                      <td className="px-6 py-3 hidden sm:table-cell text-zinc-500 dark:text-zinc-400">
                        {event.created_at ? formatDate(event.created_at) : "Unknown"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href="/moderation/events"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="h-4.5 w-4.5" />
                          </Link>
                          <Link
                            href="/moderation/events"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="h-4.5 w-4.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Clubs Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-zinc-900 dark:text-zinc-100 font-semibold">
                Pending Clubs
              </h2>
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingClubCount}
              </span>
            </div>
            <Link
              href="/moderation/clubs?status=pending"
              className="text-sm text-red-600 dark:text-red-400 font-medium hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Club Name</th>
                  <th className="px-6 py-3 font-medium">Creator</th>
                  <th className="px-6 py-3 font-medium hidden sm:table-cell">Category</th>
                  <th className="px-6 py-3 font-medium hidden md:table-cell">Submitted</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pendingClubs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                        No pending clubs &mdash; you&apos;re all caught up!
                      </p>
                    </td>
                  </tr>
                ) : (
                  pendingClubs.map((club) => (
                    <tr
                      key={club.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                          {club.name}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-zinc-600 dark:text-zinc-300">
                        {club.created_by ?? "Unknown"}
                      </td>
                      <td className="px-6 py-3 hidden sm:table-cell">
                        {club.category ? (
                          <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-medium px-2 py-0.5 rounded">
                            {club.category}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 text-xs">
                            Uncategorized
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 hidden md:table-cell text-zinc-500 dark:text-zinc-400">
                        {formatDate(club.created_at)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href="/moderation/clubs"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="h-4.5 w-4.5" />
                          </Link>
                          <Link
                            href="/moderation/clubs"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="h-4.5 w-4.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-zinc-400" />
            <h2 className="text-zinc-900 dark:text-zinc-100 font-semibold">
              Recent Activity
            </h2>
          </div>
          <Link
            href="/moderation/audit-log"
            className="text-sm text-red-600 dark:text-red-400 font-medium hover:underline flex items-center gap-1"
          >
            View Full Log <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {auditEntries.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                No recent activity.
              </p>
            </div>
          ) : (
            auditEntries.map((entry) => {
              const adminName =
                entry.admin_email?.split("@")[0] ?? "Admin";
              const meta = entry.metadata as Record<string, unknown>;
              const targetName =
                (meta?.event_title as string) ??
                (meta?.title as string) ??
                (meta?.club_name as string) ??
                entry.target_type;

              return (
                <div
                  key={entry.id}
                  className="px-6 py-3.5 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${getActionColor(entry.action)}`}
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">
                      {adminName}
                    </span>{" "}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {entry.action} {entry.target_type}
                    </span>{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      &ldquo;{targetName}&rdquo;
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                    {formatTimeAgo(entry.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
