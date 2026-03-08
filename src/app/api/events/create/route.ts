import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateEventDates } from "@/lib/dateValidation";
import { sanitizeText } from "@/lib/sanitize";
import { computeEventContentHash } from "@/lib/contentHash";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to create an event" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { start_date, end_date, tags, image_url, category } = body;

    // Sanitize text inputs to prevent XSS
    const title = sanitizeText(body.title ?? "");
    const description = sanitizeText(body.description ?? "");
    const location = sanitizeText(body.location ?? "");

    // Validate required fields
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (!start_date) {
      return NextResponse.json({ error: "Start date is required", field: "start_date" }, { status: 400 });
    }
    if (!location) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: "At least one tag is required" },
        { status: 400 }
      );
    }

    // Validate date fields (strict ISO 8601 + future constraint)
    const dateError = validateEventDates(start_date, end_date);
    if (dateError) {
      return NextResponse.json({ error: dateError.message, field: dateError.field }, { status: 400 });
    }

    // Get user profile with roles
    const { data: profile } = await supabase
      .from("users")
      .select("name, email, roles")
      .eq("id", user.id)
      .single();

    const organizer = profile?.name || profile?.email || user.email || "Unknown";
    const roles: string[] = profile?.roles ?? [];

    // Compute content hash for duplicate detection
    const contentHash = await computeEventContentHash(title, start_date, organizer);

    // Check for duplicate events
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A similar event already exists with the same title, date, and organizer" },
        { status: 409 }
      );
    }

    // Determine event status based on user roles
    let status: "pending" | "approved" = "pending";

    if (roles.includes("admin")) {
      status = "approved";
    } else if (roles.includes("club_organizer") && body.club_id) {
      // Check if user is an organizer for this specific club
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", body.club_id)
        .single();

      if (membership) {
        status = "approved";
      }
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        title,
        description,
        start_date,
        end_date: end_date || start_date,
        location,
        organizer,
        tags: tags,
        image_url: image_url || null,
        category: category || tags[0] || null,
        club_id: body.club_id || null,
        status,
        created_by: user.id,
        content_hash: contentHash,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const message = status === "approved"
      ? "Event created and approved"
      : "Event submitted for review";

    // Notification fanout for approved events with a club
    if (status === "approved" && body.club_id) {
      const fanout = async () => {
        try {
          const { data: clubInfo } = await supabase
            .from("clubs")
            .select("name")
            .eq("id", body.club_id)
            .single();

          const clubName = clubInfo?.name || "A club";

          const { data: followers } = await supabase
            .from("club_followers")
            .select("user_id")
            .eq("club_id", body.club_id);

          if (followers && followers.length > 0) {
            await supabase.from("notifications").insert(
              followers.map((f: { user_id: string }) => ({
                user_id: f.user_id,
                type: "new_event",
                title: "New Event",
                message: `${clubName} published: ${title}`,
                event_id: data.id,
                read: false,
              }))
            );
          }
        } catch (err) {
          console.error("Notification fanout error:", err);
        }
      };
      // Fire-and-forget
      fanout();
    }

    return NextResponse.json(
      { event: data, message },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in create event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
