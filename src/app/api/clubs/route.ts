/**
 * GET /api/clubs
 * List all approved clubs ordered by name. Public endpoint.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: clubs, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "approved")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching clubs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clubs: clubs ?? [] });
  } catch (error) {
    console.error("Error in clubs list:", error);
    return NextResponse.json(
      { error: "Failed to fetch clubs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clubs
 * Create a new club (requires authentication). Club starts as "pending".
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, instagram_handle, logo_url } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Club name is required" },
        { status: 400 }
      );
    }

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      );
    }

    const { data: club, error } = await supabase
      .from("clubs")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        instagram_handle: instagram_handle?.trim() || null,
        logo_url: logo_url?.trim() || null,
        status: "pending",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating club:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ club }, { status: 201 });
  } catch (error) {
    console.error("Error in club creation:", error);
    return NextResponse.json(
      { error: "Failed to create club" },
      { status: 500 }
    );
  }
}
