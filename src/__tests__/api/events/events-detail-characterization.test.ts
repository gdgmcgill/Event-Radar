/**
 * PRESERVE characterization — GET /api/events/[id] (REFAC-10)
 *
 * Written against the UNMODIFIED route `src/app/api/events/[id]/route.ts`
 * (GET, lines 71-134) at plan 04-04's base commit b632f62. Slice 2 touches
 * this file's GET only if the 04-11 checkpoint ships the club embed (DEC-27);
 * 04-10 edits a comment in it. This file must pass unedited after both.
 *
 * Tests cover:
 *   - an id with no row (PGRST116 from `.single()`) is 404
 *     `{ error: "Event not found" }`; a soft-deleted row is the same 404
 *   - any other query error is a 500, and so is a thrown error
 *   - a found event comes back as `{ event }` — one key — with its stored
 *     id, title, start_date and stable tags
 *   - THE VISIBILITY GATE on `pending_edits` (lines 108-124), in two layers:
 *       (a) with the real transform: an anonymous caller, a signed-in
 *           stranger, a club organizer and a caller with no users row never
 *           receive a `pending_edits` key, even when the row holds one;
 *       (b) through a transform that carries `pending_edits` (a delegating
 *           wrapper on `transformEventFromDB`, see below): the creator and a
 *           caller whose users row has the admin role receive it; everyone
 *           else has it stripped, and the stripped event is otherwise
 *           identical to the creator's.
 *
 * WHY LAYER (b) EXISTS — measured while writing this file, recorded as DI-36
 * in `evidence/deferred-items.md`: `transformEventFromDB`
 * (`src/lib/tagMapping.ts:146-173`) builds a fresh object and never copies
 * `pending_edits`, so with the real transform NO caller receives it — not the
 * creator, not an admin. The stripping branch is dead at the response level,
 * and the creator's "Your changes … will be reviewed" notice
 * (`EventDetailView.tsx:207`) cannot render from this route. Layer (a) pins
 * the half that must survive any fix (non-owners never see it). Layer (b)
 * pins the handler's own gate so that when DI-36 is fixed the visibility rule
 * is already under test. The wrapper delegates to the real function and only
 * adds the one column back; 04-07, 04-10 and 04-11 all keep
 * `transformEventFromDB` exported from `@/lib/tagMapping`, which the route
 * imports, so the seam does not move under Slice 2.
 *
 * DELIBERATELY NOT PINNED (each may change in the named commit):
 *   - the select column string and the club shape — F-080; the embed and the
 *     removal of the organizer fallback ship only if the 04-11 checkpoint
 *     says so (DEC-27). Fixtures carry `organizer: null` and no `club` key.
 *     The fabricated club is pinned only in `club-fabrication-defect.test.ts`.
 *   - any tag outside the six stable members — F-081 (DEC-26).
 *   - the text of a 500 body — F-059, Phase 5. Only the status is asserted.
 *   - whether the creator or an admin receives `pending_edits` through the
 *     REAL transform — DI-36. Asserting "they don't" would pin a defect as
 *     preserved behaviour; asserting "they do" would be false today.
 *   - which query decides admin-ness (today a `users.roles` read). Only the
 *     outcome per caller is asserted, so a seam adoption cannot move it.
 *
 * The seam is "@/lib/supabase/server", behind which the in-memory fake
 * (`../../helpers/fakeSupabase.ts`) evaluates `eq`/`is` and `.single()`
 * against the rows it holds, so a handler that dropped the `deleted_at`
 * filter would return the soft-deleted fixture with a 200 and go red.
 * Every assertion invokes the exported `GET` and asserts on the response.
 * Observed red under mutations of the stripping branch and of the deleted_at
 * filter; see `evidence/slice-2-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import type { Event } from "@/types";
import * as tagMapping from "@/lib/tagMapping";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
  type FakeUser,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/events/[id]/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// A delegating wrapper: by default it IS the real transform (reset in the
// top-level beforeEach); layer (b) swaps in a version that also carries
// pending_edits.
jest.mock("@/lib/tagMapping", () => {
  const actual = jest.requireActual<typeof import("@/lib/tagMapping")>("@/lib/tagMapping");
  return { ...actual, transformEventFromDB: jest.fn(actual.transformEventFromDB) };
});

const actualTagMapping = jest.requireActual<typeof import("@/lib/tagMapping")>("@/lib/tagMapping");
const mockTransform = jest.mocked(tagMapping.transformEventFromDB);

type DBRow = Parameters<typeof actualTagMapping.transformEventFromDB>[0];

function transformCarryingPendingEdits(row: DBRow): Event {
  return {
    ...actualTagMapping.transformEventFromDB(row),
    pending_edits: (row as unknown as Pick<Event, "pending_edits">).pending_edits,
  };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CREATOR: FakeUser = { id: "5eed0000-0000-4000-8000-00000000c001", email: "creator@mail.mcgill.ca" };
const ADMIN: FakeUser = { id: "5eed0000-0000-4000-8000-00000000c002", email: "admin@mail.mcgill.ca" };
const STRANGER: FakeUser = { id: "5eed0000-0000-4000-8000-00000000c003", email: "stranger@mail.mcgill.ca" };
const ORGANIZER: FakeUser = { id: "5eed0000-0000-4000-8000-00000000c004", email: "organizer@mail.mcgill.ca" };
const NO_PROFILE: FakeUser = { id: "5eed0000-0000-4000-8000-00000000c005", email: "ghost@mail.mcgill.ca" };

const profile = (user: FakeUser, roles: string[]): FakeRow => ({
  id: user.id,
  roles,
  onboarding_completed: true,
  banned_at: null,
  ban_expires_at: null,
});

const USERS: FakeRow[] = [
  profile(CREATOR, ["user"]),
  profile(ADMIN, ["user", "admin"]),
  profile(STRANGER, ["user"]),
  profile(ORGANIZER, ["user", "club_organizer"]),
];

const PENDING_EDITS = { title: "Renamed Lecture", submitted_at: "2026-09-20T10:00:00+00:00" };

const EVENT_ID = "5eed0000-0000-4000-8000-00000000e001";
const DELETED_ID = "5eed0000-0000-4000-8000-00000000e002";
const MISSING_ID = "5eed0000-0000-4000-8000-00000000e0ff";

function eventRow(id: string, overrides: FakeRow = {}): FakeRow {
  return {
    id,
    title: "Alpha Lecture",
    description: "Alpha Lecture description",
    start_date: "2026-10-05T18:00:00+00:00",
    end_date: "2026-10-05T20:00:00+00:00",
    location: "Leacock 132",
    organizer: null,
    club_id: null,
    tags: ["academic", "social"],
    image_url: null,
    category: null,
    source: "manual",
    source_url: null,
    content_hash: null,
    rsvp_count: 0,
    is_free: true,
    price: null,
    rsvp_link: null,
    created_by: CREATOR.id,
    created_at: "2026-08-01T12:00:00+00:00",
    updated_at: "2026-08-01T12:00:00+00:00",
    status: "approved",
    deleted_at: null,
    appeal_count: 0,
    pending_edits: PENDING_EDITS,
    ...overrides,
  };
}

const EVENTS: FakeRow[] = [
  eventRow(EVENT_ID),
  eventRow(DELETED_ID, { deleted_at: "2026-09-01T00:00:00+00:00" }),
];

interface DetailBody {
  event?: Record<string, unknown>;
  error?: string;
}

async function get(eventId: string, user: FakeUser | null, init: Partial<FakeSupabaseInit> = {}) {
  mockFake = createFakeSupabase({ user, tables: { users: USERS, events: EVENTS }, ...init });
  const res = await GET(new NextRequest(`http://localhost:3000/api/events/${eventId}`), {
    params: Promise.resolve({ id: eventId }),
  });
  const body = (await res.json()) as DetailBody;
  return { res, body };
}

beforeEach(() => {
  mockTransform.mockImplementation(actualTagMapping.transformEventFromDB);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/events/[id] — not found and errors", () => {
  it("an id with no row is 404 Event not found", async () => {
    const { res, body } = await get(MISSING_ID, null);
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Event not found" });
  });

  it("a soft-deleted row is 404 Event not found", async () => {
    const { res, body } = await get(DELETED_ID, CREATOR);
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Event not found" });
  });

  it("any other query error is a 500", async () => {
    const { res } = await get(EVENT_ID, null, { errors: { events: { code: "XX000", message: "fake failure" } } });
    expect(res.status).toBe(500);
  });

  it("a thrown error is a 500", async () => {
    const { res } = await get(EVENT_ID, null, { throwOn: { events: "connection reset" } });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/events/[id] — the found event", () => {
  it("returns 200 with exactly one key, event, holding the stored id, title, start_date and tags", async () => {
    const { res, body } = await get(EVENT_ID, null);
    expect(res.status).toBe(200);
    expect(Object.keys(body)).toEqual(["event"]);
    expect(body.event).toMatchObject({
      id: EVENT_ID,
      title: "Alpha Lecture",
      start_date: "2026-10-05T18:00:00+00:00",
      tags: ["academic", "social"],
      created_by: CREATOR.id,
    });
  });
});

describe("GET /api/events/[id] — pending_edits, (a) with the real transform: non-owners never receive it", () => {
  it.each([
    ["an anonymous caller", null],
    ["a signed-in stranger", STRANGER],
    ["a club organizer who did not create the event", ORGANIZER],
    ["a signed-in caller with no users row", NO_PROFILE],
  ])("%s gets no pending_edits key, though the row holds one", async (_label, user) => {
    const { res, body } = await get(EVENT_ID, user);
    expect(res.status).toBe(200);
    expect(body.event).toBeDefined();
    expect(body.event).not.toHaveProperty("pending_edits");
  });
});

describe("GET /api/events/[id] — pending_edits, (b) the handler's gate, through a transform that carries it", () => {
  beforeEach(() => {
    mockTransform.mockImplementation(transformCarryingPendingEdits);
  });

  it("the creator receives pending_edits", async () => {
    const { res, body } = await get(EVENT_ID, CREATOR);
    expect(res.status).toBe(200);
    expect(body.event?.pending_edits).toEqual(PENDING_EDITS);
  });

  it("a caller whose users row has the admin role receives pending_edits", async () => {
    const { res, body } = await get(EVENT_ID, ADMIN);
    expect(res.status).toBe(200);
    expect(body.event?.pending_edits).toEqual(PENDING_EDITS);
  });

  it.each([
    ["an anonymous caller", null],
    ["a signed-in stranger", STRANGER],
    ["a club organizer who did not create the event", ORGANIZER],
    ["a signed-in caller with no users row", NO_PROFILE],
  ])("%s has pending_edits stripped", async (_label, user) => {
    const { res, body } = await get(EVENT_ID, user);
    expect(res.status).toBe(200);
    expect(body.event).toBeDefined();
    expect(body.event).not.toHaveProperty("pending_edits");
  });

  it("the stripped event is otherwise identical to the creator's", async () => {
    const owner = await get(EVENT_ID, CREATOR);
    const stranger = await get(EVENT_ID, STRANGER);
    const { pending_edits: _omitted, ...ownerWithout } = owner.body.event ?? {};
    expect(stranger.body.event).toEqual(ownerWithout);
  });
});
