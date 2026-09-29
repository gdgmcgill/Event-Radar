import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { getDiscoveryAccess } from "@/lib/features";
import { parseWith } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { publicDetail } from "@/server/discovery/service";
import { notFound } from "@/server/errors";
import { withRoute } from "@/server/route";
export const GET = withRoute({ cache: "private", action: "load opportunity" }, async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = parseWith(DetailParams, await params); if (!parsed.ok) return parsed.response;
  const item = await publicDetail(ctx, "opportunity", parsed.data.id);
  return item ? NextResponse.json({ item }) : notFound("Opportunity not found");
});
