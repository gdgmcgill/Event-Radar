import { createClient } from "@/lib/supabase/server";
import { getElevatedClient } from "@/server/db/elevated";
import { hasUnsafeUrlScheme, sanitizeText } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { readJsonObject } from "@/server/body";

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
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;

  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const { contact_email, logo_url, instagram_handle, website_url, discord_url, twitter_url, linkedin_url } = body;

  // The optional text fields reach an elevated insert: each must be a string
  // when present, and a link may not carry a non-http(s) scheme such as
  // `javascript:` (REVIEW-05 WR-09). A value that does not parse as a URL at
  // all is still accepted, as before: the create form's inputs are free text
  // and a browser can only resolve such a value as a relative link.
  const optionalText = {
    logo_url,
    instagram_handle,
    website_url,
    discord_url,
    twitter_url,
    linkedin_url,
  } as const;
  for (const [field, value] of Object.entries(optionalText)) {
    if (value !== undefined && value !== null && typeof value !== "string") {
      return NextResponse.json(
        { error: `Invalid value for ${field}`, field },
        { status: 400 }
      );
    }
    if (
      field !== "instagram_handle" &&
      typeof value === "string" &&
      hasUnsafeUrlScheme(value.trim())
    ) {
      return NextResponse.json(
        { error: `Invalid URL for ${field}` },
        { status: 400 }
      );
    }
  }

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

  // The duplicate-name read ("Anyone can read clubs") and the caller's own
  // roles read ("Users can read own profile") run on the cookie client
  // (DEC-49). The club insert, the owner membership and the organizer role go
  // through the elevated door. REGISTRY.md row: "Create a club with its owner
  // membership and the creator's organizer role".
  const supabase = ctx.supabase;
  const elevated = getElevatedClient();

  // Check for duplicate club name (case-insensitive, non-rejected clubs only)
  const { data: existingClub } = await supabase
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
  const { data: club, error: clubError } = await elevated
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
  await elevated
    .from("club_members")
    .insert({ user_id: user.id, club_id: club.id, role: "owner" });

  // 3. Add club_organizer role if not already present
  const { data: profile } = await supabase
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const currentRoles = (profile?.roles as ("user" | "admin" | "club_organizer")[]) || ["user"];
  if (!currentRoles.includes("club_organizer")) {
    await elevated
      .from("users")
      .update({ roles: [...currentRoles, "club_organizer"] as ("user" | "admin" | "club_organizer")[] })
      .eq("id", user.id);
  }

  return NextResponse.json(club, { status: 201 });
}
