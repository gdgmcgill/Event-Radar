import { NextResponse } from "next/server";
import { getElevatedClient } from "@/server/db/elevated";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";

export async function POST() {
  try {
    // Protected: only admins can manually trigger batch scoring
    const ctx = await createRequestContext();
    const activeUser = requireActiveUser(ctx);
    if (!activeUser.ok) return activeUser.response;
    const auth = requireRole(ctx, "admin");
    if (!auth.ok) return auth.response;

    // A privileged batch write over every user's scores. REGISTRY.md row:
    // "Batch score computation (rpc compute_user_scores)".
    const supabase = getElevatedClient();

    const { error } = await supabase.rpc("compute_user_scores");

    if (error) {
      console.error("Batch scoring error:", error);
      return NextResponse.json(
        { error: "Batch scoring failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Batch scoring completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Batch trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
