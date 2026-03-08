import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [allUsers, activeUsers, engagedUsers] = await Promise.all([
    supabase
      .from("users")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", sevenDaysAgo.toISOString()),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("saved_events_count", 3),
  ]);

  const dailySignups = buildDailySignups(
    allUsers.data ?? [],
    thirtyDaysAgo,
    now
  );

  const totalUsersResult = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  let cumulativeBase = (totalUsersResult.count ?? 0) -
    (allUsers.data?.length ?? 0);
  const cumulativeGrowth = dailySignups.map((day) => {
    cumulativeBase += day.count;
    return { date: day.date, total: cumulativeBase };
  });

  return NextResponse.json({
    dailySignups,
    cumulativeGrowth,
    activeUsersLast7Days: activeUsers.count ?? 0,
    engagedUsers: engagedUsers.count ?? 0,
    totalUsers: totalUsersResult.count ?? 0,
  });
}

interface UserRow {
  created_at: string;
}

function buildDailySignups(users: UserRow[], from: Date, to: Date) {
  const counts: Record<string, number> = {};

  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    counts[current.toISOString().split("T")[0]] = 0;
    current.setDate(current.getDate() + 1);
  }

  for (const user of users) {
    const date = user.created_at.split("T")[0];
    if (date in counts) {
      counts[date]++;
    }
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}
