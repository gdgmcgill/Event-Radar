/**
 * Fetch platform-wide analytics from Supabase.
 * Usage: npx tsx scripts/platform-analytics.ts [--json]
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";

config({ path: resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(url, key);

async function count(
  table: keyof Database["public"]["Tables"],
  filter?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) throw new Error(`${String(table)}: ${error.message}`);
  return n ?? 0;
}

async function main() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsers,
    usersOnboarded,
    usersActive7d,
    usersActive30d,
    usersEngaged,
    usersBanned,
    totalClubs,
    clubsApproved,
    clubsPending,
    clubsRejected,
    totalEvents,
    eventsApproved,
    eventsPending,
    eventsRejected,
    totalRsvps,
    rsvpsGoing,
    totalSaves,
    totalClubFollows,
    totalUserFollows,
    totalInteractions,
    interactions7d,
    totalReviews,
    totalNotifications,
    clubMembers,
    organizers,
  ] = await Promise.all([
    count("users"),
    count("users", (q) => q.eq("onboarding_completed", true)),
    count("users", (q) => q.gte("updated_at", d7)),
    count("users", (q) => q.gte("updated_at", d30)),
    count("users", (q) => q.gte("saved_events_count", 3)),
    count("users", (q) => q.not("banned_at", "is", null)),
    count("clubs"),
    count("clubs", (q) => q.eq("status", "approved")),
    count("clubs", (q) => q.eq("status", "pending")),
    count("clubs", (q) => q.eq("status", "rejected")),
    count("events"),
    count("events", (q) => q.eq("status", "approved")),
    count("events", (q) => q.eq("status", "pending")),
    count("events", (q) => q.eq("status", "rejected")),
    count("rsvps"),
    count("rsvps", (q) => q.eq("status", "going")),
    count("saved_events"),
    count("club_followers"),
    count("user_follows"),
    count("user_interactions"),
    count("user_interactions", (q) => q.gte("created_at", d7)),
    count("reviews"),
    count("notifications"),
    count("club_members"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .contains("roles", ["club_organizer"])
      .then(({ count: n, error }) => {
        if (error) throw error;
        return n ?? 0;
      }),
  ]);

  const upcomingApproved = await count("events", (q) =>
    q.eq("status", "approved").gte("start_date", now.toISOString()).is("deleted_at", null)
  );

  const [
    newUsers7d,
    newUsers30d,
    newClubs30d,
    newEvents30d,
    admins,
    usersWithInterests,
    eventsWithImages,
    featuredEventsActive,
    featuredClubsActive,
  ] = await Promise.all([
    count("users", (q) => q.gte("created_at", d7)),
    count("users", (q) => q.gte("created_at", d30)),
    count("clubs", (q) => q.gte("created_at", d30)),
    count("events", (q) => q.gte("created_at", d30)),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .contains("roles", ["admin"])
      .then(({ count: n, error }) => {
        if (error) throw error;
        return n ?? 0;
      }),
    count("users", (q) => q.not("interest_tags", "is", null)),
    count("events", (q) => q.not("image_url", "is", null)),
    supabase
      .from("featured_events")
      .select("id", { count: "exact", head: true })
      .lte("starts_at", now.toISOString())
      .gte("ends_at", now.toISOString())
      .then(({ count: n, error }) => {
        if (error) throw error;
        return n ?? 0;
      }),
    supabase
      .from("featured_clubs")
      .select("id", { count: "exact", head: true })
      .lte("starts_at", now.toISOString())
      .gte("ends_at", now.toISOString())
      .then(({ count: n, error }) => {
        if (error) throw error;
        return n ?? 0;
      }),
  ]);

  const { data: eventSources } = await supabase.from("events").select("source");
  const sourceBreakdown: Record<string, number> = {};
  for (const row of eventSources ?? []) {
    const s = row.source ?? "unknown";
    sourceBreakdown[s] = (sourceBreakdown[s] ?? 0) + 1;
  }

  const stats = {
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      onboardingCompleted: usersOnboarded,
      onboardingRatePct: totalUsers ? Math.round((usersOnboarded / totalUsers) * 100) : 0,
      newLast7Days: newUsers7d,
      newLast30Days: newUsers30d,
      activeLast7Days: usersActive7d,
      activeLast30Days: usersActive30d,
      engagedSaved3Plus: usersEngaged,
      withInterestTags: usersWithInterests,
      banned: usersBanned,
      admins,
      clubOrganizers: organizers,
    },
    clubs: {
      total: totalClubs,
      approved: clubsApproved,
      pending: clubsPending,
      rejected: clubsRejected,
      newLast30Days: newClubs30d,
      membersTotal: clubMembers,
      followersTotal: totalClubFollows,
      featuredActive: featuredClubsActive,
    },
    events: {
      total: totalEvents,
      approved: eventsApproved,
      pending: eventsPending,
      rejected: eventsRejected,
      newLast30Days: newEvents30d,
      upcomingApproved,
      withImages: eventsWithImages,
      bySource: sourceBreakdown,
      featuredActive: featuredEventsActive,
    },
    engagement: {
      rsvpsTotal: totalRsvps,
      rsvpsGoing: rsvpsGoing,
      savedEvents: totalSaves,
      userFollows: totalUserFollows,
      interactionsTotal: totalInteractions,
      interactionsLast7Days: interactions7d,
      reviews: totalReviews,
      notifications: totalNotifications,
    },
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(JSON.stringify(stats));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
