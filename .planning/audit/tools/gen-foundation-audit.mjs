#!/usr/bin/env node
/**
 * .planning/audit/tools/gen-foundation-audit.mjs
 *
 * Renders .planning/audit/FOUNDATION_AUDIT.md from .planning/audit/findings.json.
 *
 * The human register is GENERATED from the machine register so the two cannot drift.
 * FOUNDATION_AUDIT.md is never hand-edited. If a finding needs a change, change
 * findings.json and re-run this file; `validate.mjs --check findings` asserts that the
 * document and the register agree on the finding count, so a hand-edit is caught.
 *
 * Zero dependencies by design — only node:fs and node:path. Nothing from src/ is
 * imported and this file is never added to package.json, because either would be a
 * working-tree change outside .planning/ and would fail the phase's exit criterion.
 *
 * Determinism: the output is a pure function of findings.json plus the three narrative
 * constants below. Findings are sorted by severity rank then by id, both total orders,
 * so two runs on the same input produce byte-identical output. No timestamp is written
 * into the body; the provenance line carries the input's own mtime-independent hash-free
 * description instead.
 *
 * Usage:
 *   node .planning/audit/tools/gen-foundation-audit.mjs           # write the document
 *   node .planning/audit/tools/gen-foundation-audit.mjs --check   # exit 1 if stale
 *
 * `resolution` (added by plan 02-11, Phase 2). An OPTIONAL per-finding string rendered
 * as a Resolution paragraph under the validation criterion. It exists because the
 * register could record THAT a finding closed — via `status` and `closes_in_phase` —
 * and had nowhere to record HOW, in which commit, or which clause did not close. A
 * finding untouched since Phase 1 has no `resolution` and renders exactly as before,
 * so this addition is byte-neutral on every row it is absent from.
 */

import fs from 'node:fs';
import path from 'node:path';

const AUDIT_ROOT = path.resolve(import.meta.dirname, '..');
const FINDINGS = path.join(AUDIT_ROOT, 'findings.json');
const OUTPUT = path.join(AUDIT_ROOT, 'FOUNDATION_AUDIT.md');

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];
const STATUS_ORDER = ['Open', 'Fixed', 'Risk-accepted'];
const CATEGORY_ORDER = [
  'authz', 'authn', 'cache-exposure', 'schema-drift', 'config',
  'dependency', 'observability', 'validation', 'performance', 'dead-code', 'injection',
];

/* ------------------------------------------------------------------ narrative -- */

/**
 * Fixes that looked trivial during the audit and were deliberately NOT applied.
 * This list is the written record that the baseline was preserved on purpose rather
 * than by omission, and it becomes the first Stage 3 slice. Every id here must exist
 * in findings.json; the generator exits non-zero if one does not.
 */
const TEMPTING_ONE_LINERS = [
  ['F-001', 'Change `if (expectedKey && ...)` to `if (!expectedKey) return 401`. One line, one file, closes a live Critical — and it is a source change, which this phase forbids absolutely. Applying it would also have destroyed the evidence that the gate was ever open.'],
  ['F-002', 'Replace the template literal with a presence check, copying the sibling handler four directories away. Two lines. Not applied: same source-change prohibition, and the handler may be deleted instead (see F-037), which is a product decision this phase cannot take.'],
  ['F-026', 'Narrow the `vercel.json` `/api/(.*)` cache rule. A config edit, not a source edit — still forbidden, and still wrong to do blind: 13 routes legitimately want the shared cache and the correct scope comes from `cache/cache-matrix.csv`, not from a hunch.'],
  ['F-054', 'Add `/docs` to `PROTECTED_ROUTES`. One array element. Not applied: the middleware ring is itself env-conditional (F-003), so the one-liner would have produced protection that evaporates when a variable is unset — a fix that reads as done and is not.'],
  ['F-063', 'Correct `CLAUDE.md:50` from six protected routes to eight, and `PROJECT.md:41` from 92 handlers to 94. Pure documentation, zero risk — and explicitly out of scope: this phase files the contradictions, the phase-completion step applies them.'],
  ['F-064', 'Delete `vitest.config.ts`, `vitest.setup.ts`, `test-results/.last-run.json`, and the broken `check:feedback` script entry. Four deletions, nothing references any of them. Not applied: deletions outside `.planning/` are exactly what the read-only gate exists to prove did not happen.'],
  ['F-051', 'Run `npm update next`. The fix is inside the declared `^16.0.3` range. Not applied: it rewrites `package-lock.json`, whose SHA-256 is one of the three checks in `tools/readonly-guard.sh`.'],
  ['F-052', 'Move `vercel` from `dependencies` to `devDependencies` — one line in `package.json`, retires 7 of 24 High/Critical advisory rows. Not applied: same lockfile and manifest prohibition.'],
  ['F-016', 'Apply the already-written migration that declares the invitee policies. The fix is in the repository, unapplied, and club-invitation acceptance is broken in production right now. Not applied: this phase issues no database write of any kind, and applying an unreplayable migration history (F-043) is not a one-liner.'],
];

