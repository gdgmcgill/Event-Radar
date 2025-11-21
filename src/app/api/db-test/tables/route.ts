import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Check each table
    const tables = ["clubs", "users", "events", "saved_events"];
    const tableStatus: Record<string, boolean> = {};

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select("id")
        .limit(1);

      tableStatus[table] = !error;
    }

    const allTablesExist = Object.values(tableStatus).every((exists) => exists);

    if (!allTablesExist) {
      const missingTables = Object.entries(tableStatus)
        .filter(([_, exists]) => !exists)
        .map(([table]) => table);

      return NextResponse.json({
        success: false,
        message: `❌ Missing tables: ${missingTables.join(", ")}`,
        data: {
          tableStatus,
          missingTables,
          instruction: "Run the schema.sql file in your Supabase SQL Editor",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ All tables exist!",
      data: {
        tableStatus,
        tables,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "❌ Error checking tables",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

