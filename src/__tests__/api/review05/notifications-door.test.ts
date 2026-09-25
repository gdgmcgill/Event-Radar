/**
 * Cross-user notifications go through the elevated door (REVIEW-05 WR-10).
 *
 * `notifications` INSERT is granted to service_role only. These three
 * handlers inserted on the caller's cookie client and ignored the error, so
 * nothing was ever delivered:
 *   - POST /api/events/[id]/invite (invitee notifications; it also answered
 *     `{ sent: N }` when the invite upsert itself failed);
 *   - POST /api/events/create (the club follower fanout of an approved event);
 *   - POST /api/users/[id]/follow (new follower / new friend).
 * Each insert now runs on the elevated client, its error is logged, and the
 * invite route answers 500 when the invite rows were not written.
 */

import {
  ADMIN,
  CLUB_ID,
  EVENT_ID,
  OTHER,
  THIRD,
  STUDENT,
  callsTo,
  idParams,
  jsonRequest,
  makeFake,
  profileOf,
  type Answers,
  type Fake,
} from "./fake";

let mockCookie: Fake;
let mockElevated: Fake;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function asStudent(cookie: Answers, elevated: Answers = {}): void {
  mockCookie = makeFake({
    user: STUDENT,
    profile: profileOf(STUDENT.id, ["user"]),
    answers: cookie,
  });
  mockElevated = makeFake({ answers: elevated });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
}

describe("POST /api/events/[id]/invite", () => {
  const friends: Answers = {
    "rpc:get_friends": { data: [{ id: OTHER }, { id: THIRD }] },
    "events.select": { data: { title: "Review Event" } },
    "users.select": { data: { name: "Inviter" } },
  };

  async function invite() {
    const { POST } = await import("@/app/api/events/[id]/invite/route");
    return POST(
      jsonRequest(`events/${EVENT_ID}/invite`, "POST", { invitee_ids: [OTHER, THIRD] }),
      idParams(EVENT_ID)
    );
  }

  it("notifies the newly invited through the door, none on the cookie client", async () => {
    asStudent({
      ...friends,
      "event_invites.upsert": { data: [{ invitee_id: OTHER }, { invitee_id: THIRD }] },
    });
    const res = await invite();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 2 });
    expect(callsTo(mockCookie, "notifications", "insert")).toHaveLength(0);
    // One insert per invitee (iter3 WR-03).
    const inserts = callsTo(mockElevated, "notifications", "insert");
    expect(inserts.map((c) => (c.payload as { user_id: string }).user_id)).toEqual([
      OTHER,
      THIRD,
    ]);
    expect(inserts[0].payload).toMatchObject({
      type: "event_invite",
      event_id: EVENT_ID,
    });
  });

  it("a re-invite notifies only the invitees whose invite is new", async () => {
    asStudent({ ...friends, "event_invites.upsert": { data: [{ invitee_id: THIRD }] } });
    const res = await invite();
    expect(await res.json()).toEqual({ sent: 2 });
    const inserts = callsTo(mockElevated, "notifications", "insert");
    expect(inserts.map((c) => (c.payload as { user_id: string }).user_id)).toEqual([THIRD]);
  });

  it("when every invite already existed, nothing is inserted", async () => {
    asStudent({ ...friends, "event_invites.upsert": { data: [] } });
    const res = await invite();
    expect(res.status).toBe(200);
    expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(0);
  });

  it("a failed invite upsert answers 500 and notifies nobody", async () => {
    asStudent({ ...friends, "event_invites.upsert": { error: { message: "denied" } } });
    const res = await invite();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to send invites" });
    expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(0);
  });

  it("a failed notification insert is logged; the invites stand", async () => {
    asStudent(
      { ...friends, "event_invites.upsert": { data: [{ invitee_id: OTHER }] } },
      { "notifications.insert": { error: { message: "boom" } } }
    );
    const res = await invite();
    expect(res.status).toBe(200);
    expect(
      errorSpy.mock.calls.some((c) => String(c[0]).includes("invite notifications"))
    ).toBe(true);
  });

  // REVIEW-05 iter3 WR-04: only a live, approved event can be shared. The
  // read is filtered on status and deleted_at, so a pending, rejected,
  // soft-deleted or unknown event reads as no row.
  it("iter3 WR-04: the event read requires an approved, live event", async () => {
    asStudent({
      ...friends,
      "event_invites.upsert": { data: [{ invitee_id: OTHER }] },
    });
    await invite();
    const [eventRead] = callsTo(mockCookie, "events", "select");
    expect(eventRead.filters).toEqual([
      { op: "eq", column: "id", value: EVENT_ID },
      { op: "eq", column: "status", value: "approved" },
      { op: "is", column: "deleted_at", value: null },
    ]);
  });

  it("iter3 WR-04: an event that is not approved and live answers 404 and writes nothing", async () => {
    asStudent({
      ...friends,
      "events.select": { data: null },
      "event_invites.upsert": { data: [{ invitee_id: OTHER }] },
    });
    const res = await invite();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Event not found" });
    expect(callsTo(mockCookie, "event_invites", "upsert")).toHaveLength(0);
    expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(0);
  });

  // REVIEW-05 iter3 WR-03: notifications_dedup_idx ignores the inviter, so a
  // new invite can meet an existing notification (a second inviter, or a
  // re-invite after the invitee deleted the invite). That one 23505 used to
  // drop every notification in the batch.
  it("iter3 WR-03: one invitee's duplicate notification does not stop the others", async () => {
    asStudent(
      {
        ...friends,
        "event_invites.upsert": { data: [{ invitee_id: OTHER }, { invitee_id: THIRD }] },
      },
      {
        "notifications.insert": [
          { error: { code: "23505", message: "duplicate key value violates unique constraint" } },
          { data: null },
        ],
      }
    );
    const res = await invite();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 2 });
    const inserts = callsTo(mockElevated, "notifications", "insert");
    expect(inserts.map((c) => (c.payload as { user_id: string }).user_id)).toEqual([
      OTHER,
      THIRD,
    ]);
    // A duplicate means the invitee is already notified: not logged as a failure.
    expect(
      errorSpy.mock.calls.some((c) => String(c[0]).includes("invite notifications"))
    ).toBe(false);
  });

  it("iter3 WR-03: a per-row failure other than a duplicate is logged; the other rows still insert", async () => {
    asStudent(
      {
        ...friends,
        "event_invites.upsert": { data: [{ invitee_id: OTHER }, { invitee_id: THIRD }] },
      },
      { "notifications.insert": [{ data: null }, { error: { message: "boom" } }] }
    );
    const res = await invite();
    expect(res.status).toBe(200);
    expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(2);
    const logged = errorSpy.mock.calls.filter((c) =>
      String(c[0]).includes("invite notifications")
    );
    expect(logged).toHaveLength(1);
    expect(String(logged[0][0])).toContain("row 2 of 2");
  });
});

