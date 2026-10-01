import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { ResourceMutationBody } from "@/contracts/resources";
import { parseBody, parseWith } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { notFound } from "@/server/errors";
import { adminContext, mutationError } from "@/server/opportunities/admin";
import { adminResource } from "@/server/resources/admin";
import { withRoute } from "@/server/route";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRoute({ cache: "private", action: "load resource for editing" }, async (_request: NextRequest, { params }: RouteContext) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const parsed = parseWith(DetailParams, await params);
  if (!parsed.ok) return parsed.response;
  const item = await adminResource(parsed.data.id);
  return item ? NextResponse.json({ item }) : notFound("Resource not found");
});

export const PATCH = withRoute({ cache: "private", action: "update resource" }, async (request: NextRequest, { params }: RouteContext) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const id = parseWith(DetailParams, await params);
  if (!id.ok) return id.response;
  const parsed = await parseBody(request, ResourceMutationBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const payload = body.action === "edit" ? body.data : {};
  const { error } = await getElevatedClient().rpc("curate_resource", {
    p_actor: auth.user.id,
    p_id: id.data.id,
    p_action: body.action,
    p_data: payload,
    p_expected: body.expected_updated_at,
  });
  if (error) return mutationError(error);
  return NextResponse.json({ item: await adminResource(id.data.id) });
});
