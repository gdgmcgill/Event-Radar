import type { NextRequest } from "next/server";
import { SUBMISSION_FIELDS, SubmissionBody, toIntakeDetails } from "@/contracts/intake";
import { getDiscoveryAccess } from "@/lib/features";
import { parseBody } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { forbidden, notFound } from "@/server/errors";
import { intakeClientHash, intakeQuotaExceeded, intakeReceived, intakeTooLong, intakeUserId, submitIntake } from "@/server/intake/service";
import { withRoute } from "@/server/route";

export const POST = withRoute({ cache: "private", action: "submit listing" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
  const parsed = await parseBody(request, SubmissionBody, { fieldFor: SUBMISSION_FIELDS });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (body.website) return intakeReceived();
  const hash = intakeClientHash(request);
  if (!hash.ok) return hash.response;
  const result = await submitIntake({
    kind: body.kind,
    title: body.title,
    organization: body.organization,
    source_url: body.source_url,
    details: toIntakeDetails(body),
    contact_name: body.contact_name || null,
    contact_email: body.contact_email || null,
    user_id: intakeUserId(ctx),
    client_hash: hash.hash,
  });
  if (result === "quota") return intakeQuotaExceeded();
  if (result === "forbidden") return forbidden("Account suspended");
  if (result === "too_long") return intakeTooLong();
  return intakeReceived();
});
