import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Share2,
  Instagram,
  Globe,
  Users,
  CalendarX,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FollowButton } from "@/components/clubs/FollowButton";
import { EventCard } from "@/components/events/EventCard";
import type { Event } from "@/types";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: club } = await supabase
    .from("clubs")
    .select("name, description")
    .eq("id", id)
    .single();

  if (!club) {
    return { title: "Club Not Found" };
  }

  return {
    title: `${club.name} | UNI-VERSE`,
    description: club.description ?? `Discover events by ${club.name} on UNI-VERSE`,
  };
}

export default async function ClubDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Parallel fetch: club, follower count, member count, events, current user
  const [clubResult, followerResult, memberResult, eventsResult, userResult] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", id).single(),
    supabase
      .from("club_followers")
      .select("*", { count: "exact", head: true })
      .eq("club_id", id),
    supabase
      .from("club_members")
      .select("*", { count: "exact", head: true })
      .eq("club_id", id),
    supabase
      .from("events")
      .select("*")
      .eq("club_id", id)
      .eq("status", "approved")
      .order("start_date", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (clubResult.error || !clubResult.data) {
    notFound();
  }

  const club = clubResult.data;
  const followerCount = followerResult.count ?? 0;
  const memberCount = memberResult.count ?? 0;
  // Attach club info to each event for EventCard display
  const rawEvents = (eventsResult.data ?? []).map((e) => ({
    ...e,
    club_id: e.club_id ?? id,
    club: { id, name: club.name, logo_url: club.logo_url },
  }));

  // Split events into upcoming and past (using start_date from DB)
  const today = new Date().toISOString().split("T")[0];
  const upcomingEvents = rawEvents
    .filter((e) => e.start_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date)) as unknown as Event[];
  const pastEvents = rawEvents
    .filter((e) => e.start_date < today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date)) as unknown as Event[];
  const allEvents = rawEvents as unknown as Event[];

  // Check if current user follows this club
  let isFollowing = false;
  const currentUser = userResult.data?.user;
  if (currentUser) {
    const { data: followRow } = await supabase
      .from("club_followers")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("club_id", id)
      .maybeSingle();
    isFollowing = !!followRow;
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-white via-white to-primary/10 dark:from-black dark:via-background dark:to-primary/10">
      {/* Full-Bleed Hero */}
      <div className="relative w-full h-[55vh] min-h-[450px]">
        <div className="absolute inset-0">
          {club.logo_url ? (
            <Image
              src={club.logo_url}
              alt={club.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/60 to-primary/80 dark:from-primary/20 dark:via-secondary/30 dark:to-primary/10" />
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white dark:from-black/40 dark:via-transparent dark:to-black" />

        {/* Top bar */}
        <div className="absolute top-0 w-full px-6 py-8 z-20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link
              href="/clubs"
              className="group flex items-center gap-2 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-semibold tracking-wide">Back to Clubs</span>
            </Link>
            <button
              aria-label="Share"
              className="flex items-center justify-center w-10 h-10 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full transition-all duration-300 cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Club info overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 z-10">
          <div className="max-w-7xl mx-auto flex items-end gap-5">
            <div className="w-20 h-20 rounded-xl bg-white border-[3px] border-white shadow-lg overflow-hidden flex items-center justify-center shrink-0">
              {club.logo_url ? (
                <Image
                  src={club.logo_url}
                  alt={`${club.name} logo`}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <div>
              {club.category && (
                <Badge variant="secondary" className="mb-2 bg-white/20 text-white border-white/30 backdrop-blur-md">
                  {club.category}
                </Badge>
              )}
              <h1 className="text-3xl sm:text-4xl font-black text-white drop-shadow-lg">
                {club.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content (overlaps hero) */}
      <main className="w-full max-w-7xl mx-auto px-6 pb-24 -mt-24 relative z-10">
        {/* Rejection Banner (visible only to club creator) */}
        {club.status === "rejected" && currentUser?.id === club.created_by && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-4 flex items-center gap-3 mb-6">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                This club was not approved.
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Visit your club dashboard to see the rejection reason and submit an appeal.
              </p>
            </div>
            <Link
              href={`/my-clubs/${club.id}`}
              className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400"
            >
              View Details
            </Link>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-card rounded-2xl border border-border shadow-lg p-6 sm:p-8 mb-10">
          {club.description && (
            <p className="text-muted-foreground leading-relaxed mb-6">
              {club.description}
            </p>
          )}

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{followerCount}</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{memberCount}</div>
              <div className="text-xs text-muted-foreground">Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{allEvents.length}</div>
              <div className="text-xs text-muted-foreground">Events</div>
            </div>
            <div className="ml-auto">
              <FollowButton
                clubId={id}
                initialFollowing={isFollowing}
                initialCount={followerCount}
              />
            </div>
          </div>

          {/* Social Links */}
          <div className="flex flex-wrap items-center gap-3">
            {club.instagram_handle && (
              <Link
                href={`https://instagram.com/${(club.instagram_handle as string).replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Instagram className="h-4 w-4" />
                Instagram
              </Link>
            )}
            {club.twitter_url && (
              <Link
                href={club.twitter_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                X / Twitter
              </Link>
            )}
            {club.discord_url && (
              <Link
                href={club.discord_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Discord
              </Link>
            )}
            {club.linkedin_url && (
              <Link
                href={club.linkedin_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                LinkedIn
              </Link>
            )}
            {club.website_url && (
              <Link
                href={club.website_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Globe className="h-4 w-4" />
                Website
              </Link>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-foreground">Upcoming Events</h2>
          {upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarX}
              title="No upcoming events"
              description={`${club.name} hasn't posted any upcoming events yet. Follow them to get notified when they do!`}
            />
          )}
        </section>

        {/* Past Events — capped at 6 */}
        {pastEvents.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Past Events</h2>
              {pastEvents.length > 6 && (
                <span className="text-sm text-muted-foreground">
                  Showing 6 of {pastEvents.length}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.slice(0, 6).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
