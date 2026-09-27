/**
 * The slice-7 shape-400 table (plan 06-07, REFAC-15).
 *
 * One descriptor per 400 a slice-7 contract could move: every shape rule of
 * every route and verb in the families events, clubs, users, profile,
 * organizer-requests, admin, moderation and the five multipart uploads, read
 * from the handlers at HEAD f550de9 (research § Inventory C gave the worklist;
 * its line numbers predate 06-04 and were re-read). Each row's input satisfies
 * every earlier check of its handler and breaks exactly one, so its expected
 * body is that one rule's text. A route with two or more rules also has an
 * `order` row: an input breaking the first two rules answers the first rule's
 * body, which pins today's check order (Pitfall 6: zod reports issues in
 * schema key order, so a contract must declare keys in this order).
 *
 * Rows tagged `kind: "rule"` are business rules evaluated after a guard or a
 * database read (C11). They stay in the handler after the contracts land, and
 * are pinned here only where the fake reaches them without scaffolding.
 *
 * `field` appears only where the handler emits it today. Research C10 named
 * four sites; the measurement found two more families that emit it
 * (`clubs` POST and `clubs/[id]` PATCH "Invalid value for …", and the
 * `end_date`-only branch of `events/[id]` PATCH). They are pinned as measured.
 *
 * Also exported: `QUERY_COERCION_ROWS`, one per query-reading route in the
 * plan's list, pinning a parameter that is silently coerced today (no 400)
 * and the value the handler used, read from the response or the fake's call
 * log.
 *
 * Personas (`PERSONAS`) share one world of rows:
 *   - student: onboarded, roles ["user"], a member of no club;
 *   - owner:   the same caller, owner of CLUB_ID (so the owner-gated club arms
 *              pass their gate) and creator of EVENT_OWN;
 *   - admin:   the same caller with roles ["user","admin"].
 * The elevated fake holds the same rows (it bypasses RLS).
 *
 * This module registers no jest mock. A suite that imports it mocks
 * `@/lib/supabase/server` (the cookie fake), `@/lib/supabase/service` and
 * `@supabase/supabase-js` (the elevated fake) and `next/headers` itself, so
 * the dynamic imports below resolve against that suite's mocks. Every invoker
 * is type-checked against the handler's own exported signature; no handler is
 * widened to fit this table.
 */

import { NextRequest } from "next/server";
import type {
  FakeCall,
  FakeRow,
  FakeSupabase,
  FakeSupabaseInit,
} from "../helpers/fakeSupabase";

// ─── Fixture ids (synthetic, not seed ids) ─────────────────────────────────

export const CALLER = {
  id: "5eed0000-0000-4000-8000-0a7000000001",
  email: "bad.request.caller@mail.mcgill.ca",
};
export const OTHER_USER_ID = "5eed0000-0000-4000-8000-0a7000000002";
export const THIRD_USER_ID = "5eed0000-0000-4000-8000-0a7000000003";
export const NON_MEMBER_ID = "5eed0000-0000-4000-8000-0a7000000004";
export const EVENT_OWN = "5eed0000-0000-4000-8000-0a70000000e1";
export const EVENT_PENDING = "5eed0000-0000-4000-8000-0a70000000e2";
export const CLUB_ID = "5eed0000-0000-4000-8000-0a70000000c1";
export const CLUB_NAME = "Bad Request Club";
export const MEMBER_SELF = "5eed0000-0000-4000-8000-0a70000000d1";
export const MEMBER_ORGANIZER = "5eed0000-0000-4000-8000-0a70000000d2";
export const MEMBER_OTHER_OWNER = "5eed0000-0000-4000-8000-0a70000000d3";
export const EXPERIMENT_ID = "5eed0000-0000-4000-8000-0a70000000a1";
export const FEATURED_ID = "5eed0000-0000-4000-8000-0a70000000f1";
export const REQUEST_ID = "5eed0000-0000-4000-8000-0a70000000b1";
export const REPORT_ID = "5eed0000-0000-4000-8000-0a70000000a2";

const BASE = "http://localhost:3000/api";

// ─── Descriptor shapes ─────────────────────────────────────────────────────

export type Verb = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type PersonaName = "student" | "owner" | "admin";

export interface FormSpec {
  /** The `file` part; omitted means no file part at all. */
  file?: { type: string; size: number; name?: string };
  /** Plain text parts, for example `clubId`. */
  fields?: Record<string, string>;
}

export interface BadRequestRow {
  id: string;
  /** Route path under /api with bracketed segments, e.g. "events/[id]/rsvp". */
  route: string;
  verb: Verb;
  persona: PersonaName;
  /** Values for the bracketed segments. */
  params?: Record<string, string>;
  /** A JSON body, serialized with JSON.stringify. */
  body?: unknown;
  /** A query string including the leading "?". */
  query?: string;
  /** A multipart body. */
  form?: FormSpec;
  /** "shape" (a contract moves it) or "rule" (stays in the handler, C11). */
  kind: "shape" | "rule" | "order";
  status: 400;
  expected: { error: string; field?: string };
}

// ─── The invokers: one per route and verb, typed by the handler ────────────

/**
 * `Response | undefined` because one handler's own signature says so
 * (`events/export` GET is typed `Promise<NextResponse | undefined>`). The
 * table's type widens to fit the handler; the handler is never widened.
 */
type Invoke = (
  req: NextRequest,
  p: Record<string, string>
) => Promise<Response | undefined>;

function id(p: Record<string, string>) {
  return { params: Promise.resolve({ id: p.id ?? "" }) };
}

