import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { SubmissionReviewBody } from "@/contracts/intake";
import { parseBody, parseWith } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { notFound } from "@/server/errors";
import { getSubmission } from "@/server/intake/admin";
import { adminContext, mutationError } from "@/server/opportunities/admin";
import { withRoute } from "@/server/route";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRoute({ cache: "private", action: "load submission" }, async (_request: NextRequest, { params }: RouteContext) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const parsed = parseWith(DetailParams, await params);
  if (!parsed.ok) return parsed.response;
  const item = await getSubmission(parsed.data.id);
  return item ? NextResponse.json({ item }) : notFound("Submission not found");
});

/** Convert creates a DRAFT opportunity or resource; publication still goes
 * through the editor and its checks. A retried convert returns the same
 * target. The result never carries private contact fields. */
export const PATCH = withRoute({ cache: "private", action: "review submission" }, async (request: NextRequest, { params }: RouteContext) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const id = parseWith(DetailParams, await params);
  if (!id.ok) return id.response;
  const parsed = await parseBody(request, SubmissionReviewBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const { data, error } = await getElevatedClient().rpc("review_submission", {
    p_actor: auth.user.id,
    p_id: id.data.id,
    p_action: body.action,
    p_reason: ("reason" in body && body.reason) || null!,
    p_expected: body.expected_updated_at,
  });
  if (error) return mutationError(error);
  return NextResponse.json(data);
});
