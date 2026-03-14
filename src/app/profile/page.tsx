import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileHeader from "@/components/profile/ProfileHeader";
import InterestsCard from "@/components/profile/InterestsCard";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Building2,
  Users,
  CalendarCheck,
  Megaphone,
  Clock,
  Eye,
  EyeOff,
  Calendar,
  MapPin,
  ChevronRight,
  ArrowRight,
  Code,
  Camera,
} from "lucide-react";
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

  // Fetch profile, clubs, following, stats, event history, upcoming events, and friends in parallel
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

  const friendCount = friends?.length ?? 0;
  const clubCount = (memberships?.length ?? 0) + (following?.length ?? 0);
  const eventCount = (eventsAttended ?? 0) + (eventsOrganized ?? 0);

  // Build subtitle from faculty and year
  const subtitleParts: string[] = [];
  if ((displayData as any).faculty) subtitleParts.push((displayData as any).faculty);
  if ((displayData as any).year) subtitleParts.push(`McGill '${(displayData as any).year}`);
  const subtitle = subtitleParts.join(", ") || null;

  return (
    <div className="min-h-screen bg-[#f8f6f6] dark:bg-background">
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar: Profile Info */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Profile Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-red-600/5 dark:border-slate-700 flex flex-col items-center text-center">
            <ProfileHeader
              name={displayData.name}
              email={displayData.email}
              avatarUrl={displayData.avatar_url}
              userId={displayData.id}
              editable
            />
            <h1 className="text-2xl font-bold mt-4 dark:text-slate-100">{displayData.name ?? displayData.email ?? "User"}</h1>
            {subtitle && (
              <p className="text-red-600 font-medium">{subtitle}</p>
            )}
            {(displayData as any).pronouns && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{(displayData as any).pronouns}</p>
            )}
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-sm">Montreal, QC</span>
            </div>

            {/* Edit Profile Button */}
            <div className="flex w-full gap-3 mt-6">
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
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-600/5 dark:border-slate-700 text-center">
              <p className="text-2xl font-bold text-red-600">{eventCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Events</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-600/5 dark:border-slate-700 text-center">
              <p className="text-2xl font-bold text-red-600">{clubCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Clubs</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-600/5 dark:border-slate-700 text-center">
              <p className="text-2xl font-bold text-red-600">{friendCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Friends</p>
            </div>
          </div>

          {/* Interests */}
          <InterestsCard
            userId={displayData.id}
            initialTags={(displayData.interest_tags ?? []) as import("@/types").EventTag[]}
          />

          {/* Friends Preview */}
          {friends && friends.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-red-600/5 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2 dark:text-slate-100">
                  <Users className="h-5 w-5 text-red-600" /> Friends
                </h3>
                <Link href="#" className="text-xs text-red-600 font-bold">View All</Link>
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
                  <div className="aspect-square rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                    +{friendCount - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Upcoming Events Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 dark:text-slate-100">
                <Calendar className="h-5 w-5 text-red-600" /> Upcoming Events
              </h3>
              <Link href="/my-events" className="text-sm text-red-600 font-bold flex items-center gap-1">
                Full Schedule <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingEvents.map((se: any) => {
                  const event = se.events;
                  const eventDate = new Date(event.event_date);
                  const dateLabel = eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const timeLabel = event.event_time
                    ? (() => {
                        const [h, m] = event.event_time.split(":");
                        const hour = parseInt(h, 10);
                        const ampm = hour >= 12 ? "PM" : "AM";
                        const h12 = hour % 12 || 12;
                        return `${h12}:${m} ${ampm}`;
                      })()
                    : "";

                  return (
                    <Link
                      key={se.id}
                      href={`/events/${event.id}`}
                      className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-red-600/5 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div
                        className="h-32 bg-slate-200 dark:bg-slate-700 bg-cover bg-center"
                        style={event.image_url ? { backgroundImage: `url('${event.image_url}')` } : undefined}
                      />
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-red-600 font-bold text-xs mb-1 uppercase tracking-wider">
                          <Calendar className="h-3 w-3" />
                          {dateLabel} {timeLabel && `\u2022 ${timeLabel}`}
                        </div>
                        <h4 className="font-bold text-lg mb-1 dark:text-slate-100">{event.title}</h4>
                        {event.location && (
                          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{event.location}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2">
                            <div className="h-6 w-6 rounded-full border border-white dark:border-slate-700 bg-slate-300 dark:bg-slate-600" />
                            <div className="h-6 w-6 rounded-full border border-white dark:border-slate-700 bg-slate-400 dark:bg-slate-500" />
                            <div className="h-6 w-6 rounded-full border border-white dark:border-slate-700 bg-slate-500 dark:bg-slate-400" />
                          </div>
                          <span className="text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                            Confirmed
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-red-600/5 dark:border-slate-700 text-center">
                <Calendar className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming events. Browse events to find something interesting!</p>
              </div>
            )}
          </section>

          {/* Member of (Clubs) Section */}
          {memberships && memberships.length > 0 && (
            <section>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-4 dark:text-slate-100">
                <Building2 className="h-5 w-5 text-red-600" /> Member of
              </h3>
              <div className="flex flex-col gap-3">
                {memberships.map((m) => {
                  const club = m.clubs as unknown as {
                    id: string;
                    name: string;
                    logo_url: string | null;
                    category: string | null;
                  };
                  return (
                    <Link
                      key={m.id}
                      href={`/my-clubs/${club.id}`}
                      className="bg-white dark:bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-red-600/5 dark:border-slate-700 hover:shadow-sm transition-shadow"
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
                          <h4 className="font-bold dark:text-slate-100">{club.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{m.role}</p>
                        </div>
                      </div>
                      <span className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Following Clubs as additional clubs */}
          {following && following.length > 0 && !memberships?.length && (
            <section>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-4 dark:text-slate-100">
                <Heart className="h-5 w-5 text-red-600" /> Following
              </h3>
              <div className="flex flex-col gap-3">
                {following.map((f) => {
                  const club = f.clubs as unknown as {
                    id: string;
                    name: string;
                    logo_url: string | null;
                    description: string | null;
                    category: string | null;
                  };
                  return (
                    <Link
                      key={f.id}
                      href={`/clubs/${club.id}`}
                      className="bg-white dark:bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-red-600/5 dark:border-slate-700 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-red-600/10 flex items-center justify-center text-red-600">
                          {club.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={club.logo_url} alt={club.name} className="h-12 w-12 rounded-lg object-cover" />
                          ) : (
                            <Camera className="h-7 w-7" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold dark:text-slate-100">{club.name}</h4>
                          {club.category && <p className="text-xs text-slate-500 dark:text-slate-400">{club.category}</p>}
                        </div>
                      </div>
                      <span className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Event History Table */}
          {pastEvents && pastEvents.length > 0 && (
            <section>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-4 dark:text-slate-100">
                <Clock className="h-5 w-5 text-red-600" /> Event History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-red-600/5 text-red-600 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-4 rounded-tl-lg">Event</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 rounded-tr-lg">Location</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm bg-white dark:bg-slate-800">
                    {pastEvents.map((se: any) => {
                      const event = se.events;
                      return (
                        <tr key={se.id} className="border-b border-red-600/5 last:border-0">
                          <td className="p-4 font-semibold dark:text-slate-100">
                            <Link href={`/events/${event.id}`} className="hover:text-red-600 transition-colors">
                              {event.title}
                            </Link>
                          </td>
                          <td className="p-4 text-slate-500 dark:text-slate-400">
                            {new Date(event.event_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="p-4">
                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full text-xs">
                              Attended
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 dark:text-slate-400">{event.location || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
