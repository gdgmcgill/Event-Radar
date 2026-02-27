import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { type, subject, message } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const validTypes = ["bug", "feature", "general"];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid feedback type" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user if authenticated (feedback can be anonymous)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await (supabase as any).from("feedback").insert({
      type: type || "general",
      subject: subject?.trim() || null,
      message: message.trim(),
      user_id: user?.id || null,
      user_email: user?.email || null,
    });

    if (error) {
      console.error("Failed to save feedback:", error);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
