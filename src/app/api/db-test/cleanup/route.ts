import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createClient();

    // Delete all test clubs
    const { data, error } = await supabase
      .from("clubs")
      .delete()
      .eq("name", "DB Test Club")
      .select();

    if (error) {
      return NextResponse.json({
        success: false,
        message: "❌ Failed to cleanup test data",
        data: { error: error.message },
      });
    }

    return NextResponse.json({
      success: true,
      message: `✅ Successfully cleaned up ${data?.length || 0} test record(s)!`,
      data: {
        deletedCount: data?.length || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "❌ Cleanup operation failed",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

