/**
 * .planning/audit/tools/gen-endpoint-inventory.mjs
 *
 * AUDIT-03 — the keystone endpoint inventory. One row per `src/app/**\/route.ts`,
 * carrying machine-derived grep signals plus the human-classification fields that
 * plan 01-11 resolves. Consumed by the cache matrix (AUDIT-08), the service-role
 * register (AUDIT-07), every Stage 3 slice plan, and CERT-06's generated
 * persona-by-endpoint matrix.
 *
 * Usage: node .planning/audit/tools/gen-endpoint-inventory.mjs
 *
 * MERGE SEMANTICS ARE THE POINT. The file is read back and indexed by `id` before
 * anything is written; only `id`, `file`, `route`, `methods`, `dynamic_segments`
 * and `signals` are ever overwritten. A generator that replaced the file would
 * silently discard a day of hand classification (01-RESEARCH.md Pattern 1,
 * threat T-01-02-03). Consecutive runs are byte-identical.
 *
 * READ-ONLY. Route sources are opened with readFileSync and never written back;
 * the single write target is inventory/endpoints.json under .planning/.
 *
 * Deviations from the repo analog `scripts/platform-analytics.ts`, all required
 * by this phase: plain `node` rather than `npx tsx` (tsx is an unused devDependency
 * knip flags for removal); ESM, so `__dirname` does not exist; zero dependencies —
 * `node:fs` and `node:child_process` only, no dotenv and no @supabase/supabase-js;
 * output written with writeFileSync instead of stdout, with progress on stderr so
 * stdout stays clean when piped; and merge rather than replace.
 *
 * env_vars_referenced captures the identifier AFTER `process.env.` — a variable
 * NAME, never a value. This file is committed (threat T-01-02-02).
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const OUT = ".planning/audit/inventory/endpoints.json";
const ROOT_MARKERS = ["src/app", ".planning/audit/tools/validate.mjs"];

/** The 13 CERT-05 personas. A missing key is a schema error, never an implicit placeholder. */
const PERSONAS = [
  "anonymous", "onboarded_student", "mid_onboarding_student", "club_member",
  "club_owner", "multi_club_organizer", "cross_club_attacker", "admin",
  "banned_permanent", "suspended_active", "suspension_expired",
  "non_mcgill_signin", "machine_no_credential",
];

/** The literal `validate.mjs` treats as "not yet classified by a human". */
const PLACEHOLDER = "unknown";

/** Human-classification fields, in the order they are written. Never overwritten. */
const HUMAN_FIELDS = [
  "auth_requirement", "role_required", "rls_reliance", "service_role_justified",
  "personalized", "cache_policy_today", "cache_policy_target", "input_validation",
  "test_present", "dead_or_duplicate", "expected_status", "findings",
];

function humanDefaults() {
  return {
    auth_requirement: PLACEHOLDER,
    role_required: PLACEHOLDER,
    rls_reliance: PLACEHOLDER,
    service_role_justified: null,
    personalized: PLACEHOLDER,
    cache_policy_today: PLACEHOLDER,
    cache_policy_target: PLACEHOLDER,
    input_validation: PLACEHOLDER,
    test_present: PLACEHOLDER,
    dead_or_duplicate: PLACEHOLDER,
    expected_status: Object.fromEntries(PERSONAS.map((p) => [p, PLACEHOLDER])),
    findings: [],
  };
}

function deriveSignals(s) {
  return {
    uses_cookie_client:      /@\/lib\/supabase\/server/.test(s),
    uses_service_client:     /createServiceClient/.test(s),
    calls_verify_admin:      /verifyAdmin\s*\(/.test(s),
    calls_get_user:          /auth\.getUser\s*\(/.test(s),
    calls_get_session:       /auth\.getSession\s*\(/.test(s),
    calls_check_ban:         /checkBanStatus\s*\(/.test(s),
    inline_role_check:       /roles\s*\.\s*includes\s*\(/.test(s),
    references_club_members: /club_members/.test(s),
    parses_body:             /\b(?:request|req)\.json\s*\(/.test(s),
    has_zod:                 /from\s+["']zod["']/.test(s),
    sets_cache_control:      /["']Cache-Control["']/i.test(s),
    cache_control_values:    [...s.matchAll(/["']Cache-Control["']\s*[,:]\s*["']([^"']+)["']/gi)].map((m) => m[1]),
    env_vars_referenced:     [...new Set([...s.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))],
    // AUDIT-10 fail-open shape: an authorization branch conditional on an env var
    // being present, e.g. `if (expectedKey && authHeader !== ...)`. Optional per
    // endpoints.schema.json; --check authz-registers reads it (01-01-SUMMARY contract).
    env_gated_auth:          /if\s*\(\s*[A-Za-z_]\w*\s*&&\s*[^)]*!==/.test(s),
    has_try_catch:           /\btry\s*\{/.test(s),
    catch_any_count:         (s.match(/catch\s*\(\s*[A-Za-z_]+\s*:\s*any\s*\)/g) || []).length,
    console_count:           (s.match(/console\.(log|error|warn|info|debug)/g) || []).length,
    as_any_count:            (s.match(/\bas any\b/g) || []).length,
    tables_referenced:       [...new Set([...s.matchAll(/\.from\(\s*["']([a-z_0-9.]+)["']/g)].map((m) => m[1]))],
    loc: s.split("\n").length,
  };
}

async function main() {
  for (const marker of ROOT_MARKERS) {
    if (!existsSync(marker)) {
      console.error(`Run this from the repository root: ${marker} not found`);
      process.exit(1);
    }
  }

  const prior = existsSync(OUT)
    ? Object.fromEntries(JSON.parse(readFileSync(OUT, "utf8")).map((r) => [r.id, r]))
    : {};
  console.error(`merging into ${Object.keys(prior).length} existing rows`);

  const files = execSync("find src/app -name route.ts").toString().trim().split("\n").sort();

  const rows = files.map((file) => {
    const s = readFileSync(file, "utf8");
    const route = "/" + file.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
    const id = route.replace(/^\//, "").replace(/\//g, ".").replace(/\[|\]/g, "");
    const base = prior[id] ?? humanDefaults();

    const row = {
      id,
      file,
      route,
      methods: [...s.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1]),
      dynamic_segments: route.match(/\[[^\]]+\]/g) ?? [],
      signals: deriveSignals(s),
    };
    // Human classification survives verbatim; a fresh row gets the placeholders.
    const defaults = humanDefaults();
    for (const field of HUMAN_FIELDS) {
      row[field] = base[field] !== undefined ? base[field] : defaults[field];
    }
    return row;
  });

  writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n");
  console.error(`wrote ${rows.length} rows to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
