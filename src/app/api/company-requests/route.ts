import type { NextRequest } from "next/server";
import { COMPANY_REQUEST_FIELDS, CompanyRequestBody, toIntakeDetails } from "@/contracts/intake";
import { getDiscoveryAccess } from "@/lib/features";
import { parseBody } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { forbidden, notFound } from "@/server/errors";
import { intakeClientHash, intakeQuotaExceeded, intakeReceived, intakeTooLong, intakeUserId, submitIntake } from "@/server/intake/service";
import { withRoute } from "@/server/route";

/** A hiring request never creates an account, a company page, a role or
 * applicant access: it is a pending submission an editor may convert into a
 * draft job listing. */
export const POST = withRoute({ cache: "private", action: "submit hiring request" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = await parseBody(request, CompanyRequestBody, { fieldFor: COMPANY_REQUEST_FIELDS });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (body.website) return intakeReceived();
  const hash = intakeClientHash(request);
  if (!hash.ok) return hash.response;
  const result = await submitIntake({
    kind: "company_request",
    title: body.role_title,
    organization: body.company_name,
    source_url: body.source_url ?? null,
    details: toIntakeDetails(body),
    contact_name: body.contact_name,
    contact_email: body.contact_email,
    user_id: intakeUserId(ctx),
    client_hash: hash.hash,
  });
  if (result === "quota") return intakeQuotaExceeded();
  if (result === "forbidden") return forbidden("Account suspended");
  if (result === "too_long") return intakeTooLong();
  return intakeReceived();
});
