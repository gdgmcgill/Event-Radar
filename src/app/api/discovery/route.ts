import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DiscoveryQuery } from "@/contracts/discovery";
import { getDiscoveryAccess } from "@/lib/features";
import { parseQuery } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { discover } from "@/server/discovery/service";
import { InvalidCursor } from "@/server/discovery/cursor";
import { badRequest, notFound } from "@/server/errors";
import { withRoute } from "@/server/route";
export const GET = withRoute({ cache: "private", action: "load discovery" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = parseQuery(request.nextUrl.searchParams, DiscoveryQuery); if (!parsed.ok) return parsed.response;
  try { return NextResponse.json(await discover(ctx, parsed.data)); } catch (error) { if (error instanceof InvalidCursor) return badRequest("Invalid or expired cursor; restart this view"); throw error; }
});