const COVERAGE_EXAMINED = [
  'All **94** API route handlers, classified for authorization requirement, role, RLS reliance, service-role justification, personalization, cache policy, input validation, test presence and liveness (`inventory/endpoints.json`).',
  'All **43** pages, classified for middleware protection, layout guard, page guard and *effective* protection (`inventory/pages.json`).',
  'All **101** live row-level policies over **38** relations, against six flag classes, plus the full table × command × role grid (`rls/rls-review.md`, `rls/rls-heatmap.csv`).',
  'All **25** service-role construction sites against four justification questions; every `getSession()` callsite; every environment-conditional authorization shape (`authz/`).',
  'All **4** storage buckets and **15** object policies; all **6** classes of asynchronous entry point plus GitHub Actions (`storage/`, `async/`).',
  '**288** schema rows reconciled across production, migrations and `types.ts`; the migration replay attempted from zero (`schema/drift.md`, `schema/local-reset.txt`).',
  '**680** production dependencies audited with a reachability judgment on every High/Critical; the module graph cruised for API-documentation reachability (`quality/`).',
  '**15** routes probed live for shared-cache behaviour, three requests each, with a positive control that fired (`cache/`).',
  'The test, type-check, lint and build baseline captured verbatim with exit codes (`baseline/`).',
];

const COVERAGE_NOT_EXAMINED = [
  '**Cross-session cache retrieval.** The mechanism is proven — personalized responses are stored and the cache key ignores the session — but no request carrying account B\'s cookies was observed receiving account A\'s entry. `COOKIE_A`/`COOKIE_B` were never supplied. Retry command in `cache/curl-summary.json`. This is why F-025 is `Critical` with an honest `latent-hazard` verdict rather than a stronger label.',
  '**Staging and local schema snapshots.** `schema/staging.schema.sql` and `schema/local.schema.sql` are BLOCKED stubs. The local replay aborts on the repository\'s own migration history (F-043); staging needs a credential not supplied. `validate.mjs --check schema-snapshots` is red for exactly this reason and was not weakened.',
  '**GoTrue auth hook configuration.** The `pg-functions://` form is ruled out by the function catalog; the HTTP form is dashboard state and is not capturable read-only.',
  '**The client bundle with a real service-role key in the build environment.** `security/client-bundle-sweep.md` records `ENVSTATE: INCONCLUSIVE-key-absent-from-build-env`. Its seven zero counts prove the key was absent from *that* build, not that a build holding it would not inline it.',
  '**The production host operating system**, which leaves one dependency advisory (`GHSA-p293-qw3h-jr36`, Windows RCE) dispositioned on an assumption rather than a fact — recorded as F-057 rather than silently closed.',
  '**Anything requiring a write.** No source file, config, dependency, migration, policy or database row was changed by any plan in this phase. That invariant, not the finding count, is the phase\'s exit criterion.',
];

const BLOCKED_ITEMS = [
  ['AUDIT-01 — staging schema snapshot', 'credential for the staging project not supplied', 'supabase db dump --schema public,storage,extensions --project-ref <STAGING-REF> > .planning/audit/schema/staging.schema.sql'],
  ['AUDIT-01 — local schema snapshot', 'the migration history aborts the replay at the 12th of 44 files (F-043); Docker was available, the repository was not replayable', 'supabase db reset   # blocked until F-043 is fixed, then: supabase db dump --local --schema public,storage > .planning/audit/schema/local.schema.sql'],
  ['AUDIT-08 — two-session cache probe', 'COOKIE_A / COOKIE_B never exported into the executing shell; no cookie value entered this machine', 'export PROD_HOST=https://universeapp.ca COOKIE_A=\'<account A sb-*-auth-token cookies>\' COOKIE_B=\'<account B>\' CLUB_ID=\'<public club id>\'; bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs && node .planning/audit/tools/validate.mjs --check cache'],
  ['AUDIT-16 — client bundle sweep', 'the build that produced `.next/static` ran without the real service-role key, so a zero count is INCONCLUSIVE rather than clean', 'SUPABASE_SERVICE_ROLE_KEY=<real key> npm run build && <re-run the sweep recorded in security/client-bundle-sweep.md>'],
  ['AUDIT-11 — GoTrue auth hook configuration', 'dashboard state; the HTTP hook form is not readable through any read-only capture used in this phase', 'supabase projects api-keys --project-ref <PROD-REF>   # then read Authentication → Hooks in the dashboard'],
];

