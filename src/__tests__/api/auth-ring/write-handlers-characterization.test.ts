/**
 * PRESERVE characterization — the write-handler auth ring (REFAC-11)
 *
 * Written against the UNMODIFIED route handlers at the commit after plan 05-02
 * (0c265a4). Plans 05-06 (events family) and 05-07 (every other arm) put
 * `requireActiveUser` and `requireOnboarded` in front of these arms (DEC-34).
 * This file must pass byte for byte, unedited, after both. A red here after
 * either plan is a behaviour change, not a test problem.
 *
 * The arms come from `writeHandlerTable.ts`: every exported POST, PUT, PATCH
 * and DELETE under `src/app/api` outside `admin/`, `cron/` and
 * `recommendations/batch/`. P0 re-derives that list from the tree on every run,
 * so an arm added without a descriptor turns this file red.
 *
 * What is pinned (each expectation was measured before it was pinned; the
 * measurements are in `evidence/slice-3-characterization-handlers.txt`):
 *   - P0 the table is the tree: the descriptor ids equal the enumeration, the
 *     ten legacy-ban arms, the two onboarding exemptions and the two
 *     anonymous-tolerant arms are exactly the named ones;
 *   - P1 every arm, anonymous caller: the exact status and parsed body today
 *     (`ANONYMOUS_BYTES`). 34 arms answer 401 `{"error":"Unauthorized"}`, three
 *     answer 401 with their own text, and no anonymous request writes. The
 *     anonymous-tolerant arms (feedback, interactions) are admitted: their
 *     measured non-401 status is pinned;
 *   - P2 the ten legacy-ban arms, banned caller: 403 with body exactly
 *     `{"error":"Account suspended"}`, and no insert, update, delete or rpc.
 *     The seam guard must reproduce these bytes;
 *   - P3 the two onboarding exemptions, un-onboarded caller: admitted.
 *     `POST /api/onboarding/complete` answers 200 `{"success":true}` and the
 *     self `PATCH /api/users/[id]` answers 200 and stores
 *     `onboarding_completed: true`. Without these two the wizard cannot finish
 *     (research C2, Pitfall 8);
 *   - P4 the ten legacy-ban arms, expired suspension: not refused as suspended;
 *   - P5 the two anonymous-tolerant arms, active signed-in caller: admitted.
 *
 * Mocks: `@/lib/supabase/server` (createClient → the shared fake's client),
 * `@/lib/supabase/service` (createServiceClient → the same client, so a
 * service-role write lands in the same call log) and `next/headers` (a
 * cookies() stub with get, getAll, set and delete, which
 * `onboarding/complete` calls). The legacy ban helper in `src/lib/ban.ts` is
 * NOT mocked: it builds its client from the mocked server factory and reads
 * the same fake, so P2 pins the real rule. No other module is mocked.
 *
 * Deliberately NOT pinned here: what a banned, profile-less or un-onboarded
 * caller gets on the arms that do not check today. That is today's fail-open
 * admission, which the sibling `write-handlers-ring-defect.test.ts` pins as
 * the known-wrong half, and which 05-06 and 05-07 change.
 *
 * Mutation evidence: `evidence/slice-3-mutation-check-handlers.txt` cycles
 * 1, 3 and 4 turn P2, P1 and P3 rows red by editing SOURCE only.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import {
  CALLER,
  PERSONAS,
  WRITE_ARMS,
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

// ─── P0: the table is the tree ─────────────────────────────────────────────

const API_DIR = join(process.cwd(), "src", "app", "api");
const EXCLUDED = ["admin/", "cron/", "recommendations/batch/"];
const WRITE_VERB = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/g;

function enumerateWriteArms(): string[] {
  const arms: string[] = [];
  for (const entry of readdirSync(API_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== "route.ts") continue;
    const file = join(entry.parentPath, entry.name);
    const route = relative(API_DIR, entry.parentPath).split(sep).join("/");
    if (EXCLUDED.some((prefix) => `${route}/`.startsWith(prefix))) continue;
    for (const match of readFileSync(file, "utf8").matchAll(WRITE_VERB)) {
      arms.push(`${route} ${match[1]}`);
    }
  }
  return arms.sort();
}

describe("P0 the descriptor table equals the route tree", () => {
  test("every write arm under src/app/api has exactly one descriptor", () => {
    const ids = WRITE_ARMS.map((arm) => arm.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(enumerateWriteArms());
    expect(ids).toHaveLength(39);
  });

  test("the ten legacy-ban arms are exactly the helper's callers", () => {
    expect(
      WRITE_ARMS.filter((arm) => arm.legacyBan)
        .map((arm) => arm.id)
        .sort()
    ).toEqual(
      [
        "clubs POST",
        "clubs/[id]/appeal POST",
        "events/[id]/appeal POST",
        "events/[id]/invite POST",
        "events/[id]/rsvp POST",
        "events/[id]/save POST",
        "events/create POST",
        "recommendations/feedback POST",
        "user/engagement POST",
        "users/[id]/follow POST",
      ].sort()
    );
  });

  test("the two onboarding exemptions and the two anonymous-tolerant arms", () => {
    expect(
      WRITE_ARMS.filter((arm) => arm.onboardingExempt).map((arm) => arm.id)
    ).toEqual(["onboarding/complete POST", "users/[id] PATCH"]);
    expect(
      WRITE_ARMS.filter((arm) => arm.anonymousTolerant).map((arm) => arm.id)
    ).toEqual(["feedback POST", "interactions POST"]);
  });
});

// ─── P1: anonymous bytes ───────────────────────────────────────────────────

const UNAUTHORIZED = { status: 401, body: { error: "Unauthorized" } };

/** Measured on the unmodified tree; see the evidence file's P1 table. */
const ANONYMOUS_BYTES: Record<string, { status: number; body: unknown }> = {
  "clubs/[id]/appeal POST": UNAUTHORIZED,
  "clubs/[id]/follow POST": UNAUTHORIZED,
  "clubs/[id]/follow DELETE": UNAUTHORIZED,
  "clubs/[id]/invites POST": UNAUTHORIZED,
  "clubs/[id]/members/role PATCH": UNAUTHORIZED,
  "clubs/[id]/members DELETE": UNAUTHORIZED,
  "clubs/[id] PATCH": UNAUTHORIZED,
  "clubs/[id] DELETE": UNAUTHORIZED,
  "clubs/[id]/transfer POST": UNAUTHORIZED,
  "clubs/banner POST": UNAUTHORIZED,
  "clubs/logo POST": UNAUTHORIZED,
  "clubs POST": UNAUTHORIZED,
  "events/[id]/appeal POST": UNAUTHORIZED,
  "events/[id]/invite POST": UNAUTHORIZED,
  "events/[id]/report POST": UNAUTHORIZED,
  "events/[id]/reviews POST": UNAUTHORIZED,
  "events/[id] PATCH": {
    status: 401,
    body: { error: "You must be signed in to edit an event" },
  },
  "events/[id] DELETE": UNAUTHORIZED,
  "events/[id]/rsvp POST": UNAUTHORIZED,
  "events/[id]/rsvp DELETE": UNAUTHORIZED,
  "events/[id]/save DELETE": UNAUTHORIZED,
  "events/[id]/save POST": UNAUTHORIZED,
  "events/create POST": {
    status: 401,
    body: { error: "You must be signed in to create an event" },
  },
  "events/upload-image POST": UNAUTHORIZED,
  "notifications/[id] PATCH": UNAUTHORIZED,
  "notifications POST": UNAUTHORIZED,
  "onboarding/complete POST": UNAUTHORIZED,
  "organizer-requests POST": UNAUTHORIZED,
  "profile/avatar POST": UNAUTHORIZED,
  "profile/banner POST": UNAUTHORIZED,
  "profile/inferred-tags DELETE": UNAUTHORIZED,
  "profile/interests PUT": UNAUTHORIZED,
  "recommendations/feedback POST": {
    status: 401,
    body: { error: "Unauthorized. Must be logged in to submit feedback." },
  },
  "user/engagement POST": UNAUTHORIZED,
  "users/[id]/follow POST": UNAUTHORIZED,
  "users/[id]/follow DELETE": UNAUTHORIZED,
  "users/[id] PATCH": UNAUTHORIZED,
};

