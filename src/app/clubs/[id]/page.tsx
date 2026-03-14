import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Instagram, ExternalLink, Users, CalendarX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
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

  // Parallel fetch: club, follower count, events, current user + follow status
  const [clubResult, followerResult, eventsResult, userResult] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", id).single(),
    supabase
      .from("club_followers")
      .select("*", { count: "exact", head: true })
      .eq("club_id", id),
    supabase
      .from("events")
      .select("*")
      .eq("club_id", id)
      .eq("status", "approved")
      .order("event_date", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (clubResult.error || !clubResult.data) {
    notFound();
  }

  const club = clubResult.data;
  const followerCount = followerResult.count ?? 0;
  // Attach club info to each event for EventCard display
  const allEvents = (eventsResult.data ?? []).map((e) => ({
    ...e,
    club_id: e.club_id ?? id,
    club: { id, name: club.name, logo_url: club.logo_url },
  })) as unknown as Event[];

  // Split events into upcoming and past
  const today = new Date().toISOString().split("T")[0];
  const upcomingEvents = allEvents
    .filter((e) => e.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const pastEvents = allEvents
    .filter((e) => e.event_date < today)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

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
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      {/* Header Section */}
      <Card className="overflow-hidden border border-border shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Club Logo */}
            <div className="flex-shrink-0">
              {club.logo_url ? (
                <Image
                  src={club.logo_url}
                  alt={`${club.name} logo`}
                  width={96}
                  height={96}
                  className="rounded-xl object-cover w-24 h-24"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-secondary/30 flex items-center justify-center">
                  <Users className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Club Info */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {club.name}
                </h1>
                {club.category && (
                  <Badge variant="secondary" className="text-sm">
                    {club.category}
                  </Badge>
                )}
              </div>

              {club.description && (
                <p className="text-muted-foreground leading-relaxed">
                  {club.description}
                </p>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <FollowButton
                  clubId={id}
                  initialFollowing={isFollowing}
                  initialCount={followerCount}
                />

                {club.instagram_handle && (
                  <Link
                    href={`https://instagram.com/${club.instagram_handle.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Instagram className="h-4 w-4" />
                    <span>{club.instagram_handle}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Upcoming Events
        </h2>
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

      {/* Past Events - only show if there are any */}
      {pastEvents.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Past Events
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pastEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
