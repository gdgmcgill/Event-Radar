/**
 * GET /api/user/following
 * Retrieve the list of clubs the current authenticated user follows,
 * joined with club details.
 * Requires: authenticated user
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "private", action: "fetch followed clubs" }, async () => {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in" },
        { status: 401 }
      );
    }

    const { data: following, error } = await supabase
      .from("club_followers")
      .select(`
        id,
        created_at,
        clubs (
          id,
          name,
          logo_url,
          description,
          category
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      log.error("Error fetching followed clubs", { error });
      return NextResponse.json(
        { error: "Failed to fetch followed clubs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ following: following ?? [] });
  } catch (error) {
    log.error("Error in GET user following", { error });
    return NextResponse.json(
      { error: "Failed to fetch followed clubs" },
      { status: 500 }
    );
  }
});
