/**
 * POST /api/clubs/:id/invites — Create an invitation for a McGill email
 * DELETE /api/clubs/:id/invites — Revoke a pending invitation (owner only)
 * Requires: owner role for this club
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMcGillEmail } from "@/lib/utils";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    // Verify authenticated user
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

    // Verify the caller is an owner of this club
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .single();

    if (!membership || membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only the club owner can send invitations" },
        { status: 403 }
      );
    }

    // Parse and validate the invitee email from request body
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate it is a McGill email
    if (!isMcGillEmail(email)) {
      return NextResponse.json(
        { error: "Only McGill email addresses can be invited" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Verify the invitee has a Uni-Verse account (exists in users table)
    const { data: invitee } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (!invitee) {
      return NextResponse.json(
        { error: "No Uni-Verse account found for this email address" },
        { status: 400 }
      );
    }

    // Check the invitee is not already a member of this club
    const { data: existingMember } = await supabase
      .from("club_members")
      .select("id")
      .eq("user_id", invitee.id)
      .eq("club_id", clubId)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "This person is already a member of the club" },
        { status: 400 }
      );
    }

    // Check for existing pending invitation (avoid duplicates)
    const { data: existingInvite } = await supabase
      .from("club_invitations")
      .select("id")
      .eq("club_id", clubId)
      .eq("invitee_email", normalizedEmail)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 400 }
      );
    }

    // Insert the invitation
    // Note: role does NOT exist in club_invitations table — hardcoded organizer role is applied on acceptance
    // token and expires_at have DB defaults (gen_random_uuid() and now() + 7 days)
    const { data: invite, error: insertError } = await supabase
      .from("club_invitations")
      .insert({
        club_id: clubId,
        inviter_id: user.id,
        invitee_email: normalizedEmail,
      })
      .select("token")
      .single();

    if (insertError || !invite) {
      console.error("Error creating invitation:", insertError);
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Return token only — URL construction is client-side
    return NextResponse.json({ token: invite.token }, { status: 201 });
  } catch (error) {
    console.error("Error in POST club invite:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
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

    // Verify caller is owner
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .single();

    if (!membership || membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only the club owner can revoke invitations" },
        { status: 403 }
      );
    }

    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "Invite ID is required" },
        { status: 400 }
      );
    }

    // Update status to 'revoked' — preserves invitation history
    const { error: updateError } = await supabase
      .from("club_invitations")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .eq("club_id", clubId)
      .eq("status", "pending");

    if (updateError) {
      console.error("Error revoking invitation:", updateError);
      return NextResponse.json(
        { error: "Failed to revoke invitation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Invitation revoked" });
  } catch (error) {
    console.error("Error in DELETE club invite:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
