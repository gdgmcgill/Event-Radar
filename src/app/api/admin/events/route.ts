/**
 * POST /api/admin/events
 * Create or update an event (admin only)
 * TODO: Implement event creation/update with admin validation
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // TODO: Get current user and verify admin status
    // const {
    //   data: { user },
    // } = await supabase.auth.getUser();

    // if (!user || !isAdmin(user.id)) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 403 }
    //   );
    // }

    // TODO: Parse request body
    // const body = await request.json();
    // const { title, description, event_date, event_time, location, club_id, tags, image_url } = body;

    // TODO: Validate required fields
    // if (!title || !description || !event_date || !event_time || !location || !club_id) {
    //   return NextResponse.json(
    //     { error: 'Missing required fields' },
    //     { status: 400 }
    //   );
    // }

    // TODO: Create or update event
    // const { data, error } = await supabase
    //   .from('events')
    //   .insert({
    //     title,
    //     description,
    //     event_date,
    //     event_time,
    //     location,
    //     club_id,
    //     tags,
    //     image_url,
    //     status: 'approved', // Admin-created events are auto-approved
    //     approved_by: user.id,
    //     approved_at: new Date().toISOString(),
    //   })
    //   .select()
    //   .single();

    // if (error) {
    //   return NextResponse.json({ error: error.message }, { status: 500 });
    // }

    return NextResponse.json({ event: null }, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // TODO: Implement event update
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function DELETE(request: NextRequest) {
  // TODO: Implement event deletion
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}