/* ------------------------------------------------------------------- helpers -- */

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
const slug = (id) => id.toLowerCase();

/**
 * Counts by `field`, emitting the known values in the declared order first so the
 * output is stable, then any unexpected value sorted lexically rather than dropped —
 * a category the schema does not know about must show up in the summary, not vanish.
 */
function countBy(rows, field, order) {
  const counts = new Map();
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) || 0) + 1);
  const known = order.filter((k) => counts.has(k)).map((k) => [k, counts.get(k)]);
  const extra = [...counts.keys()].filter((k) => !order.includes(k)).sort().map((k) => [k, counts.get(k)]);
  return [...known, ...extra];
}

function severityRank(severity) {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

function sortFindings(rows) {
  return [...rows].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return String(a.id).localeCompare(String(b.id));
  });
}

function pathCell(entry) {
  return entry.lines ? `\`${entry.path}\` lines ${entry.lines}` : `\`${entry.path}\``;
}

/* -------------------------------------------------------------------- render -- */

function render(rows) {
  const sorted = sortFindings(rows);
  const out = [];
  const w = (line = '') => out.push(line);

  w('<!-- GENERATED FILE — DO NOT EDIT BY HAND.');
  w('     Source: .planning/audit/findings.json');
  w('     Regenerate: node .planning/audit/tools/gen-foundation-audit.mjs');
  w('     `validate.mjs --check findings` asserts this document and the register agree. -->');
  w();
  w('# Foundation Audit — Finding Register');
  w();
  w('**Requirement:** AUDIT-20 · **Phase:** 01-read-only-foundation-audit · **Plan:** 01-13');
  w('**Generated from:** [`findings.json`](./findings.json) — the machine register is the source of truth; this document is a view of it and cannot drift from it.');
  w('**Severity policy:** [`SEVERITY_SLA.md`](./SEVERITY_SLA.md), written in Wave 1 before the first finding existed. Severity is exposure-adjusted; CVSS vectors are not assigned to application-logic findings.');
  w('**Reading order:** this register first, then the three threat models under [`security/`](./security/), then the inventories under [`inventory/`](./inventory/). The artifact index is [`README.md`](./README.md).');
  w();
  w('---');
  w();

  /* summary block */
  w('## Summary');
  w();
  w(`**${sorted.length} findings**, every one carrying a reproduction, a recommended fix and a validation criterion. A finding with no evidence is not in this register.`);
  w();
  w('### By severity');
  w();
  w('| Severity | Count | Must be fixed by |');
  w('|---|---:|---|');
  const slaDeadline = {
    Critical: 'First Stage 3 slice owning the layer. **None may be Open when Phase 5 starts.**',
    High: 'Before Phase 7 begins, or a dated risk acceptance with a reachability argument.',
    Medium: 'Within Stage 3, in the slice that touches the file.',
    Low: 'Opportunistically. No deadline.',
  };
  for (const [severity, count] of countBy(sorted, 'severity', SEVERITY_ORDER)) {
    w(`| ${severity} | ${count} | ${slaDeadline[severity] || '—'} |`);
  }
  w(`| **Total** | **${sorted.length}** | |`);
  w();
  w('### By category');
  w();
  w('| Category | Count |');
  w('|---|---:|');
  for (const [category, count] of countBy(sorted, 'category', CATEGORY_ORDER)) w(`| ${category} | ${count} |`);
  w(`| **Total** | **${sorted.length}** |`);
  w();
  w('### By status');
  w();
  w('| Status | Count |');
  w('|---|---:|');
  for (const [status, count] of countBy(sorted, 'status', STATUS_ORDER)) w(`| ${status} | ${count} |`);
  w();
  w('---');
  w();

  /* table of contents */
  w('## Contents');
  w();
  w('| Id | Severity | Category | Finding |');
  w('|---|---|---|---|');
  for (const row of sorted) {
    w(`| [${row.id}](#${slug(row.id)}) | ${row.severity} | ${row.category} | ${esc(row.title)} |`);
  }
  w();
  w('---');
  w();

  /* findings */
  w('## Findings');
  w();
  for (const row of sorted) {
    w(`### ${row.id} — ${esc(row.title)}`);
    w();
    w(`**Severity:** ${row.severity} · **Category:** ${row.category} · **Status:** ${row.status}` +
      (row.closes_in_phase ? ` · **Closes in phase:** ${row.closes_in_phase}` : ''));
    w();
    w(`**Exposure rationale.** ${row.severity_rationale}`);
    w();
    w('**Affected paths.**');
    w();
    for (const entry of row.affected_paths) w(`- ${pathCell(entry)}`);
    w();
    w(`**Evidence.** [\`${row.evidence}\`](./${row.evidence})`);
    w();
    w('**Reproduction.**');
    w();
    row.reproduction.forEach((step, index) => w(`${index + 1}. ${step}`));
    w();
    w(`**Recommended fix.** ${row.recommended_fix}`);
    w();
    w(`**Validation criterion.** ${row.validation_criterion}`);
    if (row.resolution) {
      w();
      w(`**Resolution.** ${row.resolution}`);
    }
    if (row.risk_acceptance) {
      const ra = row.risk_acceptance;
      w();
      w(`**Risk acceptance.** ${ra.owner}, signed ${ra.date}, expires ${ra.expiry}. ${ra.rationale}`);
    }
    if (Array.isArray(row.related) && row.related.length > 0) {
      w();
      w(`**Related.** ${row.related.map((id) => `[${id}](#${slug(id)})`).join(', ')}`);
    }
    w();
    w('---');
    w();
  }

  /* tempting one-liners */
  w('## Tempting One-Liners');
  w();
  w('Every fix below looked trivial while the audit was running and was **deliberately not applied**. This list is the written record that the baseline was preserved on purpose, and it is the first Stage 3 slice. A read-only audit that quietly fixed things would have no way to prove what the codebase actually looked like when it started.');
  w();
  w('| Finding | The one-liner, and why it was not applied |');
  w('|---|---|');
  for (const [id, reason] of TEMPTING_ONE_LINERS) w(`| [${id}](#${slug(id)}) | ${esc(reason)} |`);
  w();
  w('---');
  w();

  /* blocked index */
  w('## Blocked Items — what a later credentialed pass must close');
  w();
  w('A gap and an omission are different things. Each row below is a deliberate gap with a named blocking input and the exact command that closes it.');
  w();
  w('| Item | Blocking input | Retry command |');
  w('|---|---|---|');
  for (const [item, blocker, command] of BLOCKED_ITEMS) w(`| ${esc(item)} | ${esc(blocker)} | \`${esc(command)}\` |`);
  w();
  w('---');
  w();

  /* coverage */
  w('## Coverage Statement');
  w();
  w('This gate is a coverage argument, not a list. The question a reviewer should be able to answer is not "how many findings" but "what was looked at, and what was deliberately left".');
  w();
  w('### Examined');
  w();
  for (const line of COVERAGE_EXAMINED) w(`- ${line}`);
  w();
  w('### Deliberately not examined');
  w();
  for (const line of COVERAGE_NOT_EXAMINED) w(`- ${line}`);
  w();
  w('---');
  w();
  w('*Generated by `tools/gen-foundation-audit.mjs` from `findings.json`. Do not edit this file.*');
  w('*Phase: 01-read-only-foundation-audit · Plan: 01-13 · Requirement: AUDIT-20*');

  return `${out.join('\n')}\n`;
}

/* ---------------------------------------------------------------------- main -- */

function main() {
  const rows = JSON.parse(fs.readFileSync(FINDINGS, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('findings.json must be an array of finding records');

  const ids = new Set(rows.map((r) => r.id));
  const orphans = TEMPTING_ONE_LINERS.map(([id]) => id).filter((id) => !ids.has(id));
  if (orphans.length > 0) {
    console.error(`gen-foundation-audit: tempting-one-liner references unknown findings: ${orphans.join(', ')}`);
    process.exit(1);
  }
  if (ids.size !== rows.length) {
    console.error('gen-foundation-audit: duplicate finding ids in findings.json');
    process.exit(1);
  }

  const markdown = render(rows);
  const referenced = new Set(markdown.match(/\bF-\d{3}\b/g) || []);
  if (referenced.size !== rows.length) {
    console.error(`gen-foundation-audit: rendered ${referenced.size} distinct ids but the register holds ${rows.length}`);
    process.exit(1);
  }

  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
    if (current !== markdown) {
      console.error('gen-foundation-audit: FOUNDATION_AUDIT.md is stale — re-run without --check');
      process.exit(1);
    }
    console.log(`gen-foundation-audit: up to date (${rows.length} findings)`);
    return;
  }

  fs.writeFileSync(OUTPUT, markdown);
  console.log(`gen-foundation-audit: wrote ${path.relative(AUDIT_ROOT, OUTPUT)} — ${rows.length} findings, ${referenced.size} ids referenced`);
}

main();
