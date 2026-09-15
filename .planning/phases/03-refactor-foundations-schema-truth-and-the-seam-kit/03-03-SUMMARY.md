---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
plan: 03
subsystem: server-seam-and-import-boundary
status: complete
tags: [refac-05, seam, authz, eslint-boundary, ratchet, zero-routes]
requirements: [REFAC-05]
dependency_graph:
  requires: []
  provides:
    - "src/server/ seam kit — per-request context, http/error vocabulary, three fail-closed authz guards, the single elevated door"
    - "Build-time import boundary at error severity, files-scoped to src/app/**, with a generated shrink-only ratchet"
    - "scripts/check-elevated-ratchet.mjs — the shrink-only assertion"
    - "The authoritative service-client callsite census (24) as the phase's zero-routes tripwire"
  affects:
    - "Phases 4-6 refactor routes into this seam, deleting one allow-list entry and adding one REGISTRY.md row per migration"
tech_stack:
  added: []
  patterns:
    - "Discriminated guard results ({ ok, user } | { ok, response }) rather than thrown responses"
    - "Generated shrink-only ESLint allow-list with escaped glob brackets"
    - "Zero-dependency node:-only tooling invoked by path, never declared in package.json"
key_files:
  created:
    - src/server/context.ts
    - src/server/http.ts
    - src/server/errors.ts
    - src/server/authz/requireUser.ts
    - src/server/authz/requireRole.ts
    - src/server/authz/requireClubRole.ts
    - src/server/db/elevated/index.ts
    - src/server/db/elevated/REGISTRY.md
    - src/server/__tests__/context.test.ts
    - src/server/__tests__/http.test.ts
    - src/server/__tests__/errors.test.ts
    - src/server/__tests__/requireUser.test.ts
    - src/server/__tests__/requireRole.test.ts
    - src/server/__tests__/requireClubRole.test.ts
    - src/server/__tests__/elevated.test.ts
    - eslint.elevated-allowlist.mjs
    - scripts/check-elevated-ratchet.mjs
  modified:
    - eslint.config.mjs
decisions:
  - "D-05 upheld: the boundary ships at error severity WITH a generated escaped-bracket ratchet; the seam touches zero routes; the census is unmoved at 24"
  - "D-09 upheld: requireClubRole takes a required-role SET, reports the actual role, and has no admin bypass — it reads club_members and no other table"
  - "The live census (24) is authoritative over the research's recorded 23, because it is reproducible"
  - "The render-pass alias resolves React's cache by capability — React 18.3.1 ships it in neither build"
  - "The generated allow-list header carries no timestamp, so the file regenerates byte-for-byte"
metrics:
  duration: ~20 min
  completed: 2026-09-15
  tasks: 3
  commits: 4
  files_created: 17
  files_modified: 1
  tests_added: 46
---

# Phase 3 Plan 03: The `src/server/` Seam Kit and the Import Boundary — Summary

A seam that every later phase will refactor into, proven by 46 unit tests that assert denial rather than the happy path, plus a build-time boundary observed rejecting a new service-role import and accepting the tree without it — applied to exactly zero routes.

## What was built

**The seam (`src/server/`, seven modules).** `createRequestContext()` is `src/lib/admin.ts` widened: it awaits the *existing* server factory rather than becoming a fourth Supabase client, reads the revalidating user accessor, and widens the profile read from `roles` alone to the five columns the ban check, onboarding guard and role guards collectively need. `http.ts` and `errors.ts` emit the status vocabulary already in the tree — nothing invented, because a seam that changes the wire format is a behaviour change wearing a refactor's clothes. The three guards return a discriminated result instead of throwing, so an adopting handler keeps its control flow.

**The boundary.** `no-restricted-imports` at `error` severity, `files`-scoped to `src/app/**`, `patterns` only, shipped with a generated allow-list of the 24 pre-existing callsites that may only shrink.

**The ratchet checker.** `scripts/check-elevated-ratchet.mjs` re-derives the census and fails when the live set holds an entry the committed list does not.

## Evidence

| Gate | Result |
| --- | --- |
| Seam unit suites | **7 suites, 46 tests, exit 0** |
| `npx tsc --noEmit` | **exit 0**, no output |
| `npm run lint` | **0 errors, 19 warnings** — byte-for-byte the pre-existing floor |
| Boundary fixture RED | **exit 1**, 2 × `no-restricted-imports` |
| Boundary fixture GREEN | **exit 0** after deletion; fixture absent from output |
| `check-elevated-ratchet.mjs` | **exit 0**, `committed=24 live=24 delta=0` |
| Ratchet rejects a new violation | **exit 1**, names the entry |
| Ratchet accepts a shrink | **exit 0**, names the retired entry |
| Full suite | **324 passing, 5 skipped** (criterion ≥285 / 5) |
| `git diff --name-only -- src/app/` | **empty** |
| Census | **24 at plan start, 24 at plan end** |

## Deviations from Plan

### 1. [Rule 1 — plan premise falsified by the tree] The render-pass alias cannot be built on React's `cache`

