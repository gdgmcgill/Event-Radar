import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * POST /api/clubs/logo
 * Upload a club logo. Owner-only.
 * Accepts FormData with "file" and "clubId" fields.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .eq("role", "owner")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "Only the club owner can upload a logo" },
        { status: 403 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File must be JPEG, PNG, or WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be under 2MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "png";
    const path = `${clubId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("club-logos")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload logo" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("club-logos").getPublicUrl(path);

    return NextResponse.json({ url: publicUrl }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}
