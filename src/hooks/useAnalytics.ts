"use client";

import useSWR from "swr";
import type { EventAnalytics, ClubAnalytics } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch failed");
    return r.json();
  });

/**
 * Fetch event-level analytics (views, clicks, saves, RSVPs).
 * Requires club membership.
 */
export function useEventAnalytics(eventId: string) {
  return useSWR<EventAnalytics>(
    eventId ? `/api/events/${eventId}/analytics` : null,
    fetcher
  );
}

/**
 * Fetch club-level analytics (follower growth, attendees, popular tags, per-event metrics).
 * Requires club membership.
 */
export function useClubAnalytics(clubId: string) {
  return useSWR<ClubAnalytics>(
    clubId ? `/api/clubs/${clubId}/analytics` : null,
    fetcher
  );
}
