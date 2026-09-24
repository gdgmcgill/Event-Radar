/**
 * DEFECT characterization — F-088, F-089 (F-062 related)
 *
 * Subject: every state-changing arm in `writeHandlerTable.ts` (39 arms: every
 * exported POST, PUT, PATCH and DELETE under `src/app/api` outside `admin/`,
 * `cron/` and `recommendations/batch/`), called directly, the way a script
 * or a client that ignores the proxy calls it.
 *
 * The defects, as registered:
 *   - F-088: the handler ring fails open. Only ten arms call the legacy ban
 *     helper, so a banned caller is admitted on the other 29. The helper
 *     itself reads "no profile row" as "not banned" (`src/lib/ban.ts`, the
 *     `profile && isBanned(profile)` test), so a signed-in caller with no
 *     `users` row is admitted on every arm. The proxy's ban redirect is the
 *     only other ring, and it answers a JSON call with an HTML redirect (F-062)
 *     and passes through on its own errors, so it cannot stand in.
 *   - F-089: nothing on the handler ring checks onboarding. A caller whose
 *     `onboarding_completed` is false is admitted on every arm; the proxy's
 *     cookie redirect exempts `/api/*`.
 *
 * What this file pins, per arm, with the shape it takes once the arm is fixed:
 *   - D1 (F-088) arms without the legacy helper, banned caller.
 *       today: the response is not 403 `{"error":"Account suspended"}`.
 *       fixed: exactly 403 `{"error":"Account suspended"}`, and the call log is
 *       exactly one `users` select (the guard's read) and nothing else.
 *   - D2 (F-088, DEC-35) every arm, signed-in caller with no `users` row.
 *       today: not 403 `{"error":"Profile not found"}` (note that
 *       `profile/inferred-tags DELETE` answers 404 with that text today; the
 *       status is what differs).
 *       fixed: exactly 403 `{"error":"Profile not found"}`, no write.
 *   - D3 (F-089) every arm except DEC-34's two onboarding exemptions,
 *       un-onboarded caller. The anonymous-tolerant arms are included,
 *       because a user is present and DEC-34 guards them when one is.
 *       today: not 403 `{"error":"Onboarding required"}`.
 *       fixed: exactly 403 `{"error":"Onboarding required"}`, no write.
 *
 * How a row flips. `GUARDED` below is the set of arm ids already guarded.
 * The commit in 05-06 or 05-07 that puts `requireActiveUser` and
 * `requireOnboarded` in front of an arm adds that arm's id to `GUARDED` and
 * records the move in `evidence/defect-ledger.md`. That is the only edit this
 * file takes; the sibling suite that pins the surviving bytes
 * (`write-handlers-characterization.test.ts`) is never edited. Before the id
 * is added, the today-shape assertion goes red against the fix, which is the
 * proof the row pinned something real.
 *
 * Status: OPEN — rows flip as 05-06 and 05-07 guard each arm
 *
 * Mocks: `@/lib/supabase/server` and `@/lib/supabase/service` (both return
 * the shared fake's client, so every read and write lands in one call log)
 * and `next/headers` (a cookies() stub). The legacy ban helper is not mocked.
 *
 * Mutation evidence: `evidence/slice-3-mutation-check-handlers.txt` cycle 2
 * adds an early suspended-403 to `events/[id]/save` DELETE and shows the D1
 * row for that arm turn red.
 */

import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import {
  PERSONAS,
  WRITE_ARMS,
  callShape,
  refusedWith,
  runArm,
  writeCalls,
  type PersonaName,
  type WriteArm,
} from "./writeHandlerTable";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockFake.client,
}));

jest.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: () => undefined,
      getAll: () => [],
      set: () => undefined,
      delete: () => undefined,
    }),
}));

/**
 * Arm ids whose guards have landed. Empty on the unmodified tree; the fixing
 * commits add ids here, one row per arm, with a ledger row each.
 */
const GUARDED: ReadonlySet<string> = new Set<string>([
  // 05-06: the events family, plus recommendations/feedback and user/engagement
  "events/[id]/save POST",
  "events/[id]/save DELETE",
  "events/[id]/rsvp POST",
  "events/[id]/rsvp DELETE",
  "events/create POST",
  "events/[id]/invite POST",
  "events/[id]/appeal POST",
  "events/[id]/report POST",
  "events/[id]/reviews POST",
  "events/[id] PATCH",
  "events/[id] DELETE",
  "events/upload-image POST",
  "recommendations/feedback POST",
  "user/engagement POST",
  // 05-07 Task 1: the clubs family
  "clubs POST",
  "clubs/[id]/appeal POST",
  "clubs/[id]/follow POST",
  "clubs/[id]/follow DELETE",
  "clubs/[id]/invites POST",
  "clubs/[id]/members/role PATCH",
  "clubs/[id]/members DELETE",
  "clubs/[id] PATCH",
  "clubs/[id] DELETE",
  "clubs/[id]/transfer POST",
  "clubs/banner POST",
  "clubs/logo POST",
]);

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function as(persona: PersonaName): FakeSupabase {
  mockFake = createFakeSupabase(PERSONAS[persona]());
  return mockFake;
}

function rows(filter: (arm: WriteArm) => boolean): [string, WriteArm][] {
  return WRITE_ARMS.filter(filter).map((arm) => [arm.id, arm]);
}

test("GUARDED names only arms that exist in the table", () => {
  const ids = new Set(WRITE_ARMS.map((arm) => arm.id));
  expect([...GUARDED].filter((armId) => !ids.has(armId))).toEqual([]);
});

describe("F-088 D1 banned caller on arms without the legacy ban helper", () => {
  test.each(rows((arm) => !arm.legacyBan))(
    "F-088 D1 %s: banned caller",
    async (armId, arm) => {
      const fake = as("banned");
      const outcome = await runArm(arm);
      if (GUARDED.has(armId)) {
        expect(outcome).toEqual({
          status: 403,
          body: { error: "Account suspended" },
        });
        expect(callShape(fake.calls)).toEqual(["users.select"]);
      } else {
        expect(refusedWith(outcome, 403, "Account suspended")).toBe(false);
      }
    }
  );
});

describe("F-088 D2 signed-in caller with no users row", () => {
  test.each(rows(() => true))(
    "F-088 D2 %s: no profile row",
    async (armId, arm) => {
      const fake = as("noProfile");
      const outcome = await runArm(arm);
      if (GUARDED.has(armId)) {
        expect(outcome).toEqual({
          status: 403,
          body: { error: "Profile not found" },
        });
        expect(writeCalls(fake.calls)).toEqual([]);
      } else {
        expect(refusedWith(outcome, 403, "Profile not found")).toBe(false);
      }
    }
  );
});

describe("F-089 D3 un-onboarded caller on every non-exempt arm", () => {
  test.each(rows((arm) => !arm.onboardingExempt))(
    "F-089 D3 %s: un-onboarded caller",
    async (armId, arm) => {
      const fake = as("unonboarded");
      const outcome = await runArm(arm);
      if (GUARDED.has(armId)) {
        expect(outcome).toEqual({
          status: 403,
          body: { error: "Onboarding required" },
        });
        expect(writeCalls(fake.calls)).toEqual([]);
      } else {
        expect(refusedWith(outcome, 403, "Onboarding required")).toBe(false);
      }
    }
  );
});
