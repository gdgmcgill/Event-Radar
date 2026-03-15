"use client";

import useSWR from "swr";
import { useAuthStore } from "@/store/useAuthStore";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch failed");
    return r.json();
  });

/**
 * Fetch a single club by ID with follower count.
 */
export function useClub(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}` : null,
    fetcher
  );
}

/**
 * Fetch approved events for a club.
 */
export function useClubEvents(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/events` : null,
    fetcher
  );
}

/**
 * Fetch all events for a club (organizer view with RSVP counts).
 * Returns all statuses for club members, approved-only for non-members.
 */
export function useClubEventsManagement(clubId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    clubId ? `/api/clubs/${clubId}/events` : null,
    fetcher
  );

  return {
    events: data?.events ?? [],
    isOrganizer: data?.isOrganizer ?? false,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Fetch members of a club (requires membership).
 */
export function useClubMembers(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/members` : null,
    fetcher
  );
}

/**
 * Fetch current user's clubs.
 */
export function useMyClubs() {
  return useSWR("/api/my-clubs", fetcher);
}

/**
 * Check if current user follows a club.
 */
export function useFollowStatus(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/follow` : null,
    fetcher
  );
}

/**
 * Fetch the set of club IDs the current user follows.
 * SWR deduplicates across all components using the same key,
 * so this only makes one request regardless of how many cards render.
 */
export function useFollowedClubIds() {
  const user = useAuthStore((s) => s.user);
  const { data, error, isLoading, mutate } = useSWR(
    user ? "/api/user/following" : null,
    fetcher
  );

  const followedIds: Set<string> = new Set();
  if (data?.following) {
    for (const f of data.following) {
      const clubId = f.clubs?.id ?? f.club_id;
      if (clubId) followedIds.add(clubId);
    }
  }

  return { followedIds, error, isLoading, mutate };
}

/**
 * Fetch pending invites for a club.
 */
export function useClubInvites(clubId: string | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/invites` : null,
    fetcher
  );
}
