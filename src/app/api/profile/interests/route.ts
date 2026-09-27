/**
 * PUT /api/profile/interests
 * Update user's interest tags
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import type { NextRequest } from "next/server";
import { parseBody } from "@/server/body";
import { InterestsBody } from "@/contracts/users";
import type { Database } from "@/lib/supabase/types";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const PUT = withRoute({ cache: "private", action: "update interests" }, async (request: NextRequest) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    // "interest_tags must be an array", then every tag a valid interest tag
    // (EventTag + quick filters): "Invalid tag values provided".
    const parsed = await parseBody(request, InterestsBody);
    if (!parsed.ok) return parsed.response;
    const { interest_tags } = parsed.data;

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
      log.error("Database error", { error });
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
    log.error("Error updating interests", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