export const INVOKERS: Record<string, Invoke> = {
  // events
  "events GET": async (r) => (await import("@/app/api/events/route")).GET(r),
  "events/create POST": async (r) =>
    (await import("@/app/api/events/create/route")).POST(r),
  "events/[id] PATCH": async (r, p) =>
    (await import("@/app/api/events/[id]/route")).PATCH(r, id(p)),
  "events/[id]/rsvp POST": async (r, p) =>
    (await import("@/app/api/events/[id]/rsvp/route")).POST(r, id(p)),
  "events/[id]/rsvp DELETE": async (r, p) =>
    (await import("@/app/api/events/[id]/rsvp/route")).DELETE(r, id(p)),
  "events/[id]/reviews POST": async (r, p) =>
    (await import("@/app/api/events/[id]/reviews/route")).POST(r, id(p)),
  "events/[id]/invite POST": async (r, p) =>
    (await import("@/app/api/events/[id]/invite/route")).POST(r, id(p)),
  "events/[id]/report POST": async (r, p) =>
    (await import("@/app/api/events/[id]/report/route")).POST(r, id(p)),
  "events/[id]/appeal POST": async (r, p) =>
    (await import("@/app/api/events/[id]/appeal/route")).POST(r, id(p)),
  "events/[id]/analytics GET": async (r, p) =>
    (await import("@/app/api/events/[id]/analytics/route")).GET(r, id(p)),
  "events/export GET": async (r) =>
    (await import("@/app/api/events/export/route")).GET(r),
  "events/popular GET": async (r) =>
    (await import("@/app/api/events/popular/route")).GET(r),
  "events/upload-image POST": async (r) =>
    (await import("@/app/api/events/upload-image/route")).POST(r),
  "calendar/events GET": async (r) =>
    (await import("@/app/api/calendar/events/route")).GET(r),

  // clubs
  "clubs POST": async (r) => (await import("@/app/api/clubs/route")).POST(r),
  "clubs/[id] PATCH": async (r, p) =>
    (await import("@/app/api/clubs/[id]/route")).PATCH(r, id(p)),
  "clubs/[id] DELETE": async (r, p) =>
    (await import("@/app/api/clubs/[id]/route")).DELETE(r, id(p)),
  "clubs/[id]/transfer POST": async (r, p) =>
    (await import("@/app/api/clubs/[id]/transfer/route")).POST(r, id(p)),
  "clubs/[id]/members/role PATCH": async (r, p) =>
    (await import("@/app/api/clubs/[id]/members/role/route")).PATCH(r, id(p)),
  "clubs/[id]/members DELETE": async (r, p) =>
    (await import("@/app/api/clubs/[id]/members/route")).DELETE(r, id(p)),
  "clubs/[id]/invites POST": async (r, p) =>
    (await import("@/app/api/clubs/[id]/invites/route")).POST(r, id(p)),
  "clubs/[id]/appeal POST": async (r, p) =>
    (await import("@/app/api/clubs/[id]/appeal/route")).POST(r, id(p)),
  "clubs/banner POST": async (r) =>
    (await import("@/app/api/clubs/banner/route")).POST(r),
  "clubs/logo POST": async (r) =>
    (await import("@/app/api/clubs/logo/route")).POST(r),
  "clubs/trending GET": async (r) =>
    (await import("@/app/api/clubs/trending/route")).GET(r),

  // users and profile
  "users/[id] PATCH": async (r, p) =>
    (await import("@/app/api/users/[id]/route")).PATCH(r, id(p)),
  "users/[id]/follow POST": async (r, p) =>
    (await import("@/app/api/users/[id]/follow/route")).POST(r, id(p)),
  "users/saved-events GET": async (r) =>
    (await import("@/app/api/users/saved-events/route")).GET(r),
  "users/search GET": async (r) =>
    (await import("@/app/api/users/search/route")).GET(r),
  "profile/avatar POST": async (r) =>
    (await import("@/app/api/profile/avatar/route")).POST(r),
  "profile/banner POST": async (r) =>
    (await import("@/app/api/profile/banner/route")).POST(r),
  "profile/interests PUT": async (r) =>
    (await import("@/app/api/profile/interests/route")).PUT(r),
  "profile/inferred-tags DELETE": async (r) =>
    (await import("@/app/api/profile/inferred-tags/route")).DELETE(r),
  "organizer-requests POST": async (r) =>
    (await import("@/app/api/organizer-requests/route")).POST(r),
  "moderation/reviews/[targetType]/[targetId] GET": async (r, p) =>
    (await import("@/app/api/moderation/reviews/[targetType]/[targetId]/route")).GET(
      r,
      {
        params: Promise.resolve({
          targetType: p.targetType ?? "",
          targetId: p.targetId ?? "",
        }),
      }
    ),

  // admin
  "admin/clubs/[id] PATCH": async (r, p) =>
    (await import("@/app/api/admin/clubs/[id]/route")).PATCH(r, id(p)),
  "admin/clubs GET": async (r) =>
    (await import("@/app/api/admin/clubs/route")).GET(r),
  "admin/events/[id]/edits PATCH": async (r, p) =>
    (await import("@/app/api/admin/events/[id]/edits/route")).PATCH(r, id(p)),
  "admin/events/[id]/status PATCH": async (r, p) =>
    (await import("@/app/api/admin/events/[id]/status/route")).PATCH(r, id(p)),
  "admin/events/[id] PUT": async (r, p) =>
    (await import("@/app/api/admin/events/[id]/route")).PUT(r, id(p)),
  "admin/events GET": async (r) =>
    (await import("@/app/api/admin/events/route")).GET(r),
  "admin/events POST": async (r) =>
    (await import("@/app/api/admin/events/route")).POST(r),
  "admin/experiments POST": async (r) =>
    (await import("@/app/api/admin/experiments/route")).POST(r),
  "admin/experiments/[id] PATCH": async (r, p) =>
    (await import("@/app/api/admin/experiments/[id]/route")).PATCH(r, id(p)),
  "admin/experiments/[id] DELETE": async (r, p) =>
    (await import("@/app/api/admin/experiments/[id]/route")).DELETE(r, id(p)),
  "admin/featured POST": async (r) =>
    (await import("@/app/api/admin/featured/route")).POST(r),
  "admin/featured/[id] PATCH": async (r, p) =>
    (await import("@/app/api/admin/featured/[id]/route")).PATCH(r, id(p)),
  "admin/organizer-requests/[id] PATCH": async (r, p) =>
    (await import("@/app/api/admin/organizer-requests/[id]/route")).PATCH(r, id(p)),
  "admin/organizer-requests GET": async (r) =>
    (await import("@/app/api/admin/organizer-requests/route")).GET(r),
  "admin/reports/[id] PATCH": async (r, p) =>
    (await import("@/app/api/admin/reports/[id]/route")).PATCH(r, id(p)),
  "admin/reports GET": async (r) =>
    (await import("@/app/api/admin/reports/route")).GET(r),
  "admin/audit-log GET": async (r) =>
    (await import("@/app/api/admin/audit-log/route")).GET(r),
  "admin/organizers GET": async (r) =>
    (await import("@/app/api/admin/organizers/route")).GET(r),
  "admin/users/[id]/ban POST": async (r, p) =>
    (await import("@/app/api/admin/users/[id]/ban/route")).POST(r, id(p)),
  "admin/users/[id] PATCH": async (r, p) =>
    (await import("@/app/api/admin/users/[id]/route")).PATCH(r, id(p)),
};

// ─── Row builders ──────────────────────────────────────────────────────────

type Input = Pick<BadRequestRow, "params" | "body" | "query" | "form">;

type Head = Pick<BadRequestRow, "id" | "route" | "verb" | "persona">;

function row(
  head: Head,
  input: Input,
  error: string,
  opts: { field?: string; kind?: BadRequestRow["kind"] } = {}
): BadRequestRow {
  return {
    ...head,
    ...input,
    kind: opts.kind ?? "shape",
    status: 400,
    expected: opts.field === undefined ? { error } : { error, field: opts.field },
  };
}

const ev = { id: EVENT_OWN };
const club = { id: CLUB_ID };
const self = { id: CALLER.id };
const other = { id: OTHER_USER_ID };

const MB = 1024 * 1024;
const png = (size = 4) => ({ type: "image/png", size, name: "x.png" });
const txt = (size = 4) => ({ type: "text/plain", size, name: "x.txt" });

/** A complete, valid events/create body; each row breaks one field. */
const CREATE = {
  title: "Contract Night",
  description: "An evening of contracts",
  start_date: "2030-06-01T18:00:00Z",
  location: "Leacock 132",
  tags: ["academic"],
};

/** A complete, valid clubs POST body. */
const NEW_CLUB = {
  name: "Contract Society",
  description: "We write schemas",
  category: "academic",
  contact_email: "contracts@mail.mcgill.ca",
};

const START_FORMAT =
  'start_date must be a valid ISO 8601 date (e.g. "2026-03-15" or "2026-03-15T09:00:00Z")';
const END_FORMAT =
  'end_date must be a valid ISO 8601 date (e.g. "2026-03-15" or "2026-03-15T11:00:00Z")';

// ─── The rows ──────────────────────────────────────────────────────────────

