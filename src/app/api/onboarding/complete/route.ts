import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { withRoute } from "@/server/route";

export const POST = withRoute({ cache: "private", action: "complete onboarding" }, async () => {
  // Onboarding exemption (DEC-34, research C2): this is the step that
  // completes onboarding, so requireOnboarded is deliberately not called.
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;

  if (!ctx.profile?.onboarding_completed) {
    return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });
  }
  const cookieStore = await cookies();

  cookieStore.set("needs_onboarding", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Deletes the cookie
  });

  return NextResponse.json({ success: true });
});
