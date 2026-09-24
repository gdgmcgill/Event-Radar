---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 14
subsystem: auth
tags: [admin, requireRole, requireActiveUser, elevated-door, audit-log, pending-edits, endpoint-contract, F-001, FO-01, F-091, F-073, F-072, F-086, DI-48, DEC-45, DEC-46, DEC-53, DEC-55, DEC-58, REFAC-13]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-12: the admin arm table and the F-001/F-091/F-072/F-073/F-086 DEFECT pins. 05-13: 33 helper arms on the DEC-58 preamble, FIXED_ARMS and BAN_GUARDED_ARMS at 33. Floor: Jest 1298/1298, tag gate ok 34, ratchet committed 25 / live 22"
provides:
  - "calculate-popularity POST and GET open with createRequestContext(), requireActiveUser(ctx) and requireRole(ctx, \"admin\"), and run on getElevatedClient(). The machine-key gate and the inline service-key client are gone (F-001, FO-01)"
  - "PATCH /api/admin/users/[id]: roles are validated against the user_role enum (else 400), a change to your own roles is refused (403), admin is kept, the write goes through the door, and the change is audited (F-091, DEC-45)"
  - "logAdminAction writes through the door without admin_email, takes an optional requestId, and logs a rejected insert loudly (F-073, DEC-46). All 15 callsites pass requestId"
  - "Both moderation pages resolve the actor from users by id. The (supabase as any) cast and the shape assertion are gone from /moderation (F-072)"
  - "GET /api/events/[id] gives pending_edits to the creator and to admins (F-086, DEC-53)"
  - "REGISTRY rows for the popularity recompute, the admin role change and the audit-log writer"
  - "FIXED_ARMS and BAN_GUARDED_ARMS each hold all 35 arms, so DI-48 is closed on /api/admin/*"
  - "e2e/specs/admin-audit-row.spec.ts: one approval produces exactly one audit row, and Recent Activity names the actor"
  - "The endpoint contract names the seam as the admin mechanism, and calculate-popularity is admin-only in the contract"
