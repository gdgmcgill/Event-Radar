/**
 * Guarded handlers answer a JSON 400 for a malformed or non-object body
 * (REVIEW-05 WR-08).
 *
 * Before the fix these arms called `await request.json()` (or read a key of
 * its result) outside any `try`, so an invalid body, or a valid one that is
 * `null`, a string, a number or an array, threw to the framework and came
 * back as an HTML 500. Each arm now reads its body through
 * `readJsonObject()` (`src/server/body.ts`), after its guards, so a caller
 * who fails a guard still gets the guard's answer first.
 *
 * `POST /api/admin/users/[id]/ban` joined the table in REVIEW-05 iter3 WR-08.
 *
 * Also pinned: `PATCH /api/admin/users/[id]` validates `name` (a trimmed
 * string of 2-50 characters) and audits a name change.
 */

import {
  ADMIN,
  CLUB_ID,
  EVENT_ID,
  OTHER,
  REPORT_ID,
  REQUEST_ID,
  STUDENT,
  callsTo,
  idParams,
  jsonRequest,
  makeFake,
  profileOf,
  writes,
  type Fake,
} from "./fake";
import { readJsonObject } from "@/server/body";
import type { NextRequest, NextResponse } from "next/server";

let mockCookie: Fake;
let mockElevated: Fake;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

type Persona = "admin" | "owner" | "student";

function as(persona: Persona): void {
  const user = persona === "admin" ? ADMIN : STUDENT;
  const roles = persona === "admin" ? ["user", "admin"] : ["user"];
  mockCookie = makeFake({
    user,
    profile: profileOf(user.id, roles),
    // The owner gate (requireClubRole) reads the caller's membership.
    answers: persona === "owner" ? { "club_members.select": { data: { role: "owner" } } } : {},
  });
  mockElevated = makeFake();
}

type Call = (req: NextRequest) => Promise<NextResponse | Response>;

const ARMS: Array<[string, Persona, string, string, Call]> = [
  ["admin/users/[id] PATCH", "admin", `admin/users/${OTHER}`, "PATCH",
    async (r) => (await import("@/app/api/admin/users/[id]/route")).PATCH(r, idParams(OTHER))],
  ["admin/clubs/[id] PATCH", "admin", `admin/clubs/${CLUB_ID}`, "PATCH",
    async (r) => (await import("@/app/api/admin/clubs/[id]/route")).PATCH(r, idParams(CLUB_ID))],
  ["admin/events/[id]/status PATCH", "admin", `admin/events/${EVENT_ID}/status`, "PATCH",
    async (r) => (await import("@/app/api/admin/events/[id]/status/route")).PATCH(r, idParams(EVENT_ID))],
  ["admin/events/[id]/edits PATCH", "admin", `admin/events/${EVENT_ID}/edits`, "PATCH",
    async (r) => (await import("@/app/api/admin/events/[id]/edits/route")).PATCH(r, idParams(EVENT_ID))],
  ["admin/organizer-requests/[id] PATCH", "admin", `admin/organizer-requests/${REQUEST_ID}`, "PATCH",
    async (r) => (await import("@/app/api/admin/organizer-requests/[id]/route")).PATCH(r, idParams(REQUEST_ID))],
  ["admin/reports/[id] PATCH", "admin", `admin/reports/${REPORT_ID}`, "PATCH",
    async (r) => (await import("@/app/api/admin/reports/[id]/route")).PATCH(r, idParams(REPORT_ID))],
  ["clubs/[id] DELETE", "owner", `clubs/${CLUB_ID}`, "DELETE",
    async (r) => (await import("@/app/api/clubs/[id]/route")).DELETE(r, idParams(CLUB_ID))],
  ["clubs/[id]/transfer POST", "owner", `clubs/${CLUB_ID}/transfer`, "POST",
    async (r) => (await import("@/app/api/clubs/[id]/transfer/route")).POST(r, idParams(CLUB_ID))],
  ["clubs/[id]/members/role PATCH", "owner", `clubs/${CLUB_ID}/members/role`, "PATCH",
    async (r) => (await import("@/app/api/clubs/[id]/members/role/route")).PATCH(r, idParams(CLUB_ID))],
  ["clubs POST", "student", "clubs", "POST",
    async (r) => (await import("@/app/api/clubs/route")).POST(r)],
  ["organizer-requests POST", "student", "organizer-requests", "POST",
    async (r) => (await import("@/app/api/organizer-requests/route")).POST(r)],
  ["events/[id]/appeal POST", "student", `events/${EVENT_ID}/appeal`, "POST",
    async (r) => (await import("@/app/api/events/[id]/appeal/route")).POST(r, idParams(EVENT_ID))],
  ["clubs/[id]/appeal POST", "student", `clubs/${CLUB_ID}/appeal`, "POST",
    async (r) => (await import("@/app/api/clubs/[id]/appeal/route")).POST(r, idParams(CLUB_ID))],
  ["events/[id]/report POST", "student", `events/${EVENT_ID}/report`, "POST",
    async (r) => (await import("@/app/api/events/[id]/report/route")).POST(r, idParams(EVENT_ID))],
  // REVIEW-05 iter3 WR-08: missed by the first pass. Its own try caught only
  // a parse failure, so `null` threw at the destructuring (HTML 500).
  ["admin/users/[id]/ban POST", "admin", `admin/users/${OTHER}/ban`, "POST",
    async (r) => (await import("@/app/api/admin/users/[id]/ban/route")).POST(r, idParams(OTHER))],
];

