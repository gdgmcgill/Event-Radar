import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Megaphone, Users, Lock, Building2, Heart } from "lucide-react";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import FollowUserButton from "@/components/users/FollowUserButton";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: targetId } = await params;
  const supabase = await createClient();

  // Get current user (may be null if not logged in)
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // If viewing own profile, redirect to /profile
  if (authUser?.id === targetId) {
    redirect("/profile");
  }

  // Fetch target user profile
  const { data: target, error } = await (supabase as any)
    .from("users")
    .select("id, name, avatar_url, email, pronouns, year, faculty, visibility, interest_tags, created_at")
    .eq("id", targetId)
    .single();

  if (error || !target) notFound();

  // Fetch follow status and stats in parallel
  const [
    { data: followRow },
    { data: reverseFollowRow },
    { count: eventsAttended },
    { count: eventsOrganized },
    { data: friends },
  ] = await Promise.all([
    authUser
      ? (supabase as any)
          .from("user_follows")
          .select("id")
          .eq("follower_id", authUser.id)
          .eq("following_id", targetId)
          .maybeSingle()
      : { data: null },
    authUser
      ? (supabase as any)
          .from("user_follows")
          .select("id")
          .eq("follower_id", targetId)
          .eq("following_id", authUser.id)
          .maybeSingle()
      : { data: null },
    (supabase as any)
      .from("saved_events")
      .select("id, events!inner(event_date)", { count: "exact", head: true })
      .eq("user_id", targetId)
      .lt("events.event_date", new Date().toISOString().split("T")[0]),
    (supabase as any)
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("created_by", targetId)
      .eq("status", "approved"),
    (supabase as any).rpc("get_friends", { target_user_id: targetId }).limit(20),
  ]);

  const isFollowing = !!followRow;
  const isFriend = isFollowing && !!reverseFollowRow;
  const isPublic = target.visibility !== "private";
  const canSeeDetails = isPublic || isFriend;

  const initials = (target.name ?? "U")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none" />

      <div className="relative max-w-3xl mx-auto py-12 px-4 sm:px-6 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-6">
          {target.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={target.avatar_url}
              alt={target.name ?? "User"}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-background shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-4 ring-background shadow-xl flex items-center justify-center">
              <span className="text-2xl font-semibold text-primary">{initials}</span>
            </div>
          )}

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{target.name ?? "User"}</h1>
              {isFriend && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Friends
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {target.pronouns && <Badge variant="secondary">{target.pronouns}</Badge>}
              {target.year && <Badge variant="secondary">{target.year}</Badge>}
              {target.faculty && <Badge variant="secondary">{target.faculty}</Badge>}
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarCheck className="h-4 w-4" />
                <span className="font-semibold text-foreground">{eventsAttended ?? 0}</span> attended
              </span>
              <span className="flex items-center gap-1">
                <Megaphone className="h-4 w-4" />
                <span className="font-semibold text-foreground">{eventsOrganized ?? 0}</span> organized
              </span>
              {friends && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{friends.length}</span> friends
                </span>
              )}
            </div>
          </div>

          {/* Follow button */}
          {authUser && (
            <FollowUserButton
              userId={targetId}
              initialFollowing={isFollowing}
              initialIsFriend={isFriend}
            />
          )}
        </div>

        <div className="border-t border-border" />

        {/* Private profile gate */}
        {!canSeeDetails ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-lg font-semibold mb-1">This profile is private</h2>
              <p className="text-sm text-muted-foreground">
                Follow this user to become friends and view their full profile.
              </p>
            </CardContent>
          </Card>
        ) : (
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

            {/* Interests */}
            {target.interest_tags && target.interest_tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Heart className="h-5 w-5" />
                    Interests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(target.interest_tags as string[]).map((tag) => {
                      const category = EVENT_CATEGORIES[tag as EventTag];
                      return (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className={category?.color ?? ""}
                        >
                          {category?.label ?? tag}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
