import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarCheck,
  Megaphone,
  Users,
  Lock,
  Building2,
  Heart,
  MapPin,
  UserPlus,
  Mail,
  ChevronRight,
  Code,
} from "lucide-react";
import { EVENT_CATEGORIES, QUICK_FILTER_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import FollowUserButton from "@/components/users/FollowUserButton";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: targetId } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (authUser?.id === targetId) {
    redirect("/profile");
  }

  const { data: target, error } = await (supabase as any)
    .from("users")
    .select("id, name, avatar_url, email, pronouns, year, faculty, visibility, interest_tags, created_at")
    .eq("id", targetId)
    .single();

  if (error || !target) notFound();

  const [
    { data: followRow },
    { data: reverseFollowRow },
    { count: eventsAttended },
    { count: eventsOrganized },
    { data: friends },
    { data: memberships },
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
    (supabase as any)
      .from("club_members")
      .select("id, role, clubs (id, name, logo_url, category)")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false }),
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

  const friendCount = friends?.length ?? 0;
  const eventCount = (eventsAttended ?? 0) + (eventsOrganized ?? 0);
  const clubCount = memberships?.length ?? 0;

  const subtitleParts: string[] = [];
  if (target.faculty) subtitleParts.push(target.faculty);
  if (target.year) subtitleParts.push(`McGill '${target.year}`);
  const subtitle = subtitleParts.join(", ") || null;

  return (
    <div className="min-h-screen bg-[#f8f6f6]">
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-red-600/5 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="h-40 w-40 rounded-full border-4 border-red-600 p-1 bg-[#f8f6f6]">
                {target.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={target.avatar_url}
                    alt={target.name ?? "User"}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-red-600/20 to-red-600/5 flex items-center justify-center">
                    <span className="text-3xl font-semibold text-red-600">{initials}</span>
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-2xl font-bold">{target.name ?? "User"}</h1>
            {subtitle && <p className="text-red-600 font-medium">{subtitle}</p>}
            {target.pronouns && (
              <p className="text-sm text-slate-500 mt-0.5">{target.pronouns}</p>
            )}
            <div className="flex items-center gap-1 text-slate-500 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-sm">Montreal, QC</span>
            </div>

            {isFriend && (
              <Badge className="mt-2 bg-green-100 text-green-700">Friends</Badge>
            )}

            {/* Action buttons */}
            {authUser && (
              <div className="flex w-full gap-3 mt-6">
                <FollowUserButton
                  userId={targetId}
                  initialFollowing={isFollowing}
                  initialIsFriend={isFriend}
                />
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-red-600/5 text-center">
              <p className="text-2xl font-bold text-red-600">{eventCount}</p>
              <p className="text-xs text-slate-500 font-medium">Events</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-600/5 text-center">
              <p className="text-2xl font-bold text-red-600">{clubCount}</p>
              <p className="text-xs text-slate-500 font-medium">Clubs</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-600/5 text-center">
              <p className="text-2xl font-bold text-red-600">{friendCount}</p>
              <p className="text-xs text-slate-500 font-medium">Friends</p>
            </div>
          </div>

          {/* Interests */}
          {canSeeDetails && target.interest_tags && target.interest_tags.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-red-600/5">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-red-600" /> Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {(target.interest_tags as string[]).map((tag) => {
                  const label = EVENT_CATEGORIES[tag as EventTag]?.label ?? QUICK_FILTER_CATEGORIES[tag]?.label ?? tag;
                  return (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-red-600/10 text-red-600 text-sm font-medium rounded-full"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Friends Preview */}
          {canSeeDetails && friends && friends.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-red-600/5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-red-600" /> Friends
                </h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {friends.slice(0, 3).map((friend: any) => (
                  <Link key={friend.id} href={`/users/${friend.id}`}>
                    {friend.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={friend.avatar_url}
                        alt={friend.name ?? "Friend"}
                        className="aspect-square rounded-lg object-cover w-full"
                      />
                    ) : (
                      <div className="aspect-square rounded-lg bg-red-600/10 flex items-center justify-center text-sm font-bold text-red-600">
                        {(friend.name ?? "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                ))}
                {friendCount > 3 && (
                  <div className="aspect-square rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                    +{friendCount - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {!canSeeDetails ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Lock className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                <h2 className="text-lg font-semibold mb-1">This profile is private</h2>
                <p className="text-sm text-slate-500">
                  Follow this user to become friends and view their full profile.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Member of (Clubs) */}
              {memberships && memberships.length > 0 && (
                <section>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <Building2 className="h-5 w-5 text-red-600" /> Member of
                  </h3>
                  <div className="flex flex-col gap-3">
                    {memberships.map((m: any) => {
                      const club = m.clubs as unknown as {
                        id: string;
                        name: string;
                        logo_url: string | null;
                        category: string | null;
                      };
                      return (
                        <div
                          key={m.id}
                          className="bg-white p-4 rounded-xl flex items-center justify-between border border-red-600/5"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-red-600/10 flex items-center justify-center text-red-600">
                              {club.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={club.logo_url} alt={club.name} className="h-12 w-12 rounded-lg object-cover" />
                              ) : (
                                <Code className="h-7 w-7" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold">{club.name}</h4>
                              <p className="text-xs text-slate-500 capitalize">{m.role}</p>
                            </div>
                          </div>
                          <span className="p-2 text-slate-400">
                            <ChevronRight className="h-5 w-5" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
