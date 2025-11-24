/**
 * GET /api/events/:id
 * Fetch a single event by ID
 * TODO: Implement event fetching by ID with relations
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient();

    // TODO: Fetch event with relations
    // const { data, error } = await supabase
    //   .from('events')
    //   .select('*, club:clubs(*)')
    //   .eq('id', params.id)
    //   .eq('status', 'approved')
    //   .single();

    // if (error || !data) {
    //   return NextResponse.json(
    //     { error: 'Event not found' },
    //     { status: 404 }
    //   );
    // }

    return NextResponse.json({ event: null });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}




