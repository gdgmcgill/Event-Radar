/**
 * The admin and moderation contracts, input by input (plan 06-10, REFAC-15,
 * DEC-65, DEC-66, DEC-80).
 *
 * Every expected 400 body below for a rule the handlers had before is COPIED
 * from the 06-07 table (src/__tests__/contracts/badRequestTable.ts) or the
 * admin PRESERVE suites, not re-derived: a contract is correct only if it
 * answers the same first 400 the handler's own ladder answered, in the same
 * order. `field` appears only on admin/users/[id] (roles, name). The texts
 * marked F-094 are new: a wrongly typed value that used to be written as-is,
 * coerced, or thrown on now answers a 400 (INTENTIONAL BEHAVIOUR CHANGE).
 *
 * The update bodies of the four DI-53 sites are also checked at the type
 * level: each parses to an object assignable to its table's TablesUpdate<>,
 * so the payload the route builds from it needs no cast (supabase-js
 * 2.116.0's RejectExcessProperties refuses a Record).
 *
 * The last block drives the ban and role-change handlers with the caller's
 * own id in upper case (DI-64, DEC-66): the self-check compares canonical
 * ids, so the differently cased id is refused like the canonical one.
 */

import { z } from "zod";
import { parseWith, readQuery } from "@/server/body";
import type { TablesUpdate } from "@/lib/supabase/types";
import { CanonicalId } from "@/contracts/common";
import {
  AdminClubDecisionBody,
  AdminEventCreateBody,
  AdminEventPutBody,
  AdminEventUpdateBody,
  AdminUserNameBody,
  AdminUserUpdateBody,
  BanBody,
  EventEditsDecisionBody,
  EventStatusBody,
  ExperimentCreateBody,
  ExperimentUpdateBody,
  FeaturedCreateBody,
  FeaturedUpdateBody,
  ModerationReason,
  OrganizerRequestDecisionBody,
  ReportDecisionBody,
  AdminClubsQuery,
  AdminEventsQuery,
  AuditLogQuery,
  CalculatePopularityQuery,
  OrganizerRequestsQuery,
  OrganizersQuery,
  ReportsQuery,
  ReviewTargetParams,
} from "@/contracts/admin";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "@/__tests__/helpers/fakeSupabase";
import {
  CALLER,
  PERSONAS,
  elevatedInit,
  run,
} from "@/__tests__/contracts/badRequestTable";

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => mockElevated.client,
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

async function firstError(
  schema: z.ZodType,
  input: unknown,
  fieldFor?: readonly string[]
) {
  const result = parseWith(schema, input, { fieldFor });
  if (result.ok) return { ok: true as const, data: result.data };
  return {
    ok: false as const,
    status: result.response.status,
    body: await result.response.json(),
  };
}

async function refused(
  schema: z.ZodType,
  input: unknown,
  fieldFor?: readonly string[]
) {
  const outcome = await firstError(schema, input, fieldFor);
  if (outcome.ok) throw new Error(`expected a 400 for ${JSON.stringify(input)}`);
  expect(outcome.status).toBe(400);
  return outcome.body;
}

async function accepted<S extends z.ZodType>(
  schema: S,
  input: unknown
): Promise<z.output<S>> {
  const outcome = await firstError(schema, input);
  if (!outcome.ok) throw new Error(`unexpected 400 ${JSON.stringify(outcome.body)}`);
  return outcome.data as z.output<S>;
}

// ─── Type level: the DI-53 payloads need no cast ────────────────────────────

type Assignable<T, U> = [T] extends [U] ? true : false;

const eventUpdateIsTyped: Assignable<
  z.output<typeof AdminEventUpdateBody>,
  TablesUpdate<"events">
> = true;
const experimentUpdateIsTyped: Assignable<
  z.output<typeof ExperimentUpdateBody>,
  TablesUpdate<"experiments">
> = true;
const featuredUpdateIsTyped: Assignable<
  z.output<typeof FeaturedUpdateBody>,
  TablesUpdate<"featured_events">
