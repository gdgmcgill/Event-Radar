# Slice 5 close-out: admin containment, service role, rate limiting, CSRF

**Plan:** 05-19 · **Phase:** 05 · **Recorded:** 2026-09-25 · **Measured on:** `8c0cf58` (code identical to `941bee7`, the last code-bearing slice-5 commit), slice-4 head `9903671` · **Author:** executor, local stack only

Slice 5 covered the admin surface and everything that leaves the request's own identity. The order was: characterization (05-12: the 35-arm admin table, the F-061/F-001/F-091/F-005/F-086/F-090 pins, DI-48's banned-admin rows), the admin guard (05-13: `requireRole` at 33 arms, `src/lib/admin.ts` deleted), the admin behaviours (05-14: calculate-popularity, role changes, the audit writer, pending edits, the contract), service-role containment and F-005 (05-15), the F-006/F-007 migration (05-16), the rate-limit store interface, admin budgets and the CSRF origin check (05-17), the Upstash store (05-18), and this close (05-19). Every claim below cites a command output in an evidence file or a commit.

**The DI-25 bump was not taken.** 05-19's worktree proof found four admin payloads that still fail `tsc` on `@supabase/supabase-js` 2.116.0 (`evidence/di-25-bump.txt`). By the plan's stop rule no dependency moved, so the slice's last code-bearing commit is 05-18's `941bee7`. DI-25 is PARTIAL, carried as DI-53.

## 1. Floor, slice 4 after and phase after

Source: `evidence/floor.slice-4-after.txt` (head `9903671`) and `evidence/floor.phase-after.txt` (line 1 `head=8c0cf58…`). The commands are the same; rows 23-25 are new.

