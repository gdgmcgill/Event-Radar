/**
 * DEFECT characterization — F-088 (F-062 related): the DELETE arms of save and rsvp admitted a banned caller
 *
 * Subject: `DELETE /api/events/[id]/save` and `DELETE /api/events/[id]/rsvp`,
 * called directly by a permanently suspended user.
 *
 * The defect, as Phase 4 pinned it (DEC-24): the legacy ban helper ran on the
 * POST arms only. The same banned caller whose save and RSVP were refused
 * could still un-save (200 `{ saved: false }`, the row deleted) and cancel an
 * RSVP (200 `"RSVP cancelled"`, the row set to `cancelled`). The handler ring
 * failed open on those two arms, which is the F-088 shape; F-062 is the proxy
 * half, whose ban redirect could not stand in for a JSON caller.
 *
 * These two cases lived in the Phase 4 suites for the two routes
 * (`save-characterization.test.ts` and `rsvp-characterization.test.ts`), each
 * in a describe block titled "ban asymmetry — pinned for Phase 5 (DEC-24)".
 * Tags are file-level, so the pins moved here, into their own file, in the
 * commit that fixed them, and the two blocks were deleted from those suites
 * with nothing else changed (`evidence/defect-ledger.md`).
 *
 * Status: FIXED in 05-06 by the commit `fix(05-06): events-family write arms
 * fail closed on ban, onboarding and missing profile (F-088, F-089)`. Both
 * DELETE arms now call `requireActiveUser(ctx)` and `requireOnboarded(ctx)`
 * first (DEC-34). A banned caller gets 403 `{"error":"Account suspended"}`,
 * the saved row is still there, the RSVP is still `going`, and nothing was
 * inserted, updated, deleted or called as an rpc. The before-assertions (200
 * and the write) went red against the fix before they moved.
 *
 * Mocks: `@/lib/supabase/server` only (the shared fake's client), as in the
 * two suites these cases came from.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeRow,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import { DELETE as saveDELETE } from "@/app/api/events/[id]/save/route";
import { DELETE as rsvpDELETE } from "@/app/api/events/[id]/rsvp/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures (the moved blocks' fixtures, unchanged) ───────────────────────

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };
const EVENT_ID = "5eed0000-0000-4000-8000-00000000e001";
const BANNED_AT = "2026-01-01T00:00:00+00:00";

function bannedProfile(): FakeRow {
  return {
    id: CALLER.id,
    roles: ["user"],
    onboarding_completed: true,
    banned_at: BANNED_AT,
    ban_expires_at: null,
  };
}

const EVENTS: FakeRow[] = [{ id: EVENT_ID, status: "approved", deleted_at: null }];

function context() {
  return { params: Promise.resolve({ id: EVENT_ID }) };
}

/** Other users' RSVPs on the same event, as in the rsvp suite's crowd. */
function crowd(): FakeRow[] {
  return ["going", "going", "interested", "cancelled"].map((status, i) => ({
    id: `rsvp-${i + 1}`,
    user_id: `5eed0000-0000-4000-8000-00000000900${i + 1}`,
    event_id: EVENT_ID,
    status,
    created_at: "2026-09-01T10:00:00+00:00",
    updated_at: "2026-09-02T10:00:00+00:00",
  }));
}

const WRITE_OPERATIONS = new Set(["insert", "update", "delete", "rpc"]);

function writes(calls: readonly FakeCall[]): FakeCall[] {
  return calls.filter((call) => WRITE_OPERATIONS.has(call.operation));
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── save DELETE ────────────────────────────────────────────────────────────

describe("F-088 save DELETE: a permanently banned caller", () => {
  it("is refused with 403 Account suspended and the saved row is still present", async () => {
    mockFake = createFakeSupabase({
      user: CALLER,
      tables: {
        users: [bannedProfile()],
        events: EVENTS,
        saved_events: [{ id: "s1", user_id: CALLER.id, event_id: EVENT_ID }],
      },
    });

    const res = await saveDELETE(
      new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}/save`, { method: "DELETE" }),
      context()
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Account suspended" });
    expect(
      mockFake.tables.saved_events.map((r) => ({ user_id: r.user_id, event_id: r.event_id }))
    ).toEqual([{ user_id: CALLER.id, event_id: EVENT_ID }]);
    expect(writes(mockFake.calls)).toEqual([]);
  });
});

// ─── rsvp DELETE ────────────────────────────────────────────────────────────

describe("F-088 rsvp DELETE: a permanently banned caller", () => {
  it("is refused with 403 Account suspended and the RSVP is not cancelled", async () => {
    mockFake = createFakeSupabase({
      user: CALLER,
      now: "2026-09-23T12:00:00.000Z",
      tables: {
        users: [bannedProfile()],
        events: EVENTS,
        rsvps: [
          ...crowd(),
          {
            id: "caller-e001",
            user_id: CALLER.id,
            event_id: EVENT_ID,
            status: "going",
            created_at: "2026-09-05T09:00:00+00:00",
            updated_at: "2026-09-06T09:00:00+00:00",
          },
        ],
      },
    });

    const res = await rsvpDELETE(
      new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}/rsvp`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: CALLER.id }),
      }),
      context()
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Account suspended" });
    expect(
      mockFake.tables.rsvps.filter((r) => r.user_id === CALLER.id).map((r) => r.status)
    ).toEqual(["going"]);
    expect(
      mockFake.tables.rsvps.filter((r) => r.user_id !== CALLER.id).map((r) => r.status)
    ).toEqual(["going", "going", "interested", "cancelled"]);
    expect(writes(mockFake.calls)).toEqual([]);
  });
});
