import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";
import type { NextRequest } from "next/server";
import type { RequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { getElevatedClient } from "@/server/db/elevated";
import { log } from "@/server/log";
import { IntakeNotConfigured, clientHash } from "./clientHash";

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

export async function submitIntake(input: SubmitIntakeInput): Promise<"ok" | "quota" | "forbidden" | "too_long"> {
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
  // The contracts cap the serialized details in UTF-8 bytes below the
  // database's size check; this is the backstop so a violation is a 400.
  if (error.code === "23514") return "too_long";
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

export function intakeTooLong(): NextResponse {
  return NextResponse.json({ error: "Submission is too long." }, { status: 400 });
}

/** The salted client hash, or a private 503 (no DB call) when a hosted deploy
 * has no INTAKE_HASH_SECRET. */
export function intakeClientHash(request: NextRequest): { ok: true; hash: string } | { ok: false; response: NextResponse } {
  try {
    return { ok: true, hash: clientHash(request) };
  } catch (error) {
    if (!(error instanceof IntakeNotConfigured)) throw error;
    log.error("intake hash secret not configured", { scope: "intake" });
    return { ok: false, response: NextResponse.json({ error: "Submissions are temporarily unavailable." }, { status: 503 }) };
  }
}
