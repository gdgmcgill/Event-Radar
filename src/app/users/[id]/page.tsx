import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Calendar,
  CalendarCheck,
  CalendarX,
  Clock,
  Users,
  Lock,
  Building2,
  Heart,
  MapPin,
  GraduationCap,
  Shield,
  ChevronRight,
  Sparkles,
  EyeOff,
} from "lucide-react";
import { EVENT_CATEGORIES, QUICK_FILTER_CATEGORIES } from "@/lib/constants";
import type { EventTag, Event } from "@/types";
import FollowUserButton from "@/components/users/FollowUserButton";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: user } = await (supabase as any)
    .from("users")
    .select("name")
    .eq("id", id)
    .single();

  if (!user) return { title: "User Not Found" };

  return {
    title: `${user.name ?? "User"} | UNI-VERSE`,
    description: `View ${user.name ?? "this user"}'s profile on UNI-VERSE`,
  };
}

export default async function UserProfilePage({ params }: PageProps) {
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
    .select("id, name, avatar_url, banner_url, email, pronouns, year, faculty, visibility, interest_tags, created_at")
    .eq("id", targetId)
    .single();

  if (error || !target) notFound();

  const now = new Date().toISOString();

  const [
    { data: followRow },
    { data: reverseFollowRow },
    { count: eventsAttended },
    { count: eventsOrganized },
    { data: friends },
    { data: memberships },
    { data: upcomingRsvps },
    { data: pastRsvps },
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
      .select("id, events!inner(start_date)", { count: "exact", head: true })
      .eq("user_id", targetId)
      .lt("events.start_date", now),
    (supabase as any)
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("created_by", targetId)
      .eq("status", "approved")
      .is("deleted_at", null),
    (supabase as any).rpc("get_friends", { target_user_id: targetId }).limit(20),
    (supabase as any)
      .from("club_members")
      .select("id, role, clubs (id, name, logo_url, category)")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("rsvps")
      .select("id, status, events!inner(*, club:clubs(id, name, logo_url))")
      .eq("user_id", targetId)
      .in("status", ["going", "interested"])
      .gte("events.start_date", now)
      .is("events.deleted_at", null)
      .eq("events.status", "approved")
      .order("created_at", { ascending: false })
      .limit(6),
    (supabase as any)
      .from("rsvps")
      .select("id, status, events!inner(*, club:clubs(id, name, logo_url))")
      .eq("user_id", targetId)
      .in("status", ["going", "interested"])
      .lt("events.start_date", now)
      .is("events.deleted_at", null)
      .eq("events.status", "approved")
      .order("created_at", { ascending: false })
      .limit(6),
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
  const attendedCount = eventsAttended ?? 0;
  const organizedCount = eventsOrganized ?? 0;
  const clubCount = memberships?.length ?? 0;
  const eventCount = attendedCount + organizedCount;

  const organizerClubs = (memberships ?? []).filter(
    (m: any) => m.role === "organizer" || m.role === "admin" || m.role === "president"
  );
  const isOrganizer = organizerClubs.length > 0;

  const upcomingEvents: Event[] = (upcomingRsvps ?? [])
    .map((r: any) => r.events)
    .filter(Boolean)
    .sort((a: any, b: any) => a.start_date.localeCompare(b.start_date));
  const pastEvents: Event[] = (pastRsvps ?? [])
    .map((r: any) => r.events)
    .filter(Boolean)
    .sort((a: any, b: any) => b.start_date.localeCompare(a.start_date));

  const subtitleParts: string[] = [];
  if (target.faculty) subtitleParts.push(target.faculty);
  if (target.year) subtitleParts.push(`McGill '${target.year}`);

  const joinDate = new Date(target.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const heroImage = target.banner_url || target.avatar_url;

  return (
    <div className="w-full min-h-screen relative overflow-hidden">
      {/* Ambient color bleed */}
      <div className="absolute inset-0 -z-10">
        {heroImage ? (
          <>
            <Image
              src={heroImage}
              alt=""
              fill
              className="object-cover scale-125 blur-3xl opacity-30 dark:opacity-15 saturate-150"
            />
            <div className="absolute inset-0 bg-background/80 dark:bg-background/90" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        )}
      </div>

      {/* Hero Banner */}
      <div className="relative w-full h-[38vh] min-h-[300px]">
        <div className="absolute inset-0 overflow-hidden">
          {target.banner_url ? (
            <>
              <Image src={target.banner_url} alt="" fill className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background" />
            </>
          ) : target.avatar_url ? (
            <>
              <Image src={target.avatar_url} alt="" fill className="object-cover scale-150 blur-2xl saturate-150" priority />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-primary/5 to-background" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/40 to-primary/60 dark:from-primary/15 dark:via-primary/20 dark:to-primary/10" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-60% to-background" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="group flex items-center gap-2 bg-black/30 dark:bg-black/40 hover:bg-black/50 backdrop-blur-2xl border border-white/15 text-white px-4 py-2 rounded-full transition-all duration-200"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <button
              aria-label="Share profile"
              className="flex items-center justify-center w-10 h-10 bg-black/30 dark:bg-black/40 hover:bg-black/50 backdrop-blur-2xl border border-white/15 text-white rounded-full transition-all duration-200 cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content — overlaps hero */}
      <main className="w-full px-4 sm:px-8 lg:px-12 pb-24 -mt-28 relative z-10">
        {/* Profile Info Card — frosted glass */}
        <div className="bg-white/70 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/50 dark:border-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-20 sm:-mt-24 mb-6">
            {/* Avatar */}
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-xl border-[4px] border-white/80 dark:border-white/10 shadow-xl overflow-hidden flex items-center justify-center shrink-0">
              {target.avatar_url ? (
                <Image
                  src={target.avatar_url}
                  alt={target.name ?? "User"}
                  width={144}
                  height={144}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl font-bold text-primary">{initials}</span>
                </div>
              )}
            </div>

            {/* Identity block */}
            <div className="flex-1 min-w-0 pb-1 sm:pb-2">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                {isOrganizer && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/30 dark:border-white/[0.04] text-foreground/70">
                    <Shield className="h-3 w-3" /> Organizer
                  </span>
                )}
                {isFriend && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/15 dark:bg-green-400/15 backdrop-blur-sm text-green-700 dark:text-green-300 border border-green-500/20 dark:border-green-400/20">
                    <Users className="h-3 w-3" /> Friends
                  </span>
                )}
                {!isPublic && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/30 dark:border-white/[0.04] text-foreground/70">
                    <EyeOff className="h-3 w-3" /> Private
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground leading-tight tracking-tight flex items-baseline gap-2 flex-wrap">
                {target.name ?? "User"}
                {target.pronouns && (
                  <span className="text-xs font-medium text-muted-foreground/60">{target.pronouns}</span>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {subtitleParts.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    {subtitleParts.join(" · ")}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  Montreal, QC
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                  Joined {joinDate}
                </span>
              </div>
            </div>

            {/* Follow button */}
            {authUser && (
              <div className="shrink-0 self-start sm:self-end">
                <FollowUserButton
                  userId={targetId}
                  initialFollowing={isFollowing}
                  initialIsFriend={isFriend}
                />
              </div>
            )}
          </div>

          {/* Bento-style Stats */}
          <div className="grid grid-cols-3 gap-3 pt-5 border-t border-white/20 dark:border-white/[0.04]">
            {[
              { value: eventCount, label: "Events", icon: Calendar },
              { value: clubCount, label: "Clubs", icon: Building2 },
              { value: friendCount, label: "Friends", icon: Users },
            ].map((stat) => (
              <div key={stat.label} className="group relative flex flex-col items-center justify-center py-4 rounded-xl bg-white/40 dark:bg-white/[0.05] backdrop-blur-lg border border-white/30 dark:border-white/[0.03] hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200 cursor-default">
                <stat.icon className="h-4 w-4 text-muted-foreground/50 mb-1.5 group-hover:text-primary/60 transition-colors duration-200" />
                <div className="text-2xl sm:text-3xl font-black text-foreground leading-none">{stat.value}</div>
                <div className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Private profile gate */}
        {!canSeeDetails ? (
          <div className="bg-white/50 dark:bg-white/[0.04] backdrop-blur-2xl rounded-2xl border border-dashed border-white/40 dark:border-white/[0.04] p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/50 dark:bg-white/[0.08] backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/30 dark:border-white/[0.04]">
              <Lock className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">This profile is private</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Follow this user to become friends and view their full profile, events, and interests.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Left Column — Sidebar */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              {/* Interests */}
              {target.interest_tags && target.interest_tags.length > 0 && (
                <div className="bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/[0.04] shadow-sm p-6 hover:bg-white/70 dark:hover:bg-white/[0.12] transition-all duration-200">
                  <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-sm">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(target.interest_tags as string[]).map((tag) => {
                      const meta = EVENT_CATEGORIES[tag as EventTag] ?? QUICK_FILTER_CATEGORIES[tag];
                      const label = meta?.label ?? tag;
                      return (
                        <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 dark:bg-primary/15 backdrop-blur-sm text-primary border border-primary/15 dark:border-primary/20 cursor-default">
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Friends Preview */}
              {friends && friends.length > 0 && (
                <div className="bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/[0.04] shadow-sm p-6 hover:bg-white/70 dark:hover:bg-white/[0.12] transition-all duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      Friends
                    </h3>
                    <span className="text-xs font-medium text-muted-foreground bg-white/50 dark:bg-white/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/30 dark:border-white/[0.04]">{friendCount}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {friends.slice(0, 7).map((friend: any) => (
                      <Link key={friend.id} href={`/users/${friend.id}`} className="group cursor-pointer">
                        {friend.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={friend.avatar_url} alt={friend.name ?? "Friend"} className="aspect-square rounded-xl object-cover w-full ring-2 ring-white/40 dark:ring-white/10 group-hover:ring-primary/40 transition-all duration-200 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="aspect-square rounded-xl bg-white/40 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center text-sm font-bold text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all duration-200 ring-2 ring-white/30 dark:ring-white/10">
                            {(friend.name ?? "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground text-center mt-1 truncate group-hover:text-foreground transition-colors duration-200">
                          {(friend.name ?? "User").split(" ")[0]}
                        </p>
                      </Link>
                    ))}
                    {friendCount > 7 && (
                      <div className="aspect-square rounded-xl bg-white/30 dark:bg-white/[0.05] backdrop-blur-sm flex items-center justify-center text-xs font-bold text-muted-foreground ring-2 ring-white/20 dark:ring-white/10">
                        +{friendCount - 7}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Club Memberships */}
              {memberships && memberships.length > 0 && (
                <div className="bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/[0.04] shadow-sm p-6 hover:bg-white/70 dark:hover:bg-white/[0.12] transition-all duration-200">
                  <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-sm">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    Clubs
                  </h3>
                  <div className="flex flex-col gap-1">
                    {memberships.map((m: any) => {
                      const club = m.clubs as { id: string; name: string; logo_url: string | null; category: string | null };
                      const isOrgRole = m.role === "organizer" || m.role === "admin" || m.role === "president";
                      return (
                        <Link
                          key={m.id}
                          href={`/clubs/${club.id}`}
                          className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 dark:hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
                        >
                          <div className="h-10 w-10 rounded-lg overflow-hidden bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/30 dark:ring-white/10 group-hover:ring-primary/30 transition-all duration-200">
                            {club.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={club.logo_url} alt={club.name} className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <Building2 className="h-5 w-5 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-200 truncate">
                              {club.name}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                              {isOrgRole && <Shield className="h-3 w-3 text-primary" />}
                              {m.role}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column — Events */}
            <div className="lg:col-span-2 flex flex-col gap-8">
              {/* Upcoming Events */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 backdrop-blur-sm">
                    <CalendarCheck className="h-4 w-4 text-primary" />
                  </div>
                  Upcoming Events
                </h2>
                {upcomingEvents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {upcomingEvents.map((event) => {
                      const sd = new Date(event.start_date);
                      const timeLabel = sd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      return (
                        <Link key={event.id} href={`/events/${event.id}`} className="group bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/40 dark:border-white/[0.04] shadow-sm hover:shadow-[0_8px_30px_rgba(237,27,47,0.12)] hover:bg-white/75 dark:hover:bg-white/[0.12] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
                          <div className="h-36 bg-muted bg-cover bg-center relative overflow-hidden" style={event.image_url ? { backgroundImage: `url('${event.image_url}')` } : undefined}>
                            <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-black/60 via-transparent to-transparent" />
                            <div className="absolute bottom-3 left-3 flex flex-col bg-white/70 dark:bg-black/40 backdrop-blur-2xl border border-white/40 dark:border-white/[0.06] rounded-xl px-3.5 py-2 shadow-lg">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{sd.toLocaleDateString("en-US", { month: "short" })}</span>
                              <span className="text-2xl font-black leading-none text-foreground -mt-0.5">{sd.getDate()}</span>
                            </div>
                          </div>
                          <div className="p-4 relative">
                            <h4 className="font-bold text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-1">{event.title}</h4>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{timeLabel}</span>
                              {event.location && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /><span className="truncate max-w-[120px]">{event.location}</span></span>}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white/50 dark:bg-white/[0.04] backdrop-blur-2xl rounded-2xl border border-dashed border-white/40 dark:border-white/[0.04] p-10 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/[0.08] backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/30 dark:border-white/[0.04]">
                      <CalendarX className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                    <p className="font-medium text-foreground mb-1">No upcoming events</p>
                    <p className="text-sm text-muted-foreground">{target.name ?? "This user"} hasn&apos;t RSVPed to any upcoming events yet.</p>
                  </div>
                )}
              </section>

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <Heart className="h-4 w-4 text-primary" />
                      </div>
                      Past Events
                    </h2>
                    {pastEvents.length >= 6 && (
                      <span className="text-sm text-muted-foreground">Showing latest 6</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pastEvents.slice(0, 6).map((event) => {
                      const sd = new Date(event.start_date);
                      const timeLabel = sd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      return (
                        <Link key={event.id} href={`/events/${event.id}`} className="group bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/40 dark:border-white/[0.04] shadow-sm hover:bg-white/75 dark:hover:bg-white/[0.12] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer relative">
                          <div className="h-36 bg-muted bg-cover bg-center relative overflow-hidden" style={event.image_url ? { backgroundImage: `url('${event.image_url}')` } : undefined}>
                            <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-black/60 via-transparent to-transparent" />
                            <div className="absolute bottom-3 left-3 flex flex-col bg-white/70 dark:bg-black/40 backdrop-blur-2xl border border-white/40 dark:border-white/[0.06] rounded-xl px-3.5 py-2 shadow-lg">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{sd.toLocaleDateString("en-US", { month: "short" })}</span>
                              <span className="text-2xl font-black leading-none text-foreground -mt-0.5">{sd.getDate()}</span>
                            </div>
                          </div>
                          <div className="p-4 relative">
                            <h4 className="font-bold text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-1">{event.title}</h4>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{timeLabel}</span>
                              {event.location && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /><span className="truncate max-w-[120px]">{event.location}</span></span>}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* No events at all */}
              {upcomingEvents.length === 0 && pastEvents.length === 0 && (
                <div className="bg-white/50 dark:bg-white/[0.04] backdrop-blur-2xl rounded-2xl border border-dashed border-white/40 dark:border-white/[0.04] p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/[0.08] backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/30 dark:border-white/[0.04]">
                    <CalendarX className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-muted-foreground">No event activity to show yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