export const BAD_REQUEST_ROWS: readonly BadRequestRow[] = [
  // ── events/create POST (C10: start_date and the dateValidation field) ──
  row({ id: "create: title missing", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, title: "" } }, "Title is required"),
  row({ id: "create: title only markup", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, title: "<b></b>" } }, "Title is required"),
  row({ id: "create: description missing", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, description: undefined } }, "Description is required"),
  row({ id: "create: start_date missing", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, start_date: undefined } }, "Start date is required", { field: "start_date" }),
  row({ id: "create: location missing", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, location: "  " } }, "Location is required"),
  row({ id: "create: tags missing", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, tags: undefined } }, "At least one tag is required"),
  row({ id: "create: tags not an array", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, tags: "academic" } }, "At least one tag is required"),
  row({ id: "create: tags empty", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, tags: [] } }, "At least one tag is required"),
  row({ id: "create: price over 20 chars", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, price: "x".repeat(21) } }, "Price must be 20 characters or less"),
  row({ id: "create: rsvp_link over 500 chars", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, rsvp_link: `https://a.ca/${"x".repeat(500)}` } }, "Registration link is too long"),
  row({ id: "create: rsvp_link not http(s)", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, rsvp_link: "ftp://a.ca/x" } }, "Registration link must use http or https"),
  row({ id: "create: rsvp_link not a URL", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, rsvp_link: "not a url" } }, "Registration link must be a valid URL"),
  row({ id: "create: start_date not ISO", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, start_date: "June 1st" } }, START_FORMAT, { field: "start_date" }),
  row({ id: "create: start_date in the past", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, start_date: "2020-01-01" } }, "start_date must be a date in the future", { field: "start_date" }),
  row({ id: "create: end_date not ISO", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, end_date: "later" } }, END_FORMAT, { field: "end_date" }),
  row({ id: "create: end_date before start", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, end_date: "2030-06-01T17:00:00Z" } }, "end_date must be after start_date", { field: "end_date" }),
  row({ id: "create order: empty body → title first", route: "events/create", verb: "POST", persona: "student" }, { body: {} }, "Title is required", { kind: "order" }),
  row({ id: "create order: bad price and bad dates → price first", route: "events/create", verb: "POST", persona: "student" }, { body: { ...CREATE, price: "x".repeat(21), start_date: "June 1st" } }, "Price must be 20 characters or less", { kind: "order" }),

  // ── events/[id] PATCH (owner is the creator of the approved EVENT_OWN) ──
  row({ id: "event PATCH: no editable field", route: "events/[id]", verb: "PATCH", persona: "owner" }, { params: ev, body: { status: "approved" } }, "No valid fields to update"),
  row({ id: "event PATCH: start_date not ISO", route: "events/[id]", verb: "PATCH", persona: "owner" }, { params: ev, body: { start_date: "soon" } }, START_FORMAT, { field: "start_date" }),
  row({ id: "event PATCH: start_date in the past", route: "events/[id]", verb: "PATCH", persona: "owner" }, { params: ev, body: { start_date: "2020-01-01" } }, "start_date must be a date in the future", { field: "start_date" }),
  row({ id: "event PATCH: end_date before start", route: "events/[id]", verb: "PATCH", persona: "owner" }, { params: ev, body: { start_date: "2030-06-01T18:00:00Z", end_date: "2030-06-01T17:00:00Z" } }, "end_date must be after start_date", { field: "end_date" }),
  row({ id: "event PATCH: end_date alone not ISO", route: "events/[id]", verb: "PATCH", persona: "owner" }, { params: ev, body: { end_date: "later" } }, END_FORMAT, { field: "end_date" }),
  row({ id: "event PATCH order: no field beats a bad date", route: "events/[id]", verb: "PATCH", persona: "owner" }, { params: ev, body: {} }, "No valid fields to update", { kind: "order" }),

  // ── events/[id]/rsvp ──
  row({ id: "rsvp POST: user_id missing", route: "events/[id]/rsvp", verb: "POST", persona: "student" }, { params: ev, body: { status: "going" } }, "user_id is required"),
  row({ id: "rsvp POST: status missing", route: "events/[id]/rsvp", verb: "POST", persona: "student" }, { params: ev, body: { user_id: CALLER.id } }, "status is required"),
  row({ id: "rsvp POST: status not a member", route: "events/[id]/rsvp", verb: "POST", persona: "student" }, { params: ev, body: { user_id: CALLER.id, status: "maybe" } }, "Invalid status. Must be one of: going, interested"),
  row({ id: "rsvp POST order: empty body → user_id first", route: "events/[id]/rsvp", verb: "POST", persona: "student" }, { params: ev, body: {} }, "user_id is required", { kind: "order" }),
  row({ id: "rsvp DELETE: user_id missing", route: "events/[id]/rsvp", verb: "DELETE", persona: "student" }, { params: ev, body: {} }, "user_id is required"),

  // ── events/[id]/reviews POST ──
  row({ id: "reviews: rating missing", route: "events/[id]/reviews", verb: "POST", persona: "student" }, { params: ev, body: { comment: "ok" } }, "Rating must be an integer between 1 and 5"),
  row({ id: "reviews: rating 6", route: "events/[id]/reviews", verb: "POST", persona: "student" }, { params: ev, body: { rating: 6 } }, "Rating must be an integer between 1 and 5"),
  row({ id: "reviews: rating 2.5", route: "events/[id]/reviews", verb: "POST", persona: "student" }, { params: ev, body: { rating: 2.5 } }, "Rating must be an integer between 1 and 5"),
  row({ id: "reviews: event not ended", route: "events/[id]/reviews", verb: "POST", persona: "student" }, { params: ev, body: { rating: 5 } }, "Reviews can only be submitted after the event has ended", { kind: "rule" }),

  // ── events/[id]/invite, report, appeal, analytics ──
  row({ id: "invite: invitee_ids missing", route: "events/[id]/invite", verb: "POST", persona: "student" }, { params: ev, body: {} }, "No invitees provided"),
  row({ id: "invite: invitee_ids empty", route: "events/[id]/invite", verb: "POST", persona: "student" }, { params: ev, body: { invitee_ids: [] } }, "No invitees provided"),
  row({ id: "invite: no invitee is a friend", route: "events/[id]/invite", verb: "POST", persona: "student" }, { params: ev, body: { invitee_ids: [OTHER_USER_ID] } }, "No valid friends to invite", { kind: "rule" }),
  row({ id: "report: category missing", route: "events/[id]/report", verb: "POST", persona: "student" }, { params: ev, body: { message: "spam" } }, "Invalid category"),
  row({ id: "report: category unknown", route: "events/[id]/report", verb: "POST", persona: "student" }, { params: ev, body: { category: "rude" } }, "Invalid category"),
  row({ id: "event appeal: message missing", route: "events/[id]/appeal", verb: "POST", persona: "student" }, { params: ev, body: {} }, "Appeal message is required"),
  row({ id: "event appeal: message blank", route: "events/[id]/appeal", verb: "POST", persona: "student" }, { params: ev, body: { message: "   " } }, "Appeal message is required"),
  row({ id: "event analytics: event has no club", route: "events/[id]/analytics", verb: "GET", persona: "student" }, { params: ev }, "Event is not associated with a club", { kind: "rule" }),

  // ── events/export GET, events/popular GET, events GET (order only) ──
  row({ id: "export: format missing", route: "events/export", verb: "GET", persona: "student" }, { query: "" }, "format parameter must be 'csv' or 'ical'"),
  row({ id: "export: format pdf", route: "events/export", verb: "GET", persona: "student" }, { query: "?format=pdf" }, "format parameter must be 'csv' or 'ical'"),
  row({ id: "export: eventId not a UUID", route: "events/export", verb: "GET", persona: "student" }, { query: "?format=csv&eventId=abc" }, "eventId must be a valid UUID"),
  row({ id: "export: eventIds not UUIDs", route: "events/export", verb: "GET", persona: "student" }, { query: `?format=csv&eventIds=${EVENT_OWN},abc` }, "eventIds must be a comma-separated list of valid UUIDs"),
  row({ id: "export: eventId and eventIds", route: "events/export", verb: "GET", persona: "student" }, { query: `?format=ical&eventId=${EVENT_OWN}&eventIds=${EVENT_PENDING}` }, "Provide either eventId or eventIds, not both"),
  row({ id: "export order: bad format beats bad eventId", route: "events/export", verb: "GET", persona: "student" }, { query: "?format=pdf&eventId=abc" }, "format parameter must be 'csv' or 'ical'", { kind: "order" }),
  row({ id: "export order: bad eventId beats both-given", route: "events/export", verb: "GET", persona: "student" }, { query: "?format=csv&eventId=abc&eventIds=def" }, "eventId must be a valid UUID", { kind: "order" }),
  row({ id: "popular: sort unknown", route: "events/popular", verb: "GET", persona: "student" }, { query: "?sort=newest" }, "sort must be 'popularity' or 'trending'"),
  row({ id: "events list order: bad timeOfDay beats bad dayType", route: "events", verb: "GET", persona: "student" }, { query: "?timeOfDay=noon&dayType=holiday" }, "Invalid timeOfDay value. Must be one of: morning, afternoon, evening, night", { kind: "order" }),
  row({ id: "events list order: bad dayType beats bad cursor", route: "events", verb: "GET", persona: "student" }, { query: "?dayType=holiday&cursor=zzz" }, "Invalid dayType value. Must be one of: weekday, weekend", { kind: "order" }),

  // ── events/upload-image POST (multipart; size is checked before type) ──
  row({ id: "upload-image: no file", route: "events/upload-image", verb: "POST", persona: "student" }, { form: {} }, "No file provided"),
  row({ id: "upload-image: too large", route: "events/upload-image", verb: "POST", persona: "student" }, { form: { file: png(5 * MB + 1) } }, "File too large. Maximum size is 5MB"),
  row({ id: "upload-image: wrong type", route: "events/upload-image", verb: "POST", persona: "student" }, { form: { file: txt() } }, 'Invalid file type "text/plain". Allowed: JPEG, PNG, WebP, GIF.'),
  row({ id: "upload-image order: too large and wrong type → size first", route: "events/upload-image", verb: "POST", persona: "student" }, { form: { file: txt(5 * MB + 1) } }, "File too large. Maximum size is 5MB", { kind: "order" }),

  // ── clubs POST ──
  row({ id: "club POST: link not a string", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, website_url: 5 } }, "Invalid value for website_url", { field: "website_url" }),
  row({ id: "club POST: logo_url not a string", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, logo_url: ["x"] } }, "Invalid value for logo_url", { field: "logo_url" }),
  row({ id: "club POST: link javascript:", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, discord_url: "javascript:alert(1)" } }, "Invalid URL for discord_url"),
  row({ id: "club POST: name missing", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, name: "" } }, "Name, description, and category are required"),
  row({ id: "club POST: description missing", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, description: undefined } }, "Name, description, and category are required"),
  row({ id: "club POST: category missing", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, category: "<i></i>" } }, "Name, description, and category are required"),
  row({ id: "club POST: contact_email missing", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, contact_email: undefined } }, "Contact email is required"),
  row({ id: "club POST: contact_email not a string", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, contact_email: 5 } }, "Contact email is required"),
  row({ id: "club POST: contact_email malformed", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, contact_email: "not-an-email" } }, "Please provide a valid email address"),
  row({ id: "club POST: name over 100", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, name: "n".repeat(101) } }, "Name max 100 chars, description max 500 chars"),
  row({ id: "club POST: description over 500", route: "clubs", verb: "POST", persona: "student" }, { body: { ...NEW_CLUB, description: "d".repeat(501) } }, "Name max 100 chars, description max 500 chars"),
  row({ id: "club POST order: bad link type beats missing name", route: "clubs", verb: "POST", persona: "student" }, { body: { twitter_url: 1 } }, "Invalid value for twitter_url", { field: "twitter_url", kind: "order" }),
  row({ id: "club POST order: missing name beats missing email", route: "clubs", verb: "POST", persona: "student" }, { body: { description: "d", category: "c" } }, "Name, description, and category are required", { kind: "order" }),

  // ── clubs/[id] PATCH and DELETE (owner) ──
  row({ id: "club PATCH: value not a string", route: "clubs/[id]", verb: "PATCH", persona: "owner" }, { params: club, body: { description: 5 } }, "Invalid value for description", { field: "description" }),
  row({ id: "club PATCH: URL not http(s)", route: "clubs/[id]", verb: "PATCH", persona: "owner" }, { params: club, body: { banner_url: "ftp://a.ca/b.png" } }, "Invalid URL for banner_url"),
  row({ id: "club PATCH: contact_email malformed", route: "clubs/[id]", verb: "PATCH", persona: "owner" }, { params: club, body: { contact_email: "nope" } }, "Invalid email format for contact_email"),
  row({ id: "club PATCH: no allowed field", route: "clubs/[id]", verb: "PATCH", persona: "owner" }, { params: club, body: { status: "approved" } }, "No valid fields to update"),
  row({ id: "club PATCH order: bad type beats bad URL", route: "clubs/[id]", verb: "PATCH", persona: "owner" }, { params: club, body: { website_url: "x", name: 5 } }, "Invalid value for name", { field: "name", kind: "order" }),
  row({ id: "club PATCH order: bad URL beats bad email", route: "clubs/[id]", verb: "PATCH", persona: "owner" }, { params: club, body: { contact_email: "nope", linkedin_url: "x" } }, "Invalid URL for linkedin_url", { kind: "order" }),
  row({ id: "club DELETE: confirmName wrong", route: "clubs/[id]", verb: "DELETE", persona: "owner" }, { params: club, body: { confirmName: "Wrong Club" } }, "Club name confirmation does not match", { kind: "rule" }),
  row({ id: "club DELETE: confirmName missing", route: "clubs/[id]", verb: "DELETE", persona: "owner" }, { params: club, body: {} }, "Club name confirmation does not match", { kind: "rule" }),

  // ── clubs/[id]/transfer, members/role, members, invites, appeal ──
  row({ id: "transfer: newOwnerId missing", route: "clubs/[id]/transfer", verb: "POST", persona: "owner" }, { params: club, body: {} }, "newOwnerId is required"),
  row({ id: "transfer: to self", route: "clubs/[id]/transfer", verb: "POST", persona: "owner" }, { params: club, body: { newOwnerId: CALLER.id } }, "You already own this club", { kind: "rule" }),
  row({ id: "transfer: target not a member", route: "clubs/[id]/transfer", verb: "POST", persona: "owner" }, { params: club, body: { newOwnerId: NON_MEMBER_ID } }, "Target user is not a member of this club", { kind: "rule" }),
  row({ id: "member role: memberId missing", route: "clubs/[id]/members/role", verb: "PATCH", persona: "owner" }, { params: club, body: { role: "organizer" } }, "Invalid request. Role must be 'organizer'."),
  row({ id: "member role: role owner", route: "clubs/[id]/members/role", verb: "PATCH", persona: "owner" }, { params: club, body: { memberId: MEMBER_ORGANIZER, role: "owner" } }, "Invalid request. Role must be 'organizer'."),
  row({ id: "member role: own role", route: "clubs/[id]/members/role", verb: "PATCH", persona: "owner" }, { params: club, body: { memberId: MEMBER_SELF, role: "organizer" } }, "Cannot change your own role", { kind: "rule" }),
  row({ id: "member role: another owner", route: "clubs/[id]/members/role", verb: "PATCH", persona: "owner" }, { params: club, body: { memberId: MEMBER_OTHER_OWNER, role: "organizer" } }, "Cannot change owner role. Use transfer ownership instead.", { kind: "rule" }),
  row({ id: "member DELETE: memberId missing", route: "clubs/[id]/members", verb: "DELETE", persona: "owner" }, { params: club, body: {} }, "memberId is required"),
  row({ id: "member DELETE: self", route: "clubs/[id]/members", verb: "DELETE", persona: "owner" }, { params: club, body: { memberId: MEMBER_SELF } }, "You cannot remove yourself from the club", { kind: "rule" }),
  row({ id: "member DELETE: another owner", route: "clubs/[id]/members", verb: "DELETE", persona: "owner" }, { params: club, body: { memberId: MEMBER_OTHER_OWNER } }, "Cannot remove the club owner", { kind: "rule" }),
  row({ id: "invites: email missing", route: "clubs/[id]/invites", verb: "POST", persona: "owner" }, { params: club, body: {} }, "Email is required"),
  row({ id: "invites: not McGill", route: "clubs/[id]/invites", verb: "POST", persona: "owner" }, { params: club, body: { email: "someone@gmail.com" } }, "Must be a McGill email"),
  row({ id: "club appeal: message missing", route: "clubs/[id]/appeal", verb: "POST", persona: "student" }, { params: club, body: {} }, "Appeal message is required"),
  row({ id: "club appeal: message blank", route: "clubs/[id]/appeal", verb: "POST", persona: "student" }, { params: club, body: { message: " " } }, "Appeal message is required"),

  // ── clubs/banner and clubs/logo (multipart, owner; type before size) ──
  row({ id: "club banner: no file", route: "clubs/banner", verb: "POST", persona: "owner" }, { form: { fields: { clubId: CLUB_ID } } }, "File and clubId are required"),
  row({ id: "club banner: no clubId", route: "clubs/banner", verb: "POST", persona: "owner" }, { form: { file: png() } }, "File and clubId are required"),
  row({ id: "club banner: wrong type", route: "clubs/banner", verb: "POST", persona: "owner" }, { form: { file: { type: "image/gif", size: 4, name: "b.gif" }, fields: { clubId: CLUB_ID } } }, "File must be JPEG, PNG, or WebP"),
  row({ id: "club banner: too large", route: "clubs/banner", verb: "POST", persona: "owner" }, { form: { file: png(5 * MB + 1), fields: { clubId: CLUB_ID } } }, "File must be under 5MB"),
  row({ id: "club banner order: wrong type and too large → type first", route: "clubs/banner", verb: "POST", persona: "owner" }, { form: { file: txt(5 * MB + 1), fields: { clubId: CLUB_ID } } }, "File must be JPEG, PNG, or WebP", { kind: "order" }),
  row({ id: "club logo: no file", route: "clubs/logo", verb: "POST", persona: "owner" }, { form: { fields: { clubId: CLUB_ID } } }, "File and clubId are required"),
  row({ id: "club logo: no clubId", route: "clubs/logo", verb: "POST", persona: "owner" }, { form: { file: png() } }, "File and clubId are required"),
  row({ id: "club logo: wrong type", route: "clubs/logo", verb: "POST", persona: "owner" }, { form: { file: txt(), fields: { clubId: CLUB_ID } } }, "File must be JPEG, PNG, or WebP"),
  row({ id: "club logo: too large", route: "clubs/logo", verb: "POST", persona: "owner" }, { form: { file: png(2 * MB + 1), fields: { clubId: CLUB_ID } } }, "File must be under 2MB"),
  row({ id: "club logo order: wrong type and too large → type first", route: "clubs/logo", verb: "POST", persona: "owner" }, { form: { file: txt(2 * MB + 1), fields: { clubId: CLUB_ID } } }, "File must be JPEG, PNG, or WebP", { kind: "order" }),

  // ── users/[id] PATCH (self) and users/[id]/follow ──
  row({ id: "user PATCH: name too short", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { name: " a " } }, "Name must be between 2 and 50 characters long"),
  row({ id: "user PATCH: name too long", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { name: "n".repeat(51) } }, "Name must be between 2 and 50 characters long"),
  row({ id: "user PATCH: avatar_url not a string", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { avatar_url: 5 } }, "Avatar URL must be a string or null"),
  row({ id: "user PATCH: avatar_url not a URL", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { avatar_url: "avatar.png" } }, "Invalid Avatar URL format"),
  row({ id: "user PATCH: banner_url not a string", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { banner_url: true } }, "Banner URL must be a string or null"),
  row({ id: "user PATCH: banner_url not a URL", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { banner_url: "banner.png" } }, "Invalid Banner URL format"),
  row({ id: "user PATCH: interest_tags not an array", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { interest_tags: "academic" } }, "interest_tags must be an array"),
  row({ id: "user PATCH: interest_tags unknown value", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { interest_tags: ["academic", "knitting"] } }, "Invalid tag values provided in interest_tags"),
  row({ id: "user PATCH: pronouns not a string", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { pronouns: 1 } }, "Pronouns must be a string or null"),
  row({ id: "user PATCH: year not a string", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { year: 2 } }, "Year must be a string or null"),
  row({ id: "user PATCH: faculty not a string", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { faculty: ["Arts"] } }, "Faculty must be a string or null"),
  row({ id: "user PATCH: visibility unknown", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { visibility: "friends" } }, "Visibility must be 'public' or 'private'"),
  row({ id: "user PATCH: onboarding_completed not boolean", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { onboarding_completed: "yes" } }, "onboarding_completed must be a boolean"),
  row({ id: "user PATCH: no field", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { email: "x@mail.mcgill.ca" } }, "No fields to update"),
  row({ id: "user PATCH order: bad name beats bad visibility", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { visibility: "x", name: "a" } }, "Name must be between 2 and 50 characters long", { kind: "order" }),
  row({ id: "user PATCH order: bad pronouns beats bad year", route: "users/[id]", verb: "PATCH", persona: "student" }, { params: self, body: { year: 1, pronouns: 1 } }, "Pronouns must be a string or null", { kind: "order" }),
  row({ id: "follow: self", route: "users/[id]/follow", verb: "POST", persona: "student" }, { params: self }, "Cannot follow yourself", { kind: "rule" }),

  // ── profile/avatar, profile/banner (multipart; type before size) ──
  row({ id: "avatar: no file", route: "profile/avatar", verb: "POST", persona: "student" }, { form: {} }, "No file provided"),
  row({ id: "avatar: wrong type", route: "profile/avatar", verb: "POST", persona: "student" }, { form: { file: txt() } }, "Invalid file type. Allowed: JPEG, PNG, WebP, GIF"),
  row({ id: "avatar: too large", route: "profile/avatar", verb: "POST", persona: "student" }, { form: { file: png(5 * MB + 1) } }, "File too large. Maximum size is 5MB"),
  row({ id: "avatar order: wrong type and too large → type first", route: "profile/avatar", verb: "POST", persona: "student" }, { form: { file: txt(5 * MB + 1) } }, "Invalid file type. Allowed: JPEG, PNG, WebP, GIF", { kind: "order" }),
  row({ id: "profile banner: no file", route: "profile/banner", verb: "POST", persona: "student" }, { form: {} }, "No file provided"),
  row({ id: "profile banner: wrong type", route: "profile/banner", verb: "POST", persona: "student" }, { form: { file: { type: "image/gif", size: 4, name: "b.gif" } } }, "Invalid file type. Allowed: JPEG, PNG, WebP"),
  row({ id: "profile banner: too large", route: "profile/banner", verb: "POST", persona: "student" }, { form: { file: png(8 * MB + 1) } }, "File too large. Maximum size is 8MB"),

  // ── profile/interests, profile/inferred-tags, organizer-requests ──
  row({ id: "interests: not an array", route: "profile/interests", verb: "PUT", persona: "student" }, { body: { interest_tags: "academic" } }, "interest_tags must be an array"),
  row({ id: "interests: missing", route: "profile/interests", verb: "PUT", persona: "student" }, { body: {} }, "interest_tags must be an array"),
  row({ id: "interests: unknown value", route: "profile/interests", verb: "PUT", persona: "student" }, { body: { interest_tags: ["knitting"] } }, "Invalid tag values provided"),
  row({ id: "inferred-tags: tag missing", route: "profile/inferred-tags", verb: "DELETE", persona: "student" }, { body: {} }, "tag is required and must be a string"),
  row({ id: "inferred-tags: tag not a string", route: "profile/inferred-tags", verb: "DELETE", persona: "student" }, { body: { tag: ["academic"] } }, "tag is required and must be a string"),
  row({ id: "organizer request: club_id missing", route: "organizer-requests", verb: "POST", persona: "student" }, { body: { message: "please" } }, "club_id is required"),

  // ── moderation ──
  row({ id: "moderation reviews: target type unknown", route: "moderation/reviews/[targetType]/[targetId]", verb: "GET", persona: "student" }, { params: { targetType: "user", targetId: EVENT_OWN } }, "Invalid target type"),

  // ── admin/clubs/[id] PATCH ──
  row({ id: "admin club: status missing", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: {} }, "Status must be 'approved', 'rejected', or 'suspended'"),
  row({ id: "admin club: status unknown", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: { status: "deleted" } }, "Status must be 'approved', 'rejected', or 'suspended'"),
  row({ id: "admin club: rejection without message", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: { status: "rejected", category: "other" } }, "Rejection requires category and message"),
  row({ id: "admin club: rejection without category", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: { status: "rejected", message: "why" } }, "Rejection requires category and message"),
  row({ id: "admin club: rejection category unknown", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: { status: "rejected", category: "rude", message: "why" } }, "Invalid rejection category"),
  row({ id: "admin club: suspension without message", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: { status: "suspended", category: "other", message: "  " } }, "Suspension requires category and message"),
  row({ id: "admin club: suspension category unknown", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: { status: "suspended", category: "rude", message: "why" } }, "Invalid suspension category"),
  row({ id: "admin club order: requires beats category", route: "admin/clubs/[id]", verb: "PATCH", persona: "admin" }, { params: club, body: { status: "rejected", category: "rude" } }, "Rejection requires category and message", { kind: "order" }),

  // ── admin/events/[id]/edits PATCH ──
  row({ id: "admin edits: action missing", route: "admin/events/[id]/edits", verb: "PATCH", persona: "admin" }, { params: ev, body: {} }, "action must be 'approve' or 'reject'"),
  row({ id: "admin edits: action unknown", route: "admin/events/[id]/edits", verb: "PATCH", persona: "admin" }, { params: ev, body: { action: "merge" } }, "action must be 'approve' or 'reject'"),
  row({ id: "admin edits: reject without reason", route: "admin/events/[id]/edits", verb: "PATCH", persona: "admin" }, { params: ev, body: { action: "reject" } }, "reason is required when rejecting edits"),
  row({ id: "admin edits: no pending edits", route: "admin/events/[id]/edits", verb: "PATCH", persona: "admin" }, { params: ev, body: { action: "approve" } }, "This event has no pending edits", { kind: "rule" }),

  // ── admin/events/[id]/status PATCH (pending → rejected, approved → suspended) ──
  row({ id: "admin status: status missing", route: "admin/events/[id]/status", verb: "PATCH", persona: "admin" }, { params: ev, body: {} }, "Invalid status"),
  row({ id: "admin status: status pending", route: "admin/events/[id]/status", verb: "PATCH", persona: "admin" }, { params: ev, body: { status: "pending" } }, "Invalid status"),
  row({ id: "admin status: rejection without category", route: "admin/events/[id]/status", verb: "PATCH", persona: "admin" }, { params: { id: EVENT_PENDING }, body: { status: "rejected", message: "why" } }, "Rejection requires category and message"),
  row({ id: "admin status: rejection category unknown", route: "admin/events/[id]/status", verb: "PATCH", persona: "admin" }, { params: { id: EVENT_PENDING }, body: { status: "rejected", category: "rude", message: "why" } }, "Invalid rejection category"),
  row({ id: "admin status: suspension without message", route: "admin/events/[id]/status", verb: "PATCH", persona: "admin" }, { params: ev, body: { status: "suspended", category: "other" } }, "Suspension requires category and message"),
  row({ id: "admin status: suspension category unknown", route: "admin/events/[id]/status", verb: "PATCH", persona: "admin" }, { params: ev, body: { status: "suspended", category: "rude", message: "why" } }, "Invalid suspension category"),

  // ── admin/events POST, experiments, featured ──
  row({ id: "admin event POST: title missing", route: "admin/events", verb: "POST", persona: "admin" }, { body: { start_date: "2030-01-01", end_date: "2030-01-02" } }, "title, start_date, and end_date are required"),
  row({ id: "admin event POST: start_date missing", route: "admin/events", verb: "POST", persona: "admin" }, { body: { title: "T", end_date: "2030-01-02" } }, "title, start_date, and end_date are required"),
  row({ id: "admin event POST: end_date missing", route: "admin/events", verb: "POST", persona: "admin" }, { body: { title: "T", start_date: "2030-01-01" } }, "title, start_date, and end_date are required"),
  // Added by 06-10 (F-094): admin/events/[id] PUT answered no 400 before its
  // contract, so it had no row; P0 now counts it (parseBody), and this row
  // pins its first 400, measured on the adopted handler (a ledger row).
  row({ id: "admin event PUT: title not a string", route: "admin/events/[id]", verb: "PUT", persona: "admin" }, { params: ev, body: { title: 5 } }, "title must be a string"),
  row({ id: "experiment POST: name missing", route: "admin/experiments", verb: "POST", persona: "admin" }, { body: { variants: [{}, {}] } }, "name is required"),
  row({ id: "experiment POST: one variant", route: "admin/experiments", verb: "POST", persona: "admin" }, { body: { name: "x", variants: [{}] } }, "At least 2 variants are required"),
  row({ id: "experiment POST: variants not an array", route: "admin/experiments", verb: "POST", persona: "admin" }, { body: { name: "x", variants: "ab" } }, "At least 2 variants are required"),
  row({ id: "experiment POST order: name beats variants", route: "admin/experiments", verb: "POST", persona: "admin" }, { body: {} }, "name is required", { kind: "order" }),
  row({ id: "experiment DELETE: not draft", route: "admin/experiments/[id]", verb: "DELETE", persona: "admin" }, { params: { id: EXPERIMENT_ID } }, "Only draft experiments can be deleted", { kind: "rule" }),
  row({ id: "featured POST: event_id missing", route: "admin/featured", verb: "POST", persona: "admin" }, { body: { starts_at: "2030-01-01", ends_at: "2030-01-02" } }, "event_id, starts_at, and ends_at are required"),
  row({ id: "featured POST: ends_at missing", route: "admin/featured", verb: "POST", persona: "admin" }, { body: { event_id: EVENT_OWN, starts_at: "2030-01-01" } }, "event_id, starts_at, and ends_at are required"),
  row({ id: "featured PATCH: no field", route: "admin/featured/[id]", verb: "PATCH", persona: "admin" }, { params: { id: FEATURED_ID }, body: { event_id: EVENT_OWN } }, "No fields to update"),

  // ── admin organizer-requests, reports, users ──
  row({ id: "admin organizer request: status unknown", route: "admin/organizer-requests/[id]", verb: "PATCH", persona: "admin" }, { params: { id: REQUEST_ID }, body: { status: "pending" } }, "Status must be 'approved' or 'rejected'"),
  row({ id: "admin report: status unknown", route: "admin/reports/[id]", verb: "PATCH", persona: "admin" }, { params: { id: REPORT_ID }, body: { status: "open" } }, "Invalid status"),
  row({ id: "ban: reason missing", route: "admin/users/[id]/ban", verb: "POST", persona: "admin" }, { params: other, body: {} }, "Reason is required"),
  row({ id: "ban: reason blank", route: "admin/users/[id]/ban", verb: "POST", persona: "admin" }, { params: other, body: { reason: "  " } }, "Reason is required"),
  row({ id: "ban: duration_days zero", route: "admin/users/[id]/ban", verb: "POST", persona: "admin" }, { params: other, body: { reason: "spam", duration_days: 0 } }, "duration_days must be a positive integer"),
  row({ id: "ban: duration_days fractional", route: "admin/users/[id]/ban", verb: "POST", persona: "admin" }, { params: other, body: { reason: "spam", duration_days: 1.5 } }, "duration_days must be a positive integer"),
  row({ id: "ban: self", route: "admin/users/[id]/ban", verb: "POST", persona: "admin" }, { params: self, body: { reason: "spam" } }, "Cannot ban your own account", { kind: "rule" }),
  row({ id: "ban order: reason beats duration", route: "admin/users/[id]/ban", verb: "POST", persona: "admin" }, { params: other, body: { duration_days: -1 } }, "Reason is required", { kind: "order" }),
  row({ id: "admin user PATCH: role unknown", route: "admin/users/[id]", verb: "PATCH", persona: "admin" }, { params: other, body: { roles: ["superuser"] } }, "Invalid role", { field: "roles" }),
  row({ id: "admin user PATCH: roles not an array", route: "admin/users/[id]", verb: "PATCH", persona: "admin" }, { params: other, body: { roles: "admin" } }, "Invalid role", { field: "roles" }),
  row({ id: "admin user PATCH: name too short", route: "admin/users/[id]", verb: "PATCH", persona: "admin" }, { params: other, body: { name: "a" } }, "Name must be between 2 and 50 characters long", { field: "name" }),
  row({ id: "admin user PATCH: name not a string", route: "admin/users/[id]", verb: "PATCH", persona: "admin" }, { params: other, body: { name: 42 } }, "Name must be between 2 and 50 characters long", { field: "name" }),
  row({ id: "admin user PATCH order: roles beats name", route: "admin/users/[id]", verb: "PATCH", persona: "admin" }, { params: other, body: { name: "a", roles: ["x"] } }, "Invalid role", { field: "roles", kind: "order" }),
];

