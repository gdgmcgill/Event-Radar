import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VALID_INTEREST_TAGS } from "@/lib/constants";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Only allow users to update their own profile
    if (user.id !== id) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own profile" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, avatar_url, interest_tags, pronouns, year, faculty, visibility, onboarding_completed } = body;

    const updatePayload: Database["public"]["Tables"]["users"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    // Validate name
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
        return NextResponse.json(
          { error: "Name must be between 2 and 50 characters long" },
          { status: 400 }
        );
      }
      updatePayload.name = name.trim();
    }

    // Validate avatar_url
    if (avatar_url !== undefined) {
      if (avatar_url !== null && typeof avatar_url !== "string") {
        return NextResponse.json(
          { error: "Avatar URL must be a string or null" },
          { status: 400 }
        );
      }
      // Basic URL validation if it's not null and not empty
      if (avatar_url && avatar_url.trim() !== '') {
        try {
          new URL(avatar_url);
          updatePayload.avatar_url = avatar_url.trim();
        } catch (_) {
          return NextResponse.json(
            { error: "Invalid Avatar URL format" },
            { status: 400 }
          );
        }
      } else {
        updatePayload.avatar_url = null;
      }
    }

    // Validate interest_tags
    if (interest_tags !== undefined) {
      if (!Array.isArray(interest_tags)) {
        return NextResponse.json(
          { error: "interest_tags must be an array" },
          { status: 400 }
        );
      }

      const isValid = interest_tags.every((tag: string) => VALID_INTEREST_TAGS.includes(tag));

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid tag values provided in interest_tags" },
          { status: 400 }
        );
      }
      updatePayload.interest_tags = interest_tags;
    }

    // Validate pronouns
    if (pronouns !== undefined) {
      if (pronouns !== null && typeof pronouns !== "string") {
        return NextResponse.json(
          { error: "Pronouns must be a string or null" },
          { status: 400 }
        );
      }
      (updatePayload as Record<string, unknown>).pronouns = pronouns;
    }

    // Validate year
    if (year !== undefined) {
      if (year !== null && typeof year !== "string") {
        return NextResponse.json(
          { error: "Year must be a string or null" },
          { status: 400 }
        );
      }
      (updatePayload as Record<string, unknown>).year = year;
    }

    // Validate faculty
    if (faculty !== undefined) {
      if (faculty !== null && typeof faculty !== "string") {
        return NextResponse.json(
          { error: "Faculty must be a string or null" },
          { status: 400 }
        );
      }
      (updatePayload as Record<string, unknown>).faculty = faculty;
    }

    // Validate visibility
    if (visibility !== undefined) {
      if (visibility !== "public" && visibility !== "private") {
        return NextResponse.json(
          { error: "Visibility must be 'public' or 'private'" },
          { status: 400 }
        );
      }
      (updatePayload as Record<string, unknown>).visibility = visibility;
    }

    // Validate onboarding_completed
    if (onboarding_completed !== undefined) {
      if (typeof onboarding_completed !== "boolean") {
        return NextResponse.json(
          { error: "onboarding_completed must be a boolean" },
          { status: 400 }
        );
      }
      (updatePayload as Record<string, unknown>).onboarding_completed = onboarding_completed;
    }

    if (Object.keys(updatePayload).length === 1) { // only updated_at is set
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("users")
      .update(updatePayload)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Database error while updating profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
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
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
