/**
 * DEFECT characterization — F-091: admin role changes cannot land, strip admin, and are not audited
 *
 * Status: OPEN — every row below moves in 05-14 (DEC-45).
 *
 * Subject: `PATCH /api/admin/users/[id]` (`src/app/api/admin/users/[id]/route.ts`),
 * written against the unmodified route at plan 05-12's base commit (4e368b6).
 *
 * The defect, as registered (research C12, measured on the local stack): the
 * route writes on the caller's COOKIE client. `users` has no admin UPDATE
 * policy, so for any target other than the caller the update matches 0 rows,
 * `.single()` errors, and the route answers 500. Before writing, it filters
 * `admin` out of every submitted roles array; it refuses nothing about the
 * target (the caller may change their own roles), validates no role value,
 * and writes no `admin_audit_log` row.
 *
 * How the fakes express RLS. `@/lib/supabase/server` returns the cookie fake A
 * and `@/lib/supabase/service` the elevated fake B, each with its own call
 * log. Fake A holds only the caller's own `users` row: that is the only row
 * the cookie client's UPDATE can match under RLS, so an update of another
 * user's row matches 0 rows exactly as it does on the real stack and the
 * route's 500 is reproduced, not asserted from memory. Fake B holds both rows
 * (the service role bypasses RLS).
 *
 * Pinned today (measured first; `evidence/slice-5-characterization.txt` § 2.1):
 *   R1  another user's id with `{ roles: ["user","admin"] }` → 500
 *       `{"error":"Internal server error"}`; the update is issued on fake A,
 *       filtered by the target id, and its roles payload is `["user"]` (admin
 *       stripped); fake B is never called; no `admin_audit_log` insert on
 *       either fake.
 *   R2  another user's id with `{ roles: ["user","club_organizer"] }` (the
 *       `/moderation/users` organizer toggle) → the same 500, update on A.
 *   R3  the caller's own id with `{ roles: ["user","admin"] }` → 200, and the
 *       stored roles are `["user"]`: an admin can demote themselves, and the
 *       strip is what does it.
 *   R4  `{ roles: ["user","superuser"] }` → no validation: the update is
 *       attempted on A with `["user","superuser"]` and the answer is the 500.
 * Fixed (05-14, DEC-45): R1 the update is on fake B, roles keep `admin`, one
 * `admin_audit_log` insert on B (action `updated`, target_type `user`); R2
 * 200 on B; R3 `403 {"error":"You cannot change your own roles"}` with no
 * update; R4 `400 {"error":"Invalid role","field":"roles"}` with no update.
 *
 * Does NOT move (asserted here so the fix cannot loosen it):
 *   N1  a name-only edit of the caller's own row → 200 with the new name.
 *   N2  a non-admin caller → 403 `{"error":"Forbidden"}` with no update.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeRow,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

// ─── Fixture (synthetic ids, not seed ids) ─────────────────────────────────

const ADMIN = {
  id: "5eed0000-0000-4000-8000-0a5100000001",
  email: "roles.admin@mail.mcgill.ca",
};
const TARGET_ID = "5eed0000-0000-4000-8000-0a5100000002";

function userRow(id: string, roles: string[]): FakeRow {
  return {
    id,
    name: id === ADMIN.id ? "Roles Admin" : "Roles Target",
    roles,
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
  };
}

function setUp(callerRoles: string[] = ["user", "admin"]): void {
  // Fake A: only the rows the cookie client's UPDATE can match under RLS.
  mockCookie = createFakeSupabase({
    user: ADMIN,
    tables: { users: [userRow(ADMIN.id, callerRoles)] },
  });
  // Fake B: every row (the service role bypasses RLS).
  mockElevated = createFakeSupabase({
    user: null,
    tables: {
      users: [userRow(ADMIN.id, callerRoles), userRow(TARGET_ID, ["user"])],
      admin_audit_log: [],
    },
  });
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

type PatchHandler = (typeof import("@/app/api/admin/users/[id]/route"))["PATCH"];

async function patch(
  id: string,
  body: unknown
): Promise<{ status: number; body: unknown }> {
  const handler: PatchHandler = (await import("@/app/api/admin/users/[id]/route"))
    .PATCH;
  const response = await handler(
    new NextRequest(`http://localhost:3000/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id }) }
  );
  return { status: response.status, body: await response.json() };
}

function updates(fake: FakeSupabase): FakeCall[] {
  return fake.calls.filter(
    (call) => call.table === "users" && call.operation === "update"
  );
}

function auditInserts(): FakeCall[] {
  return [...mockCookie.calls, ...mockElevated.calls].filter(
    (call) => call.table === "admin_audit_log" && call.operation === "insert"
  );
}

function idFilter(call: FakeCall): unknown {
  return call.filters.find((f) => f.op === "eq" && f.column === "id")?.value;
}

// ─── Moves in 05-14 ────────────────────────────────────────────────────────

describe("F-091 today: PATCH /api/admin/users/[id]", () => {
  it("R1: another user's +admin change is written on the cookie client with admin stripped, 500s, and is not audited", async () => {
    setUp();
    const result = await patch(TARGET_ID, { roles: ["user", "admin"] });

    expect(result).toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });

    const onCookie = updates(mockCookie);
    expect(onCookie).toHaveLength(1);
    expect(idFilter(onCookie[0])).toBe(TARGET_ID);
    const payload = onCookie[0].payload as { roles?: string[] };
    expect(payload.roles).toEqual(["user"]);
    expect(payload.roles).not.toContain("admin");

    expect(mockElevated.calls).toEqual([]);
    expect(auditInserts()).toEqual([]);
  });

  it("R2: the organizer toggle for another user 500s on the cookie client", async () => {
    setUp();
    const result = await patch(TARGET_ID, { roles: ["user", "club_organizer"] });

    expect(result).toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });
    const onCookie = updates(mockCookie);
    expect(onCookie).toHaveLength(1);
    expect((onCookie[0].payload as { roles?: string[] }).roles).toEqual([
      "user",
      "club_organizer",
    ]);
    expect(updates(mockElevated)).toEqual([]);
    expect(auditInserts()).toEqual([]);
  });

  it("R3: a roles change on the caller's own id is admitted, and the strip demotes the admin", async () => {
    setUp();
    const result = await patch(ADMIN.id, { roles: ["user", "admin"] });

    expect(result.status).toBe(200);
    expect((result.body as { user: { roles: string[] } }).user.roles).toEqual([
      "user",
    ]);
    const onCookie = updates(mockCookie);
    expect(onCookie).toHaveLength(1);
    expect(idFilter(onCookie[0])).toBe(ADMIN.id);
    expect(mockCookie.tables.users[0].roles).toEqual(["user"]);
    expect(auditInserts()).toEqual([]);
  });

  it("R4: an unknown role value is not validated; the update is attempted with it", async () => {
    setUp();
    const result = await patch(TARGET_ID, { roles: ["user", "superuser"] });

    expect(result).toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });
    const onCookie = updates(mockCookie);
    expect(onCookie).toHaveLength(1);
    expect((onCookie[0].payload as { roles?: string[] }).roles).toEqual([
      "user",
      "superuser",
    ]);
  });
});

// ─── Does not move ─────────────────────────────────────────────────────────

describe("F-091 rows that do not move", () => {
  it("N1: a name-only edit of the caller's own row succeeds", async () => {
    setUp();
    const result = await patch(ADMIN.id, { name: "Renamed Admin" });

    expect(result.status).toBe(200);
    expect((result.body as { user: { name: string } }).user.name).toBe(
      "Renamed Admin"
    );
  });

  it("N2: a non-admin caller is refused 403 Forbidden and nothing is updated", async () => {
    setUp(["user"]);
    const result = await patch(TARGET_ID, { roles: ["user", "admin"] });

    expect(result).toEqual({ status: 403, body: { error: "Forbidden" } });
    expect(updates(mockCookie)).toEqual([]);
    expect(updates(mockElevated)).toEqual([]);
  });
});
