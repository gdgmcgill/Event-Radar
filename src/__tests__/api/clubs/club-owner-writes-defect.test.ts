/**
 * DEFECT characterization — F-087: owner club writes run on the cookie client, where RLS denies them
 *
 * Status: FIXED in 05-10 — D5's demotion filter moved in 05-10 Task 1
 * (DEC-40); D1, D2 and D4 moved to the elevated client in 05-10 Task 3
 * (DEC-41). Ledger rows in `evidence/defect-ledger.md`.
 *
 * The defect, as registered (research C11, measured on the local stack):
 * `clubs` has no owner UPDATE policy and `club_members` UPDATE is admin-only.
 * So these handlers issue their write on the caller's cookie client, and RLS
 * matches 0 rows:
 *   - `PATCH /api/clubs/[id]` answers the real owner 500 "Failed to update club"
 *     (the `.single()` after a 0-row update errors);
 *   - `DELETE /api/clubs/[id]` answers `{ success: true }` without deleting,
 *     then writes a `club_deleted` audit row for a club that still exists;
 *   - `PATCH /api/clubs/[id]/members/role` answers 500.
 * The fake cannot express RLS, so this file pins the cause the fake CAN see:
 * WHICH client performed each write. `@/lib/supabase/server` returns fake A
 * (the cookie client) and `@/lib/supabase/service` returns a separate fake B
 * (the elevated client), each with its own call log. The real-stack symptom
 * (the owner's PATCH answering 500) is pinned in
 * `e2e/specs/club-authorization.spec.ts`, the test titled "DEFECT F-087".
 *
 * What moves in 05-10 (DEC-41: the three owner writes go through
 * `getElevatedClient()` after `requireClubRole(…, ["owner"])`):
 *   - D1 PATCH: the `clubs` update moves from A to B;
 *   - D2 DELETE: the `status: "deleted"` update moves from A to B;
 *   - D4 members/role: the `club_members` update moves from A to B;
 *   - D5 transfer: the demotion's filter changes from the caller's membership
 *     `id` to `(club_id, user_id)` (DEC-40), because the guard returns only
 *     the role. Its writes are already on B today and stay there.
 *
 * What does NOT move, and is asserted here so the move cannot loosen it:
 *   - D1's column whitelist: a body carrying `status: "rejected"` produces an
 *     update payload with no `status` key (DEC-41 keeps the whitelist);
 *   - D2's soft-delete payload is exactly `{ status: "deleted" }`, and the
 *     `club_deleted` audit insert is on B;
 *   - D3: the membership check that precedes each write stays a read on A
 *     (the caller's own membership is visible to them under RLS).
 *
 * The protocol for moving an assertion is `evidence/defect-ledger.md`'s:
 * the fix turns this file red unedited, the moved assertions go green, and the
 * pre-fix source turns the moved file red.
 *
 * Every caller has an onboarded, unbanned `users` row, so the slice-3 seam
 * guards (`requireActiveUser`, `requireOnboarded`) admit the owner and the
 * pins isolate the write path.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeFilter,
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
}));

// ─── Fixture (synthetic ids, not seed ids) ─────────────────────────────────

const OWNER = {
  id: "5eed0000-0000-4000-8000-0c9100000001",
  email: "writes.owner@mail.mcgill.ca",
};
const ORGANIZER_ID = "5eed0000-0000-4000-8000-0c9100000002";
const CLUB_ID = "5eed0000-0000-4000-8000-0c91000000c1";
const CLUB_NAME = "Owner Writes Club";
const OWNER_MEMBERSHIP_ID = "5eed0000-0000-4000-8000-0c91000000b1";
const ORGANIZER_MEMBERSHIP_ID = "5eed0000-0000-4000-8000-0c91000000b2";

function userRow(id: string, email: string, name: string): FakeRow {
  return {
    id,
    email,
    name,
    roles: ["user"],
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
  };
}

function tables(): Record<string, FakeRow[]> {
  return {
    users: [
      userRow(OWNER.id, OWNER.email, "Writes Owner"),
      userRow(ORGANIZER_ID, "writes.organizer@mail.mcgill.ca", "Writes Organizer"),
    ],
    clubs: [
      {
        id: CLUB_ID,
        name: CLUB_NAME,
        status: "approved",
        description: "Before",
        created_by: OWNER.id,
      },
    ],
    club_members: [
      { id: OWNER_MEMBERSHIP_ID, club_id: CLUB_ID, user_id: OWNER.id, role: "owner" },
      {
        id: ORGANIZER_MEMBERSHIP_ID,
        club_id: CLUB_ID,
        user_id: ORGANIZER_ID,
        role: "organizer",
      },
    ],
  };
}

beforeEach(() => {
  mockCookie = createFakeSupabase({ user: OWNER, tables: tables() });
  mockElevated = createFakeSupabase({ user: null, tables: tables() });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

const BASE = "http://localhost:3000/api";

function json(path: string, method: string, body: unknown): NextRequest {
  return new NextRequest(`${BASE}/${path}`, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function id(value: string) {
  return { params: Promise.resolve({ id: value }) };
}

function updates(calls: readonly FakeCall[], table: string): FakeCall[] {
  return calls.filter((c) => c.table === table && c.operation === "update");
}

function filters(call: FakeCall): Array<Pick<FakeFilter, "op" | "column" | "value">> {
  return call.filters.map(({ op, column, value }) => ({ op, column, value }));
}

// ─── D1 PATCH /api/clubs/[id] ──────────────────────────────────────────────

describe("D1 PATCH /api/clubs/[id] as the owner", () => {
  async function patch() {
    const { PATCH } = await import("@/app/api/clubs/[id]/route");
    return PATCH(
      json(`clubs/${CLUB_ID}`, "PATCH", { description: "x", status: "rejected" }),
      id(CLUB_ID)
    );
  }

  test("fixed: the clubs update is issued on the elevated client, and the cookie client records none", async () => {
    const response = await patch();
    expect(response.status).toBe(200);
    expect(updates(mockElevated.calls, "clubs")).toHaveLength(1);
    expect(updates(mockCookie.calls, "clubs")).toHaveLength(0);
  });

  test("fixed: the elevated update is filtered to the club named in the path", async () => {
    await patch();
    const [update] = updates(mockElevated.calls, "clubs");
    expect(filters(update)).toEqual([{ op: "eq", column: "id", value: CLUB_ID }]);
  });

  test("stays: the whitelist drops status, so the payload is exactly { description }", async () => {
    await patch();
    const all = [
      ...updates(mockCookie.calls, "clubs"),
      ...updates(mockElevated.calls, "clubs"),
    ];
    expect(all).toHaveLength(1);
    expect(all[0].payload).toEqual({ description: "x" });
    expect(all[0].payload).not.toHaveProperty("status");
  });
});

// ─── D2 DELETE /api/clubs/[id] ─────────────────────────────────────────────

describe("D2 DELETE /api/clubs/[id] as the owner", () => {
  async function remove() {
    const { DELETE } = await import("@/app/api/clubs/[id]/route");
    return DELETE(
      json(`clubs/${CLUB_ID}`, "DELETE", { confirmName: CLUB_NAME }),
      id(CLUB_ID)
    );
  }

  test("fixed: the soft-delete update is issued on the elevated client, and the cookie client records none", async () => {
    const response = await remove();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const onElevated = updates(mockElevated.calls, "clubs");
    expect(onElevated).toHaveLength(1);
    expect(onElevated[0].payload).toEqual({ status: "deleted" });
    expect(filters(onElevated[0])).toEqual([{ op: "eq", column: "id", value: CLUB_ID }]);
    expect(updates(mockCookie.calls, "clubs")).toHaveLength(0);
  });

  test("stays: the club_deleted audit row is inserted on the elevated client", async () => {
    await remove();
    const audit = mockElevated.calls.filter(
      (c) => c.table === "admin_audit_log" && c.operation === "insert"
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].payload).toEqual({
      admin_user_id: OWNER.id,
      action: "club_deleted",
      target_type: "club",
      target_id: CLUB_ID,
      metadata: { club_name: CLUB_NAME },
    });
    expect(
      mockCookie.calls.filter((c) => c.table === "admin_audit_log")
    ).toHaveLength(0);
  });
});

// ─── D3 the membership read that precedes each write ───────────────────────

describe("D3 the caller's own membership is read on the cookie client", () => {
  test.each([
    [
      "PATCH /api/clubs/[id]",
      async () =>
        (await import("@/app/api/clubs/[id]/route")).PATCH(
          json(`clubs/${CLUB_ID}`, "PATCH", { description: "x" }),
          id(CLUB_ID)
        ),
    ],
    [
      "DELETE /api/clubs/[id]",
      async () =>
        (await import("@/app/api/clubs/[id]/route")).DELETE(
          json(`clubs/${CLUB_ID}`, "DELETE", { confirmName: CLUB_NAME }),
          id(CLUB_ID)
        ),
    ],
    [
      "PATCH /api/clubs/[id]/members/role",
      async () =>
        (await import("@/app/api/clubs/[id]/members/role/route")).PATCH(
          json(`clubs/${CLUB_ID}/members/role`, "PATCH", {
            memberId: ORGANIZER_MEMBERSHIP_ID,
            role: "organizer",
          }),
          id(CLUB_ID)
        ),
    ],
  ])("%s", async (_label, call) => {
    await call();
    const reads = mockCookie.calls.filter(
      (c) => c.table === "club_members" && c.operation === "select"
    );
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(filters(reads[0])).toEqual(
      expect.arrayContaining([
        { op: "eq", column: "club_id", value: CLUB_ID },
        { op: "eq", column: "user_id", value: OWNER.id },
      ])
    );
    expect(
      mockElevated.calls.filter(
        (c) => c.table === "club_members" && c.operation === "select"
      )
    ).toHaveLength(0);
  });
});

// ─── D4 PATCH /api/clubs/[id]/members/role ─────────────────────────────────

describe("D4 PATCH /api/clubs/[id]/members/role as the owner", () => {
  test("fixed: the club_members update is issued on the elevated client, and the cookie client records none", async () => {
    const { PATCH } = await import("@/app/api/clubs/[id]/members/role/route");
    const response = await PATCH(
      json(`clubs/${CLUB_ID}/members/role`, "PATCH", {
        memberId: ORGANIZER_MEMBERSHIP_ID,
        role: "organizer",
      }),
      id(CLUB_ID)
    );
    expect(response.status).toBe(200);
    const onElevated = updates(mockElevated.calls, "club_members");
    expect(onElevated).toHaveLength(1);
    expect(onElevated[0].payload).toEqual({ role: "organizer" });
    expect(filters(onElevated[0])).toEqual([
      { op: "eq", column: "id", value: ORGANIZER_MEMBERSHIP_ID },
    ]);
    expect(updates(mockCookie.calls, "club_members")).toHaveLength(0);
  });
});

// ─── D5 POST /api/clubs/[id]/transfer ──────────────────────────────────────

describe("D5 POST /api/clubs/[id]/transfer as the owner", () => {
  async function transfer() {
    const { POST } = await import("@/app/api/clubs/[id]/transfer/route");
    return POST(
      json(`clubs/${CLUB_ID}/transfer`, "POST", { newOwnerId: ORGANIZER_ID }),
      id(CLUB_ID)
    );
  }

  test("stays: every write is on the elevated client, none on the cookie client", async () => {
    const response = await transfer();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(
      mockCookie.calls
        .filter((c) => c.operation !== "select")
        .map((c) => `${c.table}.${c.operation}`)
    ).toEqual([]);
    expect(
      mockElevated.calls
        .filter((c) => c.operation !== "select")
        .map((c) => `${c.table}.${c.operation}`)
    ).toEqual([
      "club_members.update",
      "club_members.update",
      "admin_audit_log.insert",
    ]);
  });

  test("stays: the promotion is filtered by the target's membership id", async () => {
    await transfer();
    const [promote] = updates(mockElevated.calls, "club_members");
    expect(promote.payload).toEqual({ role: "owner" });
    expect(filters(promote)).toEqual([
      { op: "eq", column: "id", value: ORGANIZER_MEMBERSHIP_ID },
    ]);
  });

  test("fixed (DEC-40): the demotion is filtered by (club_id, user_id), not the caller's membership id", async () => {
    await transfer();
    const demote = updates(mockElevated.calls, "club_members")[1];
    expect(demote.payload).toEqual({ role: "organizer" });
    expect(filters(demote)).toEqual([
      { op: "eq", column: "club_id", value: CLUB_ID },
      { op: "eq", column: "user_id", value: OWNER.id },
    ]);
  });

  test("stays: the ownership-transfer audit row is inserted on the elevated client", async () => {
    await transfer();
    const audit = mockElevated.calls.filter(
      (c) => c.table === "admin_audit_log" && c.operation === "insert"
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].payload).toEqual({
      admin_user_id: OWNER.id,
      action: "club_ownership_transferred",
      target_type: "club",
      target_id: CLUB_ID,
      metadata: { new_owner_id: ORGANIZER_ID, previous_owner_id: OWNER.id },
    });
  });
});
