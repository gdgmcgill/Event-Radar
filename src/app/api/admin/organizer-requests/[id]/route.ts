import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { parseBody } from "@/server/body";
import { OrganizerRequestDecisionBody } from "@/contracts/admin";
import { logRouteError, withRoute } from "@/server/route";

export const PATCH = withRoute({ cache: "private", action: "review organizer request" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const parsed = await parseBody(request, OrganizerRequestDecisionBody);
  if (!parsed.ok) return parsed.response;
  const { status } = parsed.data;

  // Keep the admin-scoped preflight read; the transaction repeats its
  // pending check while holding the row lock.
  const supabase = ctx.supabase;

  const { data: orgRequest, error: fetchError } = await supabase
    .from("organizer_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !orgRequest) {
    return NextResponse.json(
      { error: "Organizer request not found" },
      { status: 404 }
    );
  }

  if (orgRequest.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been reviewed" },
      { status: 409 }
    );
  }

  // DI-62: decision, roles, membership, audit and notification are one
  // database transaction. A competing reviewer sees a conflict after the lock.
  const { data: outcome, error } = await getElevatedClient().rpc("review_organizer_request_atomic", {
    p_request_id: id,
    p_actor_id: user.id,
    p_status: status,
  });
  if (error) {
    logRouteError(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (outcome === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (outcome !== "ok") {
    return NextResponse.json(
      { error: "This request has already been reviewed" },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true });
});
