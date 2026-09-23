/**
 * =============================================================================
 * search-escape-probe.ts — live measurement of F-082's search escaping
 * Phase 04-slices-1-2-saved-events-rsvp-and-the-event-read-path · plan 04-08
 *
 * Usage: npx tsx scripts/probes/search-escape-probe.ts
 *
 * WHAT IT PROVES. `src/lib/searchFilter.ts` escapes a search term in two
 * layers (SQL LIKE, then PostgREST's double-quoted value). The unit tests pin
 * the strings; only the real PostgREST parser and Postgres ILIKE can say what
 * those strings match. Research assumption A2 (04-RESEARCH.md) left the
 * double-quote and backslash rows unmeasured because no seeded row contains
 * either character. This probe creates rows that do, queries them the way the
 * route does, and asserts each special-character term matches exactly the
 * row that contains it literally.
 *
 * METHOD CONTRACT — read this before running it
 *   * THIS TOOL WRITES. It inserts five temporary approved events, with ids in
 *     the reserved probe namespace `e5ca9e00-…` (distinct from the seed's
 *     `5eed…` block), no club, and start/end dates in 2099.
 *   * IT ALWAYS REMOVES THEM. Deletion by id runs in a `finally`, and a
 *     follow-up read verifies zero probe rows remain; a leftover row is a
 *     failure (exit 1). The `events` table's only trigger fires on UPDATE, so
 *     insert and delete have no side effect elsewhere.
 *   * IT REFUSES TO RUN ANYWHERE BUT THE LOCAL STACK. The target URL goes
 *     through `assertSeedTargetAllowed()` (scripts/seed/guard.ts) before any
 *     Supabase client exists.
 *   * IT NEVER READS A CREDENTIAL FROM AN APP ENV FILE. URL and keys come from
 *     `localStackEnv()` (e2e/env.ts), i.e. `supabase status -o env`.
 *   * IT NEVER PRINTS A KEY. Only terms, ids, counts and verdicts reach stdout.
 *   * IT IS NOT WIRED INTO CI OR NPM SCRIPTS. Run it by hand against a running
 *     local stack.
 *
 * VERDICTS. PASS: the probe ids returned equal the expected set. KNOWN: the
 * bare `*` case, expected to match all five probe rows because PostgREST
 * rewrites `*` to `%` in like/ilike values (knowingly out of scope, DEC-32,
 * threat T-04-08-06). If `*` ever stops matching all five, it prints FAIL:
 * PostgREST's behaviour changed and the disposition must be revisited.
 * Exit 1 on any FAIL or any request error.
 * =============================================================================
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { localStackEnv } from "../../e2e/env";
import { ilikeContainsFilter } from "../../src/lib/searchFilter";
import type { Database } from "../../src/lib/supabase/types";
import { assertSeedTargetAllowed } from "../seed/guard";

type Client = SupabaseClient<Database>;

const PROBE_PREFIX = "e5ca9e00-0000-4000-8000-";

/** The five probe rows, keyed by the character each title carries. */
const ROWS = {
  percent: { id: `${PROBE_PREFIX}000000000001`, title: "Probe 100% off" },
  underscore: { id: `${PROBE_PREFIX}000000000002`, title: "Probe under_score" },
  quote: { id: `${PROBE_PREFIX}000000000003`, title: 'Probe say "hi"' },
  backslash: { id: `${PROBE_PREFIX}000000000004`, title: "Probe back\\slash" },
  comma: { id: `${PROBE_PREFIX}000000000005`, title: "Probe comma, paren (x)" },
} as const;

type RowKey = keyof typeof ROWS;
const ALL_KEYS = Object.keys(ROWS) as RowKey[];
const ALL_IDS = ALL_KEYS.map((k) => ROWS[k].id);

interface Case {
  readonly name: string;
  readonly term: string;
  readonly expected: readonly RowKey[];
  /** KNOWN rows document accepted behaviour instead of a fix. */
  readonly known?: boolean;
}

const CASES: readonly Case[] = [
  { name: "percent (100%)", term: "100%", expected: ["percent"] },
  { name: "bare percent", term: "%", expected: ["percent"] },
  { name: "underscore", term: "_", expected: ["underscore"] },
  { name: "double quote", term: '"', expected: ["quote"] },
  { name: "backslash", term: "\\", expected: ["backslash"] },
  { name: "comma+parens", term: "comma, paren (x)", expected: ["comma"] },
  { name: "bare asterisk", term: "*", expected: ALL_KEYS, known: true },
];