/** The anonymous-tolerant arms: admitted, their measured status pinned. */
const ANONYMOUS_ADMITTED: Record<string, number> = {
  "feedback POST": 200,
  "interactions POST": 201,
};

describe("P1 anonymous caller: every arm's bytes", () => {
  test("the byte map covers every arm that is not anonymous-tolerant", () => {
    expect(Object.keys(ANONYMOUS_BYTES).sort()).toEqual(
      WRITE_ARMS.filter((arm) => !arm.anonymousTolerant)
        .map((arm) => arm.id)
        .sort()
    );
  });

  test.each(rows((arm) => !arm.anonymousTolerant))(
    "P1 %s: anonymous gets its exact bytes and writes nothing",
    async (armId, arm) => {
      const fake = as("anonymous");
      const outcome = await runArm(arm);
      expect(outcome).toEqual(ANONYMOUS_BYTES[armId]);
      expect(writeCalls(fake.calls)).toEqual([]);
    }
  );

  test.each(rows((arm) => arm.anonymousTolerant))(
    "P1 %s: anonymous is admitted with its measured status",
    async (armId, arm) => {
      as("anonymous");
      const outcome = await runArm(arm);
      expect(outcome.status).toBe(ANONYMOUS_ADMITTED[armId]);
      expect(outcome.body).toMatchObject({ success: true });
    }
  );
});