affects: [05-15, 05-16, 05-17, 05-19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-query actor enrichment: read the audit rows, then users id, name, email .in(\"id\", distinct ids) on the cookie client. There is no PostgREST embed, because admin_user_id references auth.users"
    - "Role validation reads the generated Constants.public.Enums.user_role. No hand-copied list"
    - "Attach a gated column after the shared transform, in the one route that owns the visibility decision. List routes are unaffected"

key-files:
  created:
    - e2e/specs/admin-audit-row.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/admin-behaviours.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/audit-writer.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/contract-regen-slice-5.txt
  modified:
    - src/app/api/admin/calculate-popularity/route.ts
    - src/app/api/admin/users/[id]/route.ts
    - src/lib/audit.ts
    - 10 further logAdminAction caller files under src/app/api/admin/**
    - src/app/moderation/page.tsx
    - src/app/moderation/audit-log/page.tsx
    - src/app/api/events/[id]/route.ts
    - src/__tests__/api/admin/admin-guard-defect.test.ts
    - src/__tests__/api/admin/admin-users-patch-defect.test.ts
    - src/__tests__/moderation/audit-shape.test.ts
    - src/__tests__/api/events/pending-edits-defect.test.ts
    - src/server/db/elevated/REGISTRY.md
    - .planning/audit/tools/classify-inventory.mjs
    - .planning/audit/inventory/classification-rules.md
    - .planning/audit/inventory/endpoints.json
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md

key-decisions:
  - "calculate-popularity also runs requireActiveUser(ctx) before requireRole (DEC-58, as the orchestrator directed), so both ids joined BAN_GUARDED_ARMS as well as FIXED_ARMS. DI-48 now covers 35 of 35 arms"
  - "The detail route attaches pending_edits only when the row has a value. A creator or admin reading a row with no pending edits gets exactly the bytes they got before (no new null key), which keeps DEC-53's 'no seeded-visible change' literally true"
  - "Non-owners still have any pending_edits key removed, because the PRESERVE detail suite's layer (b) requires stripping even when a transform carries the column. The plan's 'leave the transformed event as it is' would have failed that suite"
  - "The audit-log page (a client component) resolves actors on the browser client, which carries the same cookie session. GET /api/admin/audit-log is unchanged: it selects *, and that is the table's seven real columns"
  - "A name-only admin edit is not audited. The plan scopes the audit row to a roles change"
  - "The eslint allow-list was not regenerated. DEC-49 does that once, in 05-15. The ratchet passes with committed=25 live=20"

patterns-established:
  - "An audited admin write: guard, validate, refuse self-targeting, write on the door, then logAdminAction with requestId: ctx.requestId"

requirements-completed: []  # REFAC-13 continues in 05-15 (service-role containment), 05-17 (admin rate limiting) and 05-19 (close)

# Metrics
duration: 16min
completed: 2026-09-24
---

# Phase 5 Plan 14: Admin behaviours, audit writer, pending edits, and the contract Summary

**The last fail-open admin route (calculate-popularity) now decides admin through the seam on both verbs and runs on the elevated door. Admin role changes now land: they are validated against the enum, refused on yourself, keep admin, and are audited. Every moderation action writes exactly one audit row through the door, and a rejected write is logged. Both moderation pages name the actor, read by id. Event creators and admins receive pending_edits. The endpoint contract names `requireRole(ctx, "admin")` and marks calculate-popularity admin-only.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-09-24T21:38Z
- **Completed:** 2026-09-24T21:54Z
- **Tasks:** 3 of 3 (4 commits, because Task 3 has a fix commit and a docs commit)
- **Files:** 4 created, 29 modified

## Accomplishments

- **calculate-popularity (F-001, FO-01).** Both verbs open with the DEC-58 preamble and use `getElevatedClient()`.
  - Deleted: the inline `createAdminClient()`, the `@supabase/supabase-js` import, both machine-key gates, and the rpc's two `as never` casts. The generated types carry `update_event_popularity`.
  - Anonymous callers get 401, non-admins 403, a banned admin 403 `Account suspended`. In each case the elevated client is never touched.
- **Admin role change (F-091, DEC-45).**
  - `roles` must be `user_role` enum members, else 400 `{"error":"Invalid role","field":"roles"}`.
  - A roles change on your own id gets 403 `{"error":"You cannot change your own roles"}`.
  - `admin` is no longer stripped. `user` is still added when absent.
  - `updateData` is `TablesUpdate<"users">`, and the write goes through the door.
  - One `logAdminAction({ action: "updated", targetType: "user", metadata: { roles } })` per successful roles change.
- **Audit writer (F-073, DEC-46).**
  - `logAdminAction` uses `getElevatedClient()`, has no `adminEmail`/`admin_email`, takes an optional `requestId`, and reads `{ error }`.
  - A rejected insert logs `console.error("[Audit] admin_audit_log insert rejected", { action, targetType, targetId, requestId, code, message })`. The function still resolves.
  - All 15 callsites in 11 files pass `requestId: ctx.requestId`.
- **Moderation pages (F-072).**
  - `/moderation` selects `id, admin_user_id, action, target_type, target_id, metadata, created_at` on the typed cookie client. The cast, the eslint-disable line, the `as Promise<…>` assertion and the local `AuditEntry` interface are deleted.
  - It then reads `users.select("id, name, email").in("id", …)`. The actor shows as the name, else the email's local part, else the first 8 characters of the id.
  - `/moderation/audit-log` does the same on the browser client after each page loads.
- **Pending edits (F-086, DEC-53).** The creator and admins get the row's `pending_edits` after the unchanged transform. Everyone else gets the event without the key. `transformEventFromDB` is not touched.
- **Ledger sets.** Both calculate-popularity ids are in `FIXED_ARMS` and `BAN_GUARDED_ARMS`. A new subset test pins all 35 arms in both. DI-48's status reads 35 of 35.
- **REGISTRY.** Three rows: the popularity recompute, the admin role change, and the audit-log writer. The 04-03 "note, not a row" section about `audit.ts` is replaced by one sentence pointing at the row.
- **Contract (DEC-55).**
  - `VIA_ADMIN` now names `requireRole(ctx, "admin")`, and calculate-popularity's verdict is `admin`. `classification-rules.md` mirrors both.
  - The regeneration changed 26 rows, all in the admin family (listed field by field in `contract-regen-slice-5.txt`).
  - `--check endpoints` passes 5/5. `--quick` reads 118/2/1, the same as the floor.
- **e2e.** `admin-audit-row.spec.ts` creates a pending fixture event with the local service client. The admin approves it (200), and `admin_audit_log` goes from 0 to exactly 1 row (`approved`, `IDS.admin`). Recent Activity shows the fixture title on the "Seed Admin" line. `afterAll` removes the audit rows, notifications and event, and asserts 0 for each.

## Task Commits

1. **Task 1: calculate-popularity fails closed; admin role changes land (F-001, F-091)**: `4cf4928` (fix)
2. **Task 2: audit writer through the door; moderation pages read actors by id (F-073, F-072)**: `d510914` (fix)
3. **Task 3a: pending_edits for creator and admins (F-086)**: `b689b3b` (fix)
4. **Task 3b: endpoint contract regenerated (DEC-55)**: `c3cdc93` (docs)

Every fix commit body carries its INTENTIONAL BEHAVIOUR CHANGE list.

## Floor after this plan

| Gate | Before (05-13) | After |
|---|---|---|
| `npx jest --ci` | 1298 passed, 70 suites | 1301 passed, 0 failed, 70 suites (+1 all-35 subset test, +2 audit-shape rows) |
| `node scripts/check-characterization-tags.mjs --all` | ok 34 | ok 34 |
| `node scripts/check-elevated-ratchet.mjs` | committed 25 / live 22 | committed 25 / live 20, PASS (calculate-popularity and `src/lib/audit.ts` left the census) |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors, 19 warnings | 0 errors, 18 warnings (the moderation page's unused disable went with the cast) |
| Playwright after a clean reset and seed | 17/17 | 31/31: admin-audit-row, admin-guard, admin-moderation-queue, admin-login-cookie-equivalence, event-read-path, plus setup. Residue 0; port 3000 free |
| `validate.mjs --check endpoints` | pass | 5/5 pass |

## Decisions Made

See `key-decisions` in the frontmatter. The two that depart from the plan's text:
- **Keeping the non-owner strip.** This was required by the PRESERVE suite.
- **Adding `requireActiveUser`.** This was required by DEC-58 and the orchestrator's note.

## Deviations from Plan

### Rule-resolved choices

**1. calculate-popularity also runs `requireActiveUser(ctx)`** (DEC-58; orchestrator note).
- The plan text shows only `requireRole`.
- Both arm ids joined `BAN_GUARDED_ARMS` as well as `FIXED_ARMS`, so the banned-admin D4 rows moved in the same commit.

**2. F-086 keeps a strip branch for non-owners.**
- The plan says to "leave the transformed event as it is". The detail PRESERVE suite's layer (b) feeds a transform that carries `pending_edits` and requires non-owners to lose it.
- So non-owners get the event with the key removed. The creator and admins get the row's value when one exists.
- `events-detail-characterization.test.ts` passes unedited (`git diff f349ee9` is empty).

**3. `pending_edits` is attached only when non-null.** A creator or admin reading a row without edits gets the same bytes as before. This keeps DEC-53's "no seeded-visible change" exact rather than adding a `null` key.

**4. The audit-log page's actor read runs on the browser client.**
- The page is a client component fed by `GET /api/admin/audit-log`, and that file is not in this plan's list.
- The browser client carries the same cookie session, and the admin read policy permits the read.
- The API's `select("*")` already returns only the table's real columns, so it is unchanged.

**5. The F-086 protocol evidence is in `admin-behaviours.txt` §7–§11.** The plan names no evidence file for it.

**6. The plan's "ledger protocol" for the admin-guard DEFECT file adds one test.** A subset test pins all 35 arms in both sets. It does not edit the existing 33-arm subset test.

### Auto-fixed Issues

**1. [Rule 1 - Bug, my own draft] The route docblock named the machine-key variable**
- **Found during:** Task 1 acceptance.
- **Issue:** The `ADMIN_API_KEY`-absent check exited 1 because the new docblock sentence named the variable.
- **Fix:** Reworded it to "machine-key gate". This was comment-only. The evidence records both runs.
- **Commit:** `4cf4928`

**2. [Rule 1 - Bug] `created_at` is nullable in the generated Row**
- **Found during:** Task 2. Removing the cast on the dashboard's audit read exposed it.
- **Issue:** `formatTimeAgo(entry.created_at)` did not type-check, because `string | null` is not assignable to `string`.
- **Fix:** Render the timestamp only when present. The column defaults to `now()`, so real rows always carry it.
- **Commit:** `d510914`

## Deferred items found (for 05-19 to register or note)

- **Stale mechanism text.** `api.moderation.reviews.targetType.targetId`'s verdict in `classify-inventory.mjs` still reads "inline roles check on the service client … not verifyAdmin()". 05-13 moved that route to the request context. It is outside this plan's allowed contract set.
- **Stale audit-time signals.** `endpoints.json` signals for calculate-popularity (`env_vars_referenced` includes `ADMIN_API_KEY`, `env_gated_auth: true`) are audit-time. Only `gen-endpoint-inventory.mjs` refreshes signals, and no plan here runs it.
- **findings.json.** F-001, F-091, F-072, F-073 and F-086 `status`/`resolution` are left for the slice-close plan (DEC-57). This plan does not edit `findings.json`.
- **Carried from 05-13, unchanged here:**
  - `CLAUDE.md:67` and `.claude/CLAUDE.md:327` still describe `verifyAdmin()`.
  - `adminArmTable.ts` line 8 still names `src/lib/admin.ts`.
  - The two admin layouts and the moderation reviews admin path read the role only.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or schema change. The threat register's mitigations were applied:
- **T-05-14-01:** requireRole on both verbs. The D3 rows assert anonymous 401 and student 403 with no elevated call. The gate is gone.
- **T-05-14-02:** A change to your own roles gets 403 and an invalid role gets 400. Both are pinned.
- **T-05-14-03:** The door writer drops the absent column and logs rejections. The e2e spec shows exactly one row per action.
- **T-05-14-04:** pending_edits reaches only the creator and admins. E3/E4 and PRESERVE are green.
- **T-05-14-05:** The fixture is removed in `afterAll`. Residue is 0, recorded after both runs.

## Issues Encountered

None beyond the deviations above.

## Next Phase Readiness

- 05-15 can start. The stack is reset and seeded with no fixture residue, and port 3000 is free.
- The ratchet reads committed 25 / live 20, ready for 05-15's single regeneration (DEC-49).
- The tree is clean apart from the three untracked files that must stay untracked.

## Self-Check: PASSED

- FOUND: e2e/specs/admin-audit-row.spec.ts, evidence/admin-behaviours.txt, evidence/audit-writer.txt, evidence/contract-regen-slice-5.txt
- FOUND: commits 4cf4928, d510914, b689b3b, c3cdc93
- Jest 1301/1301, tsc exit 0, lint exit 0 (0 errors), tag gate ok 34, ratchet PASS, Playwright 31/31, `validate.mjs --check endpoints` 5/5

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