// ─── Query coercion rows (no 400 today) ────────────────────────────────────

export interface Outcome {
  status: number | "threw";
  body: unknown;
  cookieCalls: readonly FakeCall[];
}

export interface QueryCoercionRow {
  id: string;
  route: string;
  persona: PersonaName;
  query: string;
  /** Serve the cookie fake through `withContainsAndNot`. */
  wrapContains?: boolean;
  /** What the handler did with the coerced value, read from the outcome. */
  observe(outcome: Outcome): unknown;
  expected: unknown;
}

function callOn(outcome: Outcome, table: string): FakeCall | undefined {
  return outcome.cookieCalls.find(
    (c) => c.table === table && c.operation === "select"
  );
}

function filterValue(call: FakeCall | undefined, column: string): unknown {
  return call?.filters.find((f) => f.column === column)?.value;
}

function hasFilter(call: FakeCall | undefined, column: string): boolean {
  return Boolean(call?.filters.some((f) => f.column === column));
}

export const QUERY_COERCION_ROWS: readonly QueryCoercionRow[] = [
  {
    id: "events: limit=5.9 is truncated to 5",
    route: "events",
    persona: "student",
    query: "?limit=5.9",
    observe: (o) => [o.status, (o.body as { limit?: unknown }).limit],
    expected: [200, 5],
  },
  {
    id: "events/export: blank eventIds elements are dropped, not refused",
    route: "events/export",
    persona: "student",
    query: "?format=csv&eventIds=,%20,",
    observe: (o) => o.status,
    expected: 200,
  },
  {
    id: "events/popular: limit=999 is capped at 50 and never refused",
    route: "events/popular",
    persona: "student",
    query: "?limit=999&offset=abc",
    observe: (o) => o.status,
    expected: 200,
  },
  {
    id: "calendar/events: from=garbage reaches the query as-is",
    route: "calendar/events",
    persona: "student",
    query: "?from=garbage",
    observe: (o) => [o.status, filterValue(callOn(o, "events"), "start_date")],
    expected: [200, "garbage"],
  },
  {
    id: "clubs/trending: limit=abc falls back to 15, never refused",
    route: "clubs/trending",
    persona: "student",
    query: "?limit=abc",
    observe: (o) => o.status,
    expected: 200,
  },
  {
    id: "admin/events: limit=abc becomes a NaN range",
    route: "admin/events",
    persona: "admin",
    query: "?limit=abc",
    observe: (o) => callOn(o, "events")?.range,
    expected: { from: 0, to: Number.NaN },
  },
  {
    id: "admin/reports: limit=-5 falls back to 50",
    route: "admin/reports",
    persona: "admin",
    query: "?limit=-5&offset=-3",
    observe: (o) => callOn(o, "event_reports")?.range,
    expected: { from: 0, to: 49 },
  },
  {
    id: "admin/organizer-requests: offset=abc becomes a NaN range",
    route: "admin/organizer-requests",
    persona: "admin",
    query: "?offset=abc",
    observe: (o) => callOn(o, "organizer_requests")?.range,
    expected: { from: Number.NaN, to: Number.NaN },
  },
  {
    id: "admin/audit-log: page=0 becomes a negative offset",
    route: "admin/audit-log",
    persona: "admin",
    query: "?page=0",
    observe: (o) => callOn(o, "admin_audit_log")?.range,
    expected: { from: -20, to: -1 },
  },
  {
    id: "admin/clubs: an unknown status is passed to the filter",
    route: "admin/clubs",
    persona: "admin",
    query: "?status=banana",
    observe: (o) => filterValue(callOn(o, "clubs"), "status"),
    expected: "banana",
  },
  {
    id: "admin/organizers: an unknown status applies no ban filter",
    route: "admin/organizers",
    persona: "admin",
    query: "?status=banana",
    wrapContains: true,
    observe: (o) => [o.status, hasFilter(callOn(o, "users"), "banned_at")],
    expected: [200, false],
  },
  {
    id: "users/saved-events: include_past=1 is read as false",
    route: "users/saved-events",
    persona: "student",
    query: "?include_past=1",
    observe: (o) => [o.status, hasFilter(callOn(o, "events"), "start_date")],
    expected: [200, true],
  },
  {
    id: "users/search: a one-character q answers an empty list",
    route: "users/search",
    persona: "student",
    query: "?q=%20a%20",
    observe: (o) => [o.status, o.body],
    expected: [200, { users: [] }],
  },
];