> = true;

describe("the update bodies are TablesUpdate<> values (DI-53)", () => {
  it("AdminEventUpdateBody, ExperimentUpdateBody and FeaturedUpdateBody", () => {
    expect([eventUpdateIsTyped, experimentUpdateIsTyped, featuredUpdateIsTyped]).toEqual([
      true,
      true,
      true,
    ]);
  });
});

// ─── CanonicalId (DI-64, DEC-66) ────────────────────────────────────────────

describe("CanonicalId", () => {
  it("lower-cases a UUID-shaped string", () => {
    expect(CanonicalId.parse("5EED0000-0000-4000-8000-0A7000000001")).toBe(
      "5eed0000-0000-4000-8000-0a7000000001"
    );
    expect(CanonicalId.parse("5eed0000-0000-4000-8000-0a7000000001")).toBe(
      "5eed0000-0000-4000-8000-0a7000000001"
    );
  });

  it.each(["not-a-uuid", "", "ABC", "5EED0000-0000-4000-8000-0A700000000"])(
    "passes %j through unchanged, never refusing it",
    (value) => {
      const result = CanonicalId.safeParse(value);
      expect(result).toEqual({ success: true, data: value });
    }
  );
});

// ─── admin/clubs/[id] PATCH and admin/events/[id]/status PATCH ──────────────

describe("AdminClubDecisionBody (admin/clubs/[id] PATCH)", () => {
  const STATUS = "Status must be 'approved', 'rejected', or 'suspended'";

  it.each([
    [{}, STATUS],
    [{ status: "deleted" }, STATUS],
    [{ status: 5 }, STATUS],
    [{ status: "rejected", category: "other" }, "Rejection requires category and message"],
    [{ status: "rejected", message: "why" }, "Rejection requires category and message"],
    [{ status: "rejected", category: "rude", message: "why" }, "Invalid rejection category"],
    [{ status: "suspended", category: "other", message: "  " }, "Suspension requires category and message"],
    [{ status: "suspended", category: "rude", message: "why" }, "Invalid suspension category"],
    // order: the requires rule beats the category rule
    [{ status: "rejected", category: "rude" }, "Rejection requires category and message"],
    // F-094: a numeric message threw on `.trim()` (no try)
    [{ status: "rejected", category: "other", message: 5 }, "Rejection requires category and message"],
    [{ status: "suspended", category: "other", message: false }, "Suspension requires category and message"],
    // an inherited name is not a category (own keys only)
    [{ status: "rejected", category: "toString", message: "why" }, "Invalid rejection category"],
    [{ status: "rejected", category: ["other"], message: "why" }, "Invalid rejection category"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(AdminClubDecisionBody, input)).toEqual({ error });
  });

  it("an approval carries no reason, whatever else was sent", async () => {
    expect(
      await accepted(AdminClubDecisionBody, { status: "approved", category: 5, message: 5 })
    ).toEqual({ status: "approved", category: null, message: null });
  });

  it("a rejection keeps the category and the message as sent (the handler trims)", async () => {
    expect(
      await accepted(AdminClubDecisionBody, {
        status: "rejected",
        category: "duplicate",
        message: " dup ",
      })
    ).toEqual({ status: "rejected", category: "duplicate", message: " dup " });
  });
});

describe("EventStatusBody then ModerationReason (admin/events/[id]/status PATCH)", () => {
  it.each([
    [{}, "Invalid status"],
    [{ status: "pending" }, "Invalid status"],
    [{ status: 5 }, "Invalid status"],
  ])("status: %j -> %s", async (input, error) => {
    expect(await refused(EventStatusBody, input)).toEqual({ error });
  });

  it("the status alone passes the first stage; the reason is checked after the transition rule", async () => {
    const first = await accepted(EventStatusBody, { status: "rejected", message: 5 });
    expect(first).toEqual({ status: "rejected", message: 5 });
    expect(await refused(ModerationReason, first)).toEqual({
      error: "Rejection requires category and message",
    });
  });

  it.each([
    [{ status: "rejected", message: "why" }, "Rejection requires category and message"],
    [{ status: "rejected", category: "rude", message: "why" }, "Invalid rejection category"],
    [{ status: "suspended", category: "other" }, "Suspension requires category and message"],
    [{ status: "suspended", category: "rude", message: "why" }, "Invalid suspension category"],
  ])("reason: %j -> %s", async (input, error) => {
    expect(await refused(ModerationReason, input)).toEqual({ error });
  });
});