describe("POST /api/users/[id]/follow", () => {
  async function follow() {
    const { POST } = await import("@/app/api/users/[id]/follow/route");
    return POST(jsonRequest(`users/${OTHER}/follow`, "POST"), idParams(OTHER));
  }

  it("a new follower is notified through the door", async () => {
    asStudent({
      "user_follows.select": { data: null },
      "users.select": { data: { name: "Follower" } },
    });
    const res = await follow();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ following: true, isFriend: false });
    expect(callsTo(mockCookie, "notifications", "insert")).toHaveLength(0);
    const [notify] = callsTo(mockElevated, "notifications", "insert");
    expect(notify.payload).toEqual([
      {
        user_id: OTHER,
        type: "new_follower",
        title: "New Follower",
        message: "Follower started following you.",
      },
    ]);
  });

  it("a mutual follow notifies both users through the door", async () => {
    asStudent({
      "user_follows.select": { data: { id: "f1" } },
      "users.select": { data: { name: "Friend" } },
    });
    const res = await follow();
    expect(await res.json()).toEqual({ following: true, isFriend: true });
    const [notify] = callsTo(mockElevated, "notifications", "insert");
    expect((notify.payload as Array<{ user_id: string; type: string }>).map((n) => [n.user_id, n.type])).toEqual([
      [OTHER, "new_friend"],
      [STUDENT.id, "new_friend"],
    ]);
  });

  it("a failed notification does not undo the follow, and is logged", async () => {
    asStudent(
      { "user_follows.select": { data: null }, "users.select": { data: { name: "F" } } },
      { "notifications.insert": { error: { message: "boom" } } }
    );
    const res = await follow();
    expect(res.status).toBe(201);
    expect(
      errorSpy.mock.calls.some((c) => String(c[0]).includes("follow notifications"))
    ).toBe(true);
  });
});

describe("POST /api/events/create (approved, with a club)", () => {
  it("the follower fanout is inserted through the door", async () => {
    mockCookie = makeFake({
      user: ADMIN,
      profile: profileOf(ADMIN.id, ["user", "admin"]),
      answers: {
        "users.select": { data: { name: "Admin" } },
        "events.select": { data: [] },
        "events.insert": { data: { id: EVENT_ID } },
        "clubs.select": { data: { name: "Review Club" } },
        "club_followers.select": { data: [{ user_id: OTHER }, { user_id: THIRD }] },
      },
    });
    mockElevated = makeFake();
    const { POST } = await import("@/app/api/events/create/route");
    const res = await POST(
      jsonRequest("events/create", "POST", {
        title: "Fanout Event",
        description: "An event",
        location: "Leacock 132",
        start_date: "2099-01-01T18:00:00Z",
        end_date: "2099-01-01T20:00:00Z",
        tags: ["academic"],
        club_id: CLUB_ID,
      })
    );
    expect(res.status).toBe(201);
    await flush();
    expect(callsTo(mockCookie, "notifications", "insert")).toHaveLength(0);
    const [notify] = callsTo(mockElevated, "notifications", "insert");
    expect(notify).toBeDefined();
    expect((notify.payload as Array<{ user_id: string; type: string }>).map((n) => [n.user_id, n.type])).toEqual([
      [OTHER, "new_event"],
      [THIRD, "new_event"],
    ]);
  });
});
