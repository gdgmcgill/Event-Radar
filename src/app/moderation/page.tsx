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
  Shield,
  TrendingUp,
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
  creator_name?: string | null;
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
  const rawClubs = (recentClubs.data ?? []) as PendingClub[];
  const auditEntries = auditLogRes.data ?? [];

  // Resolve creator UUIDs to names
  const creatorIds = rawClubs
    .map((c) => c.created_by)
    .filter((id): id is string => !!id);
  let creatorMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", creatorIds);
    if (creators) {
      creatorMap = Object.fromEntries(
        creators.map((u) => [u.id, u.name || u.email?.split("@")[0] || "Unknown"])
      );
    }
  }
  const pendingClubs = rawClubs.map((club) => ({
    ...club,
    creator_name: club.created_by ? creatorMap[club.created_by] ?? "Unknown" : "Unknown",
  }));

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
      return "bg-emerald-500";
    if (action === "rejected" || action === "bulk_rejected" || action === "deleted")
      return "bg-red-500";
    if (action === "created") return "bg-blue-500";
    if (action === "updated") return "bg-amber-500";
    return "bg-zinc-400";
  }

  const totalActions = pendingCount + pendingClubCount;

  const stats = [
    {
      label: "Items Need Review",
      value: totalActions,
      icon: Shield,
      accent: totalActions > 0 ? "border-l-red-500" : "border-l-emerald-500",
      iconBg: totalActions > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
      iconColor: totalActions > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
      sublabel: totalActions > 0 ? `${pendingCount} events, ${pendingClubCount} clubs` : "All caught up!",
    },
    {
      label: "Registered Users",
      value: usersCount,
      icon: Users,
      accent: "border-l-blue-500",
      iconBg: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      sublabel: "Total platform users",
    },
    {
      label: "Approved Events",
      value: approvedCount,
      icon: CalendarCheck,
      accent: "border-l-emerald-500",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      sublabel: "Live on platform",
    },
    {
      label: "Pending Events",
      value: pendingCount,
      icon: Clock,
      accent: "border-l-amber-500",
      iconBg: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      sublabel: "Awaiting review",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-zinc-900 dark:text-zinc-100 text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Platform overview and pending reviews
          </p>
        </div>
        {totalActions > 0 && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm font-medium px-3 py-1.5 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            {totalActions} item{totalActions !== 1 ? "s" : ""} need review
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 border-l-4 ${stat.accent} hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" />
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stat.value}
            </p>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-0.5">
              {stat.label}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              {stat.sublabel}
            </p>
          </div>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending Events Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
                Pending Events
              </h2>
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            </div>
            <Link
              href="/moderation/events?status=pending"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {pendingEvents.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                  No pending events
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pendingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="px-5 py-3.5 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {event.title}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                        {event.organizer ?? "Unknown"}
                        {event.location && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:block">
                      {event.created_at ? formatDate(event.created_at) : ""}
                    </span>
                    <Link
                      href={`/moderation/pending`}
                      className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Clubs Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30">
                <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
                Pending Clubs
              </h2>
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingClubCount}
              </span>
            </div>
            <Link
              href="/moderation/clubs?status=pending"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {pendingClubs.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                  No pending clubs
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pendingClubs.map((club) => (
                  <div
                    key={club.id}
                    className="px-5 py-3.5 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                      {club.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {club.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        by {club.creator_name}
                        {club.category && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600 mx-1">·</span>
                            {club.category}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:block">
                      {formatDate(club.created_at)}
                    </span>
                    <Link
                      href={`/moderation/clubs`}
                      className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800">
              <History className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </div>
            <h2 className="text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
              Recent Activity
            </h2>
          </div>
          <Link
            href="/moderation/audit-log"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium flex items-center gap-1 transition-colors"
          >
            View Full Log <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {auditEntries.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <History className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                No recent activity yet
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
                  className="px-5 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ${getActionColor(entry.action)}`}
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">
                      {adminName}
                    </span>{" "}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {entry.action}
                    </span>{" "}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {entry.target_type}
                    </span>{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {targetName}
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