// ─── admin/events/[id]/edits PATCH ──────────────────────────────────────────

describe("EventEditsDecisionBody (admin/events/[id]/edits PATCH)", () => {
  const ACTION = "action must be 'approve' or 'reject'";

  it.each([
    [{}, ACTION],
    [{ action: "merge" }, ACTION],
    [{ action: 5 }, ACTION],
    [{ action: "reject" }, "reason is required when rejecting edits"],
    [{ action: "reject", reason: "" }, "reason is required when rejecting edits"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(EventEditsDecisionBody, input)).toEqual({ error });
  });

  it("approve needs a reviewed snapshot but no reason; reject retains its reason", async () => {
    const expected_pending_edits = { title: "Reviewed", submitted_at: "v1" };
    expect(await accepted(EventEditsDecisionBody, { action: "approve", expected_pending_edits })).toEqual({ action: "approve", expected_pending_edits });
    expect(await accepted(EventEditsDecisionBody, { action: "reject", reason: "no", expected_pending_edits })).toEqual({ action: "reject", reason: "no", expected_pending_edits });
    expect(await refused(EventEditsDecisionBody, { action: "approve" })).toEqual({ error: "The reviewed pending edits are required. Refresh and try again." });
  });
});

// ─── admin/events POST and PUT ──────────────────────────────────────────────

describe("AdminEventCreateBody (admin/events POST)", () => {
  const REQUIRED = "title, start_date, and end_date are required";

  it.each([
    [{ start_date: "2030-01-01", end_date: "2030-01-02" }, REQUIRED],
    [{ title: "T", end_date: "2030-01-02" }, REQUIRED],
    [{ title: "T", start_date: "2030-01-01" }, REQUIRED],
    [{ title: "<b></b>", start_date: "2030-01-01", end_date: "2030-01-02" }, REQUIRED],
    // F-094: sanitizeText coerced a number to "5"
    [{ title: 5, start_date: "2030-01-01", end_date: "2030-01-02" }, REQUIRED],
    [{ title: { a: 1 }, start_date: "2030-01-01", end_date: "2030-01-02" }, REQUIRED],
    // F-094 (new texts): optional text that was sanitized
    [{ title: "T", start_date: "2030-01-01", end_date: "2030-01-02", description: 5 }, "description must be a string"],
    [{ title: "T", start_date: "2030-01-01", end_date: "2030-01-02", location: [] }, "location must be a string"],
    // order: the required rule beats a bad description
    [{ description: 5 }, REQUIRED],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(AdminEventCreateBody, input)).toEqual({ error });
  });

  it("sanitizes title, description and location as the handler did", async () => {
    expect(
      await accepted(AdminEventCreateBody, {
        title: " <i>Gala</i> ",
        start_date: "2030-01-01",
        end_date: "2030-01-02",
        description: null,
        tags: ["social"],
        organizer: "SSMU",
      })
    ).toEqual({
      title: "Gala",
      start_date: "2030-01-01",
      end_date: "2030-01-02",
      description: "",
      location: "",
      tags: ["social"],
      organizer: "SSMU",
    });
  });
});

