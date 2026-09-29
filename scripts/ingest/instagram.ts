/**
 * M3 P1-07: the Instagram producer CLI. See docs/runbooks/ingestion.md.
 *
 *   npx tsx scripts/ingest/instagram.ts --handles a,b,c --webhook-url URL [--days 14] [--dry-run] [--fixture path]
 *
 * Fetches recent posts for up to ten handles from Apify's
 * instagram-profile-scraper (or reads --fixture), classifies them, and posts
 * signed batches of 25 to the events-webhook. Every event lands as `pending`.
 *
 * SECRETS: WEBHOOK_SECRET comes from the environment (required unless
 * --dry-run). APIFY_API_TOKEN comes from the environment or, failing that, is
 * read from .env with dotenv.parse; no other key of .env is read. Neither is
 * ever printed. Output is counts and HTTP statuses only: never a caption, a
 * token or a payload.
 *
 * TARGET GUARD: the webhook host must be 127.0.0.1 or localhost unless
 * INGEST_ALLOW_REMOTE_TARGET is exactly
 * "I_UNDERSTAND_THIS_WRITES_TO_A_REMOTE_PROJECT".
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse as parseDotenv } from "dotenv";
import {
  buildWebhookEvents,
  chunk,
  mapApifyProfiles,
  signBody,
  webhookPayload,
  type ProducerEvent,
  type ProducerRun,
} from "../../src/lib/ingest/instagramProducer";

const REMOTE_ACK = "I_UNDERSTAND_THIS_WRITES_TO_A_REMOTE_PROJECT";
const APIFY_URL =
  "https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?timeout=240";
const APIFY_TIMEOUT_MS = 300_000;
const BATCH_SIZE = 25;
const BACKOFF_MS = [1_000, 2_000, 4_000];
const HANDLE = /^[a-z0-9._]{1,30}$/i;

class UsageError extends Error {}

interface Options {
  handles: string[];
  days: number;
  webhookUrl: URL;
  dryRun: boolean;
  fixture: string | null;
}

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (!["--handles", "--days", "--webhook-url", "--fixture"].includes(arg)) throw new UsageError(`Unknown argument: ${arg}`);
    const value = argv[++index];
    if (value === undefined) throw new UsageError(`${arg} needs a value`);
    values.set(arg, value);
  }
  const handles = (values.get("--handles") ?? "").split(",").map((handle) => handle.trim().replace(/^@/, "")).filter(Boolean);
  if (handles.length === 0) throw new UsageError("--handles is required");
  if (handles.length > 10) throw new UsageError("--handles accepts at most 10 handles");
  if (!handles.every((handle) => HANDLE.test(handle))) throw new UsageError("--handles must be Instagram usernames");
  const days = Number(values.get("--days") ?? "14");
  if (!Number.isInteger(days) || days < 1 || days > 60) throw new UsageError("--days must be an integer from 1 to 60");
  const rawUrl = values.get("--webhook-url");
  if (!rawUrl) throw new UsageError("--webhook-url is required");
  let webhookUrl: URL;
  try {
    webhookUrl = new URL(rawUrl);
  } catch {
    throw new UsageError("--webhook-url must be a URL");
  }
  if (!["127.0.0.1", "localhost"].includes(webhookUrl.hostname) && process.env.INGEST_ALLOW_REMOTE_TARGET !== REMOTE_ACK) {
    throw new UsageError("REFUSED: --webhook-url must be local (127.0.0.1 or localhost); see docs/runbooks/ingestion.md");
  }
  return { handles, days, webhookUrl, dryRun, fixture: values.get("--fixture") ?? null };
}

/** APIFY_API_TOKEN from the environment, else from .env; never printed. */
function apifyToken(): string | null {
  const fromEnv = process.env.APIFY_API_TOKEN;
  if (fromEnv) return fromEnv;
  if (!existsSync(".env")) return null;
  return parseDotenv(readFileSync(".env")).APIFY_API_TOKEN || null;
}

type ApifyResult = { ok: true; items: unknown[] } | { ok: false; code: string };

async function fetchProfiles(handles: string[], token: string): Promise<ApifyResult> {
  let response: Response;
  try {
    response = await fetch(APIFY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: handles, resultsLimit: 12 }),
      signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return { ok: false, code: name === "TimeoutError" || name === "AbortError" ? "apify_timeout" : "apify_network" };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    return { ok: false, code: `apify_http_${response.status}` };
  }
  const items: unknown = await response.json().catch(() => null);
  return Array.isArray(items) ? { ok: true, items } : { ok: false, code: "apify_bad_response" };
}

