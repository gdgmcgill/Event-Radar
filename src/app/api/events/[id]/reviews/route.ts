import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/:id/reviews
 * Submit a review for a past event. Requires authentication, valid rating (1-5),
 * event must have ended, user must have RSVP'd going, and no prior review.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const { id: eventId } = await context.params;

    // Parse body
    let body: { rating: number; comment?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { rating, comment } = body;

    // Validate rating
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    // Check 1: Event exists and has ended
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, event_date, club_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (new Date(event.event_date) >= new Date()) {
      return NextResponse.json(
        { error: "Reviews can only be submitted after the event has ended" },
        { status: 400 }
      );
    }

    // Check 2: User RSVP'd going
    const { data: rsvp } = await supabase
      .from("rsvps")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("status", "going")
      .maybeSingle();

    if (!rsvp) {
      return NextResponse.json(
        { error: "Only attendees who RSVP'd going can review" },
        { status: 403 }
      );
    }

    // Check 3: No existing review
    const { data: existingReview } = await supabase
      .from("reviews" as any)
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this event" },
        { status: 409 }
      );
    }

    // Insert review
    const { data: review, error: insertError } = await supabase
      .from("reviews" as any)
      .insert({
        user_id: userId,
        event_id: eventId,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create review" },
        { status: 500 }
      );
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/events/:id/reviews
 * Returns aggregate review data, user's review (if any), and can_review eligibility.
 * Organizers see anonymized comments; non-organizers get empty comments array.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const { id: eventId } = await context.params;

    // Get event info (for club_id to check organizer status)
    const { data: event } = await supabase
      .from("events")
      .select("id, event_date, club_id")
      .eq("id", eventId)
      .single();

    // Check if user is an organizer (club member)
    let isOrganizer = false;
    if (event?.club_id) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("club_id", event.club_id)
        .eq("user_id", userId)
        .maybeSingle();
      isOrganizer = !!membership;
    }

    // Fetch all reviews for this event
    const { data: reviews } = await supabase
      .from("reviews" as any)
      .select("id, user_id, event_id, rating, comment, created_at")
      .eq("event_id", eventId);

    const allReviews = (reviews || []) as unknown as Review[];

    // Calculate aggregate
    const totalReviews = allReviews.length;
    const averageRating =
      totalReviews > 0
        ? Math.round(
            (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) *
              10
          ) / 10
        : 0;

    // Distribution: count per rating 1-5
    const distribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: allReviews.filter((r) => r.rating === rating).length,
    }));

    // Anonymized comments (only for organizers, only non-null comments)
    const comments = isOrganizer
      ? allReviews
          .filter((r) => r.comment)
          .map((r) => ({
            rating: r.rating,
            comment: r.comment as string,
            created_at: r.created_at,
          }))
      : [];

    // User's own review
    const userReview = allReviews.find((r) => r.user_id === userId) || null;

    // Can user review? Must have RSVP'd going, event ended, no existing review
    let canReview = false;
    if (!userReview && event) {
      const eventEnded = new Date(event.event_date) < new Date();
      if (eventEnded) {
        const { data: rsvp } = await supabase
          .from("rsvps")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", userId)
          .eq("status", "going")
          .maybeSingle();
        canReview = !!rsvp;
      }
    }

    return NextResponse.json({
      aggregate: {
        average_rating: averageRating,
        total_reviews: totalReviews,
        distribution,
        comments,
      },
      user_review: userReview,
      can_review: canReview,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