describe("AdminEventPutBody (admin/events/[id] PUT)", () => {
  it.each([
    // F-094: was 200, the number written as the title
    [{ title: 5 }, "title must be a string"],
    [{ title: null }, "title must be a string"],
    [{ description: 5 }, "description must be a string or null"],
    [{ start_date: 5 }, "start_date must be a string"],
    [{ end_date: null }, "end_date must be a string"],
    [{ location: 1 }, "location must be a string or null"],
    [{ organizer: {} }, "organizer must be a string or null"],
    [{ tags: "a" }, "tags must be an array of strings or null"],
    [{ tags: [1] }, "tags must be an array of strings or null"],
    [{ image_url: 1 }, "image_url must be a string or null"],
    [{ category: true }, "category must be a string or null"],
    [{ status: 5 }, "status must be a string"],
    // order: the allowed fields in the handler's order
    [{ status: 5, title: 5 }, "title must be a string"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(AdminEventPutBody, input)).toEqual({ error });
  });

  it("keeps only the ten allowed fields, as sent, and every key sent for the audit row", async () => {
    expect(
      await accepted(AdminEventPutBody, {
        title: "New",
        description: null,
        tags: ["a"],
        created_by: "x",
        pending_edits: { title: "evil" },
      })
    ).toEqual({
      sent: ["title", "description", "tags", "created_by", "pending_edits"],
      updates: { title: "New", description: null, tags: ["a"] },
    });
    expect(await accepted(AdminEventPutBody, {})).toEqual({ sent: [], updates: {} });
  });

  it("AdminEventUpdateBody alone is the ten fields, all optional", async () => {
    expect(await accepted(AdminEventUpdateBody, { image_url: null, status: "approved" })).toEqual({
      image_url: null,
      status: "approved",
    });
  });
});

// ─── admin/experiments POST and PATCH ───────────────────────────────────────

describe("ExperimentCreateBody (admin/experiments POST)", () => {
  it.each([
    [{ variants: [{}, {}] }, "name is required"],
    [{ name: "x", variants: [{}] }, "At least 2 variants are required"],
    [{ name: "x", variants: "ab" }, "At least 2 variants are required"],
    [{}, "name is required"],
    // F-094: was 201 with the number written as the name
    [{ name: 5, variants: [{ name: "a" }, { name: "b" }] }, "name is required"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(ExperimentCreateBody, input)).toEqual({ error });
  });

  it("passes the optional fields and the variants through as sent", async () => {
    const variants = [{ name: "a", weight: 2 }, { name: "b", config: { k: 1 } }];
    expect(
      await accepted(ExperimentCreateBody, { name: "exp", variants, target_metric: "ctr" })
    ).toEqual({ name: "exp", variants, target_metric: "ctr" });
  });
});

describe("ExperimentUpdateBody (admin/experiments/[id] PATCH)", () => {
  it.each([
    // F-094 (new texts): was 200, the number written as the status
    [{ status: 5 }, "Invalid status"],
    [{ status: "archived" }, "Invalid status"],
    [{ description: 5 }, "description must be a string or null"],
    [{ end_date: 5 }, "end_date must be a string or null"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(ExperimentUpdateBody, input)).toEqual({ error });
  });

  it("keeps status, description and end_date only when sent; {} stays valid", async () => {
    expect(await accepted(ExperimentUpdateBody, {})).toEqual({});
    expect(
      await accepted(ExperimentUpdateBody, { status: "running", description: null, name: "x" })
    ).toEqual({ status: "running", description: null });
  });
});

// ─── admin/featured POST and PATCH ──────────────────────────────────────────

describe("FeaturedCreateBody (admin/featured POST)", () => {
  const REQUIRED = "event_id, starts_at, and ends_at are required";

  it.each([
    [{ starts_at: "2030-01-01", ends_at: "2030-01-02" }, REQUIRED],
    [{ event_id: "e", starts_at: "2030-01-01" }, REQUIRED],
    // F-094 (new text): was 201 with the number coerced to "5"
    [{ event_id: "e", starts_at: "2030-01-01", ends_at: "2030-01-02", sponsor_name: 5 }, "sponsor_name must be a string"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(FeaturedCreateBody, input)).toEqual({ error });
  });

  it("sanitizes a sponsor name and stores a falsy one as null", async () => {
    expect(
      await accepted(FeaturedCreateBody, {
        event_id: "e",
        starts_at: "s",
        ends_at: "t",
        sponsor_name: "<b>Acme</b>",
        priority: 2,
      })
    ).toMatchObject({ sponsor_name: "Acme", priority: 2 });
    expect(
      await accepted(FeaturedCreateBody, { event_id: "e", starts_at: "s", ends_at: "t", sponsor_name: "" })
    ).toMatchObject({ sponsor_name: null });
    expect(
      await accepted(FeaturedCreateBody, { event_id: "e", starts_at: "s", ends_at: "t" })
    ).toEqual({ event_id: "e", starts_at: "s", ends_at: "t", sponsor_name: null });
  });
});

