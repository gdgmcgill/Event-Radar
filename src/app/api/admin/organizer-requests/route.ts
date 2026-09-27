import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { readQuery } from "@/server/body";
import { OrganizerRequestsQuery } from "@/contracts/admin";
import { withRoute } from "@/server/route";

export const GET = withRoute({ cache: "private", action: "fetch organizer requests" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  const { status, limit, offset } = readQuery(
    request.nextUrl.searchParams,
    OrganizerRequestsQuery
  );

  let query = supabase
    .from("organizer_requests")
    .select("*, club:clubs(*), user:users(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== "all") {
    query = query.eq("status", status as "pending" | "approved" | "rejected");
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ requests: data, total: count ?? 0 });
});
