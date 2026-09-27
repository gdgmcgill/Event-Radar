/**
 * Unit tests for the contract boundary in src/server/body.ts (plan 06-04,
 * REFAC-15, DEC-65) and the shared rules in src/contracts/common.ts.
 *
 * readJsonObject's two 400 strings are the bytes every adopting handler keeps,
 * so parseBody is asserted against exactly those. parseWith reports the FIRST
 * issue in schema key order, with today's message, and names `field` only
 * where the call site asks for it (C10).
 *
 * parseForm (plan 06-08) keeps each multipart route's own file texts: the
 * missing, oversize and wrong-type answers are the route's strings, in the
 * route's order, and an unreadable form answers what the route answered
 * before (its catch's status and body).
 */

import { z } from "zod";
import {
  parseBody,
  parseForm,
  parseQuery,
  parseWith,
  readJsonObject,
} from "../body";
import {
  ErrorBody,
  IsoDateString,
  NonEmptyTrimmedString,
  Uuid,
} from "@/contracts/common";

function jsonRequest(raw: string): Request {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
  });
}

const Pair = z.object({
  first: z.string({ error: "first is required" }),
  second: z.number({ error: "second must be a number" }),
});

describe("parseWith", () => {
  it("returns the parsed data on success", () => {
    const result = parseWith(Pair, { first: "a", second: 2, extra: true });
    expect(result).toEqual({ ok: true, data: { first: "a", second: 2 } });
  });

  it("answers 400 with the first issue's message, in schema key order", async () => {
    // Both keys are wrong; the input lists `second` first, the schema does not.
    const result = parseWith(Pair, { second: "x", first: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      error: "first is required",
    });
  });

  it("omits field unless the first issue's top-level key is in fieldFor", async () => {
    const unnamed = parseWith(Pair, { first: "a" }, { fieldFor: ["first"] });
    expect(unnamed.ok).toBe(false);
    if (unnamed.ok) return;
    await expect(unnamed.response.json()).resolves.toEqual({
      error: "second must be a number",
    });

    const named = parseWith(Pair, { first: "a" }, { fieldFor: ["second"] });
    expect(named.ok).toBe(false);
    if (named.ok) return;
    await expect(named.response.json()).resolves.toEqual({
      error: "second must be a number",
      field: "second",
    });
  });

  it("names the top-level key for a nested issue", async () => {
    const Nested = z.object({
      outer: z.object({ inner: z.string({ error: "inner is required" }) }),
    });
    const result = parseWith(Nested, { outer: {} }, { fieldFor: ["outer"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    await expect(result.response.json()).resolves.toEqual({
      error: "inner is required",
      field: "outer",
    });
  });
});

describe("parseBody", () => {
  it.each([
    ["not JSON at all", "{nope"],
    ["an empty body", ""],
  ])("answers 400 Invalid JSON body for %s", async (_label, raw) => {
    const result = await parseBody(jsonRequest(raw), Pair);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  it.each([
    ["null", "null"],
    ["a string", '"text"'],
    ["a number", "5"],
    ["an array", '[{"first":"a","second":2}]'],
  ])(
    "answers 400 Request body must be a JSON object for %s",
    async (_label, raw) => {
      const result = await parseBody(jsonRequest(raw), Pair);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: "Request body must be a JSON object",
      });
    }
  );

  it("hands an object to the schema, which decides", async () => {
    const good = await parseBody(jsonRequest('{"first":"a","second":2}'), Pair);
    expect(good).toEqual({ ok: true, data: { first: "a", second: 2 } });

    const bad = await parseBody(jsonRequest('{"first":"a"}'), Pair);
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    await expect(bad.response.json()).resolves.toEqual({
      error: "second must be a number",
    });
  });

  it("gives the same two 400 bodies as readJsonObject", async () => {
    for (const raw of ["{nope", "[]"]) {
      const viaReader = await readJsonObject(jsonRequest(raw));
      const viaParse = await parseBody(jsonRequest(raw), Pair);
      expect(viaReader.ok).toBe(false);
      expect(viaParse.ok).toBe(false);
      if (viaReader.ok || viaParse.ok) return;
      expect(await viaParse.response.json()).toEqual(
        await viaReader.response.json()
      );
    }
  });
});

describe("parseQuery", () => {
  const Query = z.object({
    top_k: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });

  it("turns URLSearchParams into a plain object the schema reads", () => {
    const result = parseQuery(new URLSearchParams("top_k=5&ignored=1"), Query);
    expect(result).toEqual({ ok: true, data: { top_k: "5" } });
  });

  it("keeps the FIRST value of a repeated scalar key, as searchParams.get does", () => {
    const result = parseQuery(new URLSearchParams("top_k=5&top_k=9"), Query);
    expect(result).toEqual({ ok: true, data: { top_k: "5" } });
  });

  it("collects a repeated key as an array only when the schema asks for one", () => {
    const result = parseQuery(new URLSearchParams("tags=a&tags=b"), Query);
    expect(result).toEqual({ ok: true, data: { tags: ["a", "b"] } });
  });

  it("answers the schema's 400 when a value is refused", async () => {
    const Period = z.object({
      period: z.enum(["7d", "30d"], { error: "Invalid period. Use 7d or 30d" }),
    });
    const result = parseQuery(new URLSearchParams("period=1y"), Period);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      error: "Invalid period. Use 7d or 30d",
    });
  });
});

// ─── parseForm (plan 06-08) ────────────────────────────────────────────────

describe("parseForm", () => {
  const RULE = {
    field: "file",
    types: ["image/png", "image/jpeg"],
    maxBytes: 10,
    messages: {
      missing: "No file provided",
      tooLarge: "File too large",
      badType: (type: string) => `Invalid file type "${type}"`,
    },
  } as const;
  const OPTS = {
    file: RULE,
    unreadable: { status: 500, error: "Internal server error" },
  };
  const NoFields = z.object({});
  const WithClub = z.object({
    clubId: z.string({ error: "clubId is required" }),
  });

  function file(size: number, type: string, name = "x.bin"): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  function formRequest(entries: [string, string | File][]): Request {
    const form = new FormData();
    for (const [key, value] of entries) form.append(key, value);
    return new Request("http://localhost/api/x", { method: "POST", body: form });
  }

  async function refusal(result: Awaited<ReturnType<typeof parseForm>>) {
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    return { status: result.response.status, body: await result.response.json() };
  }

  it("returns the file and the parsed non-file fields", async () => {
    const upload = file(4, "image/png", "a.png");
    const result = await parseForm(
      formRequest([["file", upload], ["clubId", "c1"], ["clubId", "c2"], ["extra", "x"]]),
      WithClub,
      OPTS
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The first value of a repeated key, as formData.get returned it.
    expect(result.data.fields).toEqual({ clubId: "c1" });
    expect(result.data.file.name).toBe("a.png");
    expect(result.data.file.size).toBe(4);
    expect(result.data.file.type).toBe("image/png");
  });

  it("answers the route's missing text when there is no file", async () => {
    await expect(refusal(await parseForm(formRequest([]), NoFields, OPTS))).resolves.toEqual({
      status: 400,
      body: { error: "No file provided" },
    });
  });

  it("treats a string in the file field as no file", async () => {
    const result = await parseForm(formRequest([["file", "not a file"]]), NoFields, OPTS);
    await expect(refusal(result)).resolves.toEqual({
      status: 400,
      body: { error: "No file provided" },
    });
  });

  it("answers the route's size text for an oversize file", async () => {
    const result = await parseForm(formRequest([["file", file(11, "image/png")]]), NoFields, OPTS);
    await expect(refusal(result)).resolves.toEqual({
      status: 400,
      body: { error: "File too large" },
    });
  });

  it("answers the route's type text, naming the type, for a wrong type", async () => {
    const result = await parseForm(formRequest([["file", file(4, "text/plain")]]), NoFields, OPTS);
    await expect(refusal(result)).resolves.toEqual({
      status: 400,
      body: { error: 'Invalid file type "text/plain"' },
    });
  });

  it("checks size before type by default, and type first when the route did", async () => {
    const both = () => formRequest([["file", file(11, "text/plain")]]);
    await expect(refusal(await parseForm(both(), NoFields, OPTS))).resolves.toEqual({
      status: 400,
      body: { error: "File too large" },
    });
    const typeFirst = { ...OPTS, file: { ...RULE, order: ["type", "size"] as const } };
    await expect(refusal(await parseForm(both(), NoFields, typeFirst))).resolves.toEqual({
      status: 400,
      body: { error: 'Invalid file type "text/plain"' },
    });
  });

  it("accepts a file exactly at the size limit", async () => {
    const result = await parseForm(formRequest([["file", file(10, "image/jpeg")]]), NoFields, OPTS);
    expect(result.ok).toBe(true);
  });

  it("validates the non-file fields with the schema after the file is present", async () => {
    const result = await parseForm(formRequest([["file", file(4, "image/png")]]), WithClub, OPTS);
    await expect(refusal(result)).resolves.toEqual({
      status: 400,
      body: { error: "clubId is required" },
    });
  });

  it("answers the route's own status and body when the form cannot be read", async () => {
    const request = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    await expect(refusal(await parseForm(request, NoFields, OPTS))).resolves.toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });
  });
});

