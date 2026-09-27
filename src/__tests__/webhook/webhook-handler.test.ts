/**
 * handleWebhook — the events-webhook request logic without Deno globals
 * (plan 06-03 Task 3, F-039, DEC-64, threats T-06-03-02 and T-06-03-03).
 *
 * PRESERVE: rows 1-17 below, with the two F-039 changes applied, are the
 * behaviour every later refactor of the webhook must keep.
 *
 * The table is slice-6-characterization.txt § 3, rows 1-17: every response
 * the deployed function gives today, read from source because Deno is not
 * installed locally. Each row is reproduced byte for byte EXCEPT the two rows
 * DEC-64 changes on purpose (INTENTIONAL BEHAVIOUR CHANGE):
 *
 *   row 5   a wrong-length signature: 500 Internal server error -> 401 Invalid signature
 *   row 16  a replayed, validly signed payload: inserted again -> each event `duplicate`
 *
 * The insert is injected. The fake stores rows in a Map keyed by content_hash
 * and answers { code: "23505" } on a repeated key, which is what the unique
 * partial index idx_events_content_hash
 * (supabase/migrations/20260915214553_baseline.sql:1480) does once the column
 * is populated. Payloads are signed with this file's own HMAC helper.
 */
import { createHmac } from "node:crypto";

import { computeEventContentHash } from "@/lib/contentHash";
import { handleWebhook } from "../../../supabase/functions/_shared/webhook-handler";

type Deps = Parameters<typeof handleWebhook>[1];
type InsertEvent = Deps["insertEvent"];
type Row = Parameters<InsertEvent>[0];

const SECRET = "test-webhook-secret";
const ENDPOINT = "http://localhost:54321/functions/v1/events-webhook";

const TITLE = "title is required and must be a non-empty string";
const DESCRIPTION = "description is required and must be a non-empty string";
const DATE_REQUIRED = "date is required and must be a string";
const LOCATION = "location is required and must be a non-empty string";

// ─── Harness ─────────────────────────────────────────────────────────────────

function hmacHex(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

/** A request whose body is signed correctly under `header`. */
function signed(payload: unknown, header = "x-signature"): Request {
  const body = JSON.stringify(payload);
  return post(body, { [header]: hmacHex(body) });
}

/** A raw body signed correctly with x-signature. */
function signedRaw(body: string): Request {
  return post(body, { "x-signature": hmacHex(body) });
}

interface FakeStore {
  rows: Map<string, Row & { id: string }>;
  calls: Row[];
  insertEvent: InsertEvent;
}

/**
 * A fake events table with the unique content_hash index. Like the real one it
 * is PARTIAL (WHERE content_hash IS NOT NULL): a row without a hash is never a
 * duplicate, which is exactly why replays re-inserted before plan 06-03.
 */
function makeStore(fail?: (row: Row) => { code?: string; message: string } | null): FakeStore {
  const rows = new Map<string, Row & { id: string }>();
  const calls: Row[] = [];
  let nextId = 1;
  const insertEvent: InsertEvent = async (row) => {
    calls.push(row);
    const forced = fail?.(row);
    if (forced) return { data: null, error: forced };
    const hash: string | null | undefined = row.content_hash;
    if (hash != null && rows.has(hash)) {
      return {
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "idx_events_content_hash"',
        },
      };
    }
    const id = `evt-${nextId++}`;
    const stored = { id, ...row };
    rows.set(hash ?? `no-hash:${id}`, stored);
    return { data: stored, error: null };
  };
  return { rows, calls, insertEvent };
}

function deps(store: FakeStore, overrides: Partial<Deps> = {}): Deps {
  return { secret: SECRET, configured: true, insertEvent: store.insertEvent, ...overrides };
}

async function run(req: Request, d: Deps) {
  const res = await handleWebhook(req, d);
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    text,
    body: text ? JSON.parse(text) : null,
  };
}

