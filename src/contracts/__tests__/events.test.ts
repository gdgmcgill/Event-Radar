/**
 * The events-family contracts, input by input (plan 06-08, REFAC-15, DEC-65).
 *
 * Every expected 400 body below is COPIED from the 06-07 table
 * (src/__tests__/contracts/badRequestTable.ts) or the events PRESERVE suites
 * that pin the handlers, not re-derived: a contract is correct only if it
 * answers the same first 400 the handler's own ladder answered, in the same
 * order. `field` is asserted through the same `fieldFor` keys the routes pass.
 * Valid inputs are asserted to parse to the values the handler used before
 * (sanitized where it sanitized, as sent where it read the value as sent).
 *
 * The rows marked F-094 are the deliberate changes: a wrongly typed field now
 * answers the contract's 400 where the handler threw, coerced or wrote it.
 */

import { z } from "zod";
import { parseForm, parseWith } from "@/server/body";
import {
  CREATE_EVENT_FIELD_KEYS,
  CreateEventBody,
  EVENT_IMAGE_UPLOAD,
  EVENT_UPDATE_FIELD_KEYS,
  EventAppealBody,
  EventInviteBody,
  EventReportBody,
  EventUpdateBody,
  ReviewBody,
  RsvpBody,
  RsvpDeleteBody,
  RsvpStatus,
  UploadImageForm,
} from "@/contracts/events";

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

async function accepted(schema: z.ZodType, input: unknown) {
  const outcome = await firstError(schema, input);
  if (!outcome.ok) throw new Error(`unexpected 400 ${JSON.stringify(outcome.body)}`);
  return outcome.data;
}

const START_FORMAT =
  'start_date must be a valid ISO 8601 date (e.g. "2026-03-15" or "2026-03-15T09:00:00Z")';
const END_FORMAT =
  'end_date must be a valid ISO 8601 date (e.g. "2026-03-15" or "2026-03-15T11:00:00Z")';

// ─── events/create POST ──────────────────────────────────────────────────────

const CREATE = {
  title: "Contract Night",
  description: "An evening of contracts",
  start_date: "2030-06-01T18:00:00Z",
  location: "Leacock 132",
  tags: ["academic"],
};

