import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tag } = await request.json();

    if (!tag || typeof tag !== "string") {
      return NextResponse.json(
        { error: "tag is required and must be a string" },
        { status: 400 }
      );
    }

    // Fetch current inferred_tags
    const { data: profile } = await supabase
      .from("users")
      .select("inferred_tags")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currentTags: string[] = (profile as any).inferred_tags ?? [];
    const updatedTags = currentTags.filter((t) => t !== tag);

    const { error: updateError } = await (supabase as any)
      .from("users")
      .update({ inferred_tags: updatedTags, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to remove inferred tag:", updateError);
      return NextResponse.json(
        { error: "Failed to remove tag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, inferred_tags: updatedTags });
  } catch (error) {
    console.error("Error removing inferred tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
