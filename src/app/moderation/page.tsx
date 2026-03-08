import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Shield,
  Edit,
  Ban,
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

export default async function ModerationDashboardPage() {
  const supabase = await createClient();

  const [pending, users, approved, recentEvents, auditLogRes] =
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
        .from("events")
        .select("id, title, location, organizer, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("admin_audit_log")
        .select("id, admin_email, action, target_type, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(4) as Promise<{ data: AuditEntry[] | null }>,
    ]);

  const pendingCount = pending.count ?? 0;
  const usersCount = users.count ?? 0;
  const approvedCount = approved.count ?? 0;
  const pendingEvents = recentEvents.data ?? [];
  const auditEntries = auditLogRes.data ?? [];

  function formatTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  function getEventIcon(title: string) {
    const lower = title.toLowerCase();
    if (lower.includes("jazz") || lower.includes("music") || lower.includes("art"))
      return "palette";
    if (lower.includes("basketball") || lower.includes("sport") || lower.includes("gym"))
      return "sports";
    if (lower.includes("ai") || lower.includes("science") || lower.includes("tech"))
      return "science";
    return "event";
  }

  function getActionIcon(action: string) {
    if (action === "approved" || action === "bulk_approved") return "approve";
    if (action === "rejected" || action === "bulk_rejected" || action === "deleted") return "reject";
    if (action === "updated") return "edit";
    return "action";
  }

  return (
    <>
      {/* Header */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-slate-900 text-3xl font-black leading-tight tracking-tight">
              Moderation Dashboard
            </h2>
            <p className="text-slate-500 text-base mt-1">
              Real-time overview of pending items and community reports.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
              <Download className="h-4 w-4" /> Export Report
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2 rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-red-600 bg-red-600/10 p-2 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-emerald-600 bg-emerald-100 px-2 py-1 rounded text-xs font-bold">
                +5% vs last week
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">
              Total Pending
            </p>
            <p className="text-slate-900 text-3xl font-bold">{pendingCount}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-red-600 bg-red-600/10 p-2 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-orange-600 bg-orange-100 px-2 py-1 rounded text-xs font-bold">
                {usersCount} total
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">
              Registered Users
            </p>
            <p className="text-slate-900 text-3xl font-bold">{usersCount}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-red-600 bg-red-600/10 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
              <span className="text-emerald-600 bg-emerald-100 px-2 py-1 rounded text-xs font-bold">
                +12% vs last week
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">
              Reports Resolved
            </p>
            <p className="text-slate-900 text-3xl font-bold">{approvedCount}</p>
          </div>
        </div>
      </section>

      {/* Pending Event Review Table */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-slate-900 text-xl font-bold">Pending Event Review</h3>
          <div className="flex gap-2">
            <select className="bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-red-600 focus:border-red-600 px-3 py-2">
              <option>Sort by: Newest</option>
              <option>Sort by: Priority</option>
            </select>
            <Link
              href="/moderation/pending"
              className="bg-red-600 hover:bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              Review All
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4">Event Details</th>
                <th className="px-6 py-4">Organizer</th>
                <th className="px-6 py-4">Submission Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No pending events at this time.
                  </td>
                </tr>
              )}
              {pendingEvents.map((event, index) => {
                const iconType = getEventIcon(event.title);
                const submittedAt = event.created_at
                  ? new Date(event.created_at)
                  : null;

                return (
                  <tr
                    key={event.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded bg-red-600/10 flex items-center justify-center text-red-600">
                          {iconType === "palette" && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                          )}
                          {iconType === "sports" && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>
                          )}
                          {iconType === "science" && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>
                          )}
                          {iconType === "event" && (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{event.title}</p>
                          <p className="text-xs text-slate-500">
                            {event.location ?? "Location TBD"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {(event.organizer ?? "U").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">
                          {event.organizer ?? "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {submittedAt ? (
                        <>
                          <p className="text-sm text-slate-600">
                            {submittedAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-xs text-slate-400">
                            {submittedAt.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">Unknown</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-tighter ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {index === 0 ? "Under Review" : "New Submission"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <form
                          action={`/api/admin/events/${event.id}/status`}
                          method="POST"
                        >
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        </form>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-600/10 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {pendingEvents.length} of {pendingCount} pending items
          </p>
          <div className="flex gap-1">
            <button
              className="p-1 rounded bg-white border border-slate-200 disabled:opacity-50"
              disabled
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Link
              href="/moderation/pending"
              className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Two-column bottom: Reported Content + Recent Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reported Content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-slate-900 font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" /> Reported Content
            </h3>
            <Link
              href="/moderation/events"
              className="text-xs text-red-600 font-bold hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="p-4 space-y-4">
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  Hate Speech &bull; High Priority
                </span>
                <span className="text-[10px] text-slate-400">2h ago</span>
              </div>
              <p className="text-sm italic text-slate-600 line-clamp-2">
                &ldquo;Comment flagged in the &apos;Global Politics 101&apos; study group
                discussion...&rdquo;
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="size-5 rounded-full ring-2 ring-white bg-slate-200"></div>
                  <div className="size-5 rounded-full ring-2 ring-white bg-slate-300"></div>
                </div>
                <button className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded shadow-sm">
                  Review Report
                </button>
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                  Spam &bull; Medium Priority
                </span>
                <span className="text-[10px] text-slate-400">5h ago</span>
              </div>
              <p className="text-sm italic text-slate-600 line-clamp-2">
                &ldquo;Repeated event postings for &apos;Discount Textbooks&apos; in
                multiple channels...&rdquo;
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="size-5 rounded-full ring-2 ring-white bg-slate-200"></div>
                </div>
                <button className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded shadow-sm">
                  Review Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Actions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-slate-900 font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-red-600" /> Recent Actions
            </h3>
            <Link
              href="/moderation/audit-log"
              className="text-xs text-red-600 font-bold hover:underline"
            >
              Full Log
            </Link>
          </div>
          <div className="p-4">
            <ul className="space-y-4">
              {auditEntries.length === 0 && (
                <li className="text-sm text-slate-400 text-center py-4">
                  No recent actions.
                </li>
              )}
              {auditEntries.map((entry) => {
                const actionType = getActionIcon(entry.action);
                const adminName =
                  entry.admin_email?.split("@")[0] ?? "Admin";
                const meta = entry.metadata as Record<string, unknown>;
                const targetName =
                  (meta?.event_title as string) ??
                  (meta?.title as string) ??
                  entry.target_type;

                return (
                  <li key={entry.id} className="flex gap-3">
                    <div
                      className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                        actionType === "approve"
                          ? "bg-emerald-100 text-emerald-600"
                          : actionType === "reject"
                            ? "bg-red-600/10 text-red-600"
                            : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {actionType === "approve" && (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      {actionType === "reject" && (
                        <Ban className="h-4 w-4" />
                      )}
                      {actionType === "edit" && (
                        <Edit className="h-4 w-4" />
                      )}
                      {actionType === "action" && (
                        <Shield className="h-4 w-4" />
                      )}
                    </div>
                    <div className="text-sm">
                      <p>
                        <span className="font-bold capitalize">{adminName}</span>{" "}
                        {entry.action} {entry.target_type}{" "}
                        <span className="font-bold">
                          &ldquo;{targetName}&rdquo;
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatTimeAgo(entry.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
