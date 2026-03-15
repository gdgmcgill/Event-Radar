import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClubHeroSocialLinks } from "@/components/clubs/ClubHeroSocialLinks";
import { ClubInitials } from "@/components/clubs/ClubInitials";
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
    <div className="w-full min-h-screen bg-background">
      {/* ─── Hero Banner ─── */}
      <div className="relative w-full h-[40vh] min-h-[320px] max-h-[420px]">
        {/* Background: image or rich gradient */}
        <div className="absolute inset-0">
          {club.banner_url ? (
            <Image
              src={club.banner_url}
              alt={`${club.name} banner`}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary/80 to-slate-800 dark:from-slate-950 dark:via-primary/40 dark:to-slate-900" />
          )}
        </div>

        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
        {/* Bottom blend into background */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

        {/* Top bar — back button only */}
        <div className="absolute top-0 w-full px-6 py-6 z-20">
          <div className="max-w-5xl mx-auto">
            <Link
              href="/clubs"
              className="group inline-flex items-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-semibold">Back to Clubs</span>
            </Link>
          </div>
        </div>

        {/* Bottom-right — social links + share */}
        <div className="absolute bottom-6 right-6 z-20 max-w-5xl">
          <ClubHeroSocialLinks
            clubName={club.name}
            clubDescription={club.description}
            clubId={id}
            instagramHandle={club.instagram_handle}
            twitterUrl={club.twitter_url}
            discordUrl={club.discord_url}
            linkedinUrl={club.linkedin_url}
            websiteUrl={club.website_url}
          />
        </div>
      </div>

      {/* ─── Profile Section (overlaps hero) ─── */}
      <div className="relative z-10 -mt-20 max-w-5xl mx-auto px-6">
        {/* Logo + Name Row */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-6">
          <div className="w-28 h-28 rounded-2xl bg-card border-4 border-background shadow-xl overflow-hidden flex items-center justify-center shrink-0">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={`${club.name} logo`}
                width={112}
                height={112}
                className="w-full h-full object-cover"
              />
            ) : (
              <ClubInitials name={club.name} className="w-full h-full rounded-2xl text-3xl" />
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                {club.name}
              </h1>
              {club.category && (
                <Badge variant="secondary" className="text-xs">
                  {club.category}
                </Badge>
              )}
            </div>
            {club.description && (
              <p className="text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
                {club.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats + Actions Bar */}
        <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-foreground">{followerCount}</span>
              <span className="text-sm text-muted-foreground">Followers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-foreground">{memberCount}</span>
              <span className="text-sm text-muted-foreground">Members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-foreground">{allEvents.length}</span>
              <span className="text-sm text-muted-foreground">Events</span>
            </div>
          </div>

          <div className="sm:ml-auto">
            <FollowButton
              clubId={id}
              initialFollowing={isFollowing}
              initialCount={followerCount}
            />
          </div>
        </div>
      </div>

      {/* ─── Events Content ─── */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Upcoming Events */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Upcoming Events</h2>
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
              <h2 className="text-xl font-bold text-foreground">Past Events</h2>
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
