import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileHeader from "@/components/profile/ProfileHeader";
import InterestsCard from "@/components/profile/InterestsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Building2, Users, CalendarCheck, Megaphone, Clock, Eye, EyeOff } from "lucide-react";
import EditProfileButton from "@/components/profile/EditProfileButton";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/");
  }

  // Fetch profile, clubs, following, stats, event history, and friends in parallel
  const [
    { data: profile },
    { data: memberships },
    { data: following },
    { count: eventsAttended },
    { count: eventsOrganized },
    { data: pastEvents },
    { data: friends },
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
      .select("id, events!inner(id, title, event_date, event_time, location)")
      .eq("user_id", user.id)
      .lt("events.event_date", new Date().toISOString().split("T")[0])
      .order("created_at", { ascending: false })
      .limit(10),
    (supabase as any).rpc("get_friends", { target_user_id: user.id }).limit(20),
  ]);

  // Fallback to auth user data if profile doesn't exist
  const displayData = profile ?? {
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.name as string) ??
      (user.user_metadata?.full_name as string) ??
      null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    interest_tags: [],
    pronouns: null,
    year: null,
    faculty: null,
    visibility: "public",
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none" />

      <div className="relative max-w-3xl mx-auto py-12 px-4 sm:px-6 space-y-8">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Account
            </h1>
            <p className="text-3xl font-bold text-foreground tracking-tight">
              Your Profile
            </p>
          </div>

          <EditProfileButton
            userId={displayData.id}
            initialName={displayData.name ?? ""}
            initialAvatarUrl={displayData.avatar_url ?? ""}
            initialTags={(displayData.interest_tags ?? []) as import("@/types").EventTag[]}
            initialPronouns={(displayData as any).pronouns ?? ""}
            initialYear={(displayData as any).year ?? ""}
            initialFaculty={(displayData as any).faculty ?? ""}
            initialVisibility={(displayData as any).visibility ?? "public"}
          />
        </div>

        {/* Profile Header - Avatar & Name (no card) */}
        <ProfileHeader
          name={displayData.name}
          email={displayData.email}
          avatarUrl={displayData.avatar_url}
          userId={displayData.id}
          editable
        />

        {/* Profile details card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              {(displayData as any).pronouns && (
                <Badge variant="secondary">{(displayData as any).pronouns}</Badge>
              )}
              {(displayData as any).year && (
                <Badge variant="secondary">{(displayData as any).year}</Badge>
              )}
              {(displayData as any).faculty && (
                <Badge variant="secondary">{(displayData as any).faculty}</Badge>
              )}
              <Badge variant="outline" className="gap-1">
                {(displayData as any).visibility === "private" ? (
                  <><EyeOff className="h-3 w-3" /> Private</>
                ) : (
                  <><Eye className="h-3 w-3" /> Public</>
                )}
              </Badge>
            </div>

            {/* Stats */}
            <div className="mt-4 flex gap-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarCheck className="h-4 w-4" />
                <span className="font-semibold text-foreground">{eventsAttended ?? 0}</span> events attended
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Megaphone className="h-4 w-4" />
                <span className="font-semibold text-foreground">{eventsOrganized ?? 0}</span> organized
              </div>
              {friends && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{friends.length}</span> friends
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Main Content Grid */}
        <div className="grid gap-6">
          {/* Friends */}
          {friends && friends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Friends ({friends.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {friends.map((friend: any) => (
                    <Link
                      key={friend.id}
                      href={`/users/${friend.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      {friend.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={friend.avatar_url} alt={friend.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                          {(friend.name ?? "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium truncate">{friend.name ?? "User"}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interests Card */}
          <InterestsCard
            userId={displayData.id}
            initialTags={(displayData.interest_tags ?? []) as import("@/types").EventTag[]}
          />

          {/* My Clubs Card (organizer/member) */}
          {memberships && memberships.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  My Clubs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {memberships.map((m) => {
                    const club = m.clubs as unknown as { id: string; name: string; logo_url: string | null; category: string | null };
                    return (
                      <Link
                        key={m.id}
                        href={`/my-clubs/${club.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        {club.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={club.logo_url} alt={club.name} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{club.name}</p>
                          {club.category && (
                            <p className="text-xs text-muted-foreground">{club.category}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Following Clubs Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5" />
                Following
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!following || following.length === 0) ? (
                <p className="text-sm text-muted-foreground">
                  You&apos;re not following any clubs yet. Visit the{" "}
                  <Link href="/clubs" className="text-primary hover:underline">clubs page</Link>{" "}
                  to discover clubs to follow.
                </p>
              ) : (
                <div className="space-y-3">
                  {following.map((f) => {
                    const club = f.clubs as unknown as { id: string; name: string; logo_url: string | null; description: string | null; category: string | null };
                    return (
                      <Link
                        key={f.id}
                        href={`/clubs/${club.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        {club.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={club.logo_url} alt={club.name} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{club.name}</p>
                          {club.category && (
                            <p className="text-xs text-muted-foreground">{club.category}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event History */}
          {pastEvents && pastEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  Event History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pastEvents.map((se: any) => {
                    const event = se.events;
                    return (
                      <Link
                        key={se.id}
                        href={`/events/${event.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <CalendarCheck className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {event.location && ` · ${event.location}`}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}