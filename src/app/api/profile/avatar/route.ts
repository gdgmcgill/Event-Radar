/**
 * POST /api/profile/avatar
 * Upload a new avatar image for the authenticated user
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import type { NextRequest } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Determine file extension from MIME type
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filePath = `${user.id}/avatar.${ext}`;

    // Upload to Supabase Storage (upsert to overwrite previous avatar)
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Add cache-busting timestamp to prevent stale avatars
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update the caller's own row on the cookie client: "Users can update own
    // profile" permits it, and avatar_url and updated_at are in the F-006
    // column grant (DEC-49). A refused update returns no row, and .single()
    // turns that into the 500 below rather than a silent success.
    const { data: dbData, error: dbError } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id")
      .single();

    if (dbError || !dbData) {
      console.error("Database update error:", dbError ?? "No rows updated");
      return NextResponse.json(
        { error: "Failed to save avatar URL" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, avatar_url: avatarUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
