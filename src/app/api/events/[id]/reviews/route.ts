/** P1-03: immutable legacy review history, scoped to its author or an active
 * administrator. Public aggregates and new legacy rating writes are retired.
 */
import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { parseQuery } from "@/server/body";
import { LegacyReviewHistoryQuery } from "@/contracts/events";
import { withRoute } from "@/server/route";

interface RouteContext { params: Promise<{ id: string }> }

// Permanently retired, including when the separate future feedback switch is
// enabled. The migration also removes client write privileges and policies.
export const POST = withRoute({ cache: "private", action: "create legacy review" }, async (_request: Request, _context: RouteContext) => {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  return NextResponse.json({ error: "Legacy review submissions are closed" }, { status: 404 });
});

export const GET = withRoute({ cache: "private", action: "fetch legacy review history" }, async (request: Request, context: RouteContext) => {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const query = parseQuery(new URL(request.url).searchParams, LegacyReviewHistoryQuery);
  if (!query.ok) return query.response;
  const { id } = await context.params;
  const admin = ctx.profile?.roles?.includes("admin") === true;
  let history = ctx.supabase.from("reviews")
    .select("id,event_id,user_id,rating,comment,created_at")
    .eq("event_id", id);
  // The explicit subject condition is independent defense; RLS enforces the
  // same boundary even through the Data API. Event ownership grants nothing.
  if (!admin) history = history.eq("user_id", active.user.id);
  const { data, error } = await history.order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(query.data.offset, query.data.offset + query.data.limit - 1);
  if (error) throw error;
  return NextResponse.json({ reviews: data ?? [] });
});
