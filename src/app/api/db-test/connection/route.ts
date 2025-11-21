import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Simple query to test connection
    const { data, error } = await supabase
      .from("clubs")
      .select("count")
      .limit(1);

    if (error) {
      // Check if it's a "table doesn't exist" error
      if (error.message.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({
          success: false,
          message: "✅ Connected to Supabase, but tables don't exist yet. Run schema.sql first!",
          data: {
            error: error.message,
            hint: "Go to Supabase Dashboard → SQL Editor and run the schema.sql file",
          },
        });
      }

      return NextResponse.json({
        success: false,
        message: "❌ Database query failed",
        data: { error: error.message },
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ Successfully connected to Supabase!",
      data: {
        connected: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "❌ Failed to connect to Supabase",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
        hint: "Check your .env.local file and make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set",
      },
    });
  }
}

