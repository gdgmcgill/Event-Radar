// GET /api/recommendations
// Hybrid recommendation engine: collaborative filtering (k-means clusters)
// + content-based scoring (cosine similarity) + popularity signals.
// Handles cold-start users via interest_tags alone.

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
type DbPopularity = Database["public"]["Tables"]["event_popularity_scores"]["Row"];

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

// --- Scoring weights ---
// Collaborative: how many cluster-mates saved an event
const WEIGHT_COLLABORATIVE = 0.4;
// Content: cosine similarity between user vector and event vector
const WEIGHT_CONTENT = 0.45;
// Popularity: normalized popularity score
const WEIGHT_POPULARITY = 0.15;
// Saved-event tags are weighted higher than interest tags in user vectors
const SAVED_TAG_WEIGHT = 2;

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

// Cosine similarity between two vectors. Returns 0 if either is all zeros.
function cosineSimilarity(a: Vector, b: Vector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user profile, all users, saved events, all events, and popularity in parallel
    const [
      userProfileResult,
      usersResult,
      savedEventsResult,
      allEventsResult,
      popularityResult,
    ] = await Promise.all([
      supabase
        .from("users")
        .select("id, interest_tags")
        .filter("id", "eq", user.id)
        .single(),
      supabase.from("users").select("id, interest_tags"),
      supabase.from("saved_events").select("user_id, event_id"),
      supabase.from("events").select("*"),
      supabase.from("event_popularity_scores").select("event_id, popularity_score"),
    ]);

    if (userProfileResult.error) {
      console.error("Supabase error fetching user profile:", userProfileResult.error);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (usersResult.error) {
      console.error("Supabase error fetching users:", usersResult.error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    if (savedEventsResult.error) {
      console.error("Supabase error fetching saved events:", savedEventsResult.error);
      return NextResponse.json(
        { error: "Failed to fetch saved events" },
        { status: 500 }
      );
    }

    if (allEventsResult.error) {
      console.error("Supabase error fetching events:", allEventsResult.error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const userProfile = userProfileResult.data as unknown as DbUser | null;
    const usersData = usersResult.data as unknown as DbUser[] | null;
    const savedEventsData = savedEventsResult.data as unknown as DbSavedEvent[] | null;
    const allEvents = allEventsResult.data as unknown as DbEventRow[] | null;
    const popularityData = popularityResult.data as unknown as DbPopularity[] | null;

    // Build popularity lookup
    const popularityMap = new Map<string, number>();
    let maxPopularity = 0;
    for (const row of popularityData ?? []) {
      popularityMap.set(row.event_id, row.popularity_score);
      if (row.popularity_score > maxPopularity) {
        maxPopularity = row.popularity_score;
      }
    }

    // Build a vector per user + track which events each user saved
    const userVectors = new Map<string, Vector>();
    const userSavedEventIds = new Map<string, Set<string>>();

    for (const profile of usersData ?? []) {
      userVectors.set(
        profile.id,
        vectorFromTags(normalizeTags(profile.interest_tags))
      );
      userSavedEventIds.set(profile.id, new Set());
    }

    // Index events by ID
    const eventsById = new Map<string, DbEventRow>();
    for (const event of allEvents ?? []) {
      eventsById.set(event.id, event);
    }

    // Collect saved events per user
    for (const saved of savedEventsData ?? []) {
      if (!userSavedEventIds.has(saved.user_id)) {
        userSavedEventIds.set(saved.user_id, new Set());
      }
      userSavedEventIds.get(saved.user_id)?.add(saved.event_id);
    }

    // Enrich user vectors with tags from saved events (weighted higher)
    for (const saved of savedEventsData ?? []) {
      const event = eventsById.get(saved.event_id);
      const tags = normalizeTags(event?.tags as string[] | null | undefined);
      if (!userVectors.has(saved.user_id)) {
        userVectors.set(saved.user_id, new Array(TAG_ORDER.length).fill(0));
      }
      addTagsToVector(userVectors.get(saved.user_id)!, tags, SAVED_TAG_WEIGHT);
    }

    const currentUserVector = userVectors.get(user.id);
    const currentUserSaved = userSavedEventIds.get(user.id) ?? new Set();
    const interestTags = normalizeTags(userProfile?.interest_tags);
    const isZeroVector = !currentUserVector || currentUserVector.every((v) => v === 0);

    // If user has no interest_tags and no saved events, we have nothing to work with
    if (isZeroVector && interestTags.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // --- Collaborative signal: k-means cluster ---
    const candidateCounts = new Map<string, number>();
    const points: UserPoint[] = Array.from(userVectors.entries()).map(
      ([userId, vector]) => ({ userId, vector })
    );

    if (points.length >= 2 && currentUserVector && !isZeroVector) {
      const k = Math.min(3, points.length);
      const assignments = kMeans(points, k);
      const currentCluster = assignments.find(
        (a) => a.userId === user.id
      )?.cluster;

      if (currentCluster !== undefined) {
        for (const assignment of assignments) {
          if (assignment.cluster !== currentCluster) continue;
          if (assignment.userId === user.id) continue;
          const savedIds = userSavedEventIds.get(assignment.userId);
          if (!savedIds) continue;
          for (const eventId of savedIds) {
            if (currentUserSaved.has(eventId)) continue;
            candidateCounts.set(eventId, (candidateCounts.get(eventId) ?? 0) + 1);
          }
        }
      }
    }

    // --- Build candidate set: all upcoming events the user hasn't saved ---
    const now = new Date();
    const candidates: DbEventRow[] = [];
    for (const event of allEvents ?? []) {
      if (currentUserSaved.has(event.id)) continue;
      const startDate = getEventStartDate(event);
      if (!startDate || startDate < now) continue;
      candidates.push(event);
    }

    if (candidates.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // --- Score each candidate event ---
    // For collaborative score normalization
    let maxCollaborativeCount = 0;
    for (const count of candidateCounts.values()) {
      if (count > maxCollaborativeCount) maxCollaborativeCount = count;
    }

    const scoredCandidates: { event: DbEventRow; score: number }[] = [];
    const effectiveUserVector = currentUserVector && !isZeroVector
      ? currentUserVector
      : vectorFromTags(interestTags);

    for (const event of candidates) {
      const eventTags = normalizeTags(event.tags as string[] | null | undefined);
      const eventVector = vectorFromTags(eventTags);

      // Content-based score: cosine similarity
      const contentScore = cosineSimilarity(effectiveUserVector, eventVector);

      // Collaborative score: normalized count of cluster-mates who saved it
      const collabCount = candidateCounts.get(event.id) ?? 0;
      const collaborativeScore = maxCollaborativeCount > 0
        ? collabCount / maxCollaborativeCount
        : 0;

      // Popularity score: normalized
      const rawPopularity = popularityMap.get(event.id) ?? 0;
      const popularityScore = maxPopularity > 0
        ? rawPopularity / maxPopularity
        : 0;

      // Weighted combination
      const totalScore =
        WEIGHT_CONTENT * contentScore +
        WEIGHT_COLLABORATIVE * collaborativeScore +
        WEIGHT_POPULARITY * popularityScore;

      if (totalScore > 0) {
        scoredCandidates.push({ event, score: totalScore });
      }
    }

    // Sort by score descending, then by start_date ascending as tiebreaker
    scoredCandidates.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
      const dateA = getEventStartDate(a.event)?.getTime() ?? Number.MAX_VALUE;
      const dateB = getEventStartDate(b.event)?.getTime() ?? Number.MAX_VALUE;
      return dateA - dateB;
    });

    let recommendations: Event[] = scoredCandidates
      .slice(0, 20)
      .map((c) => mapEventToResponse(c.event));

    // Fallback: if scoring produced nothing, use interest_tags overlap query
    if (recommendations.length === 0 && interestTags.length > 0) {
      const rawTags = Object.entries(tagMapping)
        .filter(([, mapped]) => interestTags.includes(mapped))
        .map(([raw]) => raw);

      if (rawTags.length > 0) {
        const { data: fallbackEventsResult, error: fallbackError } = await supabase
          .from("events")
          .select("*")
          .overlaps("tags", rawTags)
          .order("start_date", { ascending: true })
          .limit(20);

        if (fallbackError) {
          console.error("Supabase error fetching fallback events:", fallbackError);
          return NextResponse.json(
            { error: "Failed to fetch recommendations" },
            { status: 500 }
          );
        }

        const fallbackEvents = fallbackEventsResult as unknown as DbEventRow[] | null;
        recommendations = (fallbackEvents ?? [])
          .filter((event) => {
            const startDate = getEventStartDate(event);
            return startDate != null && startDate >= now;
          })
          .map(mapEventToResponse);
      }
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