describe("CreateEventBody (events/create POST)", () => {
  const F = CREATE_EVENT_FIELD_KEYS;

  it("names start_date and end_date, and only those, in fieldFor", () => {
    expect([...F]).toEqual(["start_date", "end_date"]);
  });

  it.each<[string, Record<string, unknown>, Record<string, string>]>([
    ["title missing", { ...CREATE, title: "" }, { error: "Title is required" }],
    ["title only markup", { ...CREATE, title: "<b></b>" }, { error: "Title is required" }],
    ["description missing", { ...CREATE, description: undefined }, { error: "Description is required" }],
    ["start_date missing", { ...CREATE, start_date: undefined }, { error: "Start date is required", field: "start_date" }],
    ["location missing", { ...CREATE, location: "  " }, { error: "Location is required" }],
    ["tags missing", { ...CREATE, tags: undefined }, { error: "At least one tag is required" }],
    ["tags not an array", { ...CREATE, tags: "academic" }, { error: "At least one tag is required" }],
    ["tags empty", { ...CREATE, tags: [] }, { error: "At least one tag is required" }],
    ["price over 20 chars", { ...CREATE, price: "x".repeat(21) }, { error: "Price must be 20 characters or less" }],
    ["rsvp_link over 500 chars", { ...CREATE, rsvp_link: `https://a.ca/${"x".repeat(500)}` }, { error: "Registration link is too long" }],
    ["rsvp_link not http(s)", { ...CREATE, rsvp_link: "ftp://a.ca/x" }, { error: "Registration link must use http or https" }],
    ["rsvp_link not a URL", { ...CREATE, rsvp_link: "not a url" }, { error: "Registration link must be a valid URL" }],
    ["start_date not ISO", { ...CREATE, start_date: "June 1st" }, { error: START_FORMAT, field: "start_date" }],
    ["start_date in the past", { ...CREATE, start_date: "2020-01-01" }, { error: "start_date must be a date in the future", field: "start_date" }],
    ["end_date not ISO", { ...CREATE, end_date: "later" }, { error: END_FORMAT, field: "end_date" }],
    ["end_date before start", { ...CREATE, end_date: "2030-06-01T17:00:00Z" }, { error: "end_date must be after start_date", field: "end_date" }],
    ["order: empty body → title first", {}, { error: "Title is required" }],
    ["order: bad price and bad dates → price first", { ...CREATE, price: "x".repeat(21), start_date: "June 1st" }, { error: "Price must be 20 characters or less" }],
    ["order: missing description beats missing start_date", { ...CREATE, description: "", start_date: "" }, { error: "Description is required" }],
    ["a truthy non-string start_date reaches the date rule", { ...CREATE, start_date: 5 }, { error: START_FORMAT, field: "start_date" }],
    // F-094: a non-string text field answers its required text (it was
    // coerced to "5" by sanitizeText, or threw inside it for an object).
    ["F-094: numeric title", { ...CREATE, title: 5 }, { error: "Title is required" }],
    ["F-094: object title", { ...CREATE, title: { a: 1 } }, { error: "Title is required" }],
    ["F-094: numeric description", { ...CREATE, description: 5 }, { error: "Description is required" }],
    ["F-094: array location", { ...CREATE, location: ["x"] }, { error: "Location is required" }],
  ])("%s", async (_label, input, expected) => {
    await expect(refused(CreateEventBody, input, F)).resolves.toEqual(expected);
  });

  it("parses a valid body to the sanitized text and the values as sent", async () => {
    const data = await accepted(CreateEventBody, {
      ...CREATE,
      title: "  <b>Contract</b> Night ",
      description: "An <i>evening</i>",
      location: " Leacock 132 ",
      end_date: "2030-06-01T20:00:00Z",
      image_url: "https://img.example/x.png",
      category: "academic",
      is_free: false,
      price: "$5",
      rsvp_link: "https://example.com/rsvp",
      club_id: "c1",
      ignored: true,
    });
    expect(data).toEqual({
      title: "Contract Night",
      description: "An evening",
      start_date: "2030-06-01T18:00:00Z",
      location: "Leacock 132",
      tags: ["academic"],
      end_date: "2030-06-01T20:00:00Z",
      image_url: "https://img.example/x.png",
      category: "academic",
      is_free: false,
      price: "$5",
      rsvp_link: "https://example.com/rsvp",
      club_id: "c1",
    });
  });

  it("leaves price and rsvp_link unchecked when they are not strings, as the handler did", async () => {
    const data = await accepted(CreateEventBody, { ...CREATE, price: 7, rsvp_link: null });
    expect(data).toMatchObject({ price: 7, rsvp_link: null });
  });

  it("keeps absent optional keys absent", async () => {
    const data = (await accepted(CreateEventBody, CREATE)) as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(
      ["description", "location", "start_date", "tags", "title"].sort()
    );
  });
});

// ─── events/[id] PATCH ───────────────────────────────────────────────────────

describe("EventUpdateBody (events/[id] PATCH)", () => {
  const F = EVENT_UPDATE_FIELD_KEYS;

  it("names start_date and end_date, and only those, in fieldFor", () => {
    expect([...F]).toEqual(["start_date", "end_date"]);
  });

  it.each<[string, Record<string, unknown>, Record<string, string>]>([
    ["no editable field", { status: "approved" }, { error: "No valid fields to update" }],
    ["start_date not ISO", { start_date: "soon" }, { error: START_FORMAT, field: "start_date" }],
    ["start_date in the past", { start_date: "2020-01-01" }, { error: "start_date must be a date in the future", field: "start_date" }],
    ["end_date before start", { start_date: "2030-06-01T18:00:00Z", end_date: "2030-06-01T17:00:00Z" }, { error: "end_date must be after start_date", field: "end_date" }],
    // The end_date-only branch emits field too (06-07 correction).
    ["end_date alone not ISO", { end_date: "later" }, { error: END_FORMAT, field: "end_date" }],
    ["end_date alone null", { end_date: null }, { error: END_FORMAT, field: "end_date" }],
    ["order: no field beats a bad date", {}, { error: "No valid fields to update" }],
    // F-094: a non-string text field is refused (a new text; none existed).
    ["F-094: numeric title", { title: 5 }, { error: "Title must be a string" }],
    ["F-094: null title", { title: null }, { error: "Title must be a string" }],
    ["F-094: numeric description", { description: 5 }, { error: "Description must be a string" }],
    ["F-094: object location", { location: { a: 1 } }, { error: "Location must be a string" }],
  ])("%s", async (_label, input, expected) => {
    await expect(refused(EventUpdateBody, input, F)).resolves.toEqual(expected);
  });

  it("keeps only the editable keys, as sent, and only the keys present", async () => {
    const data = await accepted(EventUpdateBody, {
      title: "New",
      description: null,
      image_url: null,
      tags: ["social"],
      status: "approved",
      pending_edits: { x: 1 },
    });
    expect(data).toEqual({ title: "New", description: null, image_url: null, tags: ["social"] });
  });

  it("accepts an end_date with no start_date when it is ISO", async () => {
    await expect(accepted(EventUpdateBody, { end_date: "2030-06-01" })).resolves.toEqual({
      end_date: "2030-06-01",
    });
  });

  it("validates end_date against start_date only when both are sent", async () => {
    await expect(
      accepted(EventUpdateBody, { start_date: "2030-06-01T18:00:00Z", end_date: "" })
    ).resolves.toEqual({ start_date: "2030-06-01T18:00:00Z", end_date: "" });
  });
});

