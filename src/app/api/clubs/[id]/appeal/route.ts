import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Appeal message is required" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: club, error: fetchError } = await serviceClient
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

  if (club.status !== "rejected") {
    return NextResponse.json(
      { error: "Only rejected clubs can be appealed" },
      { status: 409 }
    );
  }

  const { error: reviewError } = await serviceClient
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

  const { error: updateError } = await serviceClient
    .from("clubs")
    .update({
      status: "pending",
      appeal_count: (club.appeal_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    const { data: admins } = await serviceClient
      .from("users")
      .select("id")
      .contains("roles", ["admin"]);

    if (admins && admins.length > 0) {
      await serviceClient.from("notifications").insert(
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
