import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { requireClubRole } from "@/server/authz/requireClubRole";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB — banners are larger than logos

/**
 * POST /api/clubs/banner
 * Upload a club banner image. Owner-only.
 * Accepts FormData with "file" and "clubId" fields.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const clubId = formData.get("clubId") as string | null;

    if (!file || !clubId) {
      return NextResponse.json(
        { error: "File and clubId are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const gate = await requireClubRole(
      supabase,
      clubId,
      user.id,
      ["owner"],
      "Only the club owner can upload a banner"
    );
    if (!gate.ok) return gate.response;

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File must be JPEG, PNG, or WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be under 5MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "png";
    const path = `${clubId}/banner-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("club-logos")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload banner" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("club-logos").getPublicUrl(path);

    return NextResponse.json({ url: publicUrl }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to upload banner" },
      { status: 500 }
    );
  }
}
