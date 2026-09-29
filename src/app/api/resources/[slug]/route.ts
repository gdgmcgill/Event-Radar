import { NextResponse, type NextRequest } from "next/server";
import { ResourceSlugParams } from "@/contracts/resources";
import { getDiscoveryAccess } from "@/lib/features";
import { parseWith } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { notFound } from "@/server/errors";
import { resourceBySlug } from "@/server/resources/service";
import { withRoute } from "@/server/route";

export const GET = withRoute({ cache: "private", action: "load resource" }, async (_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = parseWith(ResourceSlugParams, await params);
  if (!parsed.ok) return parsed.response;
  const item = await resourceBySlug(ctx, parsed.data.slug);
  return item ? NextResponse.json({ item }) : notFound("Resource not found");
});