function ev(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Robotics Night",
    description: "Build a robot",
    category: "Workshop",
    date: "2030-03-14",
    time: "18:30",
    duration: 90,
    location: "Trottier 1100",
    organizer: "McGill Robotics",
    ...overrides,
  };
}

const TWO_EVENTS = {
  event_count: 2,
  events: [
    ev(),
    ev({
      title: "  Hack Night  ",
      organizer: undefined,
      category: undefined,
      time: undefined,
      duration: undefined,
      source_url: "https://instagram.com/p/xyz",
      image_url: "https://example.com/h.png",
      tags: ["Tech", "tech", "FOOD"],
    }),
  ],
};

// ─── Row 1: OPTIONS ──────────────────────────────────────────────────────────

describe("row 1: OPTIONS preflight", () => {
  it("answers 204 with today's CORS headers and no body, before any configuration check", async () => {
    const store = makeStore();
    const r = await run(
      new Request(ENDPOINT, { method: "OPTIONS" }),
      deps(store, { configured: false, secret: undefined })
    );
    expect(r.status).toBe(204);
    expect(r.text).toBe("");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(r.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(r.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, x-signature, x-hub-signature-256, x-webhook-signature"
    );
  });
});

// ─── Row 2: configuration ────────────────────────────────────────────────────

describe("row 2: configuration", () => {
  it.each([
    ["the database env unset (configured false)", { configured: false }],
    ["WEBHOOK_SECRET unset", { secret: undefined }],
    ["WEBHOOK_SECRET empty", { secret: "" }],
  ])("%s -> 500 Server configuration error", async (_l, override) => {
    const store = makeStore();
    const r = await run(signed(TWO_EVENTS), deps(store, override));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "Server configuration error" });
    expect(r.headers.get("Content-Type")).toBe("application/json");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(store.calls).toHaveLength(0);
  });
});

// ─── Rows 3-5: the signature ─────────────────────────────────────────────────

describe("row 3: missing signature", () => {
  it.each([
    ["no signature header", {}],
    ["all three headers empty", { "x-signature": "", "x-hub-signature-256": "", "x-webhook-signature": "" }],
    ["x-hub-signature-256 is the bare prefix", { "x-hub-signature-256": "sha256=" }],
  ])("%s -> 401 Missing signature header", async (_l, headers) => {
    const store = makeStore();
    const r = await run(post(JSON.stringify(TWO_EVENTS), headers), deps(store));
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: "Missing signature header" });
    expect(r.headers.get("Content-Type")).toBe("application/json");
    expect(store.calls).toHaveLength(0);
  });
});

describe("row 4: wrong signature of the right length", () => {
  const body = JSON.stringify(TWO_EVENTS);
  const digest = hmacHex(body);

  it.each([
    ["one hex digit changed", (digest[0] === "a" ? "b" : "a") + digest.slice(1)],
    ["the correct digest upper-cased", digest.toUpperCase()],
    ["signed with another secret", hmacHex(body, "another-secret")],
  ])("%s -> 401 Invalid signature", async (_l, sig) => {
    const store = makeStore();
    const r = await run(post(body, { "x-signature": sig }), deps(store));
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: "Invalid signature" });
    expect(store.calls).toHaveLength(0);
  });

  it("x-signature takes precedence: a wrong x-signature beside a correct x-webhook-signature -> 401", async () => {
    const store = makeStore();
    const r = await run(
      post(body, { "x-signature": "0".repeat(64), "x-webhook-signature": digest }),
      deps(store)
    );
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: "Invalid signature" });
  });
});

