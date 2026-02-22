import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, CheckCircle, FileQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [events, pending, approved, users, recentEvents] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("events")
      .select("id, title, status, created_at, organizer")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const stats = [
    { label: "Total Events", value: events.count ?? 0, icon: Calendar },
    { label: "Pending", value: pending.count ?? 0, icon: FileQuestion },
    { label: "Approved", value: approved.count ?? 0, icon: CheckCircle },
    { label: "Users", value: users.count ?? 0, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform activity</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/admin/pending">
          <Button variant="outline">
            Review Pending ({pending.count ?? 0})
          </Button>
        </Link>
        <Link href="/admin/events">
          <Button variant="outline">Manage Events</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(recentEvents.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No events yet.
              </p>
            )}
            {(recentEvents.data ?? []).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.organizer ?? "Unknown organizer"}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    event.status === "approved"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : event.status === "pending"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
