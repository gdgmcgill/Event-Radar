---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 10
subsystem: api-contracts
status: complete
tags: [zod, contracts, parseBody, parseWith, readQuery, census-gate, admin, moderation, DI-53, DI-64, F-094, DEC-65, DEC-66, DEC-80, REFAC-15]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-04: parseWith/parseBody/parseQuery, common.ts, the census gate; 06-07: the slice-7 400 table (PRESERVE) and the F-094 malformed-input DEFECT suite; 06-08: readQuery and the split-contract pattern; 06-09: the adoption precedent and its ledger practice"
provides:
  - "src/contracts/admin.ts: AdminClubDecisionBody, ModerationReason, EventStatusBody, EventEditsDecisionBody, AdminEventCreateBody, AdminEventUpdateBody + AdminEventPutBody, ExperimentCreateBody, ExperimentUpdateBody, FeaturedCreateBody, FeaturedUpdateBody, OrganizerRequestDecisionBody, ReportDecisionBody, BanBody, AdminUserUpdateBody, AdminUserNameBody; AdminEventsQuery, AdminClubsQuery, OrganizerRequestsQuery, ReportsQuery, AuditLogQuery, OrganizersQuery, CalculatePopularityQuery; ReviewTargetParams; z.input/z.infer types"
  - "CanonicalId in src/contracts/common.ts (lower-cases a UUID-shaped string, passes any other string through, never a 400)"
  - "The four DI-53 payloads typed TablesUpdate<> from contracts; tsc on @supabase/supabase-js 2.116.0 exits 0 with 0 errors (throwaway worktree)"
  - "scripts/contracts-allowlist.json is []: node scripts/check-contracts.mjs prints committed=0 live=0"
  - "22 F-094 rows moved in malformed-input-defect.test.ts (RAW_SITES and RJO_SITES now empty), one row added to badRequestTable.ts, 24 ledger rows; evidence/contracts-admin.txt"
affects: [06-11, 06-13, 06-14, 06-18]
tech-stack:
  added: []
  patterns:
    - "A moderation decision parses to a discriminated union (approved | rejected/suspended with a checked category and message), so the handler's destructured `status` narrows `category` and `message` with no cast"
    - "A body whose audit row names every key sent is parsed as a record piped into { sent, updates }, so the audit keeps Object.keys(body) while the write gets only the contract's fields"
    - "An optional key that must still yield a default when absent is `.optional().transform(...)`; a key that must stay absent when not sent is `.transform(...).optional()` (zod 4.6.5)"
    - "A route id compared with the caller's id goes through CanonicalId once, and the caller's id through it too, before the self-check"
