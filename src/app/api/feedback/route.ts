import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { parseBody } from "@/server/body";
import { FeedbackBody } from "@/contracts/feedback";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const POST = withRoute({ cache: "private", action: "save feedback" }, async (request: Request) => {
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

    // Today's two 400s in today's order (message, then type); a non-object
    // body or a non-string subject answers 400 instead of 500 (F-094).
    const parsed = await parseBody(request, FeedbackBody);
    if (!parsed.ok) return parsed.response;
    const { type, subject, message } = parsed.data;

    const { error } = await supabase.from("feedback").insert({
      type: type || "general",
      subject: subject?.trim() || null,
      message: message.trim(),
      user_id: user?.id || null,
      user_email: user?.email || null,
    });

    if (error) {
      log.error("Failed to save feedback", { error });
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Feedback API error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
