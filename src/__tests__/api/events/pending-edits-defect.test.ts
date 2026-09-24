/**
 * DEFECT characterization — F-086: pending edits never reach their creator (or an admin)
 *
 * Status: OPEN — the creator and admin rows move in 05-14 (DEC-53).
 *
 * Subject: `GET /api/events/[id]` (`src/app/api/events/[id]/route.ts`),
 * written against the unmodified route at plan 05-12's base commit (4e368b6),
 * with the REAL `transformEventFromDB` (`src/lib/tagMapping.ts`).
 *
 * The defect (research § G, registered from Phase 4's DI-36): the transform
 * builds a fresh object and never copies `pending_edits`. The route's
 * creator-or-admin branch returns that object unchanged, so the column never
 * reaches anyone, and the creator's "your changes will be reviewed" notice
 * (`EventDetailView.tsx`) and the edit form's prefill cannot render from this
 * route. The stripping branch for everyone else is dead at the response level.
 *
 * Pinned today (measured; `evidence/slice-5-characterization.txt` § 2.3):
 *   E1  the creator: 200, and `event` has no `pending_edits` key.
 *   E2  an admin (roles ["user","admin"]): 200, no `pending_edits` key.
 * Fixed (05-14, DEC-53): E1 and E2 receive `pending_edits` equal to the
 * stored `{ "title": "x" }`, attached after the unchanged shared transform.
 *
 * Does NOT move:
 *   E3  another signed-in user: 200, no `pending_edits` key.
 *   E4  an anonymous caller: 200, no `pending_edits` key.
 * The characterization suite `events-detail-characterization.test.ts` (layer b)
 * already pins the handler's own visibility gate through a transform that
 * carries the column; it runs unedited next to this file.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
  type FakeUser,
} from "../../helpers/fakeSupabase";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixture (synthetic ids, not seed ids) ─────────────────────────────────

const CREATOR: FakeUser = {
  id: "5eed0000-0000-4000-8000-0a5300000001",
  email: "pending.creator@mail.mcgill.ca",
};
const ADMIN: FakeUser = {
  id: "5eed0000-0000-4000-8000-0a5300000002",
  email: "pending.admin@mail.mcgill.ca",
};
const STRANGER: FakeUser = {
  id: "5eed0000-0000-4000-8000-0a5300000003",
  email: "pending.stranger@mail.mcgill.ca",
};
const EVENT_ID = "5eed0000-0000-4000-8000-0a53000000e1";
const PENDING = { title: "x" };

const profile = (user: FakeUser, roles: string[]): FakeRow => ({
  id: user.id,
  roles,
  onboarding_completed: true,
  banned_at: null,
  ban_expires_at: null,
});

const EVENT_ROW: FakeRow = {
  id: EVENT_ID,
  title: "Pending Edits Event",
  description: "An event with an edit awaiting review",
  start_date: "2030-03-01T18:00:00+00:00",
  end_date: "2030-03-01T20:00:00+00:00",
  location: "Pending Hall",
  club_id: null,
  organizer: null,
  tags: ["academic"],
  image_url: null,
  status: "approved",
  created_by: CREATOR.id,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
  deleted_at: null,
  pending_edits: PENDING,
};

function as(user: FakeUser | null): void {
  mockFake = createFakeSupabase({
    user,
    tables: {
      users: [
        profile(CREATOR, ["user"]),
        profile(ADMIN, ["user", "admin"]),
        profile(STRANGER, ["user"]),
      ],
      events: [EVENT_ROW],
    },
  });
}

type GetHandler = (typeof import("@/app/api/events/[id]/route"))["GET"];

async function get(): Promise<{ status: number; event: Record<string, unknown> }> {
  const handler: GetHandler = (await import("@/app/api/events/[id]/route")).GET;
  const response = await handler(
    new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}`),
    { params: Promise.resolve({ id: EVENT_ID }) }
  );
  const body = (await response.json()) as { event: Record<string, unknown> };
  return { status: response.status, event: body.event };
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Moves in 05-14 ────────────────────────────────────────────────────────

describe("F-086 today: pending_edits is dropped by the shared transform", () => {
  it("E1: the creator does not receive pending_edits", async () => {
    as(CREATOR);
    const { status, event } = await get();

    expect(status).toBe(200);
    expect(event.id).toBe(EVENT_ID);
    expect(event.pending_edits).toBeUndefined();
    expect(Object.keys(event)).not.toContain("pending_edits");
  });

  it("E2: an admin does not receive pending_edits", async () => {
    as(ADMIN);
    const { status, event } = await get();

    expect(status).toBe(200);
    expect(event.id).toBe(EVENT_ID);
    expect(event.pending_edits).toBeUndefined();
    expect(Object.keys(event)).not.toContain("pending_edits");
  });
});

// ─── Does not move ─────────────────────────────────────────────────────────

describe("F-086 rows that do not move", () => {
  it("E3: another signed-in user does not receive pending_edits", async () => {
    as(STRANGER);
    const { status, event } = await get();

    expect(status).toBe(200);
    expect(Object.keys(event)).not.toContain("pending_edits");
  });

  it("E4: an anonymous caller does not receive pending_edits", async () => {
    as(null);
    const { status, event } = await get();

    expect(status).toBe(200);
    expect(Object.keys(event)).not.toContain("pending_edits");
  });
});