key-files:
  created:
    - src/contracts/admin.ts
    - src/contracts/__tests__/admin.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/contracts-admin.txt
  modified:
    - src/contracts/common.ts
    - src/app/api/admin/clubs/[id]/route.ts
    - src/app/api/admin/clubs/route.ts
    - src/app/api/admin/events/route.ts
    - src/app/api/admin/events/[id]/route.ts
    - src/app/api/admin/events/[id]/edits/route.ts
    - src/app/api/admin/events/[id]/status/route.ts
    - src/app/api/admin/experiments/route.ts
    - src/app/api/admin/experiments/[id]/route.ts
    - src/app/api/admin/featured/route.ts
    - src/app/api/admin/featured/[id]/route.ts
    - src/app/api/admin/organizer-requests/route.ts
    - src/app/api/admin/organizer-requests/[id]/route.ts
    - src/app/api/admin/reports/route.ts
    - src/app/api/admin/reports/[id]/route.ts
    - src/app/api/admin/users/[id]/route.ts
    - src/app/api/admin/users/[id]/ban/route.ts
    - src/app/api/admin/audit-log/route.ts
    - src/app/api/admin/organizers/route.ts
    - src/app/api/admin/calculate-popularity/route.ts
    - src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
    - src/__tests__/contracts/malformed-input-defect.test.ts
    - src/__tests__/contracts/badRequestTable.ts
    - scripts/contracts-allowlist.json
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "Where a guard or a database rule sits between two input checks, the contract is split, as 06-08 did for RSVP. admin/events/[id]/status parses EventStatusBody, then applies the transition guard (404, 409), then parses ModerationReason. admin/users/[id] parses AdminUserUpdateBody (roles), then applies the own-roles 403, then parses AdminUserNameBody."
  - "PRESERVE P0 counts every route file that calls parseBody( as able to answer a 400. admin/events/[id] PUT gained its first 400s (F-094), so one row was ADDED to badRequestTable.ts: 'admin event PUT: title not a string' answers 400 'title must be a string', measured on the adopted handler. The test file is unedited and no row was removed. The row has its own ledger entry."
  - "CanonicalId canonicalizes the whole route id in ban POST and admin/users PATCH, not only the compare. The self-check, the lookup, the write and the audit target_id all use the lower-case id, and the caller's id also goes through CanonicalId. A non-UUID id passes through unchanged, so no route gains a 400."
  - "The featured PATCH payload is TablesUpdate<\"featured_events\">, and it goes to the audit metadata as-is. It type-checks as Json with no conversion, because TablesUpdate is an object-literal type alias and so has an implicit index signature. The plan allowed one narrow cast; none was needed."
  - "AdminEventPutBody returns { sent, updates }. updates is AdminEventUpdateBody (the ten fields, each typed as its events column, only when sent). sent is every key of the body, so the audit row's fields_updated stays Object.keys(body)."
metrics:
  duration: "22min"
  completed: "2026-09-27"
  tasks: 2
  files: 29
---

# Phase 6 Plan 10: Admin and Moderation on Zod Contracts; the Contracts Census at Zero Summary

**Every handler in the tree now reads its input through a zod contract, and `node scripts/check-contracts.mjs` prints `committed=0 live=0` over an empty allow-list.**
- The admin family validates through `src/contracts/admin.ts`. Its four DI-53 update payloads are `TablesUpdate<>` values built from contracts, and `tsc` on `@supabase/supabase-js` 2.116.0 now exits 0 with no errors.
- The ban and role-change self-checks compare canonical ids, so an admin's own id in upper case is refused like the lower-case form.

## What was done

**Task 1: admin body contracts, the DI-53 retypes, canonical ids** (`f869323`)
- **RED:** `admin.test.ts` could not load `@/contracts/admin`. With the contracts written, only the two route-level upper-case own-id rows stayed red. On the pre-fix routes, the ban answered 404 and the role change 500, because the string compare let the upper-case id through to the lookup.
- **Contracts:** each carries today's texts in today's order. `field` appears only on admin/users/[id] (`roles`, `name`).
  - `ModerationReason` checks "requires category and message" before the category. It looks up categories as own keys and returns a discriminated union.
  - `AdminClubDecisionBody` is the status stage piped into `ModerationReason`.
- **The four DI-53 sites:**
  - The edits route builds `liveUpdates: TablesUpdate<"events">`, assigning `title` and `image_url` by name.
  - events/[id] PUT spreads the contract output plus `updated_at` into a `TablesUpdate<"events">`.
  - experiments/[id] PATCH builds a `TablesUpdate<"experiments">`; its status is the table's check-constraint enum.
  - featured/[id] PATCH uses `FeaturedUpdateBody` output as a `TablesUpdate<"featured_events">`, which is also the audit metadata.
- **DI-64:** `CanonicalId` is added to `common.ts`. ban POST and admin/users PATCH compare `CanonicalId(route id)` with `CanonicalId(caller id)`.
- **Ledger protocol** on `malformed-input-defect.test.ts`:
  - Step 1: green on the pre-fix tree, 73 tests.
  - Step 2: red on 22 (D0 ×2, D1 ×6, D2 ×6, D3 ×8).
  - Step 3: moved, 73 green.
  - Step 4: the 13 pre-fix route files swapped in gave red on 23. `cmp` exit 0 for all 13 after the restore.
  - Step 5: the PRESERVE suites stayed unedited and green.
