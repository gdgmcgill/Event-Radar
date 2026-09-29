import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { OpportunityMutationBody } from "@/contracts/opportunities";
import { parseBody, parseWith } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { adminContext, adminOpportunity, mutationError } from "@/server/opportunities/admin";
import { notFound } from "@/server/errors";
import { withRoute } from "@/server/route";
type RouteContext = { params: Promise<{ id: string }> };
export const GET = withRoute({ cache: "private", action: "load editorial listing" }, async (_request: NextRequest, { params }: RouteContext) => {
 const auth = await adminContext(); if (!auth.ok) return auth.response;
 const parsed = parseWith(DetailParams, await params); if (!parsed.ok) return parsed.response;
 const result = await adminOpportunity(parsed.data.id);
 return result ? NextResponse.json({ ...result, can_assign_pick: auth.canPick }) : notFound("Opportunity not found");
});
export const PATCH = withRoute({ cache: "private", action: "update editorial listing" }, async (request: NextRequest, { params }: RouteContext) => {
 const auth = await adminContext(); if (!auth.ok) return auth.response;
 const id = parseWith(DetailParams, await params); if (!id.ok) return id.response;
 const parsed = await parseBody(request, OpportunityMutationBody); if (!parsed.ok) return parsed.response;
 const body = parsed.data;
 const payload = body.action === "edit" ? body.data : body.action === "merge" ? { canonical: body.canonical, reason: body.reason } : {};
 const { error } = await getElevatedClient().rpc("curate_opportunity", { p_actor: auth.user.id, p_id: id.data.id, p_action: body.action, p_data: payload, p_expected: body.expected_updated_at, p_can_pick: auth.canPick });
 if (error) return mutationError(error);
 return NextResponse.json(await adminOpportunity(id.data.id));
});
