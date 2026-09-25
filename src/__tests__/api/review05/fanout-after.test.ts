/**
 * The club-follower fanout is scheduled with `after()` (REVIEW-05 iter3 WR-06).
 *
 * POST /api/events/create started the fanout (two cookie reads and an
 * elevated notifications insert) as a detached promise after returning its
 * response. On Vercel the instance can be frozen once the response is sent,
 * so the insert could silently never run. The handler now hands the task to
 * `runAfterResponse()`, which schedules it with `after()` from `next/server`.
 *
 * `after` is mocked here to capture the task. Outside a request scope the
 * real `after` throws E468; the helper then runs the task detached, exactly
 * as before, which is the path every other suite exercises unchanged
 * (including the club gate pins, where a member creates an approved club
 * event).
 */

import {
  ADMIN,
  CLUB_ID,
  EVENT_ID,
  OTHER,
  THIRD,
  callsTo,
  jsonRequest,
  makeFake,
  profileOf,
  type Fake,
} from "./fake";

const mockAfter = jest.fn();

jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return { ...actual, after: (task: () => unknown) => mockAfter(task) };
});

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
  mockAfter.mockReset();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
}

function outsideRequestScope(): Error {
  return Object.defineProperty(
    new Error("`after` was called outside a request scope."),
    "__NEXT_ERROR_CODE",
    { value: "E468", enumerable: false }
  );
}

describe("runAfterResponse", () => {
  it("hands the task to after() and does not run it before the response", async () => {
    const { runAfterResponse } = await import("@/server/afterResponse");
    const task = jest.fn(async () => {});
    runAfterResponse(task);
    expect(mockAfter).toHaveBeenCalledTimes(1);
    await flush();
    expect(task).not.toHaveBeenCalled();
    await mockAfter.mock.calls[0][0]();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("outside a request scope (E468) runs the task detached, as before", async () => {
    const { runAfterResponse } = await import("@/server/afterResponse");
    mockAfter.mockImplementation(() => {
      throw outsideRequestScope();
    });
    const task = jest.fn(async () => {});
    runAfterResponse(task);
    await flush();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("any other after() error is rethrown", async () => {
    const { runAfterResponse } = await import("@/server/afterResponse");
    mockAfter.mockImplementation(() => {
      throw new Error("something else");
    });
    const task = jest.fn(async () => {});
    expect(() => runAfterResponse(task)).toThrow("something else");
    expect(task).not.toHaveBeenCalled();
  });

  it("a rejecting task is logged, never thrown", async () => {
    const { runAfterResponse } = await import("@/server/afterResponse");
    runAfterResponse(async () => {
      throw new Error("task boom");
    });
    await expect(mockAfter.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(
      errorSpy.mock.calls.some((c) => String(c[0]).includes("[afterResponse] task failed"))
    ).toBe(true);
  });
});

describe("POST /api/events/create (approved, with a club)", () => {
  it("answers 201 first, and the follower fanout runs only when after() runs it", async () => {
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
    expect(mockAfter).toHaveBeenCalledTimes(1);

    // Nothing of the fanout has run yet: no follower read, no insert.
    await flush();
    expect(callsTo(mockCookie, "club_followers", "select")).toHaveLength(0);
    expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(0);

    await mockAfter.mock.calls[0][0]();
    const [notify] = callsTo(mockElevated, "notifications", "insert");
    expect(
      (notify.payload as Array<{ user_id: string; type: string }>).map((n) => [
        n.user_id,
        n.type,
      ])
    ).toEqual([
      [OTHER, "new_event"],
      [THIRD, "new_event"],
    ]);
  });
});
