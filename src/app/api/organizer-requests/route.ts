import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { parseBody } from "@/server/body";
import { OrganizerRequestBody } from "@/contracts/clubs";

export async function POST(request: NextRequest) {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;
  const supabase = ctx.supabase;

  // club_id is required (its existence is the lookup below); message as sent.
  const parsed = await parseBody(request, OrganizerRequestBody);
  if (!parsed.ok) return parsed.response;
  const { club_id, message } = parsed.data;

  // Verify the club exists
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id")
    .eq("id", club_id)
    .single();

  if (clubError || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("organizer_requests")
    .insert({
      user_id: user.id,
      club_id,
      message: message || null,
    })
    .select("*, club:clubs(*), user:users(*)")
    .single();

  if (error) {
    // Unique constraint violation means duplicate request
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You already have a pending request for this club" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("organizer_requests")
    .select("*, club:clubs(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data });
}