describe.each(ARMS)("%s", (_id, persona, path, method, call) => {
  it("an invalid JSON body answers 400 Invalid JSON body and writes nothing", async () => {
    as(persona);
    const res = await call(jsonRequest(path, method, undefined, "{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
    expect(writes(mockCookie)).toEqual([]);
    expect(writes(mockElevated)).toEqual([]);
  });

  it.each([["null"], ['"a string"'], ["42"], ["[1,2]"]])(
    "a non-object body (%s) answers 400 and writes nothing",
    async (raw) => {
      as(persona);
      const res = await call(jsonRequest(path, method, undefined, raw));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Request body must be a JSON object" });
      expect(writes(mockCookie)).toEqual([]);
      expect(writes(mockElevated)).toEqual([]);
    }
  );
});

describe("readJsonObject()", () => {
  it("returns the object for a JSON object body", async () => {
    const result = await readJsonObject(jsonRequest("x", "POST", { a: 1 }));
    expect(result).toEqual({ ok: true, body: { a: 1 } });
  });

  it("refuses an empty body as invalid JSON", async () => {
    const result = await readJsonObject(jsonRequest("x", "POST", undefined, ""));
    expect(result.ok).toBe(false);
  });
});

describe("admin/users/[id] PATCH name", () => {
  async function patchName(name: unknown) {
    as("admin");
    mockElevated = makeFake({
      answers: { "users.update": { data: { id: OTHER, name } } },
    });
    const { PATCH } = await import("@/app/api/admin/users/[id]/route");
    return PATCH(jsonRequest(`admin/users/${OTHER}`, "PATCH", { name }), idParams(OTHER));
  }

  it.each([[42], [null], [{ first: "x" }], ["a"], ["  a  "], ["x".repeat(51)]])(
    "refuses %p with 400 on field name and writes nothing",
    async (name) => {
      const res = await patchName(name);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Name must be between 2 and 50 characters long",
        field: "name",
      });
      expect(writes(mockElevated)).toEqual([]);
    }
  );

  it("writes the trimmed name and audits it", async () => {
    const res = await patchName("  New Name  ");
    expect(res.status).toBe(200);
    const [update] = callsTo(mockElevated, "users", "update");
    expect((update.payload as { name: string }).name).toBe("New Name");
    const [audit] = callsTo(mockElevated, "admin_audit_log", "insert");
    expect(audit.payload).toMatchObject({
      action: "updated",
      target_type: "user",
      target_id: OTHER,
      metadata: { name: "New Name" },
    });
    expect((audit.payload as { metadata: object }).metadata).not.toHaveProperty("roles");
  });
});
