/**
 * DEFECT characterization — F-028 (the four routes DEC-39 answers with 401)
 *
 * Subjects, all GET, all personalized, all answering an anonymous caller with
 * 200 and an empty payload instead of 401:
 *   - `src/app/api/events/following/route.ts`          → `{"events":[]}`
 *   - `src/app/api/events/friends-activity/route.ts`   → `{"events":[]}`
 *   - `src/app/api/events/friends-organizing/route.ts` → `{"events":[]}`
 *   - `src/app/api/events/[id]/friends/route.ts`       → `{"friends":[],"count":0}`
 *
 * The defect (F-028): a route that only means something for a signed-in user
 * answers "you have nothing" to a caller who is not signed in, so a client
 * cannot tell "no data" from "not authenticated", and the response is
 * cacheable as an empty success. DEC-39 fixes these four with
 * `401 {"error":"Unauthorized"}` in 05-06. `GET /api/events/[id]/rsvp`,
 * `GET /api/clubs/[id]/events` and `/api/notifications/count` are NOT here:
 * the first two feed public UI and go to Phase 6 (research C7).
 *
 * Why no public surface depends on the anonymous 200 (research C7, re-checked
 * on this tree and recorded in `evidence/slice-3-characterization-handlers.txt`):
 * every client caller renders only for a signed-in user and ignores a non-ok
 * response — FollowedClubsEventsSection (`{user && …}` in `src/app/page.tsx`
 * and its own `if (!user) return`), FriendsActivitySection (`{user && …}` in
 * `src/app/page.tsx`, and the protected `/friends` page),
 * FriendsOrganizingSection (the protected `/friends` page) and FriendsGoing
 * (`{user && id && …}` in `EventDetailClient.tsx`).
 *
 * What this file pins:
 *   - A1..A4 (the defect, now fixed): with no user, each route answers 401
 *     and exactly `{"error":"Unauthorized"}`, never the empty body above.
 *     Until 05-06 these rows pinned the 200 and the empty body; they moved in
 *     the fixing commit, with a ledger row each.
 *   - S1..S4 (unchanged by the fix): a signed-in caller with a `users` row is
 *     not refused. Each route answers 200 and reaches its first data read
 *     (`club_followers` select, `get_friends` rpc, `get_friends` rpc,
 *     `get_friends_going_to_event` rpc). These rows stay as they are when the
 *     anonymous rows move.
 *
 * Related pin elsewhere: `src/__tests__/api/events/friends-defect.test.ts`
 * ("an unauthenticated caller short-circuits before any of this") pinned
 * the anonymous `{"friends":[],"count":0}` on `events/[id]/friends`. It moved
 * to the 401 in the same commit, with its own ledger row.
 *
 * Status: FIXED in 05-06 by the commit `fix(05-06): four personalized routes
 * answer anonymous callers 401 (F-028)`. Each route now opens with
 * `createRequestContext()` and `requireUser(ctx)`. The four anonymous rows
 * went red against the fix before they moved, and the moved rows went red
 * against the pre-fix routes (`evidence/defect-ledger.md`,
 * `evidence/handler-adoption-events.txt` Task 2). The signed-in rows did not
 * change.
 *
 * Mock: `@/lib/supabase/server` (createClient → the shared fake's client).
 * `events/[id]/friends` reaches the same factory through `createRequestContext`.
 * No other module is mocked.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import { GET as getFollowing } from "@/app/api/events/following/route";
import { GET as getFriendsActivity } from "@/app/api/events/friends-activity/route";
import { GET as getFriendsOrganizing } from "@/app/api/events/friends-organizing/route";
import { GET as getEventFriends } from "@/app/api/events/[id]/friends/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

const CALLER = {
  id: "5eed0000-0000-4000-8000-0a3000000001",
  email: "ring.caller@mail.mcgill.ca",
};
const EVENT_ID = "5eed0000-0000-4000-8000-0a30000000e1";

function setup(signedIn: boolean): FakeSupabase {
  mockFake = createFakeSupabase({
    user: signedIn ? CALLER : null,
    tables: {
      users: [
        {
          id: CALLER.id,
          roles: ["user"],
          onboarding_completed: true,
          banned_at: null,
          ban_expires_at: null,
        },
      ],
    },
  });
  return mockFake;
}

interface Route {
  name: string;
  call: () => Promise<Response>;
  /** The degraded 200 body an anonymous caller got before 05-06. */
  degradedBody: unknown;
  firstRead: string;
}

const ROUTES: Route[] = [
  {
    name: "GET /api/events/following",
    call: () => getFollowing(),
    degradedBody: { events: [] },
    firstRead: "club_followers.select",
  },
  {
    name: "GET /api/events/friends-activity",
    call: () => getFriendsActivity(),
    degradedBody: { events: [] },
    firstRead: "get_friends.rpc",
  },
  {
    name: "GET /api/events/friends-organizing",
    call: () => getFriendsOrganizing(),
    degradedBody: { events: [] },
    firstRead: "get_friends.rpc",
  },
  {
    name: "GET /api/events/[id]/friends",
    call: () =>
      getEventFriends(
        new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}/friends`),
        { params: Promise.resolve({ id: EVENT_ID }) }
      ),
    degradedBody: { friends: [], count: 0 },
    firstRead: "get_friends_going_to_event.rpc",
  },
];

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("F-028 anonymous caller on four personalized routes (fixed in 05-06)", () => {
  test.each(ROUTES.map((route) => [route.name, route] as const))(
    "F-028 %s: anonymous gets 401 Unauthorized, not an empty payload",
    async (_name, route) => {
      setup(false);
      const response = await route.call();
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
      expect(body).not.toEqual(route.degradedBody);
    }
  );
});

describe("F-028 signed-in caller on the same routes (unchanged by the fix)", () => {
  test.each(ROUTES.map((route) => [route.name, route] as const))(
    "F-028 %s: a signed-in caller with a users row is not refused",
    async (_name, route) => {
      const fake = setup(true);
      const response = await route.call();
      expect(response.status).not.toBe(401);
      expect(response.status).toBe(200);
      expect(fake.calls.map((c) => `${c.table}.${c.operation}`)).toContain(
        route.firstRead
      );
    }
  );
});
