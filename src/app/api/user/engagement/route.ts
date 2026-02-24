/**
 * GET /api/user/engagement
 * Get the current user's engagement summary
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * @swagger
 * /api/user/engagement:
 *   get:
 *     summary: Get user engagement summary
 *     description: Returns aggregated engagement metrics for the authenticated user
 *     tags:
 *       - User
 *     responses:
 *       200:
 *         description: User engagement summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:
 *                   type: string
 *                 total_views:
 *                   type: integer
 *                 total_clicks:
 *                   type: integer
 *                 total_saves:
 *                   type: integer
 *                 total_shares:
 *                   type: integer
 *                 total_calendar_adds:
 *                   type: integer
 *                 favorite_tags:
 *                   type: array
 *                 favorite_clubs:
 *                   type: array
 *                 last_active_at:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No engagement data found
 *       500:
 *         description: Internal server error
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error retrieving user:", authError);
      return NextResponse.json(
        { error: "Failed to authenticate" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch user's engagement summary
    const { data: engagement, error: engagementError } = await supabase
      .from("user_engagement_summary")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (engagementError) {
      console.error("Error fetching engagement:", engagementError);
      return NextResponse.json(
        { error: "Failed to fetch engagement data" },
        { status: 500 }
      );
    }

    // If no engagement record exists, return default values
    if (!engagement) {
      return NextResponse.json({
        user_id: user.id,
        total_views: 0,
        total_clicks: 0,
        total_saves: 0,
        total_shares: 0,
        total_calendar_adds: 0,
        favorite_tags: [],
        favorite_clubs: [],
        last_active_at: null,
        created_at: null,
        updated_at: null,
      });
    }

    return NextResponse.json(engagement);
  } catch (error) {
    console.error("Unexpected error fetching engagement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/engagement
 * Manually trigger recalculation of user's engagement summary
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error retrieving user:", authError);
      return NextResponse.json(
        { error: "Failed to authenticate" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Call the database function to recalculate engagement
    // Using type assertion since the function isn't in generated types yet
    const { error: rpcError } = await supabase.rpc(
      "update_user_engagement" as never,
      { p_user_id: user.id } as never
    );

    if (rpcError) {
      console.error("Error recalculating engagement:", rpcError);
      return NextResponse.json(
        { error: "Failed to recalculate engagement" },
        { status: 500 }
      );
    }

    // Fetch the updated engagement
    const { data: engagement, error: engagementError } = await supabase
      .from("user_engagement_summary")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (engagementError) {
      console.error("Error fetching updated engagement:", engagementError);
      return NextResponse.json(
        { error: "Failed to fetch updated engagement" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      engagement,
    });
  } catch (error) {
    console.error("Unexpected error recalculating engagement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
