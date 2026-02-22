import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { title, description, start_date, end_date, location, tags, image_url, category } = body;

    // Validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (!start_date) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 });
    }
    if (!location || !location.trim()) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: "At least one tag is required" },
        { status: 400 }
      );
    }

    // Validate start_date is in the future
    const startDate = new Date(start_date);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    }
    if (startDate < new Date()) {
      return NextResponse.json(
        { error: "Event date must be in the future" },
        { status: 400 }
      );
    }

    // Get user profile with roles
    const { data: profile } = await supabase
      .from("users")
      .select("name, email, roles")
      .eq("id", user.id)
      .single();

    const organizer = profile?.name || profile?.email || user.email || "Unknown";
    const roles: string[] = profile?.roles ?? [];

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
        title: title.trim(),
        description: description.trim(),
        start_date,
        end_date: end_date || start_date,
        location: location.trim(),
        organizer,
        tags: tags,
        image_url: image_url || null,
        category: category || tags[0] || null,
        club_id: body.club_id || null,
        status,
        created_by: user.id,
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