interface BatchResult {
  status: number;
  inserted: number;
  duplicates: number;
  failed: number;
}

/** POST one signed payload; retried on network errors and 5xx (1 s, 2 s, 4 s). */
async function send(url: URL, body: string, secret: string): Promise<BatchResult> {
  const signature = signBody(body, secret);
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-signature": signature },
        body,
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      response = null;
    }
    const retryable = response === null || response.status >= 500;
    if (!retryable || attempt >= BACKOFF_MS.length) {
      if (!response) return { status: 0, inserted: 0, duplicates: 0, failed: 0 };
      // Read counts only; the body echoes stored rows and is never printed.
      const parsed = (await response.json().catch(() => null)) as
        | { events?: unknown[]; errors?: { error?: string }[] }
        | null;
      const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
      const duplicates = errors.filter((entry) => entry?.error === "duplicate").length;
      return {
        status: response.status,
        inserted: Array.isArray(parsed?.events) ? parsed.events.length : 0,
        duplicates,
        failed: errors.length - duplicates,
      };
    }
    await response?.body?.cancel().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]));
  }
}

/** A batch was delivered and processed (a replay's all-duplicate 400 included). */
function delivered(result: BatchResult, size: number): boolean {
  if (result.status === 200 || result.status === 207) return true;
  return result.status === 400 && result.duplicates + result.failed === size && result.failed === 0;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const secret = process.env.WEBHOOK_SECRET;
  if (!options.dryRun && !secret) throw new UsageError("WEBHOOK_SECRET is required unless --dry-run");
  const runId = randomUUID();
  console.log(`run ${runId}: handles=${options.handles.length} days=${options.days}${options.dryRun ? " dry-run" : ""}${options.fixture ? " fixture" : ""}`);

  let items: unknown[];
  if (options.fixture) {
    items = JSON.parse(readFileSync(options.fixture, "utf8"));
    if (!Array.isArray(items)) throw new UsageError("--fixture must hold a JSON array");
  } else {
    const token = apifyToken();
    if (!token) throw new UsageError("APIFY_API_TOKEN is not set (environment or .env)");
    console.log("apify: requesting profiles");
    const result = await fetchProfiles(options.handles, token);
    if (!result.ok) {
      console.log(`apify: failed code=${result.code}`);
      if (!options.dryRun && secret) {
        const run: ProducerRun = { id: runId, status: "failed", error_code: result.code, items_seen: 0 };
        const report = await send(options.webhookUrl, webhookPayload([], run), secret);
        console.log(`failure report: status=${report.status}`);
      }
      return 1;
    }
    items = result.items;
  }

  const posts = mapApifyProfiles(items);
  const profiles = new Set(posts.map((post) => post.account)).size;
  const { events, seen, discarded } = buildWebhookEvents(posts, { now: new Date(), days: options.days });
  console.log(`classified: items=${items.length} profiles_with_posts=${profiles} posts=${posts.length} in_window=${seen} events=${events.length} discarded=${discarded}`);
  if (options.dryRun || !secret) {
    console.log("dry-run: nothing sent");
    return 0;
  }

  const run: ProducerRun = { id: runId, status: "ok", items_seen: seen };
  const batches: ProducerEvent[][] = events.length ? chunk(events, BATCH_SIZE) : [[]];
  const totals = { inserted: 0, duplicates: 0, failed: 0 };
  let ok = true;
  for (const [index, batch] of batches.entries()) {
    const result = await send(options.webhookUrl, webhookPayload(batch, run), secret);
    totals.inserted += result.inserted;
    totals.duplicates += result.duplicates;
    totals.failed += result.failed;
    const label = batch.length ? `batch ${index + 1}/${batches.length}` : "heartbeat";
    console.log(`${label}: events=${batch.length} status=${result.status} inserted=${result.inserted} duplicates=${result.duplicates} failed=${result.failed}`);
    if (batch.length ? !delivered(result, batch.length) : result.status !== 200) ok = false;
  }
  console.log(`summary: events=${events.length} inserted=${totals.inserted} duplicates=${totals.duplicates} failed=${totals.failed} ${ok ? "ok" : "incomplete"}`);
  return ok ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Usage errors are our own text; anything else is reported by class only,
    // so an error that quotes a payload or a header never reaches the output.
    console.error(error instanceof UsageError ? error.message : `producer failed (${error instanceof Error ? error.name : "unknown"})`);
    process.exitCode = 2;
  }
);
