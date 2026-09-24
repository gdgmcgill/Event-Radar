/**
 * PRESERVE characterization — club membership decisions at the 17 sites of research § C (REFAC-12)
 *
 * Written against the UNMODIFIED route handlers at 05-08's head (f1ab6a1),
 * before slice 4 collapses these hand-rolled `club_members` reads into
 * `requireClubRole` (05-10, DEC-40). This file must pass byte for byte,
 * unedited, after that. A red here after 05-10 is a behaviour change, not a
 * test problem.
 *
 * The 17 sites are research § C's table, in its order: 12 gates, 3 flags
 * (`clubs/[id]/events` isOrganizer, `events/[id]/reviews` isOrganizer,
 * `events/create` auto-approve) and 2 composite arms (`events/[id]` PATCH and
 * DELETE, where club membership is one of three ways in).
 *
 * Two facts shape every row:
 *   - C1: `club_members.role` admits only `owner` and `organizer`
 *     (`club_members_role_check`). So there are exactly two accepted sets,
 *     `["owner"]` and `["owner","organizer"]`, and "wrong role" exists only on
 *     the owner-only sites, where it is the organizer.
 *   - R9: club membership is the only authority over club operations. An
 *     admin with no membership row gets the same 403 as any other non-member
 *     at every gate. The composite arms have their OWN inline admin arm (the
 *     `roles.includes("admin")` read in the handler), which is not a club
 *     bypass; it is pinned separately so a site-wide bypass in the gates cannot
 *     hide behind it.
 *
 * What is pinned, per site (every value measured first; the measurement is in
 * `evidence/slice-4-characterization.txt` §1):
 *   - P0 the table is research § C: 17 rows numbered 1 to 17, the gate deny
 *     strings exactly as § C lists them;
 *   - P1 anonymous caller: the exact status and body today;
 *   - P2 non-member (the attacker, owner of a different club): gates and
 *     composite arms answer 403 with the site's exact body, and nothing is
 *     written on either client;
 *   - P3 wrong role (the organizer) on the eight owner-only gates: the same
 *     403 body, nothing written;
 *   - P4 admin with no membership: the same 403 body at all 12 gates (R9);
 *     the composite arms admit the admin through their own admin arm;
 *   - P5 right role (the owner everywhere, the organizer where accepted): the
 *     handler proceeds. Only the status class is asserted (not 401, not 403),
 *     because what the handler does next is not a membership decision;
 *   - P6 the flag sites: the observable difference between a member and a
 *     non-member (the response field, the listed rows, the inserted status).
 *
 * Mocks: `@/lib/supabase/server` returns fake A (the cookie client) and
 * `@/lib/supabase/service` returns a separate fake B (the elevated client), so
 * "nothing was written" is checked on both. Both fakes hold the same fixture.
 * Every caller has an onboarded, unbanned `users` row, so the slice-3 seam
 * guards admit them and the pins isolate the membership decision. No other
 * module is mocked.
 *
 * Deliberately NOT pinned here: which client performs the owner's writes. That
 * is the owner-writes file's subject (F-087), and it changes in 05-10.
 *
 * Mutation evidence: `evidence/slice-4-mutation-check.txt` cycles 1, 2, 4
 * and 5 turn P3, P2, P6 and P4 rows red by editing SOURCE only.
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
}));

// ─── Fixture (synthetic ids, not seed ids) ─────────────────────────────────

const U = {
  owner: "5eed0000-0000-4000-8000-0c9000000001",
  organizer: "5eed0000-0000-4000-8000-0c9000000002",
  attacker: "5eed0000-0000-4000-8000-0c9000000003",
  admin: "5eed0000-0000-4000-8000-0c9000000004",
  creator: "5eed0000-0000-4000-8000-0c9000000005",
} as const;

const CLUB = {
  /** The approved club every site acts on. */
  gate: "5eed0000-0000-4000-8000-0c90000000c1",
  /** The attacker's own approved club. */
  attackers: "5eed0000-0000-4000-8000-0c90000000c2",
  /** The attacker's own club that is still pending moderation. */
  attackersPending: "5eed0000-0000-4000-8000-0c90000000c3",
} as const;