// A description that contains none of the probed characters, so every match
// below is on the title.
const DESCRIPTION = "Temporary row written by the search escape probe";

async function insertRows(admin: Client): Promise<void> {
  const rows = ALL_KEYS.map((k) => ({
    id: ROWS[k].id,
    title: ROWS[k].title,
    description: DESCRIPTION,
    start_date: "2099-01-01T12:00:00.000Z",
    end_date: "2099-01-01T14:00:00.000Z",
    status: "approved",
    club_id: null,
    deleted_at: null,
    tags: ["social"],
  }));
  const { error } = await admin.from("events").insert(rows);
  if (error) throw new Error(`insert failed: ${error.code} ${error.message}`);
}

async function removeRows(admin: Client): Promise<number> {
  const { error } = await admin.from("events").delete().in("id", ALL_IDS);
  if (error) throw new Error(`delete failed: ${error.code} ${error.message}`);
  const { count, error: countError } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("id", ALL_IDS);
  if (countError) {
    throw new Error(`cleanup count failed: ${countError.code} ${countError.message}`);
  }
  return count ?? -1;
}

interface Outcome {
  readonly verdict: "PASS" | "KNOWN" | "FAIL";
  readonly got: string;
  readonly others: number;
}

async function runCase(anon: Client, c: Case): Promise<Outcome> {
  // Exactly the route's fallback: approved, non-deleted, or() of the title and
  // description conditions built by ilikeContainsFilter.
  const { data, error } = await anon
    .from("events")
    .select("id")
    .eq("status", "approved")
    .is("deleted_at", null)
    .or(
      [
        ilikeContainsFilter("title", c.term),
        ilikeContainsFilter("description", c.term),
      ].join(",")
    );
  if (error) {
    return { verdict: "FAIL", got: `ERROR ${error.code}`, others: 0 };
  }
  const ids = (data ?? []).map((r) => r.id);
  const probeHits = ALL_KEYS.filter((k) => ids.includes(ROWS[k].id));
  const others = ids.filter((id) => !id.startsWith(PROBE_PREFIX)).length;
  const same =
    probeHits.length === c.expected.length &&
    c.expected.every((k) => probeHits.includes(k));
  const verdict = same ? (c.known ? "KNOWN" : "PASS") : "FAIL";
  return { verdict, got: probeHits.join("+") || "(none)", others };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main(): Promise<number> {
  const stack = localStackEnv();
  // THE TARGET ASSERTION. No client exists until it returns.
  const url = assertSeedTargetAllowed(stack.url);
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  const admin = createClient<Database>(url, stack.serviceRoleKey, options);
  const anon = createClient<Database>(url, stack.anonKey, options);

  console.log(`probe: target ${url} (local stack)`);
  let failures = 0;
  let asExpected = 0;
  let remaining = -1;
  try {
    // A previous interrupted run could have left rows behind; start clean.
    await removeRows(admin);
    await insertRows(admin);
    console.log(`probe: inserted ${ALL_IDS.length} rows (${PROBE_PREFIX}…)`);

    const header = `${pad("case", 16)} ${pad("term", 18)} ${pad("expected", 44)} ${pad("got", 44)} others verdict`;
    console.log(header);
    console.log("-".repeat(header.length));
    for (const c of CASES) {
      const out = await runCase(anon, c);
      if (out.verdict === "FAIL") failures += 1;
      else asExpected += 1;
      console.log(
        `${pad(c.name, 16)} ${pad(JSON.stringify(c.term), 18)} ${pad(
          c.expected.join("+"),
          44
        )} ${pad(out.got, 44)} ${pad(String(out.others), 6)} ${out.verdict}`
      );
    }
  } catch (e) {
    failures += 1;
    console.error(`probe: request error: ${(e as Error).message}`);
  } finally {
    try {
      remaining = await removeRows(admin);
    } catch (e) {
      console.error(`probe: cleanup error: ${(e as Error).message}`);
    }
    console.log(`probe: cleanup — probe rows remaining: ${remaining}`);
    if (remaining !== 0) failures += 1;
  }

  console.log(
    `probe: ${failures === 0 ? "OK" : "FAILED"} — ${asExpected} of ${CASES.length} cases as expected, ${failures} failure(s)`
  );
  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`probe: ${(e as Error).message}`);
    process.exit(1);
  }
);
