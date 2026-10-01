import { isEventDuplicateReviewRequired, EVENT_DUPLICATE_REVIEW_MESSAGE } from "@/server/discovery/eventDuplicate";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { parseBody } from "@/server/body";
import { EventEditsDecisionBody } from "@/contracts/admin";
import { logRouteError, withRoute } from "@/server/route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const PATCH = withRoute({ cache: "private", action: "review event edits" }, async (request: NextRequest, { params }: RouteParams) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await params;
  // The action, then a rejection's reason (src/contracts/admin.ts). "This
  // event has no pending edits" is a rule on the row and stays below.
  const parsed = await parseBody(request, EventEditsDecisionBody);
  if (!parsed.ok) return parsed.response;
  const { action, reason, expected_pending_edits } = parsed.data;

  // DI-68: the exact pending-edit object displayed by the client is the
  // concurrency token. The locked RPC applies only that version and commits
  // its whitelisted event update, notification and audit together.
  const { data: outcome, error } = await getElevatedClient().rpc("review_event_edits_atomic", {
    p_event_id: id,
    p_actor_id: user.id,
    p_action: action,
    p_expected_pending_edits: expected_pending_edits,
    p_reason: reason == null ? undefined : String(reason),
  });
  if (error) {
    if (isEventDuplicateReviewRequired(error)) return NextResponse.json({ error: EVENT_DUPLICATE_REVIEW_MESSAGE }, { status: 400 });
    logRouteError(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (outcome === "not_found") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (outcome === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (outcome !== "ok") {
    return NextResponse.json(
      { error: "Pending edits were modified concurrently. Please refresh and try again." },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true, message: action === "approve" ? "Edits approved" : "Edits rejected" });
});
