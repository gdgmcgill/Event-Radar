import { NextResponse, type NextRequest } from "next/server";
import { ResourceListQuery } from "@/contracts/resources";
import { getDiscoveryAccess } from "@/lib/features";
import { parseQuery } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { notFound } from "@/server/errors";
import { listResources } from "@/server/resources/service";
import { withRoute } from "@/server/route";

export const GET = withRoute({ cache: "private", action: "load resources" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = parseQuery(request.nextUrl.searchParams, ResourceListQuery);
  if (!parsed.ok) return parsed.response;
  const items = await listResources(ctx, parsed.data);
  return NextResponse.json({ items });
});
