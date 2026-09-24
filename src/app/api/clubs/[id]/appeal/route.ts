import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getElevatedClient } from "@/server/db/elevated";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;

  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Appeal message is required" },
      { status: 400 }
    );
  }

  // The club read ("Anyone can read clubs") and the appeal review ("Creators
  // can appeal their items") run on the caller's cookie client (DEC-49). The
  // status reset, the admin lookup and the admin notifications go through the
  // elevated door.
  const supabase = ctx.supabase;

  const { data: club, error: fetchError } = await supabase
    .from("clubs")
    .select("id, name, created_by, status, appeal_count")
    .eq("id", id)
    .single();

  if (fetchError || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  if (club.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["rejected", "suspended"].includes(club.status)) {
    return NextResponse.json(
      { error: "Only rejected or suspended clubs can be appealed" },
      { status: 409 }
    );
  }

  const { error: reviewError } = await supabase
    .from("moderation_reviews")
    .insert({
      target_type: "club",
      target_id: id,
      action: "appeal",
      category: null,
      message: message.trim(),
      author_id: user.id,
    });

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  // clubs has no owner UPDATE policy (DEC-41). REGISTRY.md row: "Club appeal:
  // reset a rejected club to pending".
  const { data: updateData, error: updateError } = await getElevatedClient()
    .from("clubs")
    .update({
      status: "pending",
      appeal_count: (club.appeal_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", club.status)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updateData || updateData.length === 0) {
    return NextResponse.json({ error: "Appeal already processed" }, { status: 409 });
  }

  try {
    // users shows another user's row only to admins. REGISTRY.md row: "Read
    // another user's name for appeals and review listings".
    const { data: admins } = await getElevatedClient()
      .from("users")
      .select("id")
      .contains("roles", ["admin"]);

    if (admins && admins.length > 0) {
      // REGISTRY.md row: "Notify another user (notifications insert)".
      await getElevatedClient().from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: "club_appeal",
          title: "Club Appeal Submitted",
          message: `An appeal was submitted for club "${club.name}"`,
          club_id: id,
          read: false,
        }))
      );
    }
  } catch (notifErr) {
    console.error("[Appeal] Failed to send admin notifications:", notifErr);
  }

  return NextResponse.json({ success: true });
}
