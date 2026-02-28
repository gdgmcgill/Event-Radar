"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Instagram,
  Loader2,
  CalendarDays,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import Link from "next/link";
import type { Club, Event } from "@/types";
import { EventTag } from "@/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventCard } from "@/components/events/EventCard";
import { OrganizerRequestDialog } from "@/components/clubs/OrganizerRequestDialog";
import { FollowButton } from "@/components/clubs/FollowButton";
import { useAuthStore } from "@/store/useAuthStore";

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const { user } = useAuthStore();

  const fetchClub = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Club not found" : "Failed to load club");
        return;
      }
      const data = await res.json();
      setClub(data.club);
      setEvents(data.events ?? []);
      setFollowerCount(data.follower_count ?? 0);
    } catch {
      setError("Failed to load club");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchFollowStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/clubs/${id}/follow`);
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.is_following);
        setIsMember(data.is_member);
      }
    } catch {
      // Silently fail — follow status is non-critical
    }
  }, [id, user]);

  useEffect(() => {
    fetchClub();
  }, [fetchClub]);

  useEffect(() => {
    if (user) {
      fetchFollowStatus();
    }
  }, [fetchFollowStatus, user]);

  const handleFollowChange = useCallback((nowFollowing: boolean) => {
    setFollowerCount((prev) => prev + (nowFollowing ? 1 : -1));
    setIsFollowing(nowFollowing);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
          <p className="text-xl font-semibold mb-2">{error || "Club not found"}</p>
          <Link href="/clubs">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clubs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb items={[{ label: "Clubs", href: "/clubs" }, { label: club.name }]} />

      {/* Club Header */}
      <div className="flex items-start gap-4 mb-8">
        {club.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.logo_url}
            alt={club.name}
            className="h-20 w-20 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-foreground mb-1">
            {club.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {club.category && EVENT_CATEGORIES[club.category as EventTag] && (
              <Badge variant="secondary">
                {EVENT_CATEGORIES[club.category as EventTag].label}
              </Badge>
            )}
            {club.instagram_handle && (
              <a
                href={`https://instagram.com/${club.instagram_handle.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="h-4 w-4" />
                @{club.instagram_handle.replace("@", "")}
              </a>
            )}
            <span className="text-sm text-muted-foreground">
              {followerCount} {followerCount === 1 ? "follower" : "followers"}
            </span>
          </div>
          {club.description && (
            <p className="text-muted-foreground">{club.description}</p>
          )}
        </div>
      </div>

      {/* Follow / Request Organizer Access buttons */}
      <div className="mb-8 flex items-center gap-3">
        {!isMember && (
          <FollowButton
            clubId={club.id}
            initialIsFollowing={isFollowing}
            onFollowChange={handleFollowChange}
          />
        )}
        {user && !isMember && (
          <>
            <Button variant="outline" onClick={() => setRequestDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Request Organizer Access
            </Button>
            <OrganizerRequestDialog
              open={requestDialogOpen}
              onOpenChange={setRequestDialogOpen}
              clubId={club.id}
              clubName={club.name}
            />
          </>
        )}
      </div>

      {/* Upcoming Events */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Upcoming Events
        </h2>
        {events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No upcoming events for this club.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
