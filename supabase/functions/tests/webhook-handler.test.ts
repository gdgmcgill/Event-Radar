/**
 * M0: execute the shared handler in Deno without a running database, credentials,
 * or network permissions. Live deployment parity remains webhook.test.ts.
 * Run: deno test --config supabase/functions/events-webhook/deno.json supabase/functions/tests/webhook-handler.test.ts
 */
import { deepStrictEqual, strictEqual } from "node:assert";
import { createHmac } from "node:crypto";
import { handleWebhook, type WebhookDeps } from "../_shared/webhook-handler.ts";

const SECRET = "offline-test-secret";
const EVENT = { title: "Deno event", description: "Test", date: "2030-01-01", location: "Campus", tags: ["TECH"] };
function signed(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  return new Request("http://localhost/events-webhook", {
    method: "POST", body,
    headers: { "x-signature": signature ?? createHmac("sha256", SECRET).update(body).digest("hex") },
  });
}

Deno.test("DI-83: malformed inputs validate atomically in Deno", async () => {
  const payloads = [
    null,
    { event_count: 2, events: [EVENT, null] },
    { event_count: 2, events: [EVENT, { ...EVENT, tags: [1] }] },
  ];
  for (const payload of payloads) {
    let inserts = 0;
    const response = await handleWebhook(signed(payload), {
      secret: SECRET, configured: true,
      insertEvent: async () => { inserts++; return { data: {}, error: null }; },
    });
    strictEqual(response.status, 400);
    strictEqual(inserts, 0);
    const body = await response.json();
    strictEqual(body.error, payload === null
      ? "Invalid payload structure. Expected event_count (number) and events (array)"
      : "Invalid events found");
    if (payload !== null) strictEqual(body.details[0].index, 1);
  }
});

Deno.test("Deno preserves HMAC, content-hash replay and partial-batch behavior", async () => {
  const hashes = new Set<string>();
  const deps: WebhookDeps = {
    secret: SECRET, configured: true,
    insertEvent: async (row) => {
      if (hashes.has(row.content_hash)) return { data: null, error: { code: "23505", message: "private constraint" } };
      hashes.add(row.content_hash);
      deepStrictEqual(row.tags, ["tech"]);
      return { data: row, error: null };
    },
  };
  const payload = { event_count: 1, events: [EVENT] };
  const rejected = await handleWebhook(signed(payload, "short"), deps);
  strictEqual(rejected.status, 401);
  await rejected.text();
  strictEqual(hashes.size, 0);
  const first = await handleWebhook(signed(payload), deps);
  strictEqual(first.status, 200);
  await first.text();
  const replay = await handleWebhook(signed(payload), deps);
  strictEqual(replay.status, 400);
  deepStrictEqual((await replay.json()).errors, [{ index: 0, error: "duplicate" }]);
  const partial = await handleWebhook(signed({ event_count: 2, events: [EVENT, { ...EVENT, title: "New" }] }), deps);
  strictEqual(partial.status, 207);
  deepStrictEqual((await partial.json()).errors, [{ index: 0, error: "duplicate" }]);
  strictEqual(hashes.size, 2);
});

Deno.test("IN-05: Deno error responses and diagnostics omit database text", async () => {
  const logs: string[] = [];
  const original = console.error;
  console.error = (value: string) => { logs.push(value); };
  try {
    const payload = { event_count: 1, events: [EVENT] };
    const response = await handleWebhook(signed(payload), {
      secret: SECRET, configured: true,
      insertEvent: async () => ({ data: null, error: { code: "23502", message: "private constraint and row values" } }),
    });
    strictEqual(response.status, 400);
    deepStrictEqual((await response.json()).errors, [{ index: 0, error: "insert_failed" }]);
    deepStrictEqual(JSON.parse(logs[0]), { event: "webhook.insert_failed", index: 0, code: "23502" });
    const failed = await handleWebhook(signed(payload), {
      secret: SECRET, configured: true,
      insertEvent: async () => { throw new TypeError("private thrown value"); },
    });
    strictEqual(failed.status, 500);
    deepStrictEqual(await failed.json(), { error: "Internal server error" });
    deepStrictEqual(JSON.parse(logs[1]), { event: "webhook.unhandled_error", errorClass: "TypeError" });
    strictEqual(logs.join().includes("private"), false);
  } finally {
    console.error = original;
  }
});