| # | Command | Slice 4 after | Phase after | Verdict |
|---|---------|---------------|-------------|---------|
| 1 | `npx jest --ci` | 1135 passed; 65 suites | 1438 passed / 0 failed / 1 skipped; 76 suites (1 skipped) | at or above; the one skipped test is the Upstash live-store contract |
| 2 | `npm run lint` | 0 errors, 19 warnings | 0 errors, 18 warnings | at or above |
| 3 | `npx tsc --noEmit` | exit 0 | exit 0 | equal |
| 4 | `npm audit --audit-level=high --omit=dev` | 0 high, 0 critical, 2 moderate | the same | equal |
| 5 | `node scripts/check-elevated-ratchet.mjs` | committed=25 live=22 | committed=2 live=2 delta=0 | the two cron routes only (05-15) |
| 6 | `node scripts/check-migration-filenames.mjs` | 5 parse | 6 parse | +1, the F-006/F-007 migration |
| 7 | `node scripts/check-characterization-tags.mjs --all` | ok 29 | ok 34 | at or above |
| 8 | `validate.mjs --quick` | 118 / 2 failed / 1 skipped | the same | equal; the by-design snapshot FAILs |
| 8b | `validate.mjs --check endpoints` | 5 passed | 5 passed | equal |
| 8c | types drift (`supabase gen types … \| diff -u`) | empty | empty | no drift |
| 8d | CI-env `npm run build` | — | exit 0 | builds with CI's env |
| 9 | `supabase db reset --local` | 5 migrations | 6 migrations | rebuilds from zero |
| 10 | pgTAP, unseeded | Files=7 Tests=116 PASS | **Files=9 Tests=156 PASS** | +050 (23), +055 (17) |
| 11 | seed load | 10 personas, 5 clubs, 6 memberships, 5 events, 2 rsvps, 0 saved | identical | equal (DEC-54) |
| 12 | pgTAP, seeded | Files=7 Tests=116 PASS | **Files=9 Tests=156 PASS** | as row 10 |
| 13 | `npx playwright test` | 76 passed, 0 failed | **91 passed, 0 failed**, first run | at or above |
| 14 | env non-null assertions | 0 | 0 | held |
| 15 | `getSession(` | 1 (api/health:160) | the same one | unchanged, as required |
| 16 | `verifyAdmin` | 34 lines | **0** | driven to 0 (`b8e172e`) |
| 17 | `checkBanStatus` | 0 | 0 | held |
| 18 | `from("club_members")` | 24 | 24 | held |
| 19 | `(supabase as any)` | 3 lines, 1 code site | 3 lines, **0 code sites** | driven to 0 (`d510914`) |
| 20 | `requireClubRole(` call sites | 18 | 18 | held |
| 21 | gate-site `club_members` reads | 0 of 10 | 0 of 10 | held |
| 23 | service-module value imports | — | 3: the door and the two cron routes | the one registered door (plus Phase 6's two) |
| 24 | `requireRole(ctx, "admin")` | 0 | 35 lines in 26 files | every admin arm |
| 25 | F-067 lint probe | — | 1 error, exit 1; probe removed | the service-key rule bites |

The stack was left reset and seeded (block 22). Port 3000 was free before the Playwright run, after it, and at the end.

## 2. Playwright, before and after

| Run | File | Count | Exit |
|-----|------|-------|------|
| Slice 4 after (full) | `evidence/playwright.slice-4-after.txt` Part 2 | 76 passed | 0 |
| 05-12 targeted (admin-guard, csrf-origin, clean reset) | `evidence/slice-5-characterization.txt` Part 3 | 17 passed | 0 |
| 05-15 full, first run | `evidence/allowlist-shrink.txt` | 90 passed, 1 failed (the privacy spec's literal-404 assertion, rewritten to the measured soft 404) | 1 |
| 05-15, 05-16, 05-17, 05-18 full runs, each from a fresh reset | `evidence/allowlist-shrink.txt`, `evidence/schema-push-slice-5.txt` (row 19), `evidence/csrf.txt` (row 8), `evidence/upstash-install.txt` | 91 passed each | 0 |
| **Phase after (full suite, clean reset, head `8c0cf58`)** | `evidence/playwright.phase-after.txt` | **91 passed, 0 failed** | **0** |

91 = 76 + 15 slice-5 tests: `admin-guard.spec.ts` (3), `csrf-origin.spec.ts` (4), `admin-audit-row.spec.ts` (2), `admin-write-paths.spec.ts` (5) and `public-profile-privacy.spec.ts` (1). It was the first run with no retry. `git diff --stat 9903671 941bee7 -- e2e playwright.config.ts` lists those five new specs and the harness guard in `playwright.config.ts` (05-18, the blanked store variables), so the twelve earlier specs passed unedited.

## 3. Validated-workflow re-confirmation, after slice 5

Slice 5's production footprint is `git diff --name-only 9903671 941bee7 -- src supabase/migrations` with tests excluded:

- 25 admin route files under `src/app/api/admin/` plus `recommendations/analytics` and `recommendations/batch` (the admin guard); `admin/calculate-popularity`
- the non-admin service-role sites: `clubs`, `clubs/[id]/appeal`, `events/[id]/appeal`, `events/[id]` (pending edits), `moderation/reviews/[targetType]/[targetId]`, `profile/avatar`, `profile/banner`, `users/[id]`, `users/me/suggestions`
- pages and layouts: `src/app/admin/layout.tsx`, `src/app/moderation/layout.tsx`, `src/app/moderation/page.tsx`, `src/app/moderation/audit-log/page.tsx`, `src/app/users/[id]/page.tsx`
- `src/proxy.ts`, `src/instrumentation.ts`, `src/lib/env.ts`, `src/lib/audit.ts`, `src/middlewareRateLimit.ts`, `src/server/context.ts` (comment), `src/server/csrf.ts`, `src/server/ratelimit/*`, `src/server/db/elevated/REGISTRY.md`; `src/lib/admin.ts` deleted
- `supabase/migrations/20260923130000_users_grants_audit_log_insert.sql`

Unlike slices 3 and 4, slice 5 changed five page or layout files. Each change is an admin-decision swap with the same redirects (the layouts, `b8e172e`), an actor read by id (the moderation pages, `d510914`), or F-005's gate (`4d3073b`). § 5 lists what a user can see.

All 16 PROJECT.md Validated bullets (`grep -c '^- ✓' .planning/PROJECT.md` = 16) are listed below. Every named test is green in the phase-after runs (`evidence/floor.phase-after.txt` block 1, `evidence/playwright.phase-after.txt`).

| # | Validated workflow (PROJECT.md) | Touched by slice 5? | Re-confirmed after slice 5 by |
|---|-------------------------------|---------------------|-------------------------------|
| 1 | Sign in with Google OAuth; non-McGill emails rejected | Only the proxy prologue (rate limit, then the CSRF check, before session work). The callback is absent from the diff | **Every persona signs in:** `e2e/auth.setup.ts`, 10 of 10 in the phase-after run. **Non-McGill rejected:** `src/app/auth/callback/route.test.ts` test 4, unedited, in Jest 1438. `src/proxy.test.ts` and `src/proxy-characterization.test.ts` unedited |
| 2 | Anonymous visitors browse public event and club content | Only the private-profile gate on `/users/[id]` (F-005) | `e2e/specs/anonymous-browse.spec.ts` (3); `e2e/specs/event-read-path.spec.ts` (12); `e2e/specs/public-profile-privacy.spec.ts` (a public profile still renders to an anonymous reader) |
| 3 | Onboarding interest tags; guard on unfinished onboarding | Only `users/[id]` PATCH moved to the cookie client (the wizard's self-update), inside the F-006 grant | `e2e/specs/ban-and-onboarding-ring.spec.ts` 'can still make the wizard's self-update' and 'can still complete onboarding'; the redirect and direct-POST 403 rows; `e2e/specs/protected-route-redirect.spec.ts` (2); 050's allow rows (`onboarding_completed` under the grant) |
| 4 | Browse, search, filter events by tag, date, time of day | Only `events/[id]` GET's `pending_edits` attachment (F-086) | `src/__tests__/api/events/events-list-characterization.test.ts` and `src/__tests__/api/events/events-detail-characterization.test.ts` pass unedited; `e2e/specs/event-read-path.spec.ts` (12) |
| 5 | Save/unsave events and RSVP | The CSRF check and the saved-count trigger (now SECURITY DEFINER, 05-16) | `e2e/specs/save-and-rsvp.spec.ts` (3), unedited, through a real same-origin browser; `e2e/specs/csrf-origin.spec.ts` PRESERVE rows (own Origin and no headers accepted); 050 rows 20-23 (the counter still moves under the grant) |
| 6 | Personalized recommendations with popularity fallback (F-041 caveat) | `recommendations/batch` POST (admin guard; non-admins now 403) and `recommendations/analytics` (admin guard) | `src/lib/__tests__/recommendations.test.ts`, `src/lib/diversity.test.ts`; the batch row in `src/__tests__/api/admin/admin-guard-characterization.test.ts` (admin admitted) |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs (F-016 caveat) | `clubs` POST moved to the cookie client; `clubs/[id]/appeal` split | **Organizers reach their club surfaces:** `e2e/specs/club-owner-surfaces.spec.ts` (3), unedited. `e2e/specs/club-authorization.spec.ts` (19, including FIXED F-087) and `e2e/specs/club-invitation-acceptance.spec.ts` (4), unedited; `src/__tests__/api/service-role-routing.test.ts` pins the `clubs` POST and appeal routing. DI-49 and DI-50 stand |
| 8 | Organizer events auto-approved; others moderated | No: `events/create` is absent from the diff | club-gates PRESERVE P6 rows, unedited; 060 tests 7-14; `e2e/specs/admin-moderation-queue.spec.ts` (3) |
| 9 | Follow/unfollow clubs; public club pages | No | `e2e/specs/anonymous-browse.spec.ts` public club content; the follow rows of `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts`, unedited |
| 10 | Organizer event-level and club-level analytics | No (the admin analytics routes are an admin surface, row 12) | `e2e/specs/club-authorization.spec.ts` owner and organizer analytics rows; `src/__tests__/api/events/analytics.test.ts`, `src/__tests__/api/clubs/analytics.test.ts` |
| 11 | Attendees review past events; aggregate feedback | Only the moderation reviews route's admin decision (context) and its author-name read (door) | `src/__tests__/api/events/reviews.test.ts`; `src/__tests__/api/service-role-routing.test.ts` (the reviews routing) |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log (F-007 caveat) | **Yes, this is slice 5's workflow.** Every admin arm, the audit writer, both moderation pages, the ban route and the F-007 revoke | **Admins approve:** `e2e/specs/admin-moderation-queue.spec.ts` (3) and `e2e/specs/admin-write-paths.spec.ts` 'approving a pending club' and 'approving an organizer request'. **Ban and unban:** `admin-write-paths.spec.ts` 'banning with suspend_content' and 'unbanning'. **Reports:** 'resolving a report' (the per-report PATCH). **Audit log:** `e2e/specs/admin-audit-row.spec.ts`, one approval writes exactly one row and Recent Activity names the actor; 055 proves only the service role writes it. **Guard:** `e2e/specs/admin-guard.spec.ts`. **Banned users still blocked:** `e2e/specs/banned-redirect.spec.ts` (3) and the `ban-and-onboarding-ring.spec.ts` banned rows. **Caveat, pre-existing:** the reports *list* (`GET /api/admin/reports`) answers 500 on every call, so the reports queue is empty (F-092, Phase 6). The F-007 caveat now reads "fixed locally, production with DI-23" |
| 13 | In-app notifications and email reminders (F-038 caveat) | The admin notification inserts moved to the door ("notify another user", 05-15); cron is absent from the diff | `e2e/specs/admin-write-paths.spec.ts` asserts the approval and ban notifications on the real stack; `src/__tests__/api/service-role-routing.test.ts`. Email reminders (cron) still have no automated test, before or after |
| 14 | Instagram scraper pipeline, classify and ingest with dedup | No | `src/lib/classifier.test.ts` |
| 15 | A/B experiment framework (F-017 caveat) | The admin experiments routes (guard only) | `src/lib/experiments.test.ts`; the experiments rows of `src/__tests__/api/admin/admin-guard-characterization.test.ts` |
| 16 | Interaction tracking feeds popularity and interaction signals | The popularity recompute (calculate-popularity) is admin-only and runs on the door | The calculate-popularity rows of `src/__tests__/api/admin/admin-guard-defect.test.ts` (admin admitted, others refused); the write-handler P1/P5 rows, unedited. No e2e test covers the signal pipeline |

Row 13's email half and row 16's signal pipeline still have no end-to-end test, as at every earlier close. Row 12 gained the most coverage in the phase and carries one pre-existing broken sub-path (F-092), stated rather than absorbed.

## 4. Findings

**Closed (status set to `Fixed` in `.planning/audit/findings.json` by this plan, each with a resolution):**

- **F-001** (Critical): calculate-popularity fails closed; no service-key read in the route (`4cf4928`; D3 rows; `evidence/floor.phase-after.txt` block 25).
- **F-005** (High): private profiles give an anonymous reader the not-found response; no email is read (`4d3073b`). The response is Next's streamed soft 404 (HTTP 200 with noindex), the same as a missing profile. The resolution states that reading; a literal 404 is DI-56.
- **F-061** (Medium): anonymous 401 and non-admin 403 at all 35 arms (`90819ee`, `9f0e5b5`).
- **F-067** (Low): the service-key lint rule is green after F-001's inline client was removed, and it bites (block 25).
- **F-073** (High): one approval writes exactly one audit row; a rejected insert is logged (`d510914`).
- **F-086** (Low): the creator and admins receive `pending_edits` (`b689b3b`).
- **F-090** (Low): the CSRF origin check (`f245d58`), with the assessment.
- **F-091** (Medium): admin role changes land, are validated, keep admin and are audited (`4cf4928`).

**Kept Open, with the unmet clause named:**

- **F-072** (Medium): the code is fixed (`d510914`) and two of three criterion clauses are met. The pgTAP clause is not: no pgTAP file selects the columns the pages request. Re-pointed to `"07"`.
- **F-006** and **F-007** (Critical): fixed and proven locally (§ 6). `closes_in_phase: "08"`.
- **F-058** (Medium): the `/api/admin/*` 429 clause is delivered (`408064d`; `src/server/ratelimit/policy.test.ts`). The wrapper and correlation halves are Phase 6.
- **F-040** (High): the `ADMIN_API_KEY` reader is deleted (05-14), after `ADMIN_EMAILS` (05-05). `CRON_SECRET` remains, Phase 6.

**Registered:** **F-092** (Medium, Phase 6): `GET /api/admin/reports` answers 500 on every call (PGRST200 on the reporter embed). The evidence is `.planning/audit/quality/phase-05-close-defects.md`.

`node .planning/audit/tools/validate.mjs --check findings` passes 8 of 8 and exits 0 after the edits. `FOUNDATION_AUDIT.md` was regenerated with `gen-foundation-audit.mjs`: 92 findings and 92 ids referenced. Open went from 65 to 58 and Fixed from 26 to 34.

**Deferred items registered at this close** (`evidence/deferred-items.md`, "Slice 5 (05-12..05-18) and the phase close"): DI-52 (the overstated legacy-401 set, closed as a correction), DI-53 (DI-25's four remaining sites), DI-54 (`users` DELETE/TRUNCATE grants and the inert insert policy), DI-55 (layouts and the moderation reviews admin path decide by role only), DI-56 (the soft 404), DI-57 (the duplicated title suffix), DI-58 (stale generated contract text), DI-59 (stale prose and line references), and DI-46 extended (the CLAUDE.md facts the phase changed). The next id is DI-60.

## 5. INTENTIONAL BEHAVIOUR CHANGEs shipped in slice 5

| Commit | Change | Pinned by |
|--------|--------|-----------|
| `90819ee`, `9f0e5b5` (05-13) | Anonymous callers at the admin arms get 401 `Unauthorized` instead of 403 (F-061). A non-admin at `recommendations/batch` POST gets 403 instead of 401. That is the only route whose non-admin answer moved; `admin/clubs` GET and `admin/organizer-requests` GET already answered 403 (DI-52). A banned admin is refused by the handler with 403 `Account suspended`, and a signed-in caller with no profile row gets 403 `Profile not found` there. The proxy already sent both of those bytes on `/api/*` (DEC-58) | `admin-guard-defect.test.ts` D1, D2, D4; `admin-guard.spec.ts` |
| `b8e172e` (05-13) | The layouts and the moderation reviews route decide admin through the request context. No wire bytes or redirects change | the admin specs, unedited |
| `4cf4928` (05-14) | calculate-popularity: anonymous 401, non-admin 403, banned admin 403 on both verbs. Before, every caller was admitted when `ADMIN_API_KEY` was unset (F-001). The `/moderation/users` role toggle starts working, `admin` is no longer stripped, a roles change on your own id gets 403, and an unknown role gets 400 (F-091) | D3; `admin-users-patch-defect.test.ts` |
| `d510914` (05-14) | Moderation actions are recorded in `admin_audit_log` again, where every insert had been silently rejected. A rejected insert is logged. Recent Activity populates and names the actor (F-073, F-072). On seeded data the panel is still empty until an action is taken | `audit-shape.test.ts`; `admin-audit-row.spec.ts` |
| `b689b3b` (05-14) | The creator and admins receive `pending_edits` from the detail route (F-086). No seeded row carries pending edits | `pending-edits-defect.test.ts` |
| `4d3073b` (05-15) | An anonymous visitor to a private profile gets the not-found response. The profile page never reads the owner's email. `generateMetadata` for a missing profile calls `notFound()` instead of returning a title (F-005) | `public-profile-defect.test.tsx`; `public-profile-privacy.spec.ts` |
| `d7c2036` (05-16) | **Local only until DI-23.** A user can no longer set their own roles or clear their own ban through PostgREST, and only the service role can write the audit log (F-006, F-007) | 050, 055 |
| `408064d` (05-17) | `/api/admin/*` is rate limited at 600 GET and 120 mutation requests per IP, per path, per minute. The client address prefers `x-real-ip` (F-058's clause, DEC-50) | `policy.test.ts`, `memoryStore.test.ts` |
| `f245d58` (05-17) | A cross-site state-changing `/api/*` request gets 403 `Cross-site request blocked` (F-090, DEC-52) | `csrf.test.ts`; `csrf-origin.spec.ts` |
| `941bee7` (05-18) | Rate limiting counts in Upstash when a store is configured. Production without a store logs one error and serves from the memory store. `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` makes a missing store a boot failure, and a malformed flag also refuses to start (DEC-50 as amended by DEC-59) | `upstashStore.test.ts`, `env.test.ts`, `instrumentation.test.ts`; boot probes in `evidence/upstash-install.txt` |

`26cbb2a` and `f99cf6d` (05-15, the service-role split) changed which client performs each operation and carry no behaviour change. `src/__tests__/api/service-role-routing.test.ts` and `admin-write-paths.spec.ts` pin that.

## 6. Local-only closures, pending DI-23

Nothing in slice 5 wrote to production. No push subcommand was run, no linked-project flag was used, and `.env.local` was not read.

- **F-006** (Critical): fixed and proven locally by `d7c2036`. pgTAP 050 was red on the old schema and is green unseeded and seeded. The mutation check and four manual grant mutations are in `evidence/schema-push-slice-5.txt`. In production, a student can still set their own roles until the repair applies `20260923130000_users_grants_audit_log_insert.sql`.
- **F-007** (Critical): fixed and proven locally by `d7c2036` (pgTAP 055). The service-role write path is proven by `admin-audit-row.spec.ts`. In production, anyone can still insert audit rows until the repair.
- F-008 and F-016 are slice 4's (`evidence/slice-4-close.md` § 6) and are unchanged here.

## 7. Slice 5's requirements

REFAC-13, REFAC-17 and REFAC-18 are measured clause by clause in `evidence/PHASE-5-COMPLETION.md` § 2, against the evidence above. In summary:

- **REFAC-13 is PARTIAL.** The two cron routes still fail open and still import the service module directly. REFAC-14 (Phase 6) owns both.
- **REFAC-17 is Complete.**
- **REFAC-18 is PARTIAL.** "So it works across serverless instances" is unproven until a store is provisioned (DI-42).

The slice-5 floor is green, and the phase closes on it.
