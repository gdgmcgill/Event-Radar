import { NextRequest } from "next/server";
export const M2_ID = "ad080001-0000-4000-8000-000000000001";
const params = () => ({ params: Promise.resolve({ id: M2_ID }) });
/** `anonymousWrite`: a public intake write (M3 P1-09) that accepts anonymous
 * callers, so it has no active/onboarded gate; it is still a `write` arm of
 * the tree. */
export interface M2Arm { route: string; verb: string; admin?: boolean; active?: boolean; write?: boolean; anonymousWrite?: boolean; body?: unknown; query?: string; form?: boolean; invoke(request: NextRequest): Promise<Response>; }
/** Explicit descriptors; the legacy tree censuses combine these with their
 * preserved baseline descriptors. m2-route-boundaries.test.ts drives all arms. */
export const M2_ARMS: M2Arm[] = [
 { route: "events/[id]/save", verb: "PUT", active: true, write: true, invoke: async r => (await import("@/app/api/events/[id]/save/route")).PUT(r, params()) },
 { route: "universities", verb: "GET", invoke: async () => (await import("@/app/api/universities/route")).GET() },
 { route: "discovery", verb: "GET", query: "limit=0", invoke: async r => (await import("@/app/api/discovery/route")).GET(r) },
 { route: "saved", verb: "GET", active: true, query: "limit=0", invoke: async r => (await import("@/app/api/saved/route")).GET(r) },
 { route: "saved/status", verb: "GET", active: true, query: "identities=broken", invoke: async r => (await import("@/app/api/saved/status/route")).GET(r) },
 { route: "opportunities/[id]", verb: "GET", invoke: async r => (await import("@/app/api/opportunities/[id]/route")).GET(r, params()) },
 { route: "opportunities/[id]/save", verb: "PUT", active: true, write: true, invoke: async r => (await import("@/app/api/opportunities/[id]/save/route")).PUT(r, params()) },
 { route: "opportunities/[id]/save", verb: "DELETE", active: true, write: true, invoke: async r => (await import("@/app/api/opportunities/[id]/save/route")).DELETE(r, params()) },
 { route: "admin/opportunities", verb: "GET", admin: true, query: "limit=0", invoke: async r => (await import("@/app/api/admin/opportunities/route")).GET(r) },
 { route: "admin/opportunities", verb: "POST", admin: true, body: { slug: "test",listing_type: "job",title: "Test",description: "Description",organization: "Test",application_mode: "none" }, invoke: async r => (await import("@/app/api/admin/opportunities/route")).POST(r) },
 { route: "admin/opportunities/[id]", verb: "GET", admin: true, invoke: async r => (await import("@/app/api/admin/opportunities/[id]/route")).GET(r, params()) },
 { route: "admin/opportunities/[id]", verb: "PATCH", admin: true, body: { action: "archive",expected_updated_at: "2026-09-29T00:00:00Z" }, invoke: async r => (await import("@/app/api/admin/opportunities/[id]/route")).PATCH(r, params()) },
 { route: "admin/events/[id]/discovery", verb: "GET", admin: true, invoke: async r => (await import("@/app/api/admin/events/[id]/discovery/route")).GET(r, params()) },
 { route: "admin/events/[id]/discovery", verb: "PUT", admin: true, body: { expected_updated_at: null,data: {} }, invoke: async r => (await import("@/app/api/admin/events/[id]/discovery/route")).PUT(r, params()) },
 { route: "admin/events/[id]/discovery", verb: "PATCH", admin: true, body: { expected_updated_at: null,canonical: { kind: "opportunity",id: M2_ID },reason: "Verified duplicate" }, invoke: async r => (await import("@/app/api/admin/events/[id]/discovery/route")).PATCH(r, params()) },
 { route: "resources", verb: "GET", query: "limit=abc", invoke: async r => (await import("@/app/api/resources/route")).GET(r) },
 { route: "resources/[slug]", verb: "GET", invoke: async r => (await import("@/app/api/resources/[slug]/route")).GET(r, { params: Promise.resolve({ slug: M2_ID }) }) },
 { route: "resources/[slug]/open", verb: "GET", invoke: async r => (await import("@/app/api/resources/[slug]/open/route")).GET(r, { params: Promise.resolve({ slug: M2_ID }) }) },
 { route: "admin/resources", verb: "GET", admin: true, query: "limit=abc", invoke: async r => (await import("@/app/api/admin/resources/route")).GET(r) },
 { route: "admin/resources", verb: "POST", admin: true, body: { slug: "test-resource",resource_type: "template",title: "Test",summary: "Test",category: "career",audience: "Everyone",author_name: "Test" }, invoke: async r => (await import("@/app/api/admin/resources/route")).POST(r) },
 { route: "admin/resources/[id]", verb: "GET", admin: true, invoke: async r => (await import("@/app/api/admin/resources/[id]/route")).GET(r, params()) },
 { route: "admin/resources/[id]", verb: "PATCH", admin: true, body: { action: "archive",expected_updated_at: "2026-09-29T00:00:00Z" }, invoke: async r => (await import("@/app/api/admin/resources/[id]/route")).PATCH(r, params()) },
 { route: "admin/resources/[id]/file", verb: "POST", admin: true, form: true, invoke: async r => (await import("@/app/api/admin/resources/[id]/file/route")).POST(r, params()) },
 { route: "submissions", verb: "POST", write: true, anonymousWrite: true, body: { kind: "job",title: "Test",organization: "Test",source_url: "https://example.org/test",description: "Test" }, invoke: async r => (await import("@/app/api/submissions/route")).POST(r) },
 { route: "company-requests", verb: "POST", write: true, anonymousWrite: true, body: { company_name: "Test",company_context: "Test",role_title: "Test",duties: "Test",must_have_skills: "Test",hours: "10",compensation: "Paid",location: "Montréal",work_mode: "remote",start_date: "Soon",employment_type: "internship",why_worth_it: "Test",contact_name: "Test",contact_email: "test@example.org" }, invoke: async r => (await import("@/app/api/company-requests/route")).POST(r) },
 { route: "listing-reports", verb: "POST", write: true, anonymousWrite: true, body: { kind: "event",id: M2_ID,reason: "other" }, invoke: async r => (await import("@/app/api/listing-reports/route")).POST(r) },
 { route: "admin/submissions", verb: "GET", admin: true, query: "limit=abc", invoke: async r => (await import("@/app/api/admin/submissions/route")).GET(r) },
 { route: "admin/submissions/[id]", verb: "GET", admin: true, invoke: async r => (await import("@/app/api/admin/submissions/[id]/route")).GET(r, params()) },
 { route: "admin/submissions/[id]", verb: "PATCH", admin: true, body: { action: "spam",expected_updated_at: "2026-09-29T00:00:00Z" }, invoke: async r => (await import("@/app/api/admin/submissions/[id]/route")).PATCH(r, params()) },
 { route: "admin/listing-reports", verb: "GET", admin: true, query: "limit=abc", invoke: async r => (await import("@/app/api/admin/listing-reports/route")).GET(r) },
 { route: "admin/listing-reports/[id]", verb: "PATCH", admin: true, body: { action: "dismiss" }, invoke: async r => (await import("@/app/api/admin/listing-reports/[id]/route")).PATCH(r, params()) },
];
export const m2ArmIds = (prefix = "") => M2_ARMS.map(a => `${prefix}${a.route} ${a.verb}`);
/** A valid multipart body for a `form: true` arm: one signed PDF field plus
 * the version field the route reads. Malformed-input coverage for this shape
 * lives in resources.test.ts, not the generic JSON-body table below. */
function m2FormBody(): FormData {
 const form = new FormData();
 form.append("file", new File([new Uint8Array([0x25,0x50,0x44,0x46,0x2d,1,2,3])], "x.pdf", { type: "application/pdf" }));
 form.append("expected_updated_at", "2026-09-29T00:00:00Z");
 return form;
}
export function m2Request(arm: M2Arm, invalid = false): NextRequest {
 const query = invalid ? arm.query : arm.route === "saved/status" ? `identities=event:${M2_ID}` : undefined;
 return new NextRequest(`http://localhost/api/${arm.route.replace("[id]",M2_ID)}${query ? `?${query}` : ""}`, {
  method: arm.verb,
  ...(arm.form ? { body: m2FormBody() } : arm.body ? { body: invalid ? "{" : JSON.stringify(arm.body),headers: { "content-type": "application/json" } } : {}),
 });
}
