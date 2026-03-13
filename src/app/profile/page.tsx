import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/");
  }

  const [
    { data: profile },
    { data: memberships },
    { data: following },
    { count: eventsAttended },
    { count: eventsOrganized },
    { data: pastEvents },
    { data: friends },
    { data: upcomingEvents },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase
      .from("club_members")
      .select("id, role, clubs (id, name, logo_url, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("club_followers")
      .select("id, created_at, clubs (id, name, logo_url, description, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("saved_events")
      .select("id, events!inner(event_date)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lt("events.event_date", new Date().toISOString().split("T")[0]),
    (supabase as any)
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .eq("status", "approved"),
    (supabase as any)
      .from("saved_events")
      .select("id, events!inner(id, title, event_date, event_time, location, image_url)")
      .eq("user_id", user.id)
      .lt("events.event_date", new Date().toISOString().split("T")[0])
      .order("created_at", { ascending: false })
      .limit(10),
    (supabase as any).rpc("get_friends", { target_user_id: user.id }).limit(20),
    (supabase as any)
      .from("saved_events")
      .select("id, events!inner(id, title, event_date, event_time, location, image_url)")
      .eq("user_id", user.id)
      .gte("events.event_date", new Date().toISOString().split("T")[0])
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const displayData = {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? (user.user_metadata?.name as string) ?? (user.user_metadata?.full_name as string) ?? null,
    avatar_url: profile?.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null,
    interest_tags: ((profile?.interest_tags ?? []) as string[]),
    pronouns: ((profile as Record<string, unknown>)?.pronouns as string) ?? null,
    year: ((profile as Record<string, unknown>)?.year as string) ?? null,
    faculty: ((profile as Record<string, unknown>)?.faculty as string) ?? null,
    visibility: ((profile as Record<string, unknown>)?.visibility as string) ?? "public",
    created_at: user.created_at,
  };

  const subtitleParts: string[] = [];
  if (displayData.faculty) subtitleParts.push(displayData.faculty);
  if (displayData.year) subtitleParts.push(`McGill '${displayData.year}`);

  return (
    <ProfileClient
      data={{
        profile: displayData,
        subtitle: subtitleParts.join(", ") || null,
        friendCount: friends?.length ?? 0,
        clubCount: (memberships?.length ?? 0) + (following?.length ?? 0),
        eventCount: (eventsAttended ?? 0) + (eventsOrganized ?? 0),
        friends: friends ?? [],
        memberships: memberships ?? [],
        following: following ?? [],
        upcomingEvents: upcomingEvents ?? [],
        pastEvents: pastEvents ?? [],
      }}
    />
  );
}