describe("row 5 (INTENTIONAL, F-039): a wrong-LENGTH signature is 401, not 500", () => {
  const body = JSON.stringify(TWO_EVENTS);
  const digest = hmacHex(body);

  it.each([
    ["x-signature", "abc"],
    ["x-signature", "invalid-signature-12345"],
    ["x-signature", `${digest}00`],
    ["x-signature", digest.slice(2)],
    ["x-signature", `sha256=${digest}`],
    ["x-webhook-signature", `sha256=${digest}`],
    ["x-webhook-signature", "é".repeat(64)],
    ["x-hub-signature-256", "sha256=abc"],
  ])("%s: %s -> 401 Invalid signature (was 500 Internal server error)", async (header, sig) => {
    const store = makeStore();
    const r = await run(post(body, { [header]: sig }), deps(store));
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: "Invalid signature" });
    expect(r.headers.get("Content-Type")).toBe("application/json");
    expect(store.calls).toHaveLength(0);
  });
});

describe("the three accepted signature headers", () => {
  it.each([
    ["x-signature", (d: string) => d],
    ["x-hub-signature-256", (d: string) => `sha256=${d}`],
    ["x-hub-signature-256", (d: string) => d],
    ["x-webhook-signature", (d: string) => d],
  ])("%s carrying the correct digest -> 200", async (header, shape) => {
    const store = makeStore();
    const body = JSON.stringify(TWO_EVENTS);
    const r = await run(post(body, { [header]: shape(hmacHex(body)) }), deps(store));
    expect(r.status).toBe(200);
    expect(store.rows.size).toBe(2);
  });
});

// ─── Rows 6-12: the payload ──────────────────────────────────────────────────

describe("rows 6-9: the envelope", () => {
  it("row 6: a body that is not JSON -> 400 Invalid JSON payload", async () => {
    const r = await run(signedRaw("{ invalid json }"), deps(makeStore()));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "Invalid JSON payload" });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("row 7 (preserved): a JSON null body -> 500 Internal server error", async () => {
    const r = await run(signedRaw("null"), deps(makeStore()));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "Internal server error" });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it.each([
    ["event_count a string", { event_count: "1", events: [ev()] }],
    ["events not an array", { event_count: 1, events: ev() }],
    ["events missing", { event_count: 1 }],
    ["the payload an array", [ev()]],
    ["the payload a number", 5],
  ])("row 8: %s -> 400 Invalid payload structure", async (_l, payload) => {
    const store = makeStore();
    const r = await run(signed(payload), deps(store));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      error: "Invalid payload structure. Expected event_count (number) and events (array)",
    });
    expect(store.calls).toHaveLength(0);
  });

  it("row 9: event_count disagreeing with events.length -> 400 with today's message", async () => {
    const r = await run(signed({ event_count: 2, events: [ev()] }), deps(makeStore()));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "event_count (2) does not match events array length (1)" });
  });
});

describe("rows 10-12: per-event validation", () => {
  it("row 10: one invalid event -> 400 Invalid events found, and NOTHING is inserted", async () => {
    const store = makeStore();
    const r = await run(
      signed({ event_count: 2, events: [ev(), ev({ title: "" })] }),
      deps(store)
    );
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      error: "Invalid events found",
      details: [{ index: 1, errors: [TITLE] }],
    });
    expect(store.calls).toHaveLength(0);
  });

  it("row 10: every message for an event, in validateEvent's order", async () => {
    const r = await run(
      signed({ event_count: 1, events: [{ date: "", time: 5, category: 3 }] }),
      deps(makeStore())
    );
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual([
      {
        index: 0,
        errors: [
          TITLE,
          DESCRIPTION,
          "category must be a string if provided",
          DATE_REQUIRED,
          LOCATION,
          "time must be a string if provided",
        ],
      },
    ]);
  });

  it("row 10: an unparseable date -> 'date must be a valid date string'", async () => {
    const r = await run(signed({ event_count: 1, events: [ev({ date: "someday" })] }), deps(makeStore()));
    expect(r.body.details).toEqual([{ index: 0, errors: ["date must be a valid date string"] }]);
  });

  it("row 11 (preserved): a null element -> 500 Internal server error, nothing inserted", async () => {
    const store = makeStore();
    const r = await run(signed({ event_count: 2, events: [ev(), null] }), deps(store));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "Internal server error" });
    expect(store.calls).toHaveLength(0);
  });

  it("a primitive element reads as having no fields -> 400 with the four required messages", async () => {
    const r = await run(signed({ event_count: 1, events: [5] }), deps(makeStore()));
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual([
      { index: 0, errors: [TITLE, DESCRIPTION, DATE_REQUIRED, LOCATION] },
    ]);
  });

  it("row 12 (preserved): a non-string tag -> 500 Internal server error", async () => {
    const store = makeStore();
    const r = await run(signed({ event_count: 1, events: [ev({ tags: [1] })] }), deps(store));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "Internal server error" });
    expect(store.rows.size).toBe(0);
  });
});

