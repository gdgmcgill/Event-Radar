/**
 * POST /api/events/:id/save
 * Save an event for the current user
 * TODO: Implement save/unsave event functionality
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    // TODO: Get current user
    // const {
    //   data: { user },
    // } = await supabase.auth.getUser();
    // if (!user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // // TODO: Check if event is already saved
    // const { data: existing, error: existingError } = await supabase
    //   .from('saved_events')
    //   .select('id')
    //   .eq('user_id', user.id)
    //   .eq('event_id', params.id)
    //   .single();

    // if (existingError) {
    //   console.error("Error checking existing saved event:", existingError);
    //   return NextResponse.json(
    //     { error: "Failed to check saved event" },
    //     { status: 500 }
    //   );
    // }

    // // TODO: Save or unsave event
    //  if (existing) {
    //    // Unsave
    //    await supabase
    //      .from('saved_events')
    //      .delete()
    //      .eq('id', existing.id);
    //    return NextResponse.json({ saved: false });
    //  } else {
    //    // Save
    //    const { error } = await supabase
    //      .from('saved_events')
    //      .insert({
    //        user_id: user.id,
    //        event_id: params.id,
    //      });
    //    if (error) throw error;
    //    return NextResponse.json({ saved: true });
    //  }
return NextResponse.json({saved: true});

  } catch (error) {
    console.error("Error saving event:", error);
    return NextResponse.json(
      { error: "Failed to save event" },
      { status: 500 }
    );
  }
}



