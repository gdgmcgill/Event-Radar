/**
 * PUT /api/profile/interests
 * Update user's interest tags
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import type { NextRequest } from "next/server";
import { VALID_INTEREST_TAGS } from "@/lib/constants";
import type { Database } from "@/lib/supabase/types";

export async function PUT(request: NextRequest) {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { interest_tags } = await request.json();

    if (!Array.isArray(interest_tags)) {
      return NextResponse.json(
        { error: "interest_tags must be an array" },
        { status: 400 }
      );
    }

    // Validate that all tags are valid interest tags (EventTag + quick filters)
    const isValid = interest_tags.every((tag: string) => VALID_INTEREST_TAGS.includes(tag));

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
     
    const { data, error } = await supabase
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
