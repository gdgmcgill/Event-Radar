import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { readQuery } from "@/server/body";
import { AdminClubsQuery } from "@/contracts/admin";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "private", action: "fetch admin clubs" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  const { status } = readQuery(request.nextUrl.searchParams, AdminClubsQuery);

  let query = supabase
    .from("clubs")
    // DI-87: created_by references auth.users, so PostgREST cannot embed
    // public.users through it. Resolve the public profiles explicitly below.
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status as "pending" | "approved" | "rejected");
  }

  const { data, error, count } = await query;

  if (error) {
    log.error("Error fetching admin clubs", { error: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const creatorIds = [...new Set((data ?? []).map((club) => club.created_by).filter((id): id is string => Boolean(id)))];
  const creators = new Map<string, { name: string | null; email: string }>();
  if (creatorIds.length > 0) {
    const profiles = await supabase.from("users").select("id,name,email").in("id", creatorIds);
    if (profiles.error) {
      log.error("Error fetching admin club creators", { error: profiles.error });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    for (const profile of profiles.data ?? []) creators.set(profile.id, { name: profile.name, email: profile.email });
  }
  return NextResponse.json({
    clubs: (data ?? []).map((club) => ({ ...club, users: club.created_by ? creators.get(club.created_by) ?? null : null })),
    total: count ?? 0,
  });
});
