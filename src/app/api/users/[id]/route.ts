import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { parseBody } from "@/server/body";
import { UserUpdateBody } from "@/contracts/users";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Onboarding exemption (DEC-34, research C2): the onboarding wizard calls
    // this self-update before onboarding is complete, so requireOnboarded is
    // deliberately not called here. The self-only 403 below still applies.
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const user = active.user;

    const { id } = await params;

    // Only allow users to update their own profile
    if (user.id !== id) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own profile" },
        { status: 403 }
      );
    }

    // The self-update ladder, after the self-only 403 (src/contracts/users.ts):
    // name, avatar_url, banner_url, interest_tags, pronouns, year, faculty,
    // visibility, onboarding_completed, then "No fields to update". Its output
    // is the payload: each key only when sent, the name and image URLs
    // trimmed (a blank or null image URL clears it), the rest as sent.
    const parsed = await parseBody(request, UserUpdateBody);
    if (!parsed.ok) return parsed.response;
    const updatePayload = {
      updated_at: new Date().toISOString(),
      ...parsed.data,
    } as Database["public"]["Tables"]["users"]["Update"];

    // The caller's own row on the cookie client: "Users can update own
    // profile" permits it, and every column this payload can carry is in the
    // F-006 column grant (DEC-49).
    const { data, error } = await ctx.supabase
      .from("users")
      .update(updatePayload)
      .eq("id", id)
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
