import { NextResponse, type NextRequest } from "next/server";
import { OpportunityAdminQuery, OpportunityCreateBody } from "@/contracts/opportunities";
import { parseBody, parseQuery } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { adminContext, adminOpportunity, mutationError } from "@/server/opportunities/admin";
import { withRoute } from "@/server/route";
export const GET = withRoute({ cache: "private", action: "load editorial listings" }, async (request: NextRequest) => {
 const auth = await adminContext(); if (!auth.ok) return auth.response;
 const parsed = parseQuery(request.nextUrl.searchParams, OpportunityAdminQuery); if (!parsed.ok) return parsed.response;
 let query = getElevatedClient().from("opportunities").select("*,opportunity_universities(university_id)").is("deleted_at", null).order("updated_at", { ascending: false }).order("id").limit(parsed.data.limit);
 if (parsed.data.status) query = query.eq("status", parsed.data.status);
 const { data, error } = await query; if (error) throw error;
 return NextResponse.json({ items: (data ?? []).map(({ opportunity_universities, ...item }) => ({ ...item, university_ids: opportunity_universities.map((row) => row.university_id) })), can_assign_pick: auth.canPick });
});
export const POST = withRoute({ cache: "private", action: "create editorial listing" }, async (request: NextRequest) => {
 const auth = await adminContext(); if (!auth.ok) return auth.response;
 const parsed = await parseBody(request, OpportunityCreateBody); if (!parsed.ok) return parsed.response;
 const { data, error } = await getElevatedClient().rpc("curate_opportunity", { p_actor: auth.user.id, p_id: null!, p_action: "create", p_data: parsed.data, p_can_pick: auth.canPick });
 if (error) return mutationError(error);
 const id = (data as { id: string }).id;
 return NextResponse.json(await adminOpportunity(id), { status: 201 });
});
