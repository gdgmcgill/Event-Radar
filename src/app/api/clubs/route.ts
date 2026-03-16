import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sanitizeText } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/clubs
 * Public endpoint - returns all approved clubs.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: clubs, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "approved")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch clubs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clubs: clubs ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch clubs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clubs
 * Authenticated endpoint - creates a new club (pending approval).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { contact_email, logo_url, instagram_handle, website_url, discord_url, twitter_url, linkedin_url } = body;

  // Sanitize text inputs to prevent XSS
  const name = sanitizeText(body.name ?? "");
  const description = sanitizeText(body.description ?? "");
  const category = sanitizeText(body.category ?? "");

  // Name, description, category, and contact email are all required
  if (!name || !description || !category) {
    return NextResponse.json(
      { error: "Name, description, and category are required" },
      { status: 400 }
    );
  }

  if (!contact_email || typeof contact_email !== "string") {
    return NextResponse.json(
      { error: "Contact email is required" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(contact_email.trim())) {
    return NextResponse.json(
      { error: "Please provide a valid email address" },
      { status: 400 }
    );
  }

  if (name.length > 100 || description.length > 500) {
    return NextResponse.json(
      { error: "Name max 100 chars, description max 500 chars" },
      { status: 400 }
    );
  }

  // Use service client to bypass RLS for role mutation
  const serviceClient = createServiceClient();

  // Check for duplicate club name (case-insensitive, non-rejected clubs only)
  const { data: existingClub } = await serviceClient
    .from("clubs")
    .select("id, name")
    .ilike("name", name.trim())
    .neq("status", "rejected")
    .maybeSingle();

  if (existingClub) {
    return NextResponse.json(
      { error: `A club named "${existingClub.name}" already exists` },
      { status: 409 }
    );
  }

  // 1. Create the club
  const { data: club, error: clubError } = await serviceClient
    .from("clubs")
    .insert({
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      contact_email: contact_email.trim(),
      logo_url: logo_url || null,
      instagram_handle: instagram_handle?.trim() || null,
      website_url: website_url?.trim() || null,
      discord_url: discord_url?.trim() || null,
      twitter_url: twitter_url?.trim() || null,
      linkedin_url: linkedin_url?.trim() || null,
      status: "pending",
      created_by: user.id,
    })
    .select()
    .single();

  if (clubError) {
    return NextResponse.json({ error: "Failed to create club" }, { status: 500 });
  }

  // 2. Add creator as owner
  await serviceClient
    .from("club_members")
    .insert({ user_id: user.id, club_id: club.id, role: "owner" });

  // 3. Add club_organizer role if not already present
  const { data: profile } = await serviceClient
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const currentRoles = (profile?.roles as ("user" | "admin" | "club_organizer")[]) || ["user"];
  if (!currentRoles.includes("club_organizer")) {
    await serviceClient
      .from("users")
      .update({ roles: [...currentRoles, "club_organizer"] as ("user" | "admin" | "club_organizer")[] })
      .eq("id", user.id);
  }

  return NextResponse.json(club, { status: 201 });
}
