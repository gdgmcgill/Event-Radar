import type { NextRequest } from "next/server";
import { ListingReportBody } from "@/contracts/intake";
import { getDiscoveryAccess } from "@/lib/features";
import { parseBody } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { notFound } from "@/server/errors";
import { clientHash } from "@/server/intake/clientHash";
import { intakeQuotaExceeded, intakeReceived, intakeUserId, reportListing } from "@/server/intake/service";
import { withRoute } from "@/server/route";

export const POST = withRoute({ cache: "private", action: "report listing" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = await parseBody(request, ListingReportBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (body.website) return intakeReceived();
  const result = await reportListing({
    kind: body.kind,
    id: body.id,
    reason: body.reason,
    details: body.details || null,
    user_id: intakeUserId(ctx),
    client_hash: clientHash(request),
  });
  if (result === "quota") return intakeQuotaExceeded();
  if (result === "not_found") return notFound("Listing not found");
  return intakeReceived();
});
