/**
 * POST /api/profile/banner
 * Upload a new banner image for the authenticated user
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import type { NextRequest } from "next/server";
import { parseForm } from "@/server/body";
import { PROFILE_BANNER_UPLOAD, ProfileImageForm } from "@/contracts/users";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const POST = withRoute({ cache: "private", action: "upload banner" }, async (request: NextRequest) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    // "No file provided", then type, then size (8MB), with the route's texts.
    const parsed = await parseForm(request, ProfileImageForm, PROFILE_BANNER_UPLOAD);
    if (!parsed.ok) return parsed.response;
    const { file } = parsed.data;

    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filePath = `${user.id}/banner.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("banners")
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      log.error("Storage upload error", { error: uploadError });
      return NextResponse.json(
        { error: "Failed to upload banner" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("banners")
      .getPublicUrl(filePath);

    const bannerUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update the caller's own row on the cookie client: "Users can update own
    // profile" permits it, and banner_url and updated_at are in the F-006
    // column grant (DEC-49). A refused update returns no row, and .single()
    // turns that into the 500 below rather than a silent success.
    const { data: dbData, error: dbError } = await supabase
      .from("users")
      .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id")
      .single();

    if (dbError || !dbData) {
      log.error("Database update error", { error: dbError ?? "No rows updated" });
      return NextResponse.json(
        { error: "Failed to save banner URL" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, banner_url: bannerUrl },
      { status: 200 }
    );
  } catch (error) {
    log.error("Error uploading banner", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
