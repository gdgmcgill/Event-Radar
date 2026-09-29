import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";
import type { RequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { getElevatedClient } from "@/server/db/elevated";

/** M3 P1-09 public intake through the elevated door. The RPCs have no status
 * or editorial parameter: every submission starts pending and every report
 * open. The client hash is the salted quota key; the raw address never
 * leaves the request. */

export type SubmitIntakeInput = {
  kind: "event" | "hackathon" | "job" | "program" | "resource" | "company_request";
  title: string;
  organization: string;
  source_url: string | null;
  details: Record<string, string>;
  contact_name: string | null;
  contact_email: string | null;
  user_id: string | null;
  client_hash: string;
};

export type ReportListingInput = {
  kind: "event" | "opportunity" | "resource";
  id: string;
  reason: "wrong_date" | "dead_link" | "scam" | "duplicate" | "other";
  details: string | null;
  user_id: string | null;
  client_hash: string;
};

export async function submitIntake(input: SubmitIntakeInput): Promise<"ok" | "quota" | "forbidden"> {
  const { error } = await getElevatedClient().rpc("intake_submission", {
    p_kind: input.kind,
    p_title: input.title,
    p_organization: input.organization,
    p_source_url: input.source_url ?? null!,
    p_details: input.details as Json,
    p_contact_name: input.contact_name ?? null!,
    p_contact_email: input.contact_email ?? null!,
    p_user: input.user_id ?? null!,
    p_client_hash: input.client_hash,
  });
  if (!error) return "ok";
  if (error.code === "UV429") return "quota";
  if (error.code === "42501") return "forbidden";
  throw error;
}

export async function reportListing(input: ReportListingInput): Promise<"ok" | "quota" | "not_found"> {
  const { error } = await getElevatedClient().rpc("intake_listing_report", {
    p_kind: input.kind,
    p_id: input.id,
    p_reason: input.reason,
    p_details: input.details ?? null!,
    p_user: input.user_id ?? null!,
    p_client_hash: input.client_hash,
  });
  if (!error) return "ok";
  if (error.code === "UV429") return "quota";
  if (error.code === "P0002") return "not_found";
  throw error;
}

/** Anonymous intake is allowed; a user id is attached only for an active
 * (signed-in, profiled, not suspended) caller. */
export function intakeUserId(ctx: Pick<RequestContext, "user" | "profile">): string | null {
  const active = requireActiveUser(ctx);
  return active.ok ? active.user.id : null;
}

/** The one accepted-response shape: it never echoes any submitted field. */
export function intakeReceived(): NextResponse {
  return NextResponse.json({ received: true }, { status: 202 });
}

export function intakeQuotaExceeded(): NextResponse {
  return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
}