const MEMBERSHIP = {
  owner: "5eed0000-0000-4000-8000-0c90000000b1",
  organizer: "5eed0000-0000-4000-8000-0c90000000b2",
  attacker: "5eed0000-0000-4000-8000-0c90000000b3",
  attackerPending: "5eed0000-0000-4000-8000-0c90000000b4",
} as const;

const EVENT = {
  /** Approved, in the gate club, created by a user who is not a caller. */
  gate: "5eed0000-0000-4000-8000-0c90000000e1",
  /** Pending, in the gate club: members see it, the public does not. */
  gatePending: "5eed0000-0000-4000-8000-0c90000000e2",
  /** Approved, in the gate club, created by the non-member attacker. */
  byAttacker: "5eed0000-0000-4000-8000-0c90000000e3",
  /** Approved, in the gate club, created by the member organizer. */
  byOrganizer: "5eed0000-0000-4000-8000-0c90000000e4",
} as const;

const GATE_CLUB_NAME = "Gate Club";
const REVIEW_COMMENT = {
  rating: 4,
  comment: "Worth going",
  created_at: "2026-01-11T00:00:00Z",
};

type Caller = "anonymous" | "attacker" | "organizer" | "admin" | "owner";
type MemberRole = "owner" | "organizer";

function userRow(id: string, name: string, roles: string[]): FakeRow {
  return {
    id,
    email: `${name.toLowerCase().replace(/ /g, ".")}@mail.mcgill.ca`,
    name,
    avatar_url: null,
    roles,
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
  };
}

function event(
  id: string,
  title: string,
  status: string,
  createdBy: string,
  startDate: string
): FakeRow {
  return {
    id,
    title,
    status,
    club_id: CLUB.gate,
    created_by: createdBy,
    start_date: startDate,
    deleted_at: null,
    pending_edits: null,
  };
}

function tables(): Record<string, FakeRow[]> {
  return {
    users: [
      userRow(U.owner, "Gate Owner", ["user"]),
      userRow(U.organizer, "Gate Organizer", ["user"]),
      userRow(U.attacker, "Gate Attacker", ["user"]),
      userRow(U.admin, "Gate Admin", ["user", "admin"]),
      userRow(U.creator, "Gate Creator", ["user"]),
    ],
    clubs: [
      {
        id: CLUB.gate,
        name: GATE_CLUB_NAME,
        status: "approved",
        created_by: U.owner,
        description: "The gate club",
      },
      {
        id: CLUB.attackers,
        name: "Attacker Club",
        status: "approved",
        created_by: U.attacker,
        description: "The attacker's own club",
      },
      {
        id: CLUB.attackersPending,
        name: "Attacker Pending Club",
        status: "pending",
        created_by: U.attacker,
        description: "Awaiting moderation",
      },
    ],
    club_members: [
      {
        id: MEMBERSHIP.owner,
        club_id: CLUB.gate,
        user_id: U.owner,
        role: "owner",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: MEMBERSHIP.organizer,
        club_id: CLUB.gate,
        user_id: U.organizer,
        role: "organizer",
        created_at: "2026-01-02T00:00:00Z",
      },
      {
        id: MEMBERSHIP.attacker,
        club_id: CLUB.attackers,
        user_id: U.attacker,
        role: "owner",
        created_at: "2026-01-03T00:00:00Z",
      },
      {
        id: MEMBERSHIP.attackerPending,
        club_id: CLUB.attackersPending,
        user_id: U.attacker,
        role: "owner",
        created_at: "2026-01-04T00:00:00Z",
      },
    ],
    events: [
      event(EVENT.gate, "Gate Event", "approved", U.creator, "2026-01-10T18:00:00+00:00"),
      event(EVENT.gatePending, "Gate Pending Event", "pending", U.creator, "2026-01-11T18:00:00+00:00"),
      event(EVENT.byAttacker, "Attacker Event", "approved", U.attacker, "2026-01-12T18:00:00+00:00"),
      event(EVENT.byOrganizer, "Organizer Event", "approved", U.organizer, "2026-01-13T18:00:00+00:00"),
    ],
    reviews: [
      {
        id: "5eed0000-0000-4000-8000-0c90000000a1",
        user_id: U.creator,
        event_id: EVENT.gate,
        ...REVIEW_COMMENT,
      },
    ],
    club_invitations: [],
    club_followers: [],
    rsvps: [],
    saved_events: [],
    event_popularity_scores: [],
  };
}