// ─── events/[id]/rsvp POST and DELETE ───────────────────────────────────────

describe("RsvpBody, RsvpStatus, RsvpDeleteBody (events/[id]/rsvp)", () => {
  const CALLER = "5eed0000-0000-4000-8000-000000000a71";

  it.each<[string, Record<string, unknown>, string]>([
    ["user_id missing", { status: "going" }, "user_id is required"],
    ["user_id empty", { user_id: "", status: "going" }, "user_id is required"],
    ["order: empty body → user_id first", {}, "user_id is required"],
  ])("POST %s", async (_label, input, error) => {
    await expect(refused(RsvpBody, input)).resolves.toEqual({ error });
  });

  it("POST carries user_id and status as sent, for the handler's 403 and then RsvpStatus", async () => {
    await expect(accepted(RsvpBody, { user_id: CALLER, status: "maybe" })).resolves.toEqual({
      user_id: CALLER,
      status: "maybe",
    });
    // A truthy non-string user_id still reaches the handler's mismatch 403.
    await expect(accepted(RsvpBody, { user_id: 5 })).resolves.toEqual({ user_id: 5 });
  });

  it.each<[string, unknown, string]>([
    ["status missing", undefined, "status is required"],
    ["status empty", "", "status is required"],
    ["status not a member", "maybe", "Invalid status. Must be one of: going, interested"],
    ["status a number", 5, "Invalid status. Must be one of: going, interested"],
  ])("RsvpStatus: %s", async (_label, input, error) => {
    await expect(refused(RsvpStatus, input)).resolves.toEqual({ error });
  });

  it("RsvpStatus parses going and interested", async () => {
    await expect(accepted(RsvpStatus, "going")).resolves.toBe("going");
    await expect(accepted(RsvpStatus, "interested")).resolves.toBe("interested");
  });

  it("DELETE: user_id missing", async () => {
    await expect(refused(RsvpDeleteBody, {})).resolves.toEqual({ error: "user_id is required" });
  });

  it("DELETE keeps a truthy user_id as sent", async () => {
    await expect(accepted(RsvpDeleteBody, { user_id: CALLER })).resolves.toEqual({ user_id: CALLER });
  });
});

// ─── events/[id]/reviews, invite, report, appeal ────────────────────────────

describe("ReviewBody (events/[id]/reviews POST)", () => {
  const RATING = { error: "Rating must be an integer between 1 and 5" };

  it.each<[string, Record<string, unknown>]>([
    ["rating missing", { comment: "ok" }],
    ["rating 6", { rating: 6 }],
    ["rating 2.5", { rating: 2.5 }],
    ["rating 0", { rating: 0 }],
    ["rating a numeric string", { rating: "5" }],
  ])("%s", async (_label, input) => {
    await expect(refused(ReviewBody, input)).resolves.toEqual(RATING);
  });

  it("parses rating and the comment as sent", async () => {
    await expect(accepted(ReviewBody, { rating: 4, comment: "good" })).resolves.toEqual({
      rating: 4,
      comment: "good",
    });
  });
});

