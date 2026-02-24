/**
 * PUT /api/profile/interests
 * Update user's interest tags
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { EventTag } from "@/types";
import type { Database } from "@/lib/supabase/types";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { interest_tags } = await request.json();

    if (!Array.isArray(interest_tags)) {
      return NextResponse.json(
        { error: "interest_tags must be an array" },
        { status: 400 }
      );
    }

    // Validate that all tags are valid EventTag values
    const validTags = Object.values(EventTag);
    const isValid = interest_tags.every((tag) => validTags.includes(tag as EventTag));

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid tag values provided" },
        { status: 400 }
      );
    }

    // Update user's interest_tags in the database
    const updatePayload: Database["public"]["Tables"]["users"]["Update"] = {
      interest_tags,
      updated_at: new Date().toISOString(),
    };
     
    const { data, error } = await (supabase as any)
      .from("users")
      .update(updatePayload)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to update interests" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating interests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
