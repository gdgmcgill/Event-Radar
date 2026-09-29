import { NextResponse, type NextRequest } from "next/server";
import { ResourceSlugParams } from "@/contracts/resources";
import { getDiscoveryAccess } from "@/lib/features";
import { parseWith } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { notFound } from "@/server/errors";
import { resourceOpenTarget } from "@/server/resources/service";
import { withRoute } from "@/server/route";

export const GET = withRoute({ cache: "private", action: "open resource" }, async (_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = parseWith(ResourceSlugParams, await params);
  if (!parsed.ok) return parsed.response;
  const target = await resourceOpenTarget(ctx, parsed.data.slug);
  if (!target) return notFound("Resource not found");
  return NextResponse.redirect(target.url, 302);
});