describe("EventInviteBody (events/[id]/invite POST)", () => {
  it.each<[string, Record<string, unknown>]>([
    ["invitee_ids missing", {}],
    ["invitee_ids empty", { invitee_ids: [] }],
    ["invitee_ids a number", { invitee_ids: 5 }],
  ])("%s", async (_label, input) => {
    await expect(refused(EventInviteBody, input)).resolves.toEqual({ error: "No invitees provided" });
  });

  it("parses the ids as sent", async () => {
    await expect(accepted(EventInviteBody, { invitee_ids: ["a", "b"] })).resolves.toEqual({
      invitee_ids: ["a", "b"],
    });
  });
});

describe("EventReportBody (events/[id]/report POST)", () => {
  it.each<[string, Record<string, unknown>, string]>([
    ["category missing", { message: "spam" }, "Invalid category"],
    ["category unknown", { category: "rude" }, "Invalid category"],
    ["category a number", { category: 5 }, "Invalid category"],
    ["category an inherited key", { category: "toString" }, "Invalid category"],
    // F-094: a non-string message threw inside sanitizeText (an HTML 500).
    ["F-094: object message", { category: "other", message: { a: 1 } }, "Message must be a string"],
  ])("%s", async (_label, input, error) => {
    await expect(refused(EventReportBody, input)).resolves.toEqual({ error });
  });

  it("parses the category and the message as sent", async () => {
    await expect(accepted(EventReportBody, { category: "duplicate", message: "same as x" })).resolves.toEqual({
      category: "duplicate",
      message: "same as x",
    });
    await expect(accepted(EventReportBody, { category: "other", message: null })).resolves.toEqual({
      category: "other",
      message: null,
    });
  });
});

describe("EventAppealBody (events/[id]/appeal POST)", () => {
  it.each<[string, Record<string, unknown>]>([
    ["message missing", {}],
    ["message blank", { message: "   " }],
    // F-094: a numeric message threw on .trim() (an HTML 500).
    ["F-094: message a number", { message: 5 }],
  ])("%s", async (_label, input) => {
    await expect(refused(EventAppealBody, input)).resolves.toEqual({
      error: "Appeal message is required",
    });
  });

  it("parses the message as sent (the handler trims it)", async () => {
    await expect(accepted(EventAppealBody, { message: " please " })).resolves.toEqual({
      message: " please ",
    });
  });
});

// ─── events/upload-image POST (multipart) ───────────────────────────────────

describe("UploadImageForm + EVENT_IMAGE_UPLOAD (events/upload-image POST)", () => {
  const MB = 1024 * 1024;

  function upload(entries: [string, string | File][]): Request {
    const form = new FormData();
    for (const [key, value] of entries) form.append(key, value);
    return new Request("http://localhost/api/events/upload-image", {
      method: "POST",
      body: form,
    });
  }

  const blob = (size: number, type: string, name = "x.png") =>
    new File([new Uint8Array(size)], name, { type });

  async function answer(request: Request) {
    const result = await parseForm(request, UploadImageForm, EVENT_IMAGE_UPLOAD);
    if (result.ok) return { ok: true as const, file: result.data.file };
    return { status: result.response.status, body: await result.response.json() };
  }

  it.each<[string, [string, string | File][], Record<string, string>]>([
    ["no file", [], { error: "No file provided" }],
    ["too large", [["file", blob(5 * MB + 1, "image/png")]], { error: "File too large. Maximum size is 5MB" }],
    ["wrong type", [["file", blob(4, "text/plain", "x.txt")]], { error: 'Invalid file type "text/plain". Allowed: JPEG, PNG, WebP, GIF.' }],
    ["order: too large and wrong type → size first", [["file", blob(5 * MB + 1, "text/plain", "x.txt")]], { error: "File too large. Maximum size is 5MB" }],
  ])("%s", async (_label, entries, expected) => {
    await expect(answer(upload(entries))).resolves.toEqual({ status: 400, body: expected });
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])("accepts %s up to 5MB", async (type) => {
    const outcome = await answer(upload([["file", blob(5 * MB, type)]]));
    expect(outcome).toMatchObject({ ok: true });
  });

  it("answers today's 500 when the body is not multipart", async () => {
    const request = new Request("http://localhost/api/events/upload-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    await expect(answer(request)).resolves.toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });
  });
});
