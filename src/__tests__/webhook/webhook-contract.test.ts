/**
 * The events-webhook payload contract (plan 06-03 Task 2, DEC-64).
 *
 * WebhookEvent and WebhookPayload live in
 * supabase/functions/_shared/webhook-contract.ts so Deno and Jest share one
 * schema; src/contracts/webhook.ts re-exports them for the app. Every message
 * below is today's string from supabase/functions/events-webhook/index.ts
 * (validateEvent :58-95, the payload checks :260-287), pinned here as literals
 * so a change to the schema's text fails this suite.
 *
 * validateEvent's semantics are reproduced exactly, including its truthiness:
 * a falsy category or time (null, "", 0) passes, an empty date string is
 * "required" (not "invalid"), and a whitespace-only title fails. Messages come
 * out in validateEvent's check order whatever order the input's keys arrive in.
 */
import type { z } from "zod";

import {
  WebhookEvent,
  WebhookPayload,
  webhookEventErrors,
  webhookPayloadError,
} from "@/contracts/webhook";
import type { ExtractedEvent } from "@/lib/classifier";

const TITLE = "title is required and must be a non-empty string";
const DESCRIPTION = "description is required and must be a non-empty string";
const CATEGORY = "category must be a string if provided";
const DATE_REQUIRED = "date is required and must be a string";
const DATE_INVALID = "date must be a valid date string";
const LOCATION = "location is required and must be a non-empty string";
const TIME = "time must be a string if provided";
const STRUCTURE =
  "Invalid payload structure. Expected event_count (number) and events (array)";

const VALID = {
  title: "Robotics Night",
  description: "Build a robot",
  category: "workshop",
  date: "2030-03-14",
  time: "18:30",
  duration: 90,
  location: "Trottier 1100",
  organizer: "McGill Robotics",
  image_url: "https://example.com/a.png",
  source_url: "https://instagram.com/p/abc",
  tags: ["Tech"],
};

// ─── Type level: ExtractedEvent must stay assignable to the contract's input ───
// A compile-time drift guard: if ExtractedEvent (src/lib/classifier.ts) and the
// webhook contract diverge, `npx tsc --noEmit` fails on this line.
type Assignable<T, U> = [T] extends [U] ? true : false;
const extractedEventFitsContract: Assignable<
  ExtractedEvent,
  z.input<typeof WebhookEvent>
> = true;

describe("type-level drift guard", () => {
  it("ExtractedEvent is assignable to z.input<typeof WebhookEvent>", () => {
    expect(extractedEventFitsContract).toBe(true);
  });
});

describe("WebhookEvent: a valid event", () => {
  it("parses, and webhookEventErrors returns no messages", () => {
    expect(WebhookEvent.safeParse(VALID).success).toBe(true);
    expect(webhookEventErrors(VALID)).toEqual([]);
  });

  it("accepts the minimal required fields", () => {
    const minimal = { title: "T", description: "D", date: "2030-01-01", location: "L" };
    expect(webhookEventErrors(minimal)).toEqual([]);
  });

  it.each([
    ["category null", { category: null }],
    ["category empty string", { category: "" }],
    ["category 0", { category: 0 }],
    ["time null", { time: null }],
    ["time empty string", { time: "" }],
    ["time false", { time: false }],
  ])("a falsy optional (%s) passes, as validateEvent's truthiness check does", (_l, patch) => {
    expect(webhookEventErrors({ ...VALID, ...patch })).toEqual([]);
  });

  it("keeps legacy duration/organizer behavior and ignores non-array tags", () => {
    expect(
      webhookEventErrors({ ...VALID, duration: "90", organizer: 5, tags: "x" })
    ).toEqual([]);
  });

  it.each([{ tags: [] }, { tags: ["Tech", "FOOD"] }, { tags: null }, { tags: "legacy ignored value" }])("DI-83: keeps accepted tag values %j", ({ tags }) => {
    expect(webhookEventErrors({ ...VALID, tags })).toEqual([]);
  });

  it.each([[1], [null], [true], [{}], [["nested"]]])("DI-83: rejects non-string tag elements %j", (tag) => {
    expect(webhookEventErrors({ ...VALID, tags: [tag] })).toEqual(["tags must contain only strings"]);
  });
});

