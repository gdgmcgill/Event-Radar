import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Create a test club
    const { data, error } = await supabase
      .from("clubs")
      .insert({
        name: "DB Test Club",
        description: "This is a test club created by the database test suite",
        instagram_handle: "@dbtestclub",
      } as any)
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        message: "❌ Failed to write to database",
        data: { error: error.message },
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ Successfully wrote test data to database!",
      data: {
        created: data,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "❌ Write operation failed",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