describe("contracts/common", () => {
  const upper = "06000000-00AB-4000-8000-0000000000CD";

  it("Uuid accepts any-case canonical UUIDs and outputs lower case", () => {
    const result = Uuid("Invalid id").safeParse(upper);
    expect(result.success).toBe(true);
    expect(result.data).toBe(upper.toLowerCase());
  });

  it.each([
    ["a short string", "abc"],
    ["braces", `{${upper}}`],
    ["no hyphens", upper.replace(/-/g, "")],
    ["a number", 5],
    ["undefined", undefined],
  ])("Uuid rejects %s with the caller's message", (_label, value) => {
    const result = Uuid("Invalid id").safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Invalid id");
  });

  it("IsoDateString accepts an ISO date and refuses anything else with one message", () => {
    const schema = IsoDateString("Invalid date");
    expect(schema.safeParse("2026-09-26T10:00:00Z").success).toBe(true);
    for (const value of ["2026-02-31", "tomorrow", 5, undefined]) {
      const result = schema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Invalid date");
      expect(result.error?.issues).toHaveLength(1);
    }
  });

  it("NonEmptyTrimmedString refuses non-strings and blank strings with the same message", () => {
    const schema = NonEmptyTrimmedString("Message is required");
    expect(schema.safeParse("  hi  ")).toEqual({
      success: true,
      data: "  hi  ",
    });
    for (const value of ["", "   ", 5, null, undefined, {}]) {
      const result = schema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(1);
      expect(result.error?.issues[0]?.message).toBe("Message is required");
    }
  });

  it("ErrorBody describes { error, field? }", () => {
    expect(ErrorBody.safeParse({ error: "x" }).success).toBe(true);
    expect(ErrorBody.safeParse({ error: "x", field: "f" }).success).toBe(true);
    expect(ErrorBody.safeParse({ field: "f" }).success).toBe(false);
  });
});
