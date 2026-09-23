/**
 * DEFECT characterization — F-080 (and F-050's false comment)
 *
 * Subject: `src/lib/tagMapping.ts:102-144`, `transformEventFromDB`, and the two
 * routes that reach its fabricating branch because they select `*` with no
 * club embed: `src/app/api/events/[id]/route.ts:79-86` and
 * `src/app/api/users/saved-events/route.ts:92-97`.
 *
 *     if (dbEvent.club) {               // 105-123: ten real columns copied;
 *       club = { …, banner_url: null,   //   five URL columns hard-coded null
 *                website_url: null, … };
 *     } else if (dbEvent.organizer) {   // 124-143: FABRICATED
 *       club = { id: dbEvent.organizer, name: dbEvent.organizer,
 *                status: "approved", /* everything else null *\/ };
 *     }
 *
 * The defect, in two halves:
 *   - FABRICATION. An event row with an `organizer` string and no club embed
 *     gets a club whose id and name are that string and whose status is
 *     "approved", whatever the real club is. `/api/events/[id]` line 79 says
 *     "Fetch event without club relation since Clubs table does not exist",
 *     which is false (F-050): `clubs` exists and six sibling routes embed it.
 *   - BLANKING. On the real-club branch, `banner_url`, `website_url`,
 *     `discord_url`, `twitter_url` and `linkedin_url` are hard-coded null
 *     because the embed never asks for them; a caller cannot tell "the club
 *     has no website" from "the API did not ask".
 *
 * THE SEEDED CONSEQUENCE, in plain words: every seeded event has both a real
 * club_id and an organizer label (`Seed Organizer A|B|C`, picked by the seed's
 * PRNG in `scripts/seed/load.ts:325-349`). So today the detail page says
 * "Hosted by" the organizer label, while the feed card for the same event —
 * built from `/api/events`, which embeds the club — shows the real club,
 * "Seed Approved Club". Two surfaces disagree about one row. The persona
 * harness measures this on the running app in `e2e/specs/event-read-path.spec.ts`.
 *
 * What this file is and is not:
 *
 *   - It is a DEFECT test, in FOUR pins that move in different plans, so a
 *     reviewer can see which pin moved in which commit and why (DEC-27):
 *       pin A — the organizer fallback: moves only if the 04-11 decision
 *               ships the visual fix (it changes "Hosted by" on every
 *               seeded detail page, which orchestrator decision 1 forbids
 *               without the owner's say-so);
 *       pin B — the five blanked URL columns: moves in 04-10 (non-visual);
 *       pin C — `/api/users/saved-events` selects `*` with no embed: moves in
 *               04-10 (its only consumer reads ids, so nothing renders it);
 *       pin D — `/api/events/[id]` selects `*` with no embed, and so returns
 *               the fabricated club: moves only if the 04-11 decision ships
 *               the visual fix.
 *     Each passes today and is expected to keep passing until its commit.
 *   - It is NOT a failing test and NOT a fix. `contact_email` is null on both
 *     branches and is deliberately NOT pinned: DEC-27 keeps it out of event
 *     payloads on purpose (data minimisation), so it is not expected to move.
 *
 * Why pins A and B call `transformEventFromDB` directly while C and D invoke
 * the handlers and read the in-memory fake's CALL LOG
 * (`../../helpers/fakeSupabase.ts`): A and B are properties of the transform
 * whatever route feeds it. C and D are properties of what each route ASKS
 * for — the fake answers an embed from a fixture's own `club` key, so a
 * response-level assertion there could not tell "the route asked for the
 * club" from "the fixture happened to carry one". The select string is the
 * observable. Pin D also asserts the response, because that response is what
 * the detail page renders.
 *
 * Registered as F-080 in .planning/audit/findings.json (the comment is
 * F-050). Observed red under a mutation that sets the fallback's id to null;
 * see `evidence/slice-2-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import { transformEventFromDB } from "@/lib/tagMapping";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeRow,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import { GET as getDetail } from "@/app/api/events/[id]/route";
import { GET as getSavedEvents } from "@/app/api/users/saved-events/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

type DBRow = Parameters<typeof transformEventFromDB>[0];

const CLUB_ID = "5eed0000-0000-4000-8000-0000000000c1";
const EVENT_ID = "5eed0000-0000-4000-8000-0000000000e1";
const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };

/** The seeded shape: a real club_id AND an organizer label, and no club embed. */
const SEEDED_SHAPE: FakeRow = {
  id: EVENT_ID,
  title: "Seed Approved Event",
  description: "An approved event",
  start_date: "2027-03-01T18:00:00+00:00",
  end_date: "2027-03-01T20:00:00+00:00",
  location: "Leacock 132",
  organizer: "Seed Organizer A",
  club_id: CLUB_ID,
  tags: ["academic"],
  image_url: null,
  created_by: null,
  created_at: "2026-06-01T16:00:00+00:00",
  updated_at: "2026-06-01T16:00:00+00:00",
  status: "approved",
  deleted_at: null,
};