describe("FeaturedUpdateBody (admin/featured/[id] PATCH)", () => {
  it.each([
    [{ event_id: "e" }, "No fields to update"],
    [{}, "No fields to update"],
    [{ sponsor_name: 5 }, "sponsor_name must be a string"],
    [{ priority: "5" }, "priority must be an integer"],
    [{ priority: 1.5 }, "priority must be an integer"],
    [{ starts_at: null }, "starts_at must be a string"],
    [{ ends_at: 5 }, "ends_at must be a string"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(FeaturedUpdateBody, input)).toEqual({ error });
  });

  it("keeps each sent field; a falsy sponsor name clears to null", async () => {
    expect(
      await accepted(FeaturedUpdateBody, { sponsor_name: " <i>Acme</i> ", priority: 3 })
    ).toEqual({ sponsor_name: "Acme", priority: 3 });
    expect(await accepted(FeaturedUpdateBody, { sponsor_name: null })).toEqual({
      sponsor_name: null,
    });
  });
});

// ─── organizer requests, reports, ban, users ────────────────────────────────

describe("decision bodies (organizer requests, reports)", () => {
  it.each([
    [OrganizerRequestDecisionBody, { status: "pending" }, "Status must be 'approved' or 'rejected'"],
    [OrganizerRequestDecisionBody, { status: 5 }, "Status must be 'approved' or 'rejected'"],
    [OrganizerRequestDecisionBody, {}, "Status must be 'approved' or 'rejected'"],
    [ReportDecisionBody, { status: "open" }, "Invalid status"],
    [ReportDecisionBody, { status: 5 }, "Invalid status"],
  ] as const)("%#: %j -> %s", async (schema, input, error) => {
    expect(await refused(schema, input)).toEqual({ error });
  });

  it("accepts the statuses the handlers accepted", async () => {
    expect(await accepted(OrganizerRequestDecisionBody, { status: "approved" })).toEqual({
      status: "approved",
    });
    expect(await accepted(ReportDecisionBody, { status: "dismissed" })).toEqual({
      status: "dismissed",
    });
  });
});

describe("BanBody (admin/users/[id]/ban POST)", () => {
  const POSITIVE = "duration_days must be a positive integer";

  it.each([
    [{}, "Reason is required"],
    [{ reason: "  " }, "Reason is required"],
    [{ reason: 5 }, "Reason is required"],
    [{ reason: "spam", duration_days: 0 }, POSITIVE],
    [{ reason: "spam", duration_days: 1.5 }, POSITIVE],
    [{ reason: "spam", duration_days: "7" }, POSITIVE],
    // order: the reason beats the duration
    [{ duration_days: -1 }, "Reason is required"],
  ])("%j -> %s", async (input, error) => {
    expect(await refused(BanBody, input)).toEqual({ error });
  });

  it("a null or absent duration is a permanent ban", async () => {
    expect(await accepted(BanBody, { reason: "spam", duration_days: null })).toEqual({
      reason: "spam",
      duration_days: null,
    });
    expect(
      await accepted(BanBody, { reason: "spam", duration_days: 7, suspend_content: true })
    ).toEqual({ reason: "spam", duration_days: 7, suspend_content: true });
  });
});

