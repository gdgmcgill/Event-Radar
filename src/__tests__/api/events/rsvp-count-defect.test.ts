/**
 * DEFECT characterization — F-079
 *
 * Subject: `src/app/api/events/[id]/rsvp/route.ts` GET, lines 92-105.
 *
 *     const { data: rsvps, error: rsvpError } = await supabase
 *       .from("rsvps")
 *       .select("id, status")
 *       .eq("event_id", eventId)
 *       .neq("status", "cancelled");
 *     …
 *     const goingCount = rsvps?.filter((r) => r.status === "going").length ?? 0;
 *     const interestedCount = rsvps?.filter((r) => r.status === "interested").length ?? 0;
 *
 * The defect: the counts are computed by SELECTing every non-cancelled row and
 * calling `.filter().length` in JavaScript. PostgREST caps a row-returning
 * select at `max_rows`, which `supabase/config.toml` line 18 sets to 1000, so
 * an event with more than 1000 non-cancelled RSVPs under-reports — silently,
 * with no error and no log. (Production's `max_rows` is unverified; research
 * assumption A1.)
 *
 * What this file is and is not:
 *
 *   - It is a DEFECT test. It pins what the handler does TODAY: exactly one
 *     rsvps read for the counts, a row-returning select of `id, status` with
 *     no `count` option and no `head` option, filtered by `event_id` and by
 *     `status` not equal to `cancelled`. It passes today and is expected to
 *     keep passing until the fixing commit lands.
 *   - It is NOT a failing test and it is NOT a fix. The fix is plan 04-05
 *     (DEC-23): two parallel `{ count: "exact", head: true }` reads, one per
 *     status — the head-count form this repository already uses at
 *     `src/app/profile/page.tsx:38-42`. `head: true` turns the request into a
 *     HEAD and the count arrives as a server-side COUNT(*) that `max_rows` does
 *     not cap. In that commit the assertions below move to "two rsvps reads,
 *     both `{ count: "exact", head: true }`, filtered by event id and by the
 *     respective status, and no row-returning rsvps read" — deliberately and
 *     visibly.
 *   - The RESPONSE is not pinned here. `rsvp-characterization.test.ts` pins the
 *     counts in the body, blind to how they are computed, and does not move.
 *
 * Why the assertions are on the fake's CALL LOG rather than on a 1001-row
 * fixture: the cap lives in PostgREST, not in the client, so no in-process
 * fake can reproduce it — a 1001-row fixture would be counted correctly and
 * prove nothing. The observable, mockable property is the shape of the query:
 * a row-returning select with no count option, counted in JavaScript. The
 * in-memory fake (`../../helpers/fakeSupabase.ts`) records every executed
 * query's table, columns, options, ordered filters and terminal, behind a mock
 * of "@/lib/supabase/server" — the same seam the characterization suites use,
 * so 04-05's seam adoption does not move this file; only the F-079 fix does.
 *
 * Registered as F-079 in .planning/audit/findings.json. Closes in Phase 4.
 * Observed red under a mutation that adds a count option; see
 * `evidence/slice-1-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeSupabase,
  type FakeUser,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/events/[id]/rsvp/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };
const EVENT_ID = "5eed0000-0000-4000-8000-00000000e001";

function setup(user: FakeUser | null): FakeSupabase {
  mockFake = createFakeSupabase({
    user,
    tables: {
      users: [{ id: CALLER.id, roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null }],
      events: [{ id: EVENT_ID, status: "approved", deleted_at: null }],
      rsvps: [
        { id: "r1", user_id: "5eed0000-0000-4000-8000-000000009001", event_id: EVENT_ID, status: "going" },
        { id: "r2", user_id: "5eed0000-0000-4000-8000-000000009002", event_id: EVENT_ID, status: "interested" },
        { id: "r3", user_id: "5eed0000-0000-4000-8000-000000009003", event_id: EVENT_ID, status: "cancelled" },
        { id: "r4", user_id: CALLER.id, event_id: EVENT_ID, status: "going" },
      ],
    },
  });
  return mockFake;
}

async function callGet(user: FakeUser | null): Promise<FakeCall[]> {
  const fake = setup(user);
  const res = await GET(
    new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}/rsvp`),
    { params: Promise.resolve({ id: EVENT_ID }) }
  );
  expect(res.status).toBe(200);
  return fake.calls.filter((c) => c.table === "rsvps");
}

/** The count read: the rsvps select that is not scoped to one user. */
function countReads(calls: FakeCall[]): FakeCall[] {
  return calls.filter(
    (c) => c.operation === "select" && !c.filters.some((f) => f.column === "user_id")
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("F-079 — RSVP counts are a row-returning select counted in JavaScript", () => {
  it("anonymous GET issues exactly one rsvps read, and it is the count read", async () => {
    const calls = await callGet(null);
    expect(calls).toHaveLength(1);
    expect(countReads(calls)).toHaveLength(1);
  });

  it("the count read selects id, status with no count option and no head option", async () => {
    const [read] = countReads(await callGet(null));
    expect(read.columns).toBe("id, status");
    expect(read.options).toBeNull();
    expect(read.options?.count).toBeUndefined();
    expect(read.options?.head).toBeUndefined();
    expect(read.terminal).toBe("then");
  });

  it("the count read is filtered by event_id and by status not equal to cancelled — and nothing else", async () => {
    const [read] = countReads(await callGet(null));
    expect(read.filters).toEqual([
      { op: "eq", column: "event_id", value: EVENT_ID },
      { op: "neq", column: "status", value: "cancelled" },
    ]);
  });

  it("a signed-in GET still counts through exactly one unscoped row-returning read", async () => {
    const calls = await callGet(CALLER);
    const reads = countReads(calls);
    expect(reads).toHaveLength(1);
    expect(reads[0].columns).toBe("id, status");
    expect(reads[0].options).toBeNull();
    // No rsvps read of any kind asks PostgREST for a count.
    expect(calls.filter((c) => c.options?.count !== undefined || c.options?.head !== undefined)).toEqual([]);
  });
});
