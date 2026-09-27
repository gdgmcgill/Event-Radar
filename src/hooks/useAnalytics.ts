"use client";

import useSWR from "swr";
import type { EventAnalytics, ClubAnalytics, ReviewAggregate, Review } from "@/types";
import type {
  EventAnalyticsResponse,
  EventReviewsResponse,
} from "@/contracts/events";
import type { ClubAnalyticsResponse } from "@/contracts/clubs";
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

const fetchEventAnalytics = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/events/[id]/analytics",
        (): Promise<typeof EventAnalyticsResponse> =>
          import("@/contracts/events").then((m) => m.EventAnalyticsResponse),
        json
      );
    }
    return json;
  });

const fetchClubAnalytics = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/clubs/[id]/analytics",
        (): Promise<typeof ClubAnalyticsResponse> =>
          import("@/contracts/clubs").then((m) => m.ClubAnalyticsResponse),
        json
      );
    }
    return json;
  });

const fetchEventReviews = (url: string) =>
  fetcher(url).then((json) => {
    if (process.env.NODE_ENV !== "production") {
      void checkResponseInDev(
        "GET /api/events/[id]/reviews",
        (): Promise<typeof EventReviewsResponse> =>
          import("@/contracts/events").then((m) => m.EventReviewsResponse),
        json
      );
    }
    return json;
  });

/**
 * Fetch event-level analytics (views, clicks, saves, RSVPs).
 * Requires club membership.
 */
export function useEventAnalytics(eventId: string) {
  return useSWR<EventAnalytics>(
    eventId ? `/api/events/${eventId}/analytics` : null,
    fetchEventAnalytics
  );
}

/**
 * Fetch club-level analytics (follower growth, attendees, popular tags, per-event metrics).
 * Requires club membership.
 */
export function useClubAnalytics(clubId: string) {
  return useSWR<ClubAnalytics>(
    clubId ? `/api/clubs/${clubId}/analytics` : null,
    fetchClubAnalytics
  );
}

interface EventReviewsResponse {
  aggregate: ReviewAggregate;
  user_review: Review | null;
  can_review: boolean;
}

/**
 * Fetch review aggregate, user review status, and eligibility for an event.
 */
export function useEventReviews(eventId: string) {
  return useSWR<EventReviewsResponse>(
    eventId ? `/api/events/${eventId}/reviews` : null,
    fetchEventReviews
  );
}
