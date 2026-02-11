/**
 * GET /api/users/:id/saved-events
 * Retrieve all saved events for a user, with full event and club details.
 *
 * Query parameters:
 *   limit  - max items to return (default 50)
 *   offset - pagination offset (default 0)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * @swagger
 * /api/users/{id}/saved-events:
 *   get:
 *     summary: Get saved events for a user
 *     description: Retrieve all events a user has saved, with full event and club details
 *     tags:
 *      - Users
 *     parameters:
 *       - name: id
 *         description: User ID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: limit
 *         description: Maximum number of events to return
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         description: Number of events to skip for pagination
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Saved events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *                 has_more:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User ID does not match authenticated user
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();

    // For testing without auth, uncomment below and comment out line above:
    // const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    // const supabase = createSupabaseClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!
    // );

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (userId !== user.id) {
      return NextResponse.json(
        { error: "User ID does not match authenticated user" },
        { status: 403 }
      );
    }

    // Parse pagination query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    // Query saved events with full event details via JOIN
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: queryError, count } = await (supabase as any)
      .from("saved_events")
      .select(
        `
        created_at,
        event:events (
          id,
          title,
          description,
          start_date,
          end_date,
          location,
          image_url,
          tags,
          club:clubs (
            id,
            name,
            logo_url
          )
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error("Fetch saved events error:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch saved events" },
        { status: 500 }
      );
    }

    // Flatten the structure: merge event fields with saved_at timestamp
    const savedEvents =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data as any[] | null)?.map((item: any) => ({
        ...item.event,
        saved_at: item.created_at,
      })) || [];

    const total = (count as number) || 0;

    return NextResponse.json({
      events: savedEvents,
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    });
  } catch (error) {
    console.error("Unexpected error fetching saved events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
