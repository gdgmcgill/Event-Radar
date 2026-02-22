// GET /api/recommendations
// Get personalized event recommendations for the current user
// Implement recommendation algorithm based on user interests and past events

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EventTag, type Event } from "@/types";
import { kMeans, type UserPoint, type Vector } from "@/lib/kmeans";
import { mapTags, transformEventFromDB, tagMapping } from "@/lib/tagMapping";
import type { Database } from "@/lib/supabase/types";
import type { NextRequest } from "next/server";

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type DbSavedEvent = Database["public"]["Tables"]["saved_events"]["Row"];
type DbEventRow = Database["public"]["Tables"]["events"]["Row"] & {
  start_date?: string | null;
  end_date?: string | null;
  organizer?: string | null;
  tags?: string[] | null;
};

// Order the tags that are used to build vectors
const TAG_ORDER: EventTag[] = [
  EventTag.ACADEMIC,
  EventTag.SOCIAL,
  EventTag.SPORTS,
  EventTag.CAREER,
  EventTag.CULTURAL,
  EventTag.WELLNESS,
];

// Quick lookup for "tag -> index in vector"
const TAG_INDEX = new Map<EventTag, number>(
  TAG_ORDER.map((tag, index) => [tag, index])
);

// Normalize raw tag strings into EventTag enums (unique only)
function normalizeTags(tags: string[] | null | undefined): EventTag[] {
  return mapTags(tags ?? []);
}

// Convert a list of tags into a numeric vector
function vectorFromTags(tags: EventTag[]): Vector {
  const vector = new Array(TAG_ORDER.length).fill(0);
  for (const tag of tags) {
    const index = TAG_INDEX.get(tag);
    if (index !== undefined) {
      vector[index] += 1;
    }
  }
  return vector;
}

// Add tags into an existing vector (optionally with weight)
function addTagsToVector(vector: Vector, tags: EventTag[], weight = 1) {
  for (const tag of tags) {
    const index = TAG_INDEX.get(tag);
    if (index !== undefined) {
      vector[index] += weight;
    }
  }
}

// Get a usable Date for an event from start_date (schema source of truth).
function getEventStartDate(event: DbEventRow): Date | null {
  const startDate = event.start_date ?? undefined;
  if (!startDate) {
    return null;
  }
  return new Date(startDate);
}

// Shape DB event rows into the frontend Event type using shared utility
function mapEventToResponse(event: DbEventRow): Event {
  return transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0]);
}

