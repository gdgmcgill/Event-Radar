import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { requireClubRole } from "@/server/authz/requireClubRole";
import { checkFile, parseForm } from "@/server/body";
import { CLUB_BANNER_UPLOAD, ClubImageForm } from "@/contracts/clubs";

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

    // "File and clubId are required" for a missing file or clubId. The type
    // and size checks wait for the ownership gate (deferFileChecks).
    const parsed = await parseForm(request, ClubImageForm, CLUB_BANNER_UPLOAD);
    if (!parsed.ok) return parsed.response;
    const { file } = parsed.data;
    const { clubId } = parsed.data.fields;

    // Verify ownership
    const gate = await requireClubRole(
      supabase,
      clubId,
      user.id,
      ["owner"],
      "Only the club owner can upload a banner"
    );
    if (!gate.ok) return gate.response;

    // Type, then size, with the route's texts.
    const refused = checkFile(file, CLUB_BANNER_UPLOAD.file);
    if (refused) return refused;

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
