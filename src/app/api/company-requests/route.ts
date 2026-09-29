import type { NextRequest } from "next/server";
import { CompanyRequestBody, toIntakeDetails } from "@/contracts/intake";
import { getDiscoveryAccess } from "@/lib/features";
import { parseBody } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { forbidden, notFound } from "@/server/errors";
import { clientHash } from "@/server/intake/clientHash";
import { intakeQuotaExceeded, intakeReceived, intakeUserId, submitIntake } from "@/server/intake/service";
import { withRoute } from "@/server/route";

/** A hiring request never creates an account, a company page, a role or
 * applicant access: it is a pending submission an editor may convert into a
 * draft job listing. */
export const POST = withRoute({ cache: "private", action: "submit hiring request" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = await parseBody(request, CompanyRequestBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (body.website) return intakeReceived();
  const result = await submitIntake({
    kind: "company_request",
    title: body.role_title,
    organization: body.company_name,
    source_url: body.source_url ?? null,
    details: toIntakeDetails(body),
    contact_name: body.contact_name,
    contact_email: body.contact_email,
    user_id: intakeUserId(ctx),
    client_hash: clientHash(request),
  });
  if (result === "quota") return intakeQuotaExceeded();
  if (result === "forbidden") return forbidden("Account suspended");
  return intakeReceived();
});
