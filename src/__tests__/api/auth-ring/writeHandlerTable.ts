/**
 * The write-handler table for the slice 3 handler ring (plan 05-03, REFAC-11).
 *
 * One descriptor per state-changing arm under `src/app/api`: every exported
 * POST, PUT, PATCH and DELETE outside `admin/`, `cron/` and
 * `recommendations/batch/` (admin-gated). The list was derived from the tree
 * by a node enumeration, not typed from memory; the enumeration and its output
 * (39 arms in 33 files) are recorded in
 * `.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-characterization-handlers.txt`.
 * A new write arm added to the tree must be added here too, or the guard
 * adoption plans (05-06, 05-07) will not see it.
 *
 * Each descriptor carries:
 *   - `id`: "<route path under /api> <VERB>", for example "events/[id]/save DELETE";
 *   - `family`: which adoption plan owns the arm (events → 05-06, the rest → 05-07);
 *   - `invoke(req)`: a closure that dynamically imports the route module and
 *     calls the verb with the request and `{ params: Promise.resolve({ … }) }`.
 *     The call is type-checked against the handler's own exported signature,
 *     so no handler signature is widened to fit this table. Handlers that take
 *     no arguments (onboarding/complete, user/engagement) are called with none;
 *   - `makeRequest()`: a minimal valid request for the arm, read from the
 *     handler's own body contract (JSON, a query string, or FormData for the
 *     four upload arms);
 *   - `legacyBan`: the arm calls the legacy ban helper (`src/lib/ban.ts`) today;
 *   - `onboardingExempt`: DEC-34's two exemptions from the onboarding guard;
 *   - `anonymousTolerant`: the arm accepts an anonymous caller today (DEC-34
 *     applies both guards only when a user is present).
 *
 * The persona builders return a `FakeSupabaseInit` for the shared fake. The
 * tables beyond `users` hold only rows the arms read first; they are not meant
 * to make every handler succeed. The caller is deliberately not a member of
 * the club, so the owner-gated club arms stop at their own 403.
 *
 * This module registers no jest mock. Each suite that imports it mocks
 * `@/lib/supabase/server`, `@/lib/supabase/service` and `next/headers` itself,
 * so the dynamic imports below resolve against that suite's mocks.
 */

import { NextRequest } from "next/server";
import type {
  FakeCall,
  FakeRow,
  FakeSupabaseInit,
} from "../../helpers/fakeSupabase";

// ─── Fixture ids (synthetic, not seed ids) ─────────────────────────────────

export const CALLER = {
  id: "5eed0000-0000-4000-8000-0a3000000001",
  email: "ring.caller@mail.mcgill.ca",
};
export const OTHER_USER_ID = "5eed0000-0000-4000-8000-0a3000000002";
export const EVENT_ID = "5eed0000-0000-4000-8000-0a30000000e1";
export const CLUB_ID = "5eed0000-0000-4000-8000-0a30000000c1";
export const MEMBER_ID = "5eed0000-0000-4000-8000-0a30000000d1";
export const NOTIFICATION_ID = "5eed0000-0000-4000-8000-0a30000000f1";

const BASE = "http://localhost:3000/api";

// ─── Descriptor shape ──────────────────────────────────────────────────────

export type ArmFamily = "events" | "clubs" | "other";

export interface WriteArm {
  id: string;
  family: ArmFamily;
  invoke(req: NextRequest): Promise<Response>;
  makeRequest(): NextRequest;
  legacyBan: boolean;
  onboardingExempt: boolean;
  anonymousTolerant: boolean;
}

// ─── Request builders ──────────────────────────────────────────────────────

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

/** A one-pixel PNG's worth of bytes; the upload arms read type, size and name. */
function upload(path: string, extra: Record<string, string> = {}): NextRequest {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "ring.png", {
      type: "image/png",
    })
  );
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  return new NextRequest(`${BASE}/${path}`, { method: "POST", body: form });
}

function id(value: string) {
  return { params: Promise.resolve({ id: value }) };
}

// ─── The arms (39, in the enumeration's order) ─────────────────────────────

