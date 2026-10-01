/**
 * Fixtures for the slice-6 recommendations suites (plan 06-02, REFAC-14).
 *
 * Not a test file. It registers no jest mock: each suite that imports it
 * mocks `@/lib/supabase/server` (the cookie fake) and `@/lib/supabase/service`
 * (the elevated fake) itself, so the dynamic imports in the suites resolve
 * against that suite's mocks.
 *
 * The data, all synthetic, fixed UUIDs in a `06000000-…` block:
 *   - five approved future events E1..E5 with distinct scores and chosen tag
 *     overlaps. E1 and E2 carry identical tags (Jaccard 1), E5 shares one of
 *     three tags with them (1/3), E3 and E4 share nothing with anyone. Raw
 *     score order is E1 > E2 > E3 > E4 > E5. At λ 0.7 MMR puts E3 ahead of E2
 *     (E2's similarity to E1 costs it 0.3), so the ranked output differs from
 *     the raw order, which is what makes a λ pin able to bite;
 *   - their start dates are in a different order again (E3, E5, E4, E2, E1),
 *     so the popularity paths (ordered by `start_date`) are distinguishable
 *     from the scored path;
 *   - two score rows the scored path must drop: a pending event (EP) and a
 *     past one (EX), each with a score above E1's;
 *   - one running experiment with two 50/50 variants whose `config.lambda`
 *     differs (control 1, diverse 0). `pickVariant` puts the admin fixture
 *     user in "diverse" (FNV-1a bucket 92 of 100) and the student fixture
 *     user in "control" (bucket 27).
 *
 * RLS is expressed by what each fake holds (the Phase 5 convention, 05-12):
 * `experiments` and `experiment_variants` have only admin policies and
 * `experiment_assignments` has admin-ALL plus own-row SELECT (06-RESEARCH
 * § H, measured). So the cookie fake holds the experiment rows only for an
 * admin caller, while the elevated fake (service role, no RLS) holds them for
 * every caller when the scenario says the experiment exists.
 */

import type { FakeRow, FakeSupabaseInit } from "../../helpers/fakeSupabase";

// ─── Ids ───────────────────────────────────────────────────────────────────

export const STUDENT = {
  id: "06000000-0000-4000-8000-000000000001",
  email: "slice6.student@mail.mcgill.ca",
};
export const ADMIN = {
  id: "06000000-0000-4000-8000-000000000002",
  email: "slice6.admin@mail.mcgill.ca",
};
export const OTHER_USER_ID = "06000000-0000-4000-8000-000000000003";

export const E1 = "06000000-0000-4000-8000-0000000000e1";
export const E2 = "06000000-0000-4000-8000-0000000000e2";
export const E3 = "06000000-0000-4000-8000-0000000000e3";
export const E4 = "06000000-0000-4000-8000-0000000000e4";
export const E5 = "06000000-0000-4000-8000-0000000000e5";
/** Pending: in the scores table, never in any response. */
export const EP = "06000000-0000-4000-8000-0000000000e6";
/** Past: in the scores table, never in any response. */
export const EX = "06000000-0000-4000-8000-0000000000e7";

export const CLUB_ID = "06000000-0000-4000-8000-0000000000c1";
export const EXPERIMENT_ID = "06000000-0000-4000-8000-0000000000a1";
export const VARIANT_CONTROL = "06000000-0000-4000-8000-0000000000b1";
export const VARIANT_DIVERSE = "06000000-0000-4000-8000-0000000000b2";

// ─── Events ────────────────────────────────────────────────────────────────

const CLUB = { id: CLUB_ID, name: "Slice Six Society", status: "approved" };

function event(
  id: string,
  title: string,
  tags: string[],
  start: string,
  status = "approved"
): FakeRow {
  return {
    id,
    title,
    description: `${title} description`,
    tags,
    status,
    deleted_at: null,
    club_id: CLUB_ID,
    start_date: start,
    end_date: start.replace("T18:", "T20:"),
    clubs: CLUB,
  };
}

export const EVENTS: Record<string, FakeRow> = {
  [E1]: event(E1, "Event One", ["academic", "tech"], "2030-03-05T18:00:00+00:00"),
  [E2]: event(E2, "Event Two", ["academic", "tech"], "2030-03-04T18:00:00+00:00"),
  [E3]: event(E3, "Event Three", ["sports"], "2030-03-01T18:00:00+00:00"),
  [E4]: event(E4, "Event Four", ["music", "arts"], "2030-03-03T18:00:00+00:00"),
  [E5]: event(E5, "Event Five", ["academic", "career"], "2030-03-02T18:00:00+00:00"),
  [EP]: event(EP, "Event Pending", ["sports"], "2030-02-01T18:00:00+00:00", "pending"),
  [EX]: event(EX, "Event Past", ["sports"], "2020-01-01T18:00:00+00:00"),
};

/** The visible events in popularity (start_date ascending) order. */
export const POPULARITY_ORDER = [E3, E5, E4, E2, E1];

/** Raw score order of the visible events. */
export const RAW_SCORE_ORDER = [E1, E2, E3, E4, E5];

const SCORES: Array<[string, number]> = [
  [E1, 0.9],
  [E2, 0.85],
  [E3, 0.8],
  [E4, 0.6],
  [E5, 0.5],
  [EP, 0.99],
  [EX, 0.98],
];

const BREAKDOWN = {
  tag: 0.3,
  interaction: 0.2,
  popularity: 0.2,
  recency: 0.1,
  social: 0,
};

function scoreRows(userId: string, ids?: string[]): FakeRow[] {
  return SCORES.filter(([id]) => !ids || ids.includes(id)).map(
    ([eventId, score]) => ({
      user_id: userId,
      event_id: eventId,
      score,
      breakdown: BREAKDOWN,
      events: EVENTS[eventId],
    })
  );
}