// ─── P2: legacy ban bytes ──────────────────────────────────────────────────

describe("P2 banned caller on the ten legacy-ban arms", () => {
  test.each(rows((arm) => arm.legacyBan))(
    "P2 %s: 403 Account suspended, nothing written",
    async (_armId, arm) => {
      const fake = as("banned");
      const outcome = await runArm(arm);
      expect(outcome).toEqual({
        status: 403,
        body: { error: "Account suspended" },
      });
      expect(writeCalls(fake.calls)).toEqual([]);
    }
  );
});

// ─── P3: onboarding exemptions ─────────────────────────────────────────────

describe("P3 un-onboarded caller on the two onboarding exemptions", () => {
  test.each(rows((arm) => arm.onboardingExempt))(
    "P3 %s: admitted, not refused as un-onboarded",
    async (_armId, arm) => {
      as("unonboarded");
      const outcome = await runArm(arm);
      expect(refusedWith(outcome, 403, "Onboarding required")).toBe(false);
      expect(outcome.status).toBe(200);
    }
  );

  test("P3 onboarding/complete POST answers 200 {success:true}", async () => {
    as("unonboarded");
    const arm = WRITE_ARMS.find((a) => a.id === "onboarding/complete POST")!;
    expect(await runArm(arm)).toEqual({ status: 200, body: { success: true } });
  });

  test("P3 users/[id] PATCH (self) stores onboarding_completed true", async () => {
    const fake = as("unonboarded");
    const arm = WRITE_ARMS.find((a) => a.id === "users/[id] PATCH")!;
    const outcome = await runArm(arm);
    expect(outcome.status).toBe(200);
    expect(outcome.body).toMatchObject({ success: true });
    const row = fake.tables.users.find((r) => r.id === CALLER.id);
    expect(row?.onboarding_completed).toBe(true);
  });
});

// ─── P4: expired suspension ────────────────────────────────────────────────

describe("P4 expired suspension on the ten legacy-ban arms", () => {
  test.each(rows((arm) => arm.legacyBan))(
    "P4 %s: an expired suspension is not refused as suspended",
    async (_armId, arm) => {
      as("expired");
      const outcome = await runArm(arm);
      expect(refusedWith(outcome, 403, "Account suspended")).toBe(false);
    }
  );
});

// ─── P5: anonymous-tolerant arms, signed in ────────────────────────────────

describe("P5 active caller on the two anonymous-tolerant arms", () => {
  test.each(rows((arm) => arm.anonymousTolerant))(
    "P5 %s: an active signed-in caller is admitted",
    async (armId, arm) => {
      as("active");
      const outcome = await runArm(arm);
      expect(outcome.status).toBe(ANONYMOUS_ADMITTED[armId]);
      expect(outcome.body).toMatchObject({ success: true });
    }
  );
});
