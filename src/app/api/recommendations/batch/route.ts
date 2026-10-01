import { NextResponse } from "next/server";
import { getElevatedClient } from "@/server/db/elevated";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const POST = withRoute({ cache: "private", action: "run batch scoring" }, async () => {
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
      log.error("Batch scoring error", { error });
      return NextResponse.json(
        { error: "Batch scoring failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Batch scoring completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Batch trigger error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
