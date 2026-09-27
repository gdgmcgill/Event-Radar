/**
 * DEFECT characterization — F-085 (fixed in plan 06-18; assertions moved)
 *
 * Subject: `src/app/api/users/saved-events/route.ts`, the default "upcoming"
 * floor:
 *
 *     if (!includePast) {
 *       eventsQuery = eventsQuery.gte("start_date", getESTNowISO());
 *     }
 *
 * The defect this file pinned until 06-18: `start_date` is stored as Eastern
 * wall-clock with a `+00` offset (`src/lib/timezone.ts:1-10`), so "now" has to
 * be expressed in that same naive-UTC form before it is compared — which is
 * what `/api/events` does with `getESTNowISO()`. The route compared against
 * TRUE UTC (`new Date().toISOString()`) instead, so at 14:30 EDT (18:30Z) an
 * event stored as 16:00Z — 16:00 Eastern, ninety minutes away — was upcoming in
 * the feed and already gone from the caller's upcoming saved list.
 *
 * INTENTIONAL BEHAVIOUR CHANGE (06-18, DEC-80): an event is upcoming in saved
 * events exactly when it is upcoming in the feed. The assertions below moved
 * from the true-UTC values to the Eastern wall-clock values in the fixing
 * commit, under the ledger protocol (`evidence/defect-ledger.md`, F-085 row;
 * `evidence/f-085-fix.txt` in the Phase 6 directory). They go red against the
 * pre-fix source.
 *
 * Why the expected Eastern values are literals and not `getESTNowISO()`: the
 * worked instants are chosen so the arithmetic is checkable by eye (18:30Z is
 * 14:30 EDT; 19:30Z in January is 14:30 EST), and a literal cannot drift with
 * the helper it is asserting.
 *
 * The clock is pinned with Jest's modern fake timers faking `Date` only. The
 * subject is driven through the in-memory fake (`../../helpers/fakeSupabase.ts`)
 * behind a mock of "@/lib/supabase/server", the same seam as
 * `saved-events-characterization.test.ts`.
 *
 * Registered as F-085 in .planning/audit/findings.json.
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

describe("F-085 — the saved-events upcoming floor is the feed's Eastern wall-clock floor", () => {
  it("at 14:30 EDT (18:30Z) the floor is the Eastern 2026-09-23T14:30:00.000Z, not the true-UTC 2026-09-23T18:30:00.000Z", async () => {
    pinClock("2026-09-23T18:30:00.000Z");
    const fake = setup();
    const res = await GET(new NextRequest("http://localhost:3000/api/users/saved-events"));
    expect(res.status).toBe(200);
    expect(floorFilters(fake)).toEqual([
      { op: "gte", column: "start_date", value: "2026-09-23T14:30:00.000Z" },
    ]);
    expect(floorFilters(fake)[0].value).not.toBe("2026-09-23T18:30:00.000Z");
  });

  it("at 14:30 EST (19:30Z in January) the floor is the Eastern 2026-01-15T14:30:00.000Z — five hours behind true UTC", async () => {
    pinClock("2026-01-15T19:30:00.000Z");
    const fake = setup();
    await GET(new NextRequest("http://localhost:3000/api/users/saved-events"));
    expect(floorFilters(fake)).toEqual([
      { op: "gte", column: "start_date", value: "2026-01-15T14:30:00.000Z" },
    ]);
  });

  it("keeps an event ninety minutes away in Eastern time in the upcoming saved list", async () => {
    pinClock("2026-09-23T18:30:00.000Z");
    setup();
    const res = await GET(new NextRequest("http://localhost:3000/api/users/saved-events"));
    const body = await res.json();
    // SOON (16:00 Eastern) is still upcoming at 14:30 Eastern, and is kept.
    // Default sort is "recent": LATER was saved after SOON, so it comes first.
    expect(body.savedEventIds).toEqual([LATER.id, SOON.id]);
  });

  it("sends no floor at all when include_past=true", async () => {
    pinClock("2026-09-23T18:30:00.000Z");
    const fake = setup();
    await GET(new NextRequest("http://localhost:3000/api/users/saved-events?include_past=true"));
    expect(floorFilters(fake)).toEqual([]);
  });
});
