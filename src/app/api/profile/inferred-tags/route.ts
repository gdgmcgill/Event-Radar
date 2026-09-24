import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import type { NextRequest } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

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

    const { error: updateError } = await supabase
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