// ─── Experiment ────────────────────────────────────────────────────────────

export const EXPERIMENT: FakeRow = {
  id: EXPERIMENT_ID,
  name: "slice6-lambda",
  status: "running",
  description: "Lambda experiment",
};

export const VARIANTS: FakeRow[] = [
  {
    id: VARIANT_CONTROL,
    experiment_id: EXPERIMENT_ID,
    name: "control",
    config: { lambda: 1 },
    weight: 50,
  },
  {
    id: VARIANT_DIVERSE,
    experiment_id: EXPERIMENT_ID,
    name: "diverse",
    config: { lambda: 0 },
    weight: 50,
  },
];

// ─── Scenario builder ──────────────────────────────────────────────────────

export type Persona = "anonymous" | "student" | "admin";

export interface Scenario {
  persona: Persona;
  /**
   * Which user_event_scores rows the caller has: "all" (E1..E5 plus the
   * pending and past rows), "hidden-only" (only the pending and past rows,
   * which the route filters away) or "none".
   */
  scores?: "all" | "hidden-only" | "none";
  /** A running experiment exists in the database. */
  experiment?: boolean;
  /** An experiment_assignments row already exists for the caller. */
  assignedVariant?: string;
  /** Tags of a user_interactions row inside the two-hour session window. */
  sessionEvent?: string;
  onboarded?: boolean;
}

export function userOf(persona: Persona): { id: string; email: string } | null {
  if (persona === "student") return STUDENT;
  if (persona === "admin") return ADMIN;
  return null;
}

function userRow(persona: Persona, onboarded: boolean): FakeRow[] {
  const caller = userOf(persona);
  if (!caller) return [];
  return [
    {
      id: caller.id,
      email: caller.email,
      name: persona === "admin" ? "Slice Six Admin" : "Slice Six Student",
      roles: persona === "admin" ? ["user", "admin"] : ["user"],
      onboarding_completed: onboarded,
      banned_at: null,
      ban_expires_at: null,
      interest_tags: ["academic"],
      inferred_tags: [],
    },
  ];
}

function baseTables(scenario: Scenario): Record<string, FakeRow[]> {
  const caller = userOf(scenario.persona);
  const scores = scenario.scores ?? "none";
  return {
    users: userRow(scenario.persona, scenario.onboarded ?? true),
    events: Object.values(EVENTS),
    user_event_scores:
      !caller || scores === "none"
        ? []
        : scoreRows(caller.id, scores === "hidden-only" ? [EP, EX] : undefined),
    user_interactions:
      caller && scenario.sessionEvent
        ? [
            {
              user_id: caller.id,
              event_id: scenario.sessionEvent,
              created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
              events: { tags: EVENTS[scenario.sessionEvent].tags },
            },
          ]
        : [],
  };
}

function experimentTables(
  scenario: Scenario,
  visible: boolean
): Record<string, FakeRow[]> {
  const caller = userOf(scenario.persona);
  const exists = scenario.experiment ?? false;
  const assignments =
    exists && caller && scenario.assignedVariant
      ? [
          {
            experiment_id: EXPERIMENT_ID,
            user_id: caller.id,
            variant_id: scenario.assignedVariant,
          },
        ]
      : [];
  return {
    experiments: exists && visible ? [EXPERIMENT] : [],
    experiment_variants: exists && visible ? VARIANTS : [],
    // own-row SELECT exists for every caller; the row is the caller's own.
    experiment_assignments: assignments,
  };
}

/** The cookie fake: the caller's session and what RLS lets the caller see. */
export function cookieInit(scenario: Scenario): FakeSupabaseInit {
  const adminVisible = scenario.persona === "admin";
  return {
    user: userOf(scenario.persona),
    tables: {
      ...baseTables(scenario),
      ...experimentTables(scenario, adminVisible),
    },
  };
}

/** The elevated fake: no session, every row (service role bypasses RLS). */
export function elevatedInit(scenario: Scenario): FakeSupabaseInit {
  return {
    user: null,
    tables: {
      ...baseTables(scenario),
      ...experimentTables(scenario, true),
    },
    rpc: { compute_user_scores: { data: null, error: null } },
  };
}

// ─── Response helpers ──────────────────────────────────────────────────────

export interface Outcome {
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
}

export async function read(response: Response): Promise<Outcome> {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { __text: text };
  }
  return { status: response.status, headers: response.headers, body };
}

export function rankedIds(body: Record<string, unknown>): string[] {
  const recs = (body.recommendations ?? []) as Array<{ event_id: string }>;
  return recs.map((r) => r.event_id);
}

export function reportedLambda(body: Record<string, unknown>): number | null {
  const meta = body.diversity_metadata as { lambda?: number } | undefined;
  return meta?.lambda ?? null;
}

/**
 * The fake has no `upsert` (a documented gap). The thumbs arm of
 * recommendations/feedback upserts, so a suite that drives it wraps the
 * cookie client here: `upsert(payload)` on the named table behaves as
 * `insert(payload)` (PostgREST sends an upsert as an INSERT with a
 * merge-duplicates preference) and is recorded as an insert. The shared fake
 * is not changed.
 */
export function withUpsertAsInsert<
  C extends { from(table: string): unknown },
>(client: C, table: string): C {
  const original = client.from.bind(client);
  return {
    ...client,
    from(name: string) {
      const builder = original(name) as {
        insert(p: unknown): unknown;
        upsert?: (p: unknown, o?: unknown) => unknown;
      };
      if (name === table) {
        builder.upsert = (payload: unknown) => builder.insert(payload);
      }
      return builder;
    },
  } as C;
}