describe("WebhookEvent: each invalid input yields today's message and only it", () => {
  const rows: Array<[string, Record<string, unknown>, string[]]> = [
    ["title missing", { title: undefined }, [TITLE]],
    ["title empty", { title: "" }, [TITLE]],
    ["title whitespace", { title: "   " }, [TITLE]],
    ["title a number", { title: 42 }, [TITLE]],
    ["description missing", { description: undefined }, [DESCRIPTION]],
    ["description whitespace", { description: " \n " }, [DESCRIPTION]],
    ["description an object", { description: { a: 1 } }, [DESCRIPTION]],
    ["category a number", { category: 7 }, [CATEGORY]],
    ["category true", { category: true }, [CATEGORY]],
    ["category an array", { category: ["a"] }, [CATEGORY]],
    ["date missing", { date: undefined }, [DATE_REQUIRED]],
    ["date empty string (required, not invalid)", { date: "" }, [DATE_REQUIRED]],
    ["date a number", { date: 20300101 }, [DATE_REQUIRED]],
    ["date unparseable", { date: "next tuesday-ish" }, [DATE_INVALID]],
    ["location missing", { location: undefined }, [LOCATION]],
    ["location whitespace", { location: "  " }, [LOCATION]],
    ["time a number", { time: 1830 }, [TIME]],
    ["time an object", { time: { h: 18 } }, [TIME]],
  ];

  it.each(rows)("%s", (_label, patch, expected) => {
    const input: Record<string, unknown> = { ...VALID, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete input[k];
    expect(webhookEventErrors(input)).toEqual(expected);
    expect(WebhookEvent.safeParse(input).success).toBe(false);
  });
});

describe("WebhookEvent: the full list, in validateEvent's order", () => {
  it("every rule failing yields all six messages in check order", () => {
    expect(
      webhookEventErrors({
        title: "",
        description: 1,
        category: 2,
        date: "",
        location: null,
        time: 3,
      })
    ).toEqual([TITLE, DESCRIPTION, CATEGORY, DATE_REQUIRED, LOCATION, TIME]);
  });

  it("the order is validateEvent's, not the input's key order", () => {
    const reversed = { time: 3, location: "", date: "nope", category: 9, description: "", title: "" };
    expect(webhookEventErrors(reversed)).toEqual([
      TITLE,
      DESCRIPTION,
      CATEGORY,
      DATE_INVALID,
      LOCATION,
      TIME,
    ]);
  });

  it("an empty object yields the four required-field messages", () => {
    expect(webhookEventErrors({})).toEqual([TITLE, DESCRIPTION, DATE_REQUIRED, LOCATION]);
  });

  it.each([
    ["a number", 5],
    ["a string", "event"],
    ["an array", []],
    ["null (DI-83)", null],
    ["undefined (DI-83)", undefined],
  ])(
    "a non-object element (%s) reads as having no fields, as validateEvent's property reads do",
    (_l, input) => {
      expect(webhookEventErrors(input)).toEqual([TITLE, DESCRIPTION, DATE_REQUIRED, LOCATION]);
    }
  );
});

describe("WebhookPayload", () => {
  const events = [VALID, VALID];

  it("a consistent payload parses", () => {
    expect(WebhookPayload.safeParse({ event_count: 2, events }).success).toBe(true);
    expect(webhookPayloadError({ event_count: 2, events })).toBeNull();
    expect(webhookPayloadError({ event_count: 0, events: [] })).toBeNull();
  });

  it("event_count different from events.length yields today's mismatch message", () => {
    expect(webhookPayloadError({ event_count: 3, events })).toBe(
      "event_count (3) does not match events array length (2)"
    );
    expect(WebhookPayload.safeParse({ event_count: 3, events }).success).toBe(false);
  });

  it.each([
    ["events not an array", { event_count: 1, events: { 0: VALID } }],
    ["events missing", { event_count: 0 }],
    ["event_count a string", { event_count: "2", events }],
    ["event_count missing", { events }],
    ["both wrong", { event_count: "x", events: "y" }],
    ["the payload a string", "payload"],
    ["the payload a number", 7],
    ["the payload an array", [VALID]],
    ["the payload null (DI-83)", null],
  ])("%s yields today's structure message, once", (_l, input) => {
    expect(webhookPayloadError(input)).toBe(STRUCTURE);
  });

  it("the payload's events are not validated here (validateEvent runs per event after)", () => {
    expect(webhookPayloadError({ event_count: 1, events: [{}] })).toBeNull();
  });
});
