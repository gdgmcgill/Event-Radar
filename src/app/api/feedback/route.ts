import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";

export async function POST(request: Request) {
  try {
    // Anonymous feedback stays open (DEC-34): the guards apply only when a
    // user is present.
    const ctx = await createRequestContext();
    if (ctx.user) {
      const active = requireActiveUser(ctx);
      if (!active.ok) return active.response;
      const onboarded = requireOnboarded(ctx);
      if (!onboarded.ok) return onboarded.response;
    }
    const user = ctx.user;
    const supabase = ctx.supabase;

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

    const { error } = await supabase.from("feedback").insert({
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
