import { NextResponse, type NextRequest } from "next/server";
import { SavedStatusQuery } from "@/contracts/discovery";
import { getDiscoveryAccess } from "@/lib/features";
import { parseQuery } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { notFound } from "@/server/errors";
import { withRoute } from "@/server/route";
export const GET = withRoute({ cache: "private", action: "load saved status" }, async (request: NextRequest) => {
 const ctx = await createRequestContext(); const active = requireActiveUser(ctx); if (!active.ok) return active.response;
 if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
 const parsed = parseQuery(request.nextUrl.searchParams, SavedStatusQuery); if (!parsed.ok) return parsed.response;
 const saved: { kind: "event" | "opportunity"; id: string }[] = [];
 const eventIds = parsed.data.identities.filter((x) => x.kind === "event").map((x) => x.id);
 const opportunityIds = parsed.data.identities.filter((x) => x.kind === "opportunity").map((x) => x.id);
 if (eventIds.length) { const { data, error } = await ctx.supabase.from("saved_events").select("event_id").eq("user_id", active.user.id).in("event_id", eventIds); if (error) throw error; for (const row of data ?? []) if (row.event_id) saved.push({ kind: "event", id: row.event_id }); }
 if (opportunityIds.length) { const { data, error } = await ctx.supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", active.user.id).in("opportunity_id", opportunityIds); if (error) throw error; for (const row of data ?? []) saved.push({ kind: "opportunity", id: row.opportunity_id }); }
 return NextResponse.json({ saved });
});