export async function GET(request: NextRequest) {
  try {
    // Create a server-side Supabase client (uses auth cookies)
    const supabase = await createClient();

    // Find the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the current user's profile (interest tags are stored here)
    const { data: userProfileData, error: userError } = await supabase
      .from("users")
      .select("id, interest_tags")
      .filter("id", "eq", user.id)
      .single();

    if (userError) {
      console.error("Supabase error fetching user profile:", userError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // Fetch all users so we can cluster everyone
    const { data: usersDataResult, error: usersError } = await supabase
      .from("users")
      .select("id, interest_tags");

    if (usersError) {
      console.error("Supabase error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Fetch all saved events so we can learn from actual behavior
    const { data: savedEventsResult, error: savedError } = await supabase
      .from("saved_events")
      .select("user_id, event_id");

    if (savedError) {
      console.error("Supabase error fetching saved events:", savedError);
      return NextResponse.json(
        { error: "Failed to fetch saved events" },
        { status: 500 }
      );
    }

    // Build a vector per user + track which events each user saved
    const userVectors = new Map<string, Vector>();
    const userSavedEventIds = new Map<string, Set<string>>();

    const userProfile = userProfileData as unknown as DbUser | null;
    const usersData = usersDataResult as unknown as DbUser[] | null;
    const savedEventsData = savedEventsResult as unknown as DbSavedEvent[] | null;

    for (const profile of usersData ?? []) {
      userVectors.set(
        profile.id,
        vectorFromTags(normalizeTags(profile.interest_tags))
      );
      userSavedEventIds.set(profile.id, new Set());
    }

    // Collect all event IDs that appear in saved_events
    const savedEventIds = new Set<string>();
    for (const saved of savedEventsData ?? []) {
      savedEventIds.add(saved.event_id);
      if (!userSavedEventIds.has(saved.user_id)) {
        userSavedEventIds.set(saved.user_id, new Set());
      }
      userSavedEventIds.get(saved.user_id)?.add(saved.event_id);
    }

    // Pull events once and reuse for saved-event enrichment + recommendations.
    const { data: allEventsResult, error: allEventsError } = await supabase
      .from("events")
      .select("*");

    if (allEventsError) {
      console.error("Supabase error fetching events:", allEventsError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const allEvents = allEventsResult as unknown as DbEventRow[] | null;
    let eventsById = new Map<string, DbEventRow>();
    if (savedEventIds.size > 0) {
      eventsById = new Map((allEvents ?? []).map((event) => [event.id, event]));
    }

    // Make each user's vector better with tags from other saved events
    for (const saved of savedEventsData ?? []) {
      const event = eventsById.get(saved.event_id);
      const tags = normalizeTags(event?.tags as string[] | null | undefined);
      if (!userVectors.has(saved.user_id)) {
        userVectors.set(saved.user_id, new Array(TAG_ORDER.length).fill(0));
      }
      addTagsToVector(userVectors.get(saved.user_id)!, tags, 1);
    }

    // Convert to input format expected by kMean
    const points: UserPoint[] = Array.from(userVectors.entries()).map(
      ([userId, vector]) => ({ userId, vector })
    );

    const currentUserVector = userVectors.get(user.id);
    if (!currentUserVector) {
      // If we couldn't build a vector, return an empty recommendation set
      return NextResponse.json({ recommendations: [] });
    }

    // Cluster users (k is small to avoid overfitting)
    const k = Math.min(3, points.length);
    let assignments = k > 0 ? kMeans(points, k) : [];
    const currentCluster = assignments.find(
      (assignment) => assignment.userId === user.id
    )?.cluster;

    // Build recommendation candidates from users in the same cluster
    const currentUserSaved = userSavedEventIds.get(user.id) ?? new Set();
    const candidateCounts = new Map<string, number>();

    if (currentCluster !== undefined) {
      for (const assignment of assignments) {
        if (assignment.cluster !== currentCluster) continue;
        const savedIds = userSavedEventIds.get(assignment.userId);
        if (!savedIds) continue;
        for (const eventId of savedIds) {
          if (currentUserSaved.has(eventId)) continue;
          candidateCounts.set(eventId, (candidateCounts.get(eventId) ?? 0) + 1);
        }
      }
    }

    // Fetch event records for candidate IDs and rank them
    const candidateIds = Array.from(candidateCounts.keys());
    const now = new Date();
    let recommendations: Event[] = [];

    if (candidateIds.length > 0) {
      const candidateIdSet = new Set(candidateIds);
      const candidateEvents = (allEvents ?? []).filter((event) =>
        candidateIdSet.has(event.id)
      );
      recommendations = (candidateEvents ?? [])
        .filter((event) => {
          const startDate = getEventStartDate(event);
          return startDate != null && startDate >= now;
        })
        .sort((a, b) => {
          // Primary sort: how many similar users saved it
          const countDiff =
            (candidateCounts.get(b.id) ?? 0) -
            (candidateCounts.get(a.id) ?? 0);
          if (countDiff !== 0) return countDiff;
          // Secondary sort: soonest event date
          const dateA = getEventStartDate(a)?.getTime() ?? Number.MAX_VALUE;
          const dateB = getEventStartDate(b)?.getTime() ?? Number.MAX_VALUE;
          return dateA - dateB;
        })
        .map(mapEventToResponse)
        .slice(0, 20);
    }

    // Fallback: if clustering isn't helpful, recommend by interest tags
    if (recommendations.length === 0) {
      const interestTags = normalizeTags(userProfile?.interest_tags);
      let fallbackQuery = supabase.from("events").select("*");

      // Build list of raw DB tags that map to the user's normalized interests
      if (interestTags.length > 0) {
        const rawTags = Object.entries(tagMapping)
          .filter(([, mapped]) => interestTags.includes(mapped))
          .map(([raw]) => raw);
        if (rawTags.length > 0) {
          fallbackQuery = fallbackQuery.overlaps("tags", rawTags);
        }
      }

      const { data: fallbackEventsResult, error: fallbackError } =
        await fallbackQuery.order("start_date", { ascending: true }).limit(20);

      if (fallbackError) {
        console.error("Supabase error fetching fallback events:", fallbackError);
        return NextResponse.json(
          { error: "Failed to fetch recommendations" },
          { status: 500 }
        );
      }

      const fallbackEvents =
        fallbackEventsResult as unknown as DbEventRow[] | null;
      recommendations = (fallbackEvents ?? [])
        .filter((event) => {
          const startDate = getEventStartDate(event);
          return startDate != null && startDate >= now;
        })
        .map(mapEventToResponse);
    }

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