- **Found during:** Task 1, writing `src/server/context.ts`
- **Issue:** The plan and research § Pattern 3 specify the memoized alias be built on React's `cache`. React is pinned to `^18.3.0`, and **18.3.1 exports `cache` from neither build** — verified in `index.js` and in `react.shared-subset.js` (the `react-server` condition). `@types/react` 18.3 declares it only in `canary.d.ts`, which this project does not reference. A static import would fail `tsc` *and* be `undefined` at runtime. Next's authentication guide, which research cited, assumes React 19/canary; React 19 is explicitly out of scope for this program.
- **Fix:** `getRequestContext` resolves `cache` **by capability** and falls back to the un-memoized function — correct behaviour, merely an extra read per call. Explicitly **not** a module-level cache, which would be process-scoped rather than request-scoped and would leak one user's profile into another user's response. A test pins the fallback so it cannot silently drift into that.
- **Files:** `src/server/context.ts`, `src/server/__tests__/context.test.ts`
- **Commit:** `6c17988`

### 2. [Rule 3 — environment] Jest discovers zero tests inside the worktree

- **Found during:** Task 1, first test run
- **Issue:** `jest.config.js` carries `testPathIgnorePatterns: ['/node_modules/', '/.claude/', …]`, and this plan executed in a worktree at `.claude/worktrees/agent-<id>/`. The **absolute** path contains `/.claude/`, so all **886 files across both projects** are filtered — including the 20 suites that pre-date this plan. The plan's canonical command reports `No tests found, exiting with code 1`.
- **Fix:** Overrode that one config value **on the CLI**, restoring the other ignores verbatim. `jest.config.js` was **not** edited (a phase-locked constraint) and is unmodified. `evidence/seam-unit-tests.txt` records both the canonical command and the one actually run, with the reason. In the main checkout the canonical command runs unmodified.
- **Note:** running both projects under one override also wipes the node project's `src/hooks/` ignore, which routes a DOM-dependent suite into the node environment. The full suite was therefore run **per project**; both are green.

### 3. [Rule 1] Two plan acceptance commands are themselves defective

- **`patterns`-only check:** the plan's command `JSON.stringify()`s the *whole* flat config and throws `Converting circular structure to JSON` on `eslint-config-next`'s self-referencing plugin objects. Replaced with an equivalent that serializes only the rule's own option object; it additionally asserts the rule ships at `error`. Result: `patterns-only ok (2 no-restricted-imports blocks: 1 error + ratchet off)`.
- **`grep -rl "@/lib/supabase/service" src/server/` check:** initially tripped on `REGISTRY.md`, whose "Adding a row" instructions *told readers not to import that specifier*. Reworded to name the module without reproducing the literal. No importer ever existed outside the elevated module.

### 4. [Rule 2] Census and companion-rule figures re-measured, not inherited

- Research records **23** service-client callsites; the live tree returns **24**, at plan start and plan end. Both figures are recorded in `evidence/elevated-callsite-census.txt` with the live one stated as authoritative *because it is reproducible*. Research's dependent figures survive: 13 of them are dynamic routes.
- Research estimated "two" legitimate `NEXT_PUBLIC_*` reads under `src/app/**`; the live count is **12 across 5 files**. This strengthens rather than weakens the decision not to ship the companion `no-restricted-properties` rule, and the note records the measured number.

### 5. [Rule 2] The allow-list header lost its timestamp so the file is byte-reproducible

The generated file is now reproduced exactly by `node scripts/check-elevated-ratchet.mjs --write`, verified idempotent. The dated measurement lives in the census evidence, where a dated measurement belongs. The 24 entries were unchanged by the regeneration — which is itself the proof that the script reproduces the documented `grep | sed` pipeline.

## Notable Findings

**The ratchet's failure direction is asymmetric, and both directions matter.** A *higher* census means a new file reached the credential. A *lower* one means a route was migrated early, which this phase forbids. The checker fails on the first and reports the second; the note records why two independent zero-routes checks exist rather than one.

**`requireClubRole` cannot be bypassed for a structural reason, not a policy one.** It reads `club_members` and no other table, so it never learns anything else about the caller. A test asserts `from()` is called exactly once and never with `"users"` — which is a stronger guarantee than the absence of an `isAdmin` branch, because it would survive someone adding one by accident.

## Known Stubs

None. `src/server/db/elevated/REGISTRY.md` ships with an empty table **by design**, with the reason stated in the file: an empty register with a stated reason is a control, an absent one is an omission. Phases 4-6 add rows. This is not a stub — nothing is wired to a placeholder and no UI renders empty data.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change was introduced; the seam is reachable from zero routes. `T-03-03-05`'s stated residual (dynamic import; bare service-key env read) is documented in `evidence/seam-kit-note.md` as the plan required, not discovered late.

## Self-Check: PASSED

- All 10 source artifacts verified present on disk; all 5 evidence files present.
- All 4 commits verified in `git log`: `3ed868a`, `6c17988`, `f3322bc`, `444744b`.
- All `must_haves.artifacts` exceed their `min_lines`: context 108/40, requireClubRole 74/35, elevated/index 34/20, allow-list 58/20, ratchet script 174/25, REGISTRY 40/20.
- Prohibitions verified: zero files under `src/app/` changed; no fourth client factory; no session-only accessor anywhere in `src/server/` (0 occurrences); no admin branch in `requireClubRole` (0 matches); `patterns` only; brackets escaped; rule at `error` with no inline disables (0); `package.json`, `package-lock.json`, `jest.config.js`, `supabase/` and `.github/` all untouched.
- Per parallel-execution rules, `STATE.md` and `ROADMAP.md` were **not** modified; the orchestrator owns those writes.
