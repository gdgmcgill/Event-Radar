import { createClient } from "@/lib/supabase/server";
import { isMcGillEmail } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/clubs/[id]/invites
 * Create an invitation for a McGill email. Owner-only.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is owner
    const { data: callerMembership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .eq("role", "owner")
      .maybeSingle();

    if (!callerMembership) {
      return NextResponse.json(
        { error: "Only the club owner can send invitations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isMcGillEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "Must be a McGill email" },
        { status: 400 }
      );
    }

    // Check if already a member (look up user by email, then check membership)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      const { data: existingMembership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("club_id", clubId)
        .maybeSingle();

      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member" },
          { status: 409 }
        );
      }
    }

    // Check for pending invite
    const { data: existingInvite } = await supabase
      .from("club_invitations")
      .select("id")
      .eq("club_id", clubId)
      .eq("invitee_email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json(
        { error: "An active invitation already exists for this email" },
        { status: 409 }
      );
    }

    // Create invitation (token and expires_at have DB defaults)
    const { data: invite, error } = await supabase
      .from("club_invitations")
      .insert({
        club_id: clubId,
        inviter_id: user.id,
        invitee_email: normalizedEmail,
      })
      .select("token")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invite: { token: invite.token } }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