- 24 ledger rows were added: 23 moves and 1 table-row addition. Each cites F-094, and their hash was filled in by the next commit.
- The allow-list lost 13 entries (13 sites), taking the census to 20/20.

**Task 2: admin and moderation query contracts, the census at zero, the 2.116.0 signal** (`edb5eef`)
- **RED:** 24 query rows failed. **GREEN:** 133 tests in `admin.test.ts`.
- Seven list-query schemas keep each handler's defaults and coercions, NaN included, and are read through `readQuery`. None of these routes answered a 400 for its query, and none does now (T-06-10-04).
  - `parseInt` is called with no radix where the handler omitted it: reports and audit-log.
  - `??` is kept apart from `||`: organizers keeps an empty status; clubs, organizer-requests and events fall back on one.
- moderation/reviews parses its route params through `ReviewTargetParams` with `parseWith`. The 400 is still `Invalid target type`, and targetId is used as sent.
- No `searchParams.get/getAll/has`, raw JSON read, multipart read or `readJsonObject(` is left in any route file. The only exception is auth/callback's four exempt OAuth params.
- `scripts/contracts-allowlist.json` is now `[]`: 7 entries (20 sites) retired, and the census reads `committed=0 live=0`.
- **Early DEC-80 signal**, run in a detached worktree of `f869323` with Task 2's diff applied (evidence § 7):
  - tsc on 2.81.1 exit 0; tsc on 2.116.0 **exit 0, 0 errors**.
  - Jest on 2.116.0: 116 suites and 2877 tests passed.
  - The worktree was force-removed; `git worktree list` shows one line.
  - In the main tree, `package.json` and `package-lock.json` are byte-identical (`git diff --exit-code` exit 0), and `node_modules` is still on 2.81.1.
- **Playwright**, the six specs from a fresh `supabase db reset --local` and seed: **32 passed**, exit 0. Port 3000 was free before and after.

## Floor after this plan

| Check | Result |
|---|---|
| `npx jest --ci` | 116 suites passed + 1 skipped; 2877 tests passed + 1 skipped; exit 0 (+1 suite, +134 tests on 06-09) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 18 warnings (the pre-existing set, same 13 files; none in a touched file) |
| `node scripts/check-contracts.mjs` | `committed=0 live=0 delta=0`, "the allow-list is empty and the live census is empty", exit 0 |
| `node scripts/check-elevated-ratchet.mjs` | `committed=0 live=0`, exit 0 |
| `node scripts/check-characterization-tags.mjs --all` | ok 54 files |
| PRESERVE diff | `bad-request-characterization.test.ts` and `src/__tests__/api/admin/` unedited (empty diff against HEAD~2 and aa04365); `badRequestTable.ts` +1 row |
| tsc on supabase-js 2.116.0 (throwaway worktree) | exit 0, 0 errors |
| Playwright (admin-guard, admin-write-paths, admin-moderation-queue, admin-audit-row, event-moderation-notifications, async-edge) | 32 passed, fresh reset and seed |