/** A real club embed that also carries the five URL columns the embed omits today. */
const CLUB_EMBED = {
  id: CLUB_ID,
  name: "Seed Approved Club",
  instagram_handle: "seedclub",
  logo_url: "https://example.supabase.co/logo.png",
  description: "The approved club",
  category: "academic",
  status: "approved",
  created_by: "5eed0000-0000-4000-8000-000000000004",
  created_at: "2026-05-01T00:00:00+00:00",
  updated_at: "2026-05-02T00:00:00+00:00",
  website_url: "https://seedclub.example",
  banner_url: "https://example.supabase.co/banner.png",
  discord_url: "https://discord.gg/seedclub",
  twitter_url: "https://twitter.com/seedclub",
  linkedin_url: "https://linkedin.com/company/seedclub",
};

const eventSelect = (calls: FakeCall[]): FakeCall | undefined =>
  calls.find((c) => c.table === "events" && c.operation === "select");

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Pin A ──────────────────────────────────────────────────────────────────

describe("F-080 pin A — the organizer fallback fabricates a club (moves only if the 04-11 decision ships the visual fix)", () => {
  it("a row with no club and organizer 'Seed Organizer A' gets a club whose id and name are both that string, status approved", () => {
    const { club } = transformEventFromDB({ ...SEEDED_SHAPE, club_id: null } as unknown as DBRow);
    expect(club).toMatchObject({
      id: "Seed Organizer A",
      name: "Seed Organizer A",
      status: "approved",
    });
  });

  it("with a real club_id present, the fabricated club still ignores it: its id is the label, not the club_id", () => {
    const event = transformEventFromDB(SEEDED_SHAPE as unknown as DBRow);
    expect(event.club_id).toBe(CLUB_ID);
    expect(event.club?.id).toBe("Seed Organizer A");
    expect(event.club?.id).not.toBe(event.club_id);
    expect(event.club).toMatchObject({
      logo_url: null,
      description: null,
      category: null,
      created_by: null,
      created_at: SEEDED_SHAPE.created_at,
    });
  });
});

// ─── Pin B ──────────────────────────────────────────────────────────────────

describe("F-080 pin B — the real-club branch blanks five URL columns (moves in 04-10)", () => {
  it("an embed carrying website_url, banner_url, discord_url, twitter_url and linkedin_url comes out with all five null", () => {
    const { club } = transformEventFromDB({ ...SEEDED_SHAPE, club: CLUB_EMBED } as unknown as DBRow);
    expect(club).toMatchObject({
      id: CLUB_ID,
      name: "Seed Approved Club",
      website_url: null,
      banner_url: null,
      discord_url: null,
      twitter_url: null,
      linkedin_url: null,
    });
  });
});

// ─── Pin C ──────────────────────────────────────────────────────────────────

describe("F-080 pin C — /api/users/saved-events reads events with columns * and no club embed (moves in 04-10)", () => {
  it("the events read selects exactly '*'", async () => {
    mockFake = createFakeSupabase({
      user: CALLER,
      tables: {
        users: [{ id: CALLER.id, roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null }],
        saved_events: [{ id: "s1", user_id: CALLER.id, event_id: EVENT_ID, created_at: "2026-09-01T10:00:00+00:00" }],
        events: [SEEDED_SHAPE],
      },
    });
    const res = await getSavedEvents(new NextRequest("http://localhost:3000/api/users/saved-events"));
    expect(res.status).toBe(200);
    const select = eventSelect(mockFake.calls);
    expect(select?.columns).toBe("*");
    expect(select?.columns).not.toContain("clubs(");
  });
});

// ─── Pin D ──────────────────────────────────────────────────────────────────

describe("F-080 pin D — /api/events/[id] reads the event with columns * and no club embed (moves only if the 04-11 decision ships the visual fix)", () => {
  async function detail() {
    mockFake = createFakeSupabase({ user: null, tables: { events: [SEEDED_SHAPE] } });
    const res = await getDetail(new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}`), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    return { res, body: (await res.json()) as { event: { club_id: string; club?: { id: string; name: string } } } };
  }

  it("the events read selects exactly '*'", async () => {
    const { res } = await detail();
    expect(res.status).toBe(200);
    const select = eventSelect(mockFake.calls);
    expect(select?.columns).toBe("*");
    expect(select?.columns).not.toContain("clubs(");
  });

  it("so a seeded-shape event's detail response names the organizer label as its club, not the real club", async () => {
    const { body } = await detail();
    expect(body.event.club_id).toBe(CLUB_ID);
    expect(body.event.club).toMatchObject({ id: "Seed Organizer A", name: "Seed Organizer A" });
    expect(body.event.club?.name).not.toBe("Seed Approved Club");
  });
});