export const WRITE_ARMS: readonly WriteArm[] = [
  // clubs family
  {
    id: "clubs/[id]/appeal POST",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/appeal/route")).POST(req, id(CLUB_ID)),
    makeRequest: () =>
      json(`clubs/${CLUB_ID}/appeal`, "POST", { message: "Please reconsider" }),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id]/follow POST",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/follow/route")).POST(req, id(CLUB_ID)),
    makeRequest: () => json(`clubs/${CLUB_ID}/follow`, "POST"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id]/follow DELETE",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/follow/route")).DELETE(req, id(CLUB_ID)),
    makeRequest: () => json(`clubs/${CLUB_ID}/follow`, "DELETE"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id]/invites POST",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/invites/route")).POST(req, id(CLUB_ID)),
    makeRequest: () =>
      json(`clubs/${CLUB_ID}/invites`, "POST", {
        email: "invitee@mail.mcgill.ca",
      }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id]/members/role PATCH",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/members/role/route")).PATCH(
        req,
        id(CLUB_ID)
      ),
    makeRequest: () =>
      json(`clubs/${CLUB_ID}/members/role`, "PATCH", {
        memberId: MEMBER_ID,
        role: "organizer",
      }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id]/members DELETE",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/members/route")).DELETE(req, id(CLUB_ID)),
    makeRequest: () =>
      json(`clubs/${CLUB_ID}/members`, "DELETE", { memberId: MEMBER_ID }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id] PATCH",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/route")).PATCH(req, id(CLUB_ID)),
    makeRequest: () =>
      json(`clubs/${CLUB_ID}`, "PATCH", { description: "An updated description" }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id] DELETE",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/route")).DELETE(req, id(CLUB_ID)),
    makeRequest: () =>
      json(`clubs/${CLUB_ID}`, "DELETE", { confirmName: "Ring Club" }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/[id]/transfer POST",
    family: "clubs",
    invoke: async (req) =>
      (await import("@/app/api/clubs/[id]/transfer/route")).POST(req, id(CLUB_ID)),
    makeRequest: () =>
      json(`clubs/${CLUB_ID}/transfer`, "POST", { newOwnerId: OTHER_USER_ID }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/banner POST",
    family: "clubs",
    invoke: async (req) => (await import("@/app/api/clubs/banner/route")).POST(req),
    makeRequest: () => upload("clubs/banner", { clubId: CLUB_ID }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs/logo POST",
    family: "clubs",
    invoke: async (req) => (await import("@/app/api/clubs/logo/route")).POST(req),
    makeRequest: () => upload("clubs/logo", { clubId: CLUB_ID }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "clubs POST",
    family: "clubs",
    invoke: async (req) => (await import("@/app/api/clubs/route")).POST(req),
    makeRequest: () =>
      json("clubs", "POST", {
        name: "Ring Test Society",
        description: "A club created by the handler ring table",
        category: "academic",
        contact_email: "ring.society@mail.mcgill.ca",
      }),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },

  // events family
  {
    id: "events/[id]/appeal POST",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/appeal/route")).POST(req, id(EVENT_ID)),
    makeRequest: () =>
      json(`events/${EVENT_ID}/appeal`, "POST", { message: "Please reconsider" }),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id]/invite POST",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/invite/route")).POST(req, id(EVENT_ID)),
    makeRequest: () =>
      json(`events/${EVENT_ID}/invite`, "POST", { invitee_ids: [OTHER_USER_ID] }),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id]/report POST",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/report/route")).POST(req, id(EVENT_ID)),
    makeRequest: () =>
      json(`events/${EVENT_ID}/report`, "POST", {
        category: "inappropriate_content",
        message: "Ring report",
      }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id]/reviews POST",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/reviews/route")).POST(req, id(EVENT_ID)),
    makeRequest: () =>
      json(`events/${EVENT_ID}/reviews`, "POST", { rating: 5, comment: "Great" }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id] PATCH",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/route")).PATCH(req, id(EVENT_ID)),
    makeRequest: () =>
      json(`events/${EVENT_ID}`, "PATCH", { title: "An edited title" }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id] DELETE",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/route")).DELETE(req, id(EVENT_ID)),
    makeRequest: () => json(`events/${EVENT_ID}`, "DELETE"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id]/rsvp POST",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/rsvp/route")).POST(req, id(EVENT_ID)),
    makeRequest: () =>
      json(`events/${EVENT_ID}/rsvp`, "POST", {
        user_id: CALLER.id,
        status: "going",
      }),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id]/rsvp DELETE",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/rsvp/route")).DELETE(req, id(EVENT_ID)),
    makeRequest: () =>
      json(`events/${EVENT_ID}/rsvp`, "DELETE", { user_id: CALLER.id }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id]/save DELETE",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/save/route")).DELETE(req, id(EVENT_ID)),
    makeRequest: () => json(`events/${EVENT_ID}/save`, "DELETE"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/[id]/save POST",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/[id]/save/route")).POST(req, id(EVENT_ID)),
    makeRequest: () => json(`events/${EVENT_ID}/save`, "POST"),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/create POST",
    family: "events",
    invoke: async (req) => (await import("@/app/api/events/create/route")).POST(req),
    makeRequest: () =>
      json("events/create", "POST", {
        title: "Ring Test Event",
        description: "An event created by the handler ring table",
        start_date: "2030-06-01T18:00:00.000Z",
        location: "Leacock 132",
        tags: ["academic"],
      }),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "events/upload-image POST",
    family: "events",
    invoke: async (req) =>
      (await import("@/app/api/events/upload-image/route")).POST(req),
    makeRequest: () => upload("events/upload-image"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },

  // everything else
  {
    id: "feedback POST",
    family: "other",
    invoke: async (req) => (await import("@/app/api/feedback/route")).POST(req),
    makeRequest: () =>
      json("feedback", "POST", { type: "general", message: "Ring feedback" }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: true,
  },
  {
    id: "interactions POST",
    family: "other",
    invoke: async (req) => (await import("@/app/api/interactions/route")).POST(req),
    makeRequest: () =>
      json("interactions", "POST", {
        event_id: EVENT_ID,
        interaction_type: "view",
        source: "home",
      }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: true,
  },
  {
    id: "notifications/[id] PATCH",
    family: "other",
    invoke: async (req) =>
      (await import("@/app/api/notifications/[id]/route")).PATCH(
        req,
        id(NOTIFICATION_ID)
      ),
    makeRequest: () => json(`notifications/${NOTIFICATION_ID}`, "PATCH"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "notifications POST",
    family: "other",
    invoke: async (req) => (await import("@/app/api/notifications/route")).POST(req),
    makeRequest: () => json("notifications?action=mark-all-read", "POST"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "onboarding/complete POST",
    family: "other",
    invoke: async () => (await import("@/app/api/onboarding/complete/route")).POST(),
    makeRequest: () => json("onboarding/complete", "POST"),
    legacyBan: false,
    onboardingExempt: true,
    anonymousTolerant: false,
  },
  {
    id: "organizer-requests POST",
    family: "other",
    invoke: async (req) =>
      (await import("@/app/api/organizer-requests/route")).POST(req),
    makeRequest: () =>
      json("organizer-requests", "POST", {
        club_id: CLUB_ID,
        message: "I help run this club",
      }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "profile/avatar POST",
    family: "other",
    invoke: async (req) => (await import("@/app/api/profile/avatar/route")).POST(req),
    makeRequest: () => upload("profile/avatar"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "profile/banner POST",
    family: "other",
    invoke: async (req) => (await import("@/app/api/profile/banner/route")).POST(req),
    makeRequest: () => upload("profile/banner"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "profile/inferred-tags DELETE",
    family: "other",
    invoke: async (req) =>
      (await import("@/app/api/profile/inferred-tags/route")).DELETE(req),
    makeRequest: () => json("profile/inferred-tags", "DELETE", { tag: "academic" }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "profile/interests PUT",
    family: "other",
    invoke: async (req) =>
      (await import("@/app/api/profile/interests/route")).PUT(req),
    makeRequest: () =>
      json("profile/interests", "PUT", { interest_tags: ["academic"] }),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "recommendations/feedback POST",
    family: "other",
    invoke: async (req) =>
      (await import("@/app/api/recommendations/feedback/route")).POST(req),
    makeRequest: () =>
      json("recommendations/feedback", "POST", {
        event_id: EVENT_ID,
        feedback: "positive",
      }),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "user/engagement POST",
    family: "other",
    invoke: async () => (await import("@/app/api/user/engagement/route")).POST(),
    makeRequest: () => json("user/engagement", "POST"),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "users/[id]/follow POST",
    family: "other",
    invoke: async (req) =>
      (await import("@/app/api/users/[id]/follow/route")).POST(req, id(OTHER_USER_ID)),
    makeRequest: () => json(`users/${OTHER_USER_ID}/follow`, "POST"),
    legacyBan: true,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "users/[id]/follow DELETE",
    family: "other",
    invoke: async (req) =>
      (await import("@/app/api/users/[id]/follow/route")).DELETE(
        req,
        id(OTHER_USER_ID)
      ),
    makeRequest: () => json(`users/${OTHER_USER_ID}/follow`, "DELETE"),
    legacyBan: false,
    onboardingExempt: false,
    anonymousTolerant: false,
  },
  {
    id: "users/[id] PATCH",
    family: "other",
    // The id param is the caller's own id: the self-update the wizard makes.
    invoke: async (req) =>
      (await import("@/app/api/users/[id]/route")).PATCH(req, id(CALLER.id)),
    makeRequest: () =>
      json(`users/${CALLER.id}`, "PATCH", {
        name: "Ring Caller",
        onboarding_completed: true,
      }),
    legacyBan: false,
    onboardingExempt: true,
    anonymousTolerant: false,
  },
];

// ─── Personas ──────────────────────────────────────────────────────────────

function callerRow(overrides: FakeRow = {}): FakeRow {
  return {
    id: CALLER.id,
    email: CALLER.email,
    name: "Ring Caller",
    roles: ["user"],
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
    inferred_tags: ["academic"],
    ...overrides,
  };
}

const OTHER_USER_ROW: FakeRow = {
  id: OTHER_USER_ID,
  email: "ring.other@mail.mcgill.ca",
  name: "Ring Other",
  roles: ["user"],
  onboarding_completed: true,
  banned_at: null,
  ban_expires_at: null,
};

/** The rows the arms read first. The caller owns nothing and is in no club. */
function tables(caller: FakeRow | null): Record<string, FakeRow[]> {
  return {
    users: caller ? [caller, OTHER_USER_ROW] : [OTHER_USER_ROW],
    events: [
      {
        id: EVENT_ID,
        title: "Ring Event",
        status: "approved",
        deleted_at: null,
        created_by: OTHER_USER_ID,
        club_id: CLUB_ID,
        start_date: "2026-01-01T18:00:00+00:00",
        pending_edits: null,
      },
    ],
    clubs: [
      {
        id: CLUB_ID,
        name: "Ring Club",
        status: "approved",
        created_by: OTHER_USER_ID,
        appeal_count: 0,
      },
    ],
    club_members: [
      { id: MEMBER_ID, club_id: CLUB_ID, user_id: OTHER_USER_ID, role: "owner" },
    ],
    notifications: [
      { id: NOTIFICATION_ID, user_id: CALLER.id, read: false },
    ],
  };
}

export type PersonaName =
  | "anonymous"
  | "active"
  | "banned"
  | "expired"
  | "unonboarded"
  | "noProfile";

export const PERSONAS: Record<PersonaName, () => FakeSupabaseInit> = {
  anonymous: () => ({ user: null, tables: tables(null) }),
  active: () => ({ user: CALLER, tables: tables(callerRow()) }),
  banned: () => ({
    user: CALLER,
    tables: tables(callerRow({ banned_at: "2026-09-01T00:00:00+00:00" })),
  }),
  expired: () => ({
    user: CALLER,
    tables: tables(
      callerRow({
        banned_at: "2020-01-01T00:00:00+00:00",
        ban_expires_at: "2020-02-01T00:00:00+00:00",
      })
    ),
  }),
  unonboarded: () => ({
    user: CALLER,
    tables: tables(callerRow({ onboarding_completed: false })),
  }),
  noProfile: () => ({ user: CALLER, tables: tables(null) }),
};

// ─── Running an arm ────────────────────────────────────────────────────────

/**
 * What an arm did: its status and parsed body, or `"threw"` and the message
 * when the handler has no outer catch and a fake gap (no `upsert`, `ilike`,
 * `contains` or `storage`) or a missing row made it throw. A throw is an
 * admission: the caller got past every check the arm makes first.
 */
export interface ArmOutcome {
  status: number | "threw";
  body: unknown;
}

export async function runArm(arm: WriteArm): Promise<ArmOutcome> {
  try {
    const response = await arm.invoke(arm.makeRequest());
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

/** True when the outcome is exactly `status` with `{ error }` as its body. */
export function refusedWith(
  outcome: ArmOutcome,
  status: number,
  error: string
): boolean {
  return (
    outcome.status === status &&
    typeof outcome.body === "object" &&
    outcome.body !== null &&
    (outcome.body as { error?: unknown }).error === error
  );
}

const WRITE_OPERATIONS = new Set(["insert", "update", "delete", "rpc"]);

/** The calls that changed state (or could have): inserts, updates, deletes, rpcs. */
export function writeCalls(calls: readonly FakeCall[]): FakeCall[] {
  return calls.filter((call) => WRITE_OPERATIONS.has(call.operation));
}

/** `table.operation` for every call, in order. */
export function callShape(calls: readonly FakeCall[]): string[] {
  return calls.map((call) => `${call.table}.${call.operation}`);
}