// ─── Personas and the world ────────────────────────────────────────────────

function callerRow(overrides: FakeRow = {}): FakeRow {
  return {
    id: CALLER.id,
    email: CALLER.email,
    name: "Bad Request Caller",
    roles: ["user"],
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
    inferred_tags: ["academic"],
    ...overrides,
  };
}

function world(persona: PersonaName): Record<string, FakeRow[]> {
  const caller =
    persona === "admin" ? callerRow({ roles: ["user", "admin"] }) : callerRow();
  const members: FakeRow[] = [
    { id: MEMBER_ORGANIZER, club_id: CLUB_ID, user_id: OTHER_USER_ID, role: "organizer" },
    { id: MEMBER_OTHER_OWNER, club_id: CLUB_ID, user_id: THIRD_USER_ID, role: "owner" },
  ];
  if (persona === "owner") {
    members.unshift({ id: MEMBER_SELF, club_id: CLUB_ID, user_id: CALLER.id, role: "owner" });
  }
  return {
    users: [
      caller,
      { id: OTHER_USER_ID, email: "bad.request.other@mail.mcgill.ca", name: "Other", roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null },
      { id: THIRD_USER_ID, email: "bad.request.third@mail.mcgill.ca", name: "Third", roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null },
    ],
    events: [
      {
        id: EVENT_OWN,
        title: "Bad Request Event",
        description: "d",
        status: "approved",
        deleted_at: null,
        created_by: CALLER.id,
        club_id: null,
        start_date: "2030-01-01T18:00:00+00:00",
        end_date: null,
        pending_edits: null,
        tags: ["academic"],
        appeal_count: 0,
      },
      {
        id: EVENT_PENDING,
        title: "Pending Event",
        status: "pending",
        deleted_at: null,
        created_by: OTHER_USER_ID,
        club_id: null,
        start_date: "2030-02-01T18:00:00+00:00",
        pending_edits: null,
        tags: ["social"],
        appeal_count: 0,
      },
    ],
    clubs: [{ id: CLUB_ID, name: CLUB_NAME, status: "approved", created_by: THIRD_USER_ID, appeal_count: 0 }],
    club_members: members,
    saved_events: [{ user_id: CALLER.id, event_id: EVENT_OWN, created_at: "2026-01-01T00:00:00+00:00" }],
    rsvps: [],
    experiments: [{ id: EXPERIMENT_ID, name: "running-exp", status: "running" }],
    featured_events: [{ id: FEATURED_ID, event_id: EVENT_OWN, priority: 0 }],
    organizer_requests: [{ id: REQUEST_ID, user_id: OTHER_USER_ID, club_id: CLUB_ID, status: "pending" }],
    event_reports: [{ id: REPORT_ID, event_id: EVENT_OWN, reporter_id: OTHER_USER_ID, status: "pending" }],
    admin_audit_log: [],
    club_followers: [],
    user_follows: [],
  };
}

