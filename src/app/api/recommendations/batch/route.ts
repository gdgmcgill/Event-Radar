import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyAdmin } from "@/lib/admin";

export async function POST() {
  try {
    // Protected: only admins can manually trigger batch scoring
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

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