// ─── Rows 13-15: inserts and the status rules ────────────────────────────────

describe("row 13: every event inserts -> 200", () => {
  it("two events -> two stored rows, each with content_hash and status pending", async () => {
    const store = makeStore();
    const r = await run(signed(TWO_EVENTS), deps(store));

    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/json");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(r.body.success).toBe(true);
    expect(r.body.message).toBe("Successfully processed 2 event(s)");
    expect(r.body.events).toHaveLength(2);
    expect(store.rows.size).toBe(2);

    for (const row of store.calls) {
      expect(row.status).toBe("pending");
      expect(row.content_hash).toBe(
        await computeEventContentHash(row.title, row.start_date, row.organizer || "")
      );
      expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("maps each event as today's mapEventToDatabase did, plus content_hash", async () => {
    const store = makeStore();
    await run(signed(TWO_EVENTS), deps(store));
    const [first, second] = store.calls;

    expect(first).toMatchObject({
      title: "Robotics Night",
      description: "Build a robot",
      location: "Trottier 1100",
      category: "Workshop",
      tags: ["workshop"],
      image_url: null,
      organizer: "McGill Robotics",
      status: "pending",
      source: "manual",
      source_url: null,
    });
    expect(Date.parse(first.end_date) - Date.parse(first.start_date)).toBe(90 * 60_000);
    const start = new Date(first.start_date);
    expect([start.getHours(), start.getMinutes()]).toEqual([18, 30]);

    expect(second).toMatchObject({
      title: "Hack Night",
      category: null,
      tags: ["tech", "food"],
      image_url: "https://example.com/h.png",
      organizer: null,
      source: "instagram",
      source_url: "https://instagram.com/p/xyz",
    });
    expect(Date.parse(second.end_date) - Date.parse(second.start_date)).toBe(60 * 60_000);
    const secondStart = new Date(second.start_date);
    expect([secondStart.getHours(), secondStart.getMinutes()]).toEqual([0, 0]);
    expect(Object.keys(first).sort()).toEqual(
      [
        "category",
        "content_hash",
        "description",
        "end_date",
        "image_url",
        "location",
        "organizer",
        "source",
        "source_url",
        "start_date",
        "status",
        "tags",
        "title",
      ].sort()
    );
  });

  it("event_count 0 with events [] -> 200 'Successfully processed 0 event(s)'", async () => {
    const r = await run(signed({ event_count: 0, events: [] }), deps(makeStore()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: "Successfully processed 0 event(s)", events: [] });
  });
});

describe("row 14: some insert, some fail -> 207", () => {
  it("a mapping failure (time not HH:mm) beside a good event", async () => {
    const store = makeStore();
    const r = await run(
      signed({ event_count: 2, events: [ev(), ev({ title: "Late", time: "25:00" })] }),
      deps(store)
    );
    expect(r.status).toBe(207);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(r.body.success).toBe(true);
    expect(r.body.message).toBe("Processed 1 event(s) with 1 error(s)");
    expect(r.body.events).toHaveLength(1);
    expect(r.body.errors).toEqual([
      { index: 1, error: "Invalid time format: 25:00. Expected HH:mm format" },
    ]);
    expect(store.rows.size).toBe(1);
  });

  it("a non-23505 insert error keeps today's per-event reporting (the message is echoed)", async () => {
    const store = makeStore((row) =>
      row.title === "Broken" ? { code: "23502", message: "null value in column violates not-null constraint" } : null
    );
    const r = await run(
      signed({ event_count: 2, events: [ev(), ev({ title: "Broken" })] }),
      deps(store)
    );
    expect(r.status).toBe(207);
    expect(r.body.errors).toEqual([
      { index: 1, error: "null value in column violates not-null constraint" },
    ]);
  });
});

describe("row 15: nothing inserts -> 400", () => {
  it("every event failing its insert -> 400 Failed to process all events", async () => {
    const store = makeStore(() => ({ message: "permission denied for table events" }));
    const r = await run(signed(TWO_EVENTS), deps(store));
    expect(r.status).toBe(400);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(r.body).toEqual({
      success: false,
      message: "Failed to process all events",
      errors: [
        { index: 0, error: "permission denied for table events" },
        { index: 1, error: "permission denied for table events" },
      ],
    });
  });
});

// ─── Row 16: replay ──────────────────────────────────────────────────────────

describe("row 16 (INTENTIONAL, F-039): a replayed payload inserts nothing new", () => {
  it("the same signed body sent twice: both events are duplicate the second time, one row each", async () => {
    const store = makeStore();
    const first = await run(signed(TWO_EVENTS), deps(store));
    expect(first.status).toBe(200);
    expect(store.rows.size).toBe(2);

    const replay = await run(signed(TWO_EVENTS), deps(store));
    expect(replay.status).toBe(400);
    expect(replay.body).toEqual({
      success: false,
      message: "Failed to process all events",
      errors: [
        { index: 0, error: "duplicate" },
        { index: 1, error: "duplicate" },
      ],
    });
    expect(store.rows.size).toBe(2);
    expect(store.calls).toHaveLength(4);
  });

  it("a replay under a different accepted header is still duplicate", async () => {
    const store = makeStore();
    await run(signed(TWO_EVENTS, "x-signature"), deps(store));
    const replay = await run(signed(TWO_EVENTS, "x-webhook-signature"), deps(store));
    expect(replay.status).toBe(400);
    expect(replay.body.errors.map((e: { error: string }) => e.error)).toEqual(["duplicate", "duplicate"]);
    expect(store.rows.size).toBe(2);
  });

  it("a payload mixing a replayed event with a new one -> 207, the old one duplicate", async () => {
    const store = makeStore();
    await run(signed({ event_count: 1, events: [ev()] }), deps(store));
    const r = await run(
      signed({ event_count: 2, events: [ev(), ev({ title: "Brand New" })] }),
      deps(store)
    );
    expect(r.status).toBe(207);
    expect(r.body.message).toBe("Processed 1 event(s) with 1 error(s)");
    expect(r.body.errors).toEqual([{ index: 0, error: "duplicate" }]);
    expect(store.rows.size).toBe(2);
  });

  it("the dedupe key is title, date and organizer: an edited description is still duplicate (T-06-03-04, accepted)", async () => {
    const store = makeStore();
    await run(signed({ event_count: 1, events: [ev()] }), deps(store));
    const r = await run(
      signed({ event_count: 1, events: [ev({ description: "Edited", title: " ROBOTICS NIGHT " })] }),
      deps(store)
    );
    expect(r.status).toBe(400);
    expect(r.body.errors).toEqual([{ index: 0, error: "duplicate" }]);
  });
});

// ─── Row 17: anything else thrown ────────────────────────────────────────────

describe("row 17: anything thrown after the configuration check", () => {
  it("an insert that throws -> 500 Internal server error", async () => {
    const store = makeStore();
    const throwing: InsertEvent = async () => {
      throw new Error("connection reset");
    };
    const r = await run(signed(TWO_EVENTS), deps(store, { insertEvent: throwing }));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "Internal server error" });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