export const PERSONAS: Record<PersonaName, () => FakeSupabaseInit> = {
  student: () => ({ user: CALLER, tables: world("student"), rpc: RPC }),
  owner: () => ({ user: CALLER, tables: world("owner"), rpc: RPC }),
  admin: () => ({ user: CALLER, tables: world("admin"), rpc: RPC }),
};

/** get_friends answers no friends, so the invite rule row is reachable. */
const RPC = {
  get_friends: { data: [], error: null },
};

/** The elevated fake: the same rows, no session. */
export function elevatedInit(persona: PersonaName): FakeSupabaseInit {
  return { user: null, tables: world(persona), rpc: RPC };
}

// ─── A test-local client wrapper for admin/organizers ──────────────────────

type FakeClient = FakeSupabase["client"];
type FakeBuilder = ReturnType<FakeClient["from"]>;

/**
 * The shared fake has no `contains` or `not`, and several PRESERVE suites
 * pin the throw that gap produces (writeHandlerTable's "fake gap" outcomes),
 * so the fake itself is not extended (the 06-02 precedent). This wrapper adds
 * the two only for the one coercion row that needs them:
 *   - `contains(column, [one])` delegates to `overlaps`, which is exactly
 *     Postgres `@>` when the right-hand array has one element (the only use:
 *     `roles @> {club_organizer}`);
 *   - `not(column, op, value)` is recorded through `or` as
 *     `not.<column>.<op>.<value>`, not evaluated, as `or` itself is.
 */
