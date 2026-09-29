import { NextRequest } from "next/server";
export const M2_ID = "ad080001-0000-4000-8000-000000000001";
const params = () => ({ params: Promise.resolve({ id: M2_ID }) });
export interface M2Arm { route: string; verb: string; admin?: boolean; active?: boolean; write?: boolean; body?: unknown; query?: string; invoke(request: NextRequest): Promise<Response>; }
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
];
export const m2ArmIds = (prefix = "") => M2_ARMS.map(a => `${prefix}${a.route} ${a.verb}`);
export function m2Request(arm: M2Arm, invalid = false): NextRequest {
 const query = invalid ? arm.query : arm.route === "saved/status" ? `identities=event:${M2_ID}` : undefined;
 return new NextRequest(`http://localhost/api/${arm.route.replace("[id]",M2_ID)}${query ? `?${query}` : ""}`, {
  method: arm.verb,
  ...(arm.body ? { body: invalid ? "{" : JSON.stringify(arm.body),headers: { "content-type": "application/json" } } : {}),
 });
}
