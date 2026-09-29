import { NextResponse, type NextRequest } from "next/server";
import { SavedQuery } from "@/contracts/discovery";
import { getDiscoveryAccess } from "@/lib/features";
import { parseQuery } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { savedDiscovery } from "@/server/discovery/service";
import { InvalidCursor } from "@/server/discovery/cursor";
import { badRequest, notFound } from "@/server/errors";
import { withRoute } from "@/server/route";
export const GET = withRoute({ cache: "private", action: "load saved listings" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx); if (!active.ok) return active.response;
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = parseQuery(request.nextUrl.searchParams, SavedQuery); if (!parsed.ok) return parsed.response;
  try { return NextResponse.json(await savedDiscovery(ctx, parsed.data)); } catch (error) { if (error instanceof InvalidCursor) return badRequest("Invalid or expired cursor; restart this view"); throw error; }
});
