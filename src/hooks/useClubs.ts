"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  ClubEventsResponse,
  ClubFollowStatusResponse,
  ClubInvitesResponse,
  ClubMembersResponse,
  ClubResponse,
} from "@/contracts/clubs";
import type {
  FollowedClubsResponse,
  MyClubsResponse,
} from "@/contracts/users";
import { checkResponseInDev } from "@/lib/contractCheck";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch failed");
    return r.json();
  });

// One fetcher per route, each checking its response against the route's
// contract in development only (plan 06-11, REFAC-16). The schema is loaded
// inside the NODE_ENV branch, so a production build drops the branch and
// ships no contract code; the data SWR receives is the JSON as sent.

const fetchClub = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/clubs/[id]",
        (): Promise<typeof ClubResponse> =>
          import("@/contracts/clubs").then((m) => m.ClubResponse),
        json
      );
    }
    return json;
  });

const fetchClubEvents = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/clubs/[id]/events",
        (): Promise<typeof ClubEventsResponse> =>
          import("@/contracts/clubs").then((m) => m.ClubEventsResponse),
        json
      );
    }
    return json;
  });

const fetchClubMembers = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/clubs/[id]/members",
        (): Promise<typeof ClubMembersResponse> =>
          import("@/contracts/clubs").then((m) => m.ClubMembersResponse),
        json
      );
    }
    return json;
  });

const fetchMyClubs = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/my-clubs",
        (): Promise<typeof MyClubsResponse> =>
          import("@/contracts/users").then((m) => m.MyClubsResponse),
        json
      );
    }
    return json;
  });

const fetchFollowStatus = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/clubs/[id]/follow",
        (): Promise<typeof ClubFollowStatusResponse> =>
          import("@/contracts/clubs").then((m) => m.ClubFollowStatusResponse),
        json
      );
    }
    return json;
  });

const fetchFollowedClubs = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/user/following",
        (): Promise<typeof FollowedClubsResponse> =>
          import("@/contracts/users").then((m) => m.FollowedClubsResponse),
        json
      );
    }
    return json;
  });

const fetchClubInvites = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/clubs/[id]/invites",
        (): Promise<typeof ClubInvitesResponse> =>
          import("@/contracts/clubs").then((m) => m.ClubInvitesResponse),
        json
      );
    }
    return json;
  });

/**
 * Fetch a single club by ID with follower count.
 */
export function useClub(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}` : null,
    fetchClub
  );
}

/**
 * Fetch approved events for a club.
 */
export function useClubEvents(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/events` : null,
    fetchClubEvents
  );
}

/**
 * Fetch all events for a club (organizer view with RSVP counts).
 * Returns all statuses for club members, approved-only for non-members.
 */
export function useClubEventsManagement(clubId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    clubId ? `/api/clubs/${clubId}/events` : null,
    fetchClubEvents
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
    fetchClubMembers
  );
}

/**
 * Fetch current user's clubs.
 */
export function useMyClubs() {
  return useSWR("/api/my-clubs", fetchMyClubs);
}

/**
 * Check if current user follows a club.
 */
export function useFollowStatus(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/follow` : null,
    fetchFollowStatus
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
    fetchFollowedClubs
  );

  const followedIds = useMemo(() => {
    const ids = new Set<string>();
    if (data?.following) {
      for (const f of data.following) {
        const id = f.clubs?.id ?? f.club_id;
        if (id) ids.add(id);
      }
    }
    return ids;
  }, [data]);

  return { followedIds, error, isLoading, mutate };
}

/**
 * Fetch pending invites for a club.
 */
export function useClubInvites(clubId: string | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/invites` : null,
    fetchClubInvites
  );
}