describe("AdminUserUpdateBody then AdminUserNameBody (admin/users/[id] PATCH)", () => {
  const NAME = "Name must be between 2 and 50 characters long";

  it.each([
    [{ roles: ["superuser"] }, { error: "Invalid role", field: "roles" }],
    [{ roles: "admin" }, { error: "Invalid role", field: "roles" }],
    [{ roles: null }, { error: "Invalid role", field: "roles" }],
  ])("roles: %j -> %j", async (input, body) => {
    expect(await refused(AdminUserUpdateBody, input, ["roles"])).toEqual(body);
  });

  it("the roles stage passes the name as sent (the self-check sits between them)", async () => {
    expect(await accepted(AdminUserUpdateBody, { name: "a", roles: ["user"] })).toEqual({
      name: "a",
      roles: ["user"],
    });
  });

  it.each([
    [{ name: "a" }],
    [{ name: 42 }],
    [{ name: null }],
    [{ name: "n".repeat(51) }],
  ])("name: %j", async (input) => {
    expect(await refused(AdminUserNameBody, input, ["name"])).toEqual({
      error: NAME,
      field: "name",
    });
  });

  it("the name is trimmed; an absent name stays absent", async () => {
    expect(await accepted(AdminUserNameBody, { name: "  Ada  " })).toEqual({ name: "Ada" });
    expect(await accepted(AdminUserNameBody, { roles: ["user"] })).toEqual({});
  });
});

// ─── The admin list queries (Task 2): today's defaults, no new 400 ─────────

/** readQuery over a query string, exactly as the route hands it over. */
function q<S extends z.ZodType>(schema: S, query: string): z.output<S> {
  return readQuery(new URLSearchParams(query), schema);
}

describe("AdminEventsQuery (admin/events GET)", () => {
  it("defaults as the handler did", () => {
    expect(q(AdminEventsQuery, "")).toEqual({
      status: null,
      search: null,
      sort: "created_at",
      direction: "desc",
      limit: 50,
      offset: 0,
      includeDeleted: false,
    });
  });

  it.each([
    // the 06-07 P2 row: limit=abc becomes a NaN range
    ["limit=abc", { limit: Number.NaN }],
    ["limit=500", { limit: 100 }],
    ["limit=5.9", { limit: 5 }],
    ["limit=", { limit: 50 }],
    ["offset=-3", { offset: -3 }],
    ["offset=x", { offset: Number.NaN }],
    ["sort=", { sort: "created_at" }],
    ["sort=trending_score&direction=asc", { sort: "trending_score", direction: "asc" }],
    ["includeDeleted=1", { includeDeleted: false }],
    ["includeDeleted=true", { includeDeleted: true }],
    ["status=all&search=", { status: "all", search: "" }],
    ["status=a&status=b", { status: "a" }],
  ])("%s", (query, expected) => {
    expect(q(AdminEventsQuery, query)).toMatchObject(expected);
  });
});

