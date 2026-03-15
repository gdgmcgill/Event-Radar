import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only owner can change roles
  const { data: currentMember } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!currentMember || currentMember.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can change roles" }, { status: 403 });
  }

  const { memberId, role } = await request.json();

  if (!memberId || role !== "organizer") {
    return NextResponse.json({ error: "Invalid request. Role must be 'organizer'." }, { status: 400 });
  }

  // Cannot change own role
  const { data: targetMember } = await supabase
    .from("club_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  if (targetMember.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role. Use transfer ownership instead." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("club_members")
    .update({ role })
    .eq("id", memberId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ member: updated });
}