/** Fresh fakes for one call: A is the caller's cookie client, B the elevated one. */
function arrange(caller: Caller): void {
  const user =
    caller === "anonymous"
      ? null
      : { id: U[caller], email: `${caller}@mail.mcgill.ca` };
  mockCookie = createFakeSupabase({ user, tables: tables() });
  mockElevated = createFakeSupabase({ user: null, tables: tables() });
}

// ─── Requests ──────────────────────────────────────────────────────────────

const BASE = "http://localhost:3000/api";

function json(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`${BASE}/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

/** A few PNG bytes and the club id; the upload arms read clubId first. */
function upload(path: string, clubId: string): NextRequest {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "gate.png", {
      type: "image/png",
    })
  );
  form.append("clubId", clubId);
  return new NextRequest(`${BASE}/${path}`, { method: "POST", body: form });
}

function id(value: string) {
  return { params: Promise.resolve({ id: value }) };
}

function createBody(clubId: string | undefined) {
  return {
    title: "Created Gate Event",
    description: "About it",
    start_date: "2031-03-15T18:00:00Z",
    location: "Room 1",
    tags: ["academic"],
    ...(clubId === undefined ? {} : { club_id: clubId }),
  };
}

// ─── The 17 sites (research § C, in its order) ─────────────────────────────

type SiteKind = "gate" | "flag" | "composite";

interface ClubSite {
  /** The row number in research § C. */
  n: number;
  id: string;
  kind: SiteKind;
  accepted: readonly MemberRole[];
  /** The 403 body a refused caller gets (gates and composite arms). */
  deny: string | null;
  /** Today's anonymous status and body, measured. */
  anonymous: { status: number; body: unknown };
  call(): Promise<Response>;
}

const OWNER_ONLY: readonly MemberRole[] = ["owner"];
const ANY_MEMBER: readonly MemberRole[] = ["owner", "organizer"];
const UNAUTHORIZED = { status: 401, body: { error: "Unauthorized" } };

const SITES: readonly ClubSite[] = [
  {
    n: 1,
    id: "clubs/[id]/analytics GET",
    kind: "gate",
    accepted: ANY_MEMBER,
    deny: "You must be a club member to view analytics",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/analytics/route")).GET(
        json(`clubs/${CLUB.gate}/analytics`, "GET"),
        id(CLUB.gate)
      ),
  },
  {
    n: 2,
    id: "clubs/[id]/events GET",
    kind: "flag",
    accepted: ANY_MEMBER,
    deny: null,
    // Public route (research C7): anonymous callers get the approved list.
    anonymous: { status: 200, body: "public list, isOrganizer false (P6)" },
    call: async () =>
      (await import("@/app/api/clubs/[id]/events/route")).GET(
        json(`clubs/${CLUB.gate}/events`, "GET"),
        id(CLUB.gate)
      ),
  },
  {
    n: 3,
    id: "clubs/[id]/invites GET",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can view invitations",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/invites/route")).GET(
        json(`clubs/${CLUB.gate}/invites`, "GET"),
        id(CLUB.gate)
      ),
  },
  {
    n: 4,
    id: "clubs/[id]/invites POST",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can send invitations",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/invites/route")).POST(
        json(`clubs/${CLUB.gate}/invites`, "POST", {
          email: "invitee@mail.mcgill.ca",
        }),
        id(CLUB.gate)
      ),
  },
  {
    n: 5,
    id: "clubs/[id]/members/role PATCH",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can change roles",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/members/role/route")).PATCH(
        json(`clubs/${CLUB.gate}/members/role`, "PATCH", {
          memberId: MEMBERSHIP.organizer,
          role: "organizer",
        }),
        id(CLUB.gate)
      ),
  },
  {
    n: 6,
    id: "clubs/[id]/members GET",
    kind: "gate",
    accepted: ANY_MEMBER,
    deny: "You must be a member of this club to view members",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/members/route")).GET(
        json(`clubs/${CLUB.gate}/members`, "GET"),
        id(CLUB.gate)
      ),
  },
  {
    n: 7,
    id: "clubs/[id]/members DELETE",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can remove members",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/members/route")).DELETE(
        json(`clubs/${CLUB.gate}/members`, "DELETE", {
          memberId: MEMBERSHIP.organizer,
        }),
        id(CLUB.gate)
      ),
  },
  {
    n: 8,
    id: "clubs/[id] PATCH",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can update club details",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/route")).PATCH(
        json(`clubs/${CLUB.gate}`, "PATCH", {
          description: "An updated description",
        }),
        id(CLUB.gate)
      ),
  },
  {
    n: 9,
    id: "clubs/[id] DELETE",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can delete the club",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/route")).DELETE(
        json(`clubs/${CLUB.gate}`, "DELETE", { confirmName: GATE_CLUB_NAME }),
        id(CLUB.gate)
      ),
  },
  {
    n: 10,
    id: "clubs/[id]/transfer POST",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can transfer ownership",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/[id]/transfer/route")).POST(
        json(`clubs/${CLUB.gate}/transfer`, "POST", { newOwnerId: U.organizer }),
        id(CLUB.gate)
      ),
  },
  {
    n: 11,
    id: "clubs/banner POST",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can upload a banner",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/banner/route")).POST(
        upload("clubs/banner", CLUB.gate)
      ),
  },
  {
    n: 12,
    id: "clubs/logo POST",
    kind: "gate",
    accepted: OWNER_ONLY,
    deny: "Only the club owner can upload a logo",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/clubs/logo/route")).POST(
        upload("clubs/logo", CLUB.gate)
      ),
  },
  {
    n: 13,
    id: "events/[id]/analytics GET",
    kind: "gate",
    accepted: ANY_MEMBER,
    deny: "You must be a club member to view analytics",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/events/[id]/analytics/route")).GET(
        json(`events/${EVENT.gate}/analytics`, "GET"),
        id(EVENT.gate)
      ),
  },
  {
    n: 14,
    id: "events/[id]/reviews GET",
    kind: "flag",
    accepted: ANY_MEMBER,
    deny: null,
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/events/[id]/reviews/route")).GET(
        json(`events/${EVENT.gate}/reviews`, "GET"),
        id(EVENT.gate)
      ),
  },
  {
    n: 15,
    id: "events/[id] PATCH",
    kind: "composite",
    accepted: ANY_MEMBER,
    deny: "You do not have permission to edit this event",
    anonymous: {
      status: 401,
      body: { error: "You must be signed in to edit an event" },
    },
    call: async () =>
      (await import("@/app/api/events/[id]/route")).PATCH(
        json(`events/${EVENT.gate}`, "PATCH", { description: "Edited" }),
        id(EVENT.gate)
      ),
  },
  {
    n: 16,
    id: "events/[id] DELETE",
    kind: "composite",
    accepted: ANY_MEMBER,
    deny: "You do not have permission to delete this event",
    anonymous: UNAUTHORIZED,
    call: async () =>
      (await import("@/app/api/events/[id]/route")).DELETE(
        json(`events/${EVENT.gate}`, "DELETE"),
        id(EVENT.gate)
      ),
  },
  {
    n: 17,
    id: "events/create POST",
    kind: "flag",
    accepted: ANY_MEMBER,
    deny: null,
    anonymous: {
      status: 401,
      body: { error: "You must be signed in to create an event" },
    },
    call: async () =>
      (await import("@/app/api/events/create/route")).POST(
        json("events/create", "POST", createBody(CLUB.gate))
      ),
  },
];

/** Research § C's deny column, transcribed once and compared against the table. */
const RESEARCH_C_DENY: Readonly<Record<number, string>> = {
  1: "You must be a club member to view analytics",
  3: "Only the club owner can view invitations",
  4: "Only the club owner can send invitations",
  5: "Only the club owner can change roles",
  6: "You must be a member of this club to view members",
  7: "Only the club owner can remove members",
  8: "Only the club owner can update club details",
  9: "Only the club owner can delete the club",
  10: "Only the club owner can transfer ownership",
  11: "Only the club owner can upload a banner",
  12: "Only the club owner can upload a logo",
  13: "You must be a club member to view analytics",
  15: "You do not have permission to edit this event",
  16: "You do not have permission to delete this event",
};

// ─── Running a site ────────────────────────────────────────────────────────

interface Outcome {
  status: number | "threw";
  body: unknown;
}

async function run(call: () => Promise<Response>): Promise<Outcome> {
  try {
    const response = await call();
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON; keep the text
    }
    return { status: response.status, body };
  } catch (error) {
    return {
      status: "threw",
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runAs(caller: Caller, site: ClubSite): Promise<Outcome> {
  arrange(caller);
  return run(() => site.call());
}

const WRITES = new Set(["insert", "update", "delete", "rpc"]);

/** Every state-changing call on either client, as `table.operation`. */
function writesOnBothClients(): string[] {
  const shape = (calls: readonly FakeCall[], client: string) =>
    calls
      .filter((c) => WRITES.has(c.operation))
      .map((c) => `${client}:${c.table}.${c.operation}`);
  return [
    ...shape(mockCookie.calls, "cookie"),
    ...shape(mockElevated.calls, "elevated"),
  ];
}

/** The status of the single `events` insert on the cookie client. */
function insertedEventStatus(): unknown {
  const inserts = mockCookie.calls.filter(
    (c) => c.table === "events" && c.operation === "insert"
  );
  expect(inserts).toHaveLength(1);
  return (inserts[0].payload as FakeRow).status;
}

const gates = SITES.filter((s) => s.kind === "gate");
const refusing = SITES.filter((s) => s.deny !== null);
const ownerOnlyGates = gates.filter((s) => s.accepted.length === 1);
const composites = SITES.filter((s) => s.kind === "composite");

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── P0 ────────────────────────────────────────────────────────────────────

describe("P0 the table is research § C", () => {
  test("17 sites, numbered 1 to 17 in order", () => {
    expect(SITES.map((s) => s.n)).toEqual(
      Array.from({ length: 17 }, (_, i) => i + 1)
    );
  });

  test("12 gates, 3 flags, 2 composite arms", () => {
    expect(gates.map((s) => s.n)).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(SITES.filter((s) => s.kind === "flag").map((s) => s.n)).toEqual([2, 14, 17]);
    expect(composites.map((s) => s.n)).toEqual([15, 16]);
  });

  test("the accepted sets are the only two C1 allows", () => {
    expect(ownerOnlyGates.map((s) => s.n)).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12]);
    for (const site of SITES) {
      expect([OWNER_ONLY, ANY_MEMBER]).toContain(site.accepted);
    }
  });

  test("every deny string is § C's, byte for byte", () => {
    const table: Record<number, string> = {};
    for (const site of refusing) table[site.n] = site.deny as string;
    expect(table).toEqual(RESEARCH_C_DENY);
  });
});

// ─── P1 anonymous ──────────────────────────────────────────────────────────

describe("P1 anonymous caller", () => {
  test.each(SITES.filter((s) => s.n !== 2).map((s) => [s.n, s.id, s] as const))(
    "#%i %s answers its measured anonymous bytes and writes nothing",
    async (_n, _id, site) => {
      const outcome = await runAs("anonymous", site);
      expect(outcome).toEqual(site.anonymous);
      expect(writesOnBothClients()).toEqual([]);
    }
  );

  test("#2 clubs/[id]/events GET admits the anonymous caller (public route)", async () => {
    const outcome = await runAs("anonymous", SITES[1]);
    expect(outcome.status).toBe(200);
    expect((outcome.body as { isOrganizer: unknown }).isOrganizer).toBe(false);
  });
});

// ─── P2 non-member ─────────────────────────────────────────────────────────

describe("P2 non-member (owner of a different club)", () => {
  test.each(refusing.map((s) => [s.n, s.id, s] as const))(
    "#%i %s answers 403 with its exact body and writes nothing",
    async (_n, _id, site) => {
      const outcome = await runAs("attacker", site);
      expect(outcome).toEqual({ status: 403, body: { error: site.deny } });
      expect(writesOnBothClients()).toEqual([]);
    }
  );
});

// ─── P3 wrong role ─────────────────────────────────────────────────────────

describe("P3 wrong role (the organizer) on the owner-only gates", () => {
  test.each(ownerOnlyGates.map((s) => [s.n, s.id, s] as const))(
    "#%i %s answers 403 with its exact body and writes nothing",
    async (_n, _id, site) => {
      const outcome = await runAs("organizer", site);
      expect(outcome).toEqual({ status: 403, body: { error: site.deny } });
      expect(writesOnBothClients()).toEqual([]);
    }
  );
});

// ─── P4 admin without membership ───────────────────────────────────────────

describe("P4 admin with no membership row (R9: no bypass)", () => {
  test.each(gates.map((s) => [s.n, s.id, s] as const))(
    "#%i %s answers the same 403 as any non-member",
    async (_n, _id, site) => {
      const outcome = await runAs("admin", site);
      expect(outcome).toEqual({ status: 403, body: { error: site.deny } });
      expect(writesOnBothClients()).toEqual([]);
    }
  );

  test.each(composites.map((s) => [s.n, s.id, s] as const))(
    "#%i %s admits the admin through its own inline admin arm, not membership",
    async (_n, _id, site) => {
      // The admin is in no club, so only the handler's own admin arm can
      // admit them. Only the status is pinned; the order in which the arm
      // consults creator, admin and membership is not a membership decision.
      const outcome = await runAs("admin", site);
      expect(outcome.status).toBe(200);
    }
  );
});

// ─── P5 right role ─────────────────────────────────────────────────────────

describe("P5 right role: the handler proceeds past the membership decision", () => {
  const rows = SITES.flatMap((site) =>
    site.accepted.map((role) => [site.n, site.id, role, site] as const)
  );

  test.each(rows)("#%i %s as %s is neither 401 nor 403", async (_n, _id, role, site) => {
    const outcome = await runAs(role, site);
    expect(outcome.status).not.toBe("threw");
    expect(outcome.status).not.toBe(401);
    expect(outcome.status).not.toBe(403);
  });
});

// ─── P6 the flag sites ─────────────────────────────────────────────────────

describe("P6 #2 clubs/[id]/events GET: isOrganizer", () => {
  type Listed = { status: string; rsvp_counts?: unknown };

  test.each(["owner", "organizer"] as const)(
    "a member (%s) is an organizer: pending rows listed, RSVP counts attached",
    async (caller) => {
      const outcome = await runAs(caller, SITES[1]);
      const body = outcome.body as { events: Listed[]; isOrganizer: boolean };
      expect(outcome.status).toBe(200);
      expect(body.isOrganizer).toBe(true);
      expect(body.events.map((e) => e.status).sort()).toEqual([
        "approved",
        "approved",
        "approved",
        "pending",
      ]);
      for (const listed of body.events) {
        expect(listed.rsvp_counts).toEqual({ going: 0, interested: 0, cancelled: 0 });
      }
    }
  );

  test.each(["anonymous", "attacker", "admin"] as const)(
    "a non-member (%s) is not: approved rows only, no RSVP counts",
    async (caller) => {
      const outcome = await runAs(caller, SITES[1]);
      const body = outcome.body as { events: Listed[]; isOrganizer: boolean };
      expect(outcome.status).toBe(200);
      expect(body.isOrganizer).toBe(false);
      expect(body.events.map((e) => e.status)).toEqual([
        "approved",
        "approved",
        "approved",
      ]);
      for (const listed of body.events) {
        expect(listed).not.toHaveProperty("rsvp_counts");
      }
    }
  );
});

describe("P6 #14 events/[id]/reviews GET: isOrganizer", () => {
  test.each(["owner", "organizer"] as const)(
    "a member (%s) sees the anonymized comments",
    async (caller) => {
      const outcome = await runAs(caller, SITES[13]);
      expect(outcome.status).toBe(200);
      expect(
        (outcome.body as { aggregate: { comments: unknown } }).aggregate.comments
      ).toEqual([REVIEW_COMMENT]);
    }
  );

  test.each(["attacker", "admin"] as const)(
    "a non-member (%s) gets an empty comments array",
    async (caller) => {
      const outcome = await runAs(caller, SITES[13]);
      expect(outcome.status).toBe(200);
      expect(
        (outcome.body as { aggregate: { comments: unknown } }).aggregate.comments
      ).toEqual([]);
    }
  );
});

describe("P6 #17 events/create POST: the auto-approve flag", () => {
  async function create(caller: Caller, clubId: string | undefined) {
    arrange(caller);
    const outcome = await run(async () =>
      (await import("@/app/api/events/create/route")).POST(
        json("events/create", "POST", createBody(clubId))
      )
    );
    expect(outcome.status).toBe(201);
    return insertedEventStatus();
  }

  test.each(["owner", "organizer"] as const)(
    "a member (%s) of an approved club creates an approved event",
    async (caller) => {
      expect(await create(caller, CLUB.gate)).toBe("approved");
    }
  );

  test("a non-member creating for someone else's approved club gets pending", async () => {
    expect(await create("attacker", CLUB.gate)).toBe("pending");
  });

  test("a member of their own approved club gets approved", async () => {
    expect(await create("attacker", CLUB.attackers)).toBe("approved");
  });

  test("a member of their own pending club gets pending", async () => {
    expect(await create("attacker", CLUB.attackersPending)).toBe("pending");
  });

  test("a member creating with no club gets pending", async () => {
    expect(await create("organizer", undefined)).toBe("pending");
  });

  test("an admin with no membership gets approved through the inline admin arm", async () => {
    expect(await create("admin", CLUB.gate)).toBe("approved");
  });
});

describe("P6 #15 events/[id] PATCH: the composite member arm and isClubMember", () => {
  async function patch(caller: Caller, eventId: string, body: unknown) {
    arrange(caller);
    return run(async () =>
      (await import("@/app/api/events/[id]/route")).PATCH(
        json(`events/${eventId}`, "PATCH", body),
        id(eventId)
      )
    );
  }

  test("a member who did not create the event may edit it", async () => {
    const outcome = await patch("organizer", EVENT.gate, { description: "Edited" });
    expect(outcome.status).toBe(200);
    expect((outcome.body as { pending_fields: unknown }).pending_fields).toEqual([]);
  });

  test("a non-member who did not create it is refused", async () => {
    const outcome = await patch("attacker", EVENT.gate, { description: "Edited" });
    expect(outcome).toEqual({
      status: 403,
      body: { error: "You do not have permission to edit this event" },
    });
  });

  test("a member-creator's title edit on an approved event goes live", async () => {
    const outcome = await patch("organizer", EVENT.byOrganizer, { title: "Renamed" });
    expect(outcome.status).toBe(200);
    expect((outcome.body as { pending_fields: unknown }).pending_fields).toEqual([]);
    const update = mockCookie.calls.find(
      (c) => c.table === "events" && c.operation === "update"
    );
    expect(update?.payload).toEqual({ title: "Renamed" });
  });

  test("a non-member creator's title edit on an approved event is held for moderation", async () => {
    const outcome = await patch("attacker", EVENT.byAttacker, { title: "Renamed" });
    expect(outcome.status).toBe(200);
    expect((outcome.body as { pending_fields: unknown }).pending_fields).toEqual([
      "title",
    ]);
    const update = mockCookie.calls.find(
      (c) => c.table === "events" && c.operation === "update"
    );
    expect(Object.keys(update?.payload as FakeRow)).toEqual(["pending_edits"]);
  });

  test("a member who did not create it has a title edit held for moderation", async () => {
    const outcome = await patch("organizer", EVENT.gate, { title: "Renamed" });
    expect(outcome.status).toBe(200);
    expect((outcome.body as { pending_fields: unknown }).pending_fields).toEqual([
      "title",
    ]);
  });
});

describe("P6 #16 events/[id] DELETE: the composite member arm", () => {
  async function remove(caller: Caller, eventId: string) {
    arrange(caller);
    return run(async () =>
      (await import("@/app/api/events/[id]/route")).DELETE(
        json(`events/${eventId}`, "DELETE"),
        id(eventId)
      )
    );
  }

  test("a member who did not create the event may delete it", async () => {
    expect(await remove("organizer", EVENT.gate)).toEqual({
      status: 200,
      body: { success: true },
    });
  });

  test("a non-member who did not create it is refused", async () => {
    expect(await remove("attacker", EVENT.gate)).toEqual({
      status: 403,
      body: { error: "You do not have permission to delete this event" },
    });
    expect(writesOnBothClients()).toEqual([]);
  });

  test("a non-member creator may delete their own event (the creator arm)", async () => {
    expect(await remove("attacker", EVENT.byAttacker)).toEqual({
      status: 200,
      body: { success: true },
    });
  });
});