describe("the other admin list queries", () => {
  it("admin/clubs: status defaults to pending; an unknown status is passed on (06-07 P2)", () => {
    expect(q(AdminClubsQuery, "")).toEqual({ status: "pending" });
    expect(q(AdminClubsQuery, "status=")).toEqual({ status: "pending" });
    expect(q(AdminClubsQuery, "status=banana")).toEqual({ status: "banana" });
  });

  it("admin/organizer-requests: pending, 50, 0; offset=abc is NaN (06-07 P2)", () => {
    expect(q(OrganizerRequestsQuery, "")).toEqual({ status: "pending", limit: 50, offset: 0 });
    expect(q(OrganizerRequestsQuery, "offset=abc&limit=999")).toEqual({
      status: "pending",
      limit: 100,
      offset: Number.NaN,
    });
  });

  it("admin/reports: limit and offset fall back when negative or NaN (06-07 P2)", () => {
    expect(q(ReportsQuery, "")).toEqual({ status: null, event_id: null, limit: 50, offset: 0 });
    expect(q(ReportsQuery, "limit=-5&offset=-3")).toMatchObject({ limit: 50, offset: 0 });
    expect(q(ReportsQuery, "limit=abc&offset=x")).toMatchObject({ limit: 50, offset: 0 });
    expect(q(ReportsQuery, "limit=250&offset=7")).toMatchObject({ limit: 100, offset: 7 });
    // parseInt with no radix, as the handler called it
    expect(q(ReportsQuery, "limit=0x10")).toMatchObject({ limit: 16 });
    expect(q(ReportsQuery, "status=pending&event_id=e1")).toMatchObject({
      status: "pending",
      event_id: "e1",
    });
  });

  it("admin/audit-log: invalid pages default to 1 (M0 IN-07)", () => {
    expect(q(AuditLogQuery, "")).toEqual({ action: null, page: 1 });
    expect(q(AuditLogQuery, "page=0&action=banned")).toEqual({ action: "banned", page: 1 });
    expect(q(AuditLogQuery, "page=abc")).toEqual({ action: null, page: 1 });
    expect(q(AuditLogQuery, "page=0x2")).toEqual({ action: null, page: 1 });
  });

  it("admin/organizers: search defaults to '', status to all, an empty status stays empty", () => {
    expect(q(OrganizersQuery, "")).toEqual({ search: "", status: "all" });
    expect(q(OrganizersQuery, "status=&search=%20a")).toEqual({ search: " a", status: "" });
    expect(q(OrganizersQuery, "status=banana")).toEqual({ search: "", status: "banana" });
  });

  it("admin/calculate-popularity: event_id as sent, or null", () => {
    expect(q(CalculatePopularityQuery, "")).toEqual({ event_id: null });
    expect(q(CalculatePopularityQuery, "event_id=")).toEqual({ event_id: "" });
    expect(q(CalculatePopularityQuery, "event_id=abc")).toEqual({ event_id: "abc" });
  });
});

describe("ReviewTargetParams (moderation/reviews/[targetType]/[targetId] GET)", () => {
  it.each(["user", "", "Event", "events"])("targetType %j -> Invalid target type", async (targetType) => {
    expect(
      await refused(ReviewTargetParams, { targetType, targetId: "5eed0000-0000-4000-8000-0a70000000e1" })
    ).toEqual({ error: "Invalid target type" });
  });

  it("keeps the target id as sent (no new 400 for a malformed id)", async () => {
    expect(await accepted(ReviewTargetParams, { targetType: "club", targetId: "not-a-uuid" })).toEqual({
      targetType: "club",
      targetId: "not-a-uuid",
    });
  });
});

// ─── The self-checks compare canonical ids (DI-64, DEC-66, T-06-10-01) ─────

describe("an admin's own id in upper case is refused like the canonical form", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockCookie = createFakeSupabase(PERSONAS.admin());
    mockElevated = createFakeSupabase(elevatedInit("admin"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const OWN_UPPER = CALLER.id.toUpperCase();

  function writes(): string[] {
    return [...mockCookie.calls, ...mockElevated.calls]
      .filter((call) => call.operation !== "select")
      .map((call) => `${call.table}.${call.operation}`);
  }

  it("the fixture id really differs only by case", () => {
    expect(OWN_UPPER).not.toBe(CALLER.id);
    expect(OWN_UPPER.toLowerCase()).toBe(CALLER.id);
  });

  it("ban POST: 400 Cannot ban your own account, nothing written", async () => {
    const outcome = await run({
      route: "admin/users/[id]/ban",
      verb: "POST",
      params: { id: OWN_UPPER },
      body: { reason: "spam" },
    });
    expect(outcome).toEqual({
      status: 400,
      body: { error: "Cannot ban your own account" },
    });
    expect(writes()).toEqual([]);
  });

  it("role change PATCH: 403 You cannot change your own roles, nothing written", async () => {
    const outcome = await run({
      route: "admin/users/[id]",
      verb: "PATCH",
      params: { id: OWN_UPPER },
      body: { roles: ["user"] },
    });
    expect(outcome).toEqual({
      status: 403,
      body: { error: "You cannot change your own roles" },
    });
    expect(writes()).toEqual([]);
  });
});