export function withContainsAndNot(client: FakeClient): FakeClient {
  return {
    auth: client.auth,
    rpc: (name, args) => client.rpc(name, args),
    from(table) {
      const builder: FakeBuilder = client.from(table);
      return Object.assign(builder, {
        contains: (column: string, values: readonly unknown[]) =>
          builder.overlaps(column, values),
        not: (column: string, op: string, value: unknown) =>
          builder.or(`not.${column}.${op}.${String(value)}`),
      });
    },
  };
}

// ─── Building and running a request ────────────────────────────────────────

function path(route: string, params: Record<string, string> = {}): string {
  return route.replace(/\[(\w+)\]/g, (_m, key: string) => params[key] ?? key);
}

function formBody(spec: FormSpec): FormData {
  const form = new FormData();
  if (spec.file) {
    form.append(
      "file",
      new File([new Uint8Array(spec.file.size)], spec.file.name ?? "upload", {
        type: spec.file.type,
      })
    );
  }
  for (const [key, value] of Object.entries(spec.fields ?? {})) {
    form.append(key, value);
  }
  return form;
}

export interface RequestSpec {
  route: string;
  verb: Verb;
  params?: Record<string, string>;
  body?: unknown;
  /** A raw body string, sent as-is with a JSON content type. */
  raw?: string;
  query?: string;
  form?: FormSpec;
}

export function buildRequest(spec: RequestSpec): NextRequest {
  const url = `${BASE}/${path(spec.route, spec.params)}${spec.query ?? ""}`;
  if (spec.form) {
    return new NextRequest(url, { method: spec.verb, body: formBody(spec.form) });
  }
  if (spec.raw !== undefined || spec.body !== undefined) {
    return new NextRequest(url, {
      method: spec.verb,
      body: spec.raw ?? JSON.stringify(spec.body),
      headers: { "content-type": "application/json" },
    });
  }
  return new NextRequest(url, { method: spec.verb });
}

/**
 * Runs a request against its invoker. A rejected handler promise is recorded
 * as `"threw"` with the error's message: the route has no catch around the
 * failing line, so the framework would answer an HTML 500 (F-058).
 */
export async function run(
  spec: RequestSpec
): Promise<{ status: number | "threw"; body: unknown }> {
  const invoke = INVOKERS[`${spec.route} ${spec.verb}`];
  if (!invoke) throw new Error(`no invoker for ${spec.route} ${spec.verb}`);
  try {
    const response = await invoke(buildRequest(spec), spec.params ?? {});
    if (response === undefined) throw new Error("handler returned no response");
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
