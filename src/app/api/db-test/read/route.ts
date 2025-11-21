import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Read test clubs
    const { data, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("name", "DB Test Club" as any)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json({
        success: false,
        message: "❌ Failed to read from database",
        data: { error: error.message },
      });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: false,
        message: "❌ No test data found (write test may have failed)",
        data: { clubs: [] },
      });
    }

    return NextResponse.json({
      success: true,
      message: `✅ Successfully read ${data.length} test record(s) from database!`,
      data: {
        clubs: data,
        count: data.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "❌ Read operation failed",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