Each task's `<verify>` command was run verbatim and exited 0 (evidence § 4 and § 9).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] One row added to the PRESERVE table for admin/events/[id] PUT**
- **Found during:** Task 1.
- **Issue:** The unedited P0 check in `bad-request-characterization.test.ts` counts any route file calling `parseBody(` as able to answer a 400. admin/events/[id] PUT answered no 400 before this plan, so it had no row, and P0 went red once the route adopted its contract.
- **Why not `readQuery`:** 06-08 avoided `parseQuery(` with `readQuery`, but that trick does not fit here. This route really can answer 400 now (F-094).
- **Fix:** Added the row `admin event PUT: title not a string` → 400 `{"error":"title must be a string"}` to `badRequestTable.ts`, measured on the adopted handler. This is an addition, not a move: the PRESERVE test file is unedited and no row was removed. It has a ledger row.
- **Files modified:** `src/__tests__/contracts/badRequestTable.ts` (not in the plan's `files_modified`).
- **Commit:** `f869323`

**2. [Rule 1 - Bug] zod 4 refused an absent key under a `z.custom` that accepts undefined**
- **Found during:** Task 1 GREEN.
- **Issue:** `AdminEventCreateBody`'s description and location, and `FeaturedCreateBody`'s sponsor_name, answered "expected nonoptional" when absent. zod 4.6.5 refuses an absent key unless the schema is optional.
- **Fix:** `.optional()` before the transform, so an absent key still yields `""` or `null`, as the handler stored it. The featured PATCH keeps `.transform().optional()`, so an absent key stays absent. There is a row for each case.

### Plan text against measurement
- **F-094 moves:** 22 DEFECT rows plus the table addition, with 24 ledger rows in all.
  - D0 ×3: RAW_SITES 6 → 0, RJO_SITES 7 → 0, adopted files 18 → 31.
  - D1 ×6, D2 ×6.
  - D3 ×8: the six raw sites, admin/clubs/[id] and admin/events/[id]/status.
  - Five D3 rows keep their outcome, now from the contract: the edits action, the organizer-request and report status, the ban reason and the admin user name.
- **Allow-list:** 20 entries and 33 sites were retired. Task 1 retired 13 entries (13 sites: 6 R1, 7 R4); Task 2 retired 7 (20 R3 sites). No entry outside `src/app/api/admin/` was left.
- **Adoption count:** 22 route files: 13 in Task 1, and 9 in Task 2, counting moderation/reviews, which had no census site.
- **The featured audit metadata** needs no cast (see the decisions).
- **The upper-case rows** live in `admin.test.ts` and drive the real handlers through `badRequestTable.ts`'s `run()`. No existing test pinned the DI-64 behaviour, so there was no pin to move.
- **The 2.116.0 worktree** was made from HEAD `f869323`, with the uncommitted Task 2 diff applied, so it checked exactly what `edb5eef` holds.

### INTENTIONAL BEHAVIOUR CHANGES (F-094 and DI-64; listed in the Task 1 commit body and documented in `src/contracts/admin.ts`)
**Malformed bodies at the six raw sites** (experiments POST and [id] PATCH, featured POST and [id] PATCH, events POST and [id] PUT):
- A body that is not JSON answers 400 `Invalid JSON body`. It used to be a rejected promise (an HTML 500) at four sites, and the route's 500 at the two featured sites.
- An array answers 400 `Request body must be a JSON object`. It used to be the first "missing" 400, or a 200 that wrote only `updated_at`.

**Wrongly typed values that now answer a 400.** Where a text already existed, it is kept:
- admin/events POST, a non-string title: `title, start_date, and end_date are required` (sanitizeText had coerced it to "5").
- experiments POST, a non-string name: `name is required`.
- admin/clubs/[id] PATCH and admin/events/[id]/status PATCH, a non-string rejection or suspension message: `Rejection requires category and message` or `Suspension requires category and message`. `.trim()` used to throw with no try.

**New texts, where none existed before:**
- admin/events POST: `description must be a string`, `location must be a string`.
- admin/events/[id] PUT:
  - `title must be a string`, `start_date must be a string`, `end_date must be a string` and `status must be a string`. A null title, start_date, end_date or status also answers these; before, it reached a NOT NULL column.
  - `description must be a string or null`, `location must be a string or null`, `organizer must be a string or null`, `image_url must be a string or null`, `category must be a string or null`.
  - `tags must be an array of strings or null`.
- experiments/[id] PATCH: `Invalid status` (anything outside draft, running, paused or completed; the check constraint used to answer a 500), `description must be a string or null`, `end_date must be a string or null`.
- featured POST and PATCH: `sponsor_name must be a string`.
- featured PATCH: `priority must be an integer` (a string or fractional priority), `starts_at must be a string`, `ends_at must be a string`.

**Moderation categories.** A category that is an inherited name (`toString`) or not a string (for example `["other"]`, which `in` used to accept) is now `Invalid rejection category` or `Invalid suspension category`.

**DI-64.** An admin who sends their own id in another case to the ban or role-change route is refused: 400 `Cannot ban your own account` or 403 `You cannot change your own roles`. On Postgres such an id used to match the admin's own row. Those two routes also use the lower-case id for the lookup, the write and the audit `target_id`.

Task 2 changed no behaviour: every list query keeps its coercions (the 06-07 P2 rows pass unedited), and the moderation 400 keeps its bytes.

## Issues

- None blocking.
- The Supabase CLI prints an update notice (v2.118.0 available, v2.115.0 installed). It is recorded in the evidence and was not acted on.
- The scratchpad held stale files from earlier plans with the same names. This plan wrote its own under a `p10-` prefix. One early run overwrote an old `t1-red.txt` before being renamed to `p10-t1-red.txt`; nothing in the repo refers to the old file.

## Observations for later plans

- **06-18 (DEC-80):** the formal throwaway-worktree proof should find what this plan found, tsc 0 errors on 2.116.0. DI-53 can be dispositioned as cleared by `f869323`.
- **06-11 (client typing):** `src/contracts/admin.ts` imports `sanitize-html` (through `sanitizeText`) and `@/lib/supabase/types` (`Constants`). Client code may prefer the `z.input` types: `AdminClubDecisionBodyInput`, `EventStatusBodyInput`, `FeaturedUpdateBodyInput`, `BanBodyInput` and the others.
- **06-13 and 06-14 (route wrapper):** the moderation reviews route no longer carries a `status: 400` literal. It answers through `parseWith`, so the PRESERVE P0 no longer counts it. Its row in `badRequestTable.ts` still runs and passes.
- **Not in scope, noticed:** admin/events POST checks start_date and end_date for presence only (a number passes and reaches the insert), as the handler did. No finding covers this; it is recorded here for the slice-7 close.

## Requirements

REFAC-15 is **not** marked complete by this plan.
- Its handler criterion holds by census: `committed=0 live=0`, and the allow-list is empty.
- The plan says it "finishes REFAC-15's every handler". 06-11 lists only REFAC-16, and 06-18 also lists REFAC-15.
- So marking REFAC-15 complete is left to the orchestrator or to 06-18's close-out certification.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-06-10-01:** `CanonicalId` runs before the self-check, and the upper-case rows are refused (`admin.test.ts`).
- **T-06-10-02:** the payloads are `TablesUpdate<>` values built from contracts, and the edits route copies only `title` and `image_url`, by name.
- **T-06-10-03:** the allow-list is empty and the census reads `committed=0 live=0`.
- **T-06-10-04:** no list query gained a 400 (they use `readQuery`), and the six specs pass.

## Self-Check: PASSED

- FOUND: `src/contracts/admin.ts` (588 lines), `src/contracts/__tests__/admin.test.ts` (697 lines), `src/contracts/common.ts` (`CanonicalId`), `scripts/contracts-allowlist.json` (`[]`), `evidence/contracts-admin.txt` (412 lines).
- FOUND: commits `f869323` and `edb5eef`. Neither deletes a file.
- Acceptance greps:
  - `grep -c 'TablesUpdate<'` returns 1 in each of the four DI-53 files.
  - `CanonicalId` appears in both the ban and the users/[id] route.
  - There are 24 ledger rows for 06-10, all citing F-094 and carrying `f869323`.
- `git worktree list` shows one line. `git diff --exit-code -- package.json package-lock.json` exits 0.
