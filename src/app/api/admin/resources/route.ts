import { NextResponse, type NextRequest } from "next/server";
import { ResourceAdminQuery, ResourceCreateBody } from "@/contracts/resources";
import { parseBody, parseQuery } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { adminContext, mutationError } from "@/server/opportunities/admin";
import { adminResource, listAdminResources } from "@/server/resources/admin";
import { withRoute } from "@/server/route";

export const GET = withRoute({ cache: "private", action: "load resources for editing" }, async (request: NextRequest) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const parsed = parseQuery(request.nextUrl.searchParams, ResourceAdminQuery);
  if (!parsed.ok) return parsed.response;
  const items = await listAdminResources(parsed.data);
  return NextResponse.json({ items });
});

export const POST = withRoute({ cache: "private", action: "create resource" }, async (request: NextRequest) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(request, ResourceCreateBody);
  if (!parsed.ok) return parsed.response;
  const { data, error } = await getElevatedClient().rpc("curate_resource", {
    p_actor: auth.user.id,
    p_id: null!,
    p_action: "create",
    p_data: parsed.data,
  });
  if (error) return mutationError(error);
  const id = (data as { id: string }).id;
  return NextResponse.json({ item: await adminResource(id) }, { status: 201 });
});
