import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { parseBody } from "@/server/body";
import { UserUpdateBody } from "@/contracts/users";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";
import { getElevatedClient } from "@/server/db/elevated";

export const PATCH = withRoute({ cache: "private", action: "update profile" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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

    // DI-72: clients cannot set onboarding_completed directly through Data API.
    // This validated self-only path owns that transition; ordinary profile
    // changes continue through the caller's RLS policy.
    const database = parsed.data.onboarding_completed === undefined
      ? ctx.supabase : getElevatedClient();
    const { data, error } = await database
      .from("users")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("Database error while updating profile", { error });
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
    log.error("Error updating profile", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
