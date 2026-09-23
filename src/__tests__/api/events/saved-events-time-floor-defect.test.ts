/**
 * DEFECT characterization — F-085
 *
 * Subject: `src/app/api/users/saved-events/route.ts`, the default "upcoming"
 * floor at lines 99-101:
 *
 *     if (!includePast) {
 *       eventsQuery = eventsQuery.gte("start_date", new Date().toISOString());
 *     }
 *
 * The defect: `start_date` is stored as Eastern wall-clock with a `+00` offset
 * (`src/lib/timezone.ts:1-10`), so "now" has to be expressed in that same
 * naive-UTC form before it is compared — which is what `/api/events` does with
 * `getESTNowISO()` (`src/app/api/events/route.ts:245-246`). This route compares
 * against TRUE UTC instead. At 14:30 EDT the true-UTC instant is 18:30Z, so an
 * event stored as 16:00Z — 16:00 Eastern, ninety minutes away — is upcoming in
 * the feed and already gone from the caller's upcoming saved list. The band is
 * four hours wide under EDT and five under EST, and it moves with the clock.
 *
 * What this file is and is not:
 *
 *   - It is a DEFECT test. It pins what the handler does TODAY: with the system
 *     clock pinned, the floor it sends is the true-UTC ISO string of that
 *     instant, not the Eastern wall-clock string. It passes today and is
 *     expected to keep passing until the fixing change lands.
 *   - It is NOT a failing test and NOT a fix. Unifying the two floors is a
 *     timezone-dependent behaviour change with no characterization behind it
 *     yet (04-RESEARCH.md Pitfall 6), so Phase 4 registers and pins it and
 *     Phase 6 fixes it. When a shared floor function lands in Phase 6, these
 *     assertions move — deliberately and visibly, in that commit.
 *
 * Why the expected Eastern values are literals and not `getESTNowISO()`: the
 * worked instants are chosen so the arithmetic is checkable by eye (18:30Z is
 * 14:30 EDT; 19:30Z in January is 14:30 EST), and a literal cannot drift with
 * the helper it is being contrasted with.
 *
 * The clock is pinned with Jest's modern fake timers faking `Date` only. The
 * subject is driven through the in-memory fake (`../../helpers/fakeSupabase.ts`)
 * behind a mock of "@/lib/supabase/server", the same seam as
 * `saved-events-characterization.test.ts`, so it survives 04-05's seam
 * adoption unedited.
 *
 * Registered as F-085 in .planning/audit/findings.json. Closes in Phase 6.
 * Observed red under a mutation of the floor; see
 * `evidence/slice-1-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/users/saved-events/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };

function eventRow(id: string, start: string): FakeRow {
  return {
    id,
    title: `Event ${id.slice(-3)}`,
    description: null,
    start_date: start,
    end_date: start,
    location: null,
    organizer: null,
    club_id: null,
    tags: ["academic"],
    created_at: "2026-08-01T12:00:00+00:00",
    updated_at: "2026-08-01T12:00:00+00:00",
    status: "approved",
    deleted_at: null,
  };
}

// 16:00 Eastern on 2026-09-23 — ninety minutes after the pinned 14:30 EDT.
const SOON = eventRow("5eed0000-0000-4000-8000-00000000e101", "2026-09-23T16:00:00+00:00");
// 19:00 Eastern the same day — after the true-UTC floor too.
const LATER = eventRow("5eed0000-0000-4000-8000-00000000e102", "2026-09-23T19:00:00+00:00");

function setup(): FakeSupabase {
  mockFake = createFakeSupabase({
    user: CALLER,
    tables: {
      saved_events: [
        { id: "saved-1", user_id: CALLER.id, event_id: SOON.id, created_at: "2026-09-20T10:00:00+00:00" },
        { id: "saved-2", user_id: CALLER.id, event_id: LATER.id, created_at: "2026-09-21T10:00:00+00:00" },
      ],
      events: [SOON, LATER],
    },
  });
  return mockFake;
}

function pinClock(iso: string): void {
  jest.useFakeTimers({
    now: new Date(iso),
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask",
      "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback",
      "setImmediate", "clearImmediate", "setInterval", "clearInterval",
      "setTimeout", "clearTimeout",
    ],
  });
}

function floorFilters(fake: FakeSupabase) {
  return fake.calls
    .filter((c) => c.table === "events")
    .flatMap((c) => c.filters)
    .filter((f) => f.column === "start_date");
}

afterEach(() => {
  jest.useRealTimers();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("F-085 — the saved-events upcoming floor is true UTC", () => {
  it("at 14:30 EDT (18:30Z) the floor is 2026-09-23T18:30:00.000Z, not the Eastern 2026-09-23T14:30:00.000Z", async () => {
    pinClock("2026-09-23T18:30:00.000Z");
    const fake = setup();
    const res = await GET(new NextRequest("http://localhost:3000/api/users/saved-events"));
    expect(res.status).toBe(200);
    expect(floorFilters(fake)).toEqual([
      { op: "gte", column: "start_date", value: "2026-09-23T18:30:00.000Z" },
    ]);
    expect(floorFilters(fake)[0].value).not.toBe("2026-09-23T14:30:00.000Z");
  });

  it("at 14:30 EST (19:30Z in January) the floor is the true-UTC 2026-01-15T19:30:00.000Z — five hours ahead", async () => {
    pinClock("2026-01-15T19:30:00.000Z");
    const fake = setup();
    await GET(new NextRequest("http://localhost:3000/api/users/saved-events"));
    expect(floorFilters(fake)).toEqual([
      { op: "gte", column: "start_date", value: "2026-01-15T19:30:00.000Z" },
    ]);
  });

  it("drops an event ninety minutes away in Eastern time from the upcoming saved list", async () => {
    pinClock("2026-09-23T18:30:00.000Z");
    setup();
    const res = await GET(new NextRequest("http://localhost:3000/api/users/saved-events"));
    const body = await res.json();
    // SOON (16:00 Eastern) is still upcoming at 14:30 Eastern, and is dropped.
    expect(body.savedEventIds).toEqual([LATER.id]);
  });

  it("sends no floor at all when include_past=true", async () => {
    pinClock("2026-09-23T18:30:00.000Z");
    const fake = setup();
    await GET(new NextRequest("http://localhost:3000/api/users/saved-events?include_past=true"));
    expect(floorFilters(fake)).toEqual([]);
  });
});
