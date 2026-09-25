---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
fixed_at: 2026-09-25T20:52:00Z
review_path: .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/05-REVIEW.md
iteration: 3
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
cumulative:
  iteration_1: { in_scope: 12, fixed: 11, skipped: 1 }
  iteration_3: { in_scope: 8, fixed: 8, skipped: 0 }
  info_carried: 26
---

# Phase 5: Code Review Fix Report (iterations 1–3)

**Fixed at:** 2026-09-25T20:52:00Z (iteration 3); 2026-09-25T19:58:00Z (iteration 1)
**Source review:** `05-REVIEW.md` (the iteration-2 re-review: 0 critical, 8 warnings, 26 info). The iteration-1 review was CR-01, CR-02, WR-01..WR-10 and 15 info.
**Iteration:** 3 (final)
**Scope:** critical_warning. Iteration 3 covers WR-01..WR-08 of the re-review (new numbering). Info findings are out of scope; each is listed below as carried, with a proposed DI owner.

## How the iterations fit together

| Iteration | What ran | Result |
|---|---|---|
| 1 | Fixer on the first review (CR-01, CR-02, WR-01..WR-10) | 11 fixed, 1 skipped (WR-04 → DI-61) |
| 2 | Re-review of the iteration-1 fixes (`05-REVIEW.md`) | All iteration-1 fixes confirmed except partials; 8 new warnings, 26 info, 0 critical |
| 3 | Fixer on the re-review's 8 warnings (this run) | 8 fixed, 0 skipped |

**Run notes (iteration 3):**
- **Main tree, not a worktree.** The run worked in the main tree, as iteration 1 did. Project memory records `use_worktrees=false` for this repo: worktrees lack `.env`, `node_modules` and `playwright/.auth/`, and there is one Docker stack on port 3000. No recovery sentinel was written, and none exists.
- **Commits.** Every commit stages explicit paths. `.agents/`, `docs/product-master-plan.md` and `skills-lock.json` stay untracked. `.env` and `.env.local` were not touched. Nothing ran against production: no `db push`, no `--linked`.
- **Red/green.** Every fix went through a red/green check. The new or moved rows fail against the pre-fix source, which was temporarily restored with `git show HEAD:<file>`. They pass with the fix. The fixed source was then restored and shown byte-identical with `cmp`.
- **PRESERVE suites.** None was edited. No wire response pinned by a PRESERVE suite changed, so no DEFECT move or `*-defect.test.ts` was needed. One routing suite that is not a characterization suite (`service-role-routing.test.ts`) had two call lists updated for WR-07. That change is recorded in `evidence/defect-ledger.md`.

---

## Iteration 3 — fixed issues

| ID | Title | Status | Commit(s) | Wire change |
|---|---|---|---|---|
| WR-01 | Transfer self-check bypass with a non-canonical UUID; the promotion's row count is unchecked | fixed: requires human verification | `86ec29f` | Edge cases: 400 / 409 instead of 200 plus an ownerless club (INTENTIONAL BEHAVIOUR CHANGE) |
| WR-02 | The trigger's appeal arm does not require `appeal_count` to rise | fixed: requires human verification | `0d81d2b` | Database: an uncounted direct REST reset → 42501 (INTENTIONAL BEHAVIOUR CHANGE) |
| WR-03 | The invite notification batch fails whole on one duplicate | fixed | `771ee64` | None |
| WR-04 | The invite route has no event-visibility gate | fixed: requires human verification | `5626997` | 404 `Event not found` for an event that is not approved and live (INTENTIONAL BEHAVIOUR CHANGE) |
| WR-05 | A repeat follow re-notifies | fixed: requires human verification | `9956dd5` | None |
| WR-06 | The club-follower fanout is fire-and-forget on serverless | fixed | `04eb39d`, `e4dc098` (docblock follow-up) | None |
| WR-07 | The approval notification upsert fails with 42P10; re-rejection and re-suspension are deduplicated away | fixed: requires human verification | `86fd2a2` | None |
| WR-08 | Ban route: a `null` body gets an HTML 500 | fixed | `7c68c7d` | 400 JSON for a non-object body (INTENTIONAL BEHAVIOUR CHANGE, malformed input only) |

Evidence commit: `de346ae` (verification, iteration-3 section).

### WR-01: Transfer self-check bypass; unchecked promotion

**Files modified:** `src/app/api/clubs/[id]/transfer/route.ts`, `src/__tests__/api/review05/club-transfer.test.ts`
**Commit:** `86ec29f`
**Applied fix:**
- **Self-check.** The target lookup now selects `user_id`, and the route refuses with 400 `You already own this club` when that stored id, lower-cased, equals the caller's. Postgres's uuid cast had matched an upper-case, braced or unhyphenated spelling of the caller's own id. The cheap string check is kept first.
- **Promotion.** The promotion is now `UPDATE … RETURNING id` and must change exactly one row. When it changes none, the route answers 409 `Member changed concurrently. Please refresh and try again.` (the members/role wording) and never demotes the caller. Nothing has been written at that point, so there is nothing to roll back.

**Deviation from the review's snippet.** The promotion's filter stays `[eq id]`. It does not add `.eq("club_id").neq("role","owner")`, for two reasons:
- The id comes from a club-scoped read, so the extra filters add nothing for the ownerless-club bug.
- The D5 pin in `club-owner-writes-defect` stays unmoved.

A target that is already a co-owner still transfers, as before.

**Tests:** 3 new rows. The promotion fixtures now answer with the changed row. The suite was red on the 2 WR-01 rows before the fix. D5 and `club-gates-characterization` were not edited.

### WR-02: The appeal reset must raise `appeal_count` by exactly one

**Files modified:** `supabase/migrations/20260925130000_events_guard_appeal_increment.sql` (new), `supabase/tests/database/066-events-appeal-increment.test.sql` (new), `evidence/review-fix-iter3-wr02-schema.txt` (new)
**Commit:** `0d81d2b`
**Applied fix:** This is a fix-forward migration; `20260925120000_*` is not edited. It uses `CREATE OR REPLACE` on `events_guard_moderated_update()`, keeping the same body and adding one rule: when `v_is_appeal`, `NEW.appeal_count` must equal `OLD.appeal_count + 1`, else 42501. The function stays `SECURITY INVOKER` with `search_path = ''`, and the REVOKEs are restated. The optional "no content change inside the appeal" rule was not added: a rejected event is not `approved`, so its creator can already edit it through PATCH before appealing.

**pgTAP 066** has 12 rows covering both directions:
- **Refused:** the uncounted reset from `rejected`, the same reset with a content rewrite, the uncounted reset from `suspended`, and a reset that adds 2.
- **Allowed:** the appeal route's exact write (`+1`, filtered on the old status), from both states.
- **Admin:** exempt.
- **Integrity reads** confirm that refused writes changed nothing.

065 was not edited.

**The `[BLOCKING]` schema task**, in `evidence/review-fix-iter3-wr02-schema.txt`:

| Command | Exit | Result |
|---|---|---|
| `supabase test db --local` (066 present, migration not yet applied: red) | 1 | 066 failed 9/12, only WR-02 rows; the other 10 files passed |
| `supabase --version` | 0 | 2.115.0 |
| `supabase db reset --local` | 0 | applies `20260925130000` |
| `supabase gen types typescript --local --schema public > src/lib/supabase/types.ts` | 0 | |
| `git diff --exit-code --stat src/lib/supabase/types.ts` | 0 | no change, nothing to commit |
| `supabase test db --local` (unseeded) | 0 | Files=11, Tests=200, PASS |
| `npx tsx scripts/seed/load.ts` | 0 | |
| `supabase test db --local` (seeded) | 0 | Files=11, Tests=200, PASS |

**The real appeal route still works.** `e2e/specs/event-moderation-notifications.spec.ts` (added with WR-07) sends the seeded creator's `POST /api/events/<id>/appeal` through the production build. The event then reads `{status: "pending", appeal_count: 1}`.

### WR-03: One duplicate no longer drops the invite notification batch

**Files modified:** `src/app/api/events/[id]/invite/route.ts`, `src/__tests__/api/review05/notifications-door.test.ts`
**Commit:** `771ee64`
**Applied fix:** Each newly invited friend's notification is its own insert on the elevated door, run with `Promise.all`.
- **A 23505** means that invitee already holds the `event_invite` notification: from a second inviter, or from a re-invite after they deleted the invite. It counts as already notified and is not logged.
- **Any other per-row error** is logged with its row position.

PostgREST's `on_conflict` cannot name the partial index, so `ON CONFLICT DO NOTHING` is not available from the client.

**Tests:** 2 new rows, and 2 rows reshaped to one insert per invitee. All 4 were red before the fix.

### WR-04: Invites require a live, approved event

**Files modified:** `src/app/api/events/[id]/invite/route.ts`, `src/__tests__/api/review05/notifications-door.test.ts`
**Commit:** `5626997`
**Applied fix:** The event read is now `.eq("status","approved").is("deleted_at", null).maybeSingle()`, and it runs before any invite row is written. When no row matches, the route answers 404 `{"error":"Event not found"}`. `InviteFriendsModal` already treats a non-OK answer as not sent.

**Tests:** 2 new rows (the read's filters, and the 404 path with no writes). Both were red before the fix.

### WR-05: A repeat follow notifies nobody

**Files modified:** `src/app/api/users/[id]/follow/route.ts`, `src/__tests__/api/review05/notifications-door.test.ts`
**Commit:** `9956dd5`
**Applied fix:** The upsert now chains `.select("id")`, since `ON CONFLICT DO NOTHING RETURNING` yields a row only for a new follow. `user_follows` SELECT is open ("Anyone can view follows"), so the returned row is readable. A repeat follow answers the same 201 `{following: true, isFriend}` and skips the name reads and the notification.

**Tests:** 2 new rows, both red before the fix. The three existing follow rows now answer the upsert with the new row. A candidate row that tried to check the chained `.select()` was dropped: the fake does not record it, so the row passed against the pre-fix code too and proved nothing.

### WR-06: The fanout is scheduled with `after()`

**Files modified:** `src/server/afterResponse.ts` (new), `src/app/api/events/create/route.ts`, `src/__tests__/api/review05/fanout-after.test.ts` (new)
**Commits:** `04eb39d`; `e4dc098` (docblock follow-up; see below)
**Applied fix:** `runAfterResponse(task)` hands the task to `after()` from `next/server`. The signature was checked in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`: it runs after the response, within the route's max duration, and is allowed in Route Handlers. How the helper handles errors:
- A rejected task is logged, never thrown into the handler.
- Only Next's `E468` ("called outside a request scope") makes it fall back to the old detached run. That error only occurs when a unit test calls a handler directly.
- Any other error from `after()` is rethrown.

**Why a helper rather than a bare `after(fanout)`.** A bare call made `club-gates-characterization` (PRESERVE) answer 500 in the 4 cases where a member creates an approved club event, because the E468 was thrown inside the handler's `try`. With the helper, that suite passes unedited.

**Tests:** 5 rows: the helper's 4 arms, plus the route answering 201 with no follower read and no insert until the scheduled task runs. The route row was red before the fix.

**Follow-up `e4dc098`.** The new suite's docblock named another suite by its file name, next to that suite's tag word. The tag checker therefore discovered it as a PRESERVE characterization suite (35 files instead of 34). The docblock was reworded, with no assertion changes, and the checker is back to 34 files.

### WR-07: Admin event decisions write one creator notification per type

**Files modified:** `src/app/api/admin/events/[id]/status/route.ts`, `src/__tests__/api/review05/admin-event-notification.test.ts` (new), `src/__tests__/api/service-role-routing.test.ts` (two call lists), `e2e/specs/event-moderation-notifications.spec.ts` (new), `evidence/review-fix-iter3-wr07-e2e.txt` (new), `evidence/defect-ledger.md` (one row)
**Commit:** `86fd2a2`
**Applied fix:** A route-local `notifyEventCreator()` reads the existing `(user_id, event_id, type)` row on the elevated door:
- If a row exists, it is updated: new title and message, `read: false`, re-dated. That is what the upsert meant to do.
- If none exists, one row is inserted.
- Both the read error and the write error are logged.

All three arms use it, so a re-rejection or re-suspension after an appeal also refreshes the row instead of failing with 23505. The club arm (`admin/clubs/[id]`) was checked. Its `onConflict` upsert targets `club_members`, a real constraint, and its notifications have no `event_id`, so they are outside the partial index. It is not affected.

**Tests:**
- **Jest:** 6 rows, red 5/6 before the fix. The first-suspension row was already a plain insert.
- **Routing suite:** `service-role-routing` now lists `notifications.select`, `notifications.insert` where it listed `notifications.upsert` or `notifications.insert`. Every call is still on the door, and the change is recorded in the ledger.
- **e2e on the production build, green 6/6:**
  1. an approval writes exactly one `event_approved` row;
  2. a suspension writes one `event_suspended` row;
  3. a second approval refreshes the one approved row back to unread;
  4. a second suspension refreshes its row with the new reason;
  5. the real appeal route passes the WR-02 guard;
  6. the rejection after it writes one `event_rejected` row.

  Against the pre-fix route, the spec fails its first test with 0 approval rows. That is the real-stack reproduction of the 42P10.

**Commit-message correction.** The commit body says "908" tests under `src/__tests__/api`. The run just before it reported **913**.

### WR-08: The ban route reads its body with `readJsonObject()`

**Files modified:** `src/app/api/admin/users/[id]/ban/route.ts`, `src/__tests__/api/review05/json-body.test.ts` (new ban arm, 5 cases)
**Commit:** `7c68c7d`
**Applied fix:** Responses by body:

| Body | Before | Now |
|---|---|---|
| Invalid JSON | 400 `Invalid JSON body` | unchanged |
| `null` | HTML 500 | 400 `Request body must be a JSON object` |
| A string, a number or an array | 400 `Reason is required` | 400 `Request body must be a JSON object` |

An object body behaves exactly as before.

**Tests:** red on the 4 non-object cases before the fix. `admin-guard-characterization` was not edited.

### Iteration 3 — verification (HEAD `7c68c7d`, evidence commit `de346ae`)

All results are recorded with exit codes in `evidence/review-fix-verification.txt`, in the iteration-3 section:

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | |
| `npm run lint` | 0 | 0 errors; 18 warnings, none in a file iteration 3 touched |
| `npx jest --ci` | 0 | 87 suites passed, 1 skipped; **1651 passed, 1 skipped** (floor 1626 + 1) |
| `node scripts/check-characterization-tags.mjs --all` | 0 | ok 34 files |
| `node scripts/check-elevated-ratchet.mjs` | 0 | PASS |
| `node scripts/check-migration-filenames.mjs` | 0 | 8 filenames parse |
| `supabase db reset --local` | 0 | applies `20260925130000` |
| `supabase test db --local` (unseeded) | 0 | Files=11, Tests=200, PASS |
| `npx tsx scripts/seed/load.ts` | 0 | 10 personas, 5 clubs, 6 memberships, 5 events |
| `supabase test db --local` (seeded) | 0 | Files=11, Tests=200, PASS |
| `npx playwright test` club-authorization, admin-write-paths, admin-moderation-queue, save-and-rsvp, event-moderation-notifications, csrf-origin, admin-guard | 0 | **53 passed**, production build (`next build`, then `next start` on port 3000) |
| `supabase db reset --local` (final) | 0 | |
| `npx tsx scripts/seed/load.ts` (final) | 0 | |

**Two notes on these runs:**
- **Worker crash.** During the fixes, one Jest run showed `rsvp.test.ts` as FAIL with zero failed tests: a worker crash. It passed on re-run, and so did the full run.
- **Playwright exit 127.** One Playwright invocation exited 127 before any test ran: zsh does not word-split a command held in a variable. It is recorded and annotated in the evidence, and the next line of the evidence is the real run.

**End state:**
- The local stack is reset and seeded, and port 3000 is free.
- The working tree is clean apart from these paths, none committed by this run:
  - the orchestrator's modified `05-REVIEW.md`;
  - the untracked `05-REVIEW.iter2.md`;
  - this file;
  - the three untracked paths that were already there.

---

## Carried Info findings (out of scope; proposed owners)

None of these was fixed. DI-61..DI-65 were proposed in iteration 1. DI-66 onward are new proposals. **None is registered yet**: registration and phase assignment are the owner's call.

| ID | Summary | Proposed owner |
|---|---|---|
| IN-01 | Per-path rate-limit keys; `x-real-ip` trusted unconditionally (iter-1 WR-04, skipped) | **DI-61**, Phase 6 rate-limit hardening |
| IN-02 | A non-string value in a field a handler `.trim()`s throws an HTML 500 | **DI-64**, Phase 6 input validation |
| IN-03 | `clubs/[id]` PATCH and the invite route answer a JSON 500, not a 400, for a malformed body | **DI-64**, Phase 6 input validation |
| IN-04 | Club links: POST accepts values PATCH refuses, so the settings form cannot save | **DI-66** (new), Phase 6 input validation: normalize the scheme at input |
| IN-05 | Store-selection residuals: a broken Upstash pair shadows KV; the fallback ignores `REQUIRE_DISTRIBUTED`; token whitespace | **DI-61**, Phase 6 rate-limit hardening |
| IN-06 | The pgTAP mutation harness defers its trap during `db reset`; SIGTERM exits 130, not 143 | **DI-67** (new), the phase owner (test tooling) |
| IN-07 | Approving pending edits is not bound to the version the admin reviewed | **DI-68** (new), Phase 6 |
| IN-08 | Organizer-request approval side effects are unchecked after the status commits | **DI-62**, widened to "multi-write flows in one SQL transaction", Phase 6 |
| IN-09 | Other self-checks compare UUIDs as strings (admin roles, ban) | **DI-64**, Phase 6 input validation (canonicalize route UUIDs once) |
| IN-10 | `PATCH /api/clubs/[id]/members/role` can only rewrite organizer to organizer | **DI-63**, the phase owner (product decision) |
| IN-11 | Two concurrent transfers by the same owner can produce two owners | **DI-62**, Phase 6 |
| IN-12 | The proxy matcher skips `/api/**` paths that end in an image extension, bypassing CSRF and the rate limit | **DI-69** (new), Phase 6 proxy/CSRF hardening |
| IN-13 | The `getRequestContext` rationale misstates `cache` availability | **DI-70** (new), the phase owner (comment corrections) |
| IN-14 | Dead production exports: `applyApiRateLimit`, `rateLimitStoreKind` | **DI-71** (new), Phase 6 dead-code sweep |
| IN-15 | `ADMIN_PREFIX` has no trailing slash | **DI-61**, Phase 6 rate-limit hardening |
| IN-16 | The CSRF origin check ignores the scheme and default ports | **DI-69** (new), Phase 6 proxy/CSRF hardening |
| IN-17 | The onboarding flag can be set by the user directly | **DI-72** (new), Phase 6 (users column grants) |
| IN-18 | Raw DB error messages are returned to clients, now including CR-01's trigger messages | **DI-73** (new), Phase 6 error hygiene |
| IN-19 | pgTAP 050 does not pin the full UPDATE column set on `users` | **DI-67** (new), the phase owner (pgTAP coverage) |
| IN-20 | The proxy comment misstates how `getUser()` fails | **DI-70** (new), the phase owner (comment corrections) |
| IN-21 | The events appeal pre-read is an existence oracle and ignores `deleted_at`; the guard does not stop appealing a soft-deleted event | **DI-74** (new), Phase 6 (the route check and, optionally, a trigger rule) |
| IN-22 | The moderation-reviews listing exposes the local part of admins' emails | **DI-75** (new), Phase 6 privacy |
| IN-23 | `POST /auth/signout` is not covered by the CSRF check | **DI-69** (new), Phase 6 proxy/CSRF hardening |
| IN-24 | Private profiles still expose header data and counts to signed-in non-friends | **DI-75** (new), Phase 6 privacy (follows F-005 / DEC-48) |
| IN-25 | `isBanned` treats an unparseable `ban_expires_at` as not banned | **DI-76** (new), Phase 6 (fail closed) |
| IN-26 | Club owners write `admin_audit_log` rows with actions outside `AuditAction` | **DI-77** (new), Phase 6 audit taxonomy |

**DI-65 (from iteration 1) is partly resolved.**
- **Resolved:** the 42P10 half was verified by the re-review and fixed by iteration-3 WR-07.
- **Still open:** `users/[id]/follow` reads the target's name on the cookie client, where only admins can see another user's row, so friend notifications say "someone". It is not in the re-review's list, and is proposed as a Phase 6 follow-up under DI-65.

---

## Iteration 1 (retained)

**Fixed at:** 2026-09-25T19:58:00Z · **Findings in scope:** 12 · **Fixed:** 11 · **Skipped:** 1

| ID | Title | Status | Commit |
|---|---|---|---|
| CR-01 | F-008 bypassable through the unchanged `events` UPDATE policy | fixed: requires human verification | `ed1e4c2` (previous fixer), evidence `bf15d0a` |
| CR-02 | A malformed Upstash URL makes the proxy throw outside its `try` | fixed | `78c5a4e` |
| WR-01 | Approving pending edits copies arbitrary keys onto the event | fixed | `cb8426c` |
| WR-02 | Self-transfer leaves the club ownerless; wrong rollback role; unchecked audit write | fixed (partial per re-review; completed by iter-3 WR-01) | `9daa291` |
| WR-03 | The elevated member-role write is not scoped to the club or to non-owner rows | fixed: requires human verification | `2130242` |
| WR-04 | Rate-limit keys include the full pathname; `x-real-ip` trusted unconditionally | **skipped** (design change) → DI-61 | — |
| WR-05 | An admin cannot re-ban a user whose temporary ban has expired | fixed: requires human verification | `746e926` |
| WR-06 | The pgTAP mutation harness has no signal trap | fixed | `b49cfa4` |
| WR-07 | Check-then-update in the admin review routes allows double processing | fixed: requires human verification | `f0effb9` |
| WR-08 | Guarded handlers return HTML 500 on malformed or non-object bodies | fixed (mostly per re-review; completed by iter-3 WR-08) | `e101218` |
| WR-09 | Club link fields accept `javascript:` and non-string values | fixed | `73c4f44` |
| WR-10 | Notifications inserted on the cookie client always fail silently | fixed (with new defects per re-review; resolved by iter-3 WR-03..WR-07) | `a2e2ece` |

**Run notes (iteration 1):**
- This was a continuation run. A previous fixer committed CR-01 and left CR-02 half done. This run verified CR-01, finished CR-02, and did WR-01..WR-10.
- It worked in the main tree (`use_worktrees=false`), staged explicit paths only, and did not touch production.
- Each fix commit followed a red/green check.

**Details per finding (iteration 1).**

- **CR-01**
  - **Guard:** a `BEFORE UPDATE` trigger on `public.events` (`20260925120000_events_guard_moderated_update.sql`).
  - **Who it applies to:** non-admin callers on `authenticated`/`anon`.
  - **What it refuses (42501):** status changes other than the appeal reset; `appeal_count` changes outside that reset, and any decrease; `club_id` and `created_by` changes; un-deleting; direct `title`/`image_url` writes on an approved event by a non-member.
  - **`SECURITY INVOKER`, deliberately:** the guard keys on `current_user`.
  - **Tests:** pgTAP 065. The schema task is in `evidence/review-fix-cr01-schema.txt` (Files=10, Tests=188, PASS both ways).
- **CR-02.**
  - `upstashConfig()` returns trimmed values.
  - `upstashConfigProblem()` names the problem without echoing secrets.
  - Store selection never throws.
  - The proxy's rate-limit step fails open, and a 429 still passes through.
  - The boot check refuses to start only under `RATE_LIMIT_REQUIRE_DISTRIBUTED=true`.
  - DEC-59 Part 2 is kept: the env reader never throws.
- **WR-01.** The approval copies only `title` and `image_url`, and `approved_fields` lists what was applied.
- **WR-02.** The route refuses a canonical self-transfer (400). The rollback restores the target's original role. The audit error is logged.
- **WR-03.** The update carries `.eq("id").eq("club_id").neq("role","owner")`; PGRST116 maps to 409. The D4 pin moved, with a ledger row.
- **WR-05.** The route uses `isBanned()`, with `ban_expires_at` selected.
- **WR-06.** An INT/TERM/HUP trap and an EXIT trap restore the mutated migrations. Both are installed after the clean-at-start check. Evidence: `evidence/review-fix-wr06-trap.txt`.
- **WR-07.** Both updates carry `.eq("status","pending").select("id")`, and a no-row result answers 409 before any side effect.
- **WR-08.**
  - `readJsonObject()` (`src/server/body.ts`) is used in 14 handlers: 400 `Invalid JSON body`, or 400 `Request body must be a JSON object`.
  - `admin/users/[id]` validates and audits `name`.
- **WR-09.** PATCH:
  - every whitelisted value must be a string or null;
  - all six link fields must be absolute http(s) URLs.

  POST: optional fields must be strings, and a non-http(s) scheme is refused.
- **WR-10.** The invite, follow and fanout notifications go through `getElevatedClient()` and their errors are logged. A failed invite upsert answers 500. REGISTRY rows were joined, and the ratchet delta is 0.

**Skipped: WR-04** (per-path rate-limit keys; `x-real-ip`). Both halves are design changes:
- per-scope budgets that DEC-50 set and tests pin;
- a trusted-proxy model, with no safe fallback in Next 16's `NextRequest`.

Proposed owner: DI-61, Phase 6. It is carried above as IN-01.

**Verification (iteration 1, HEAD `a2e2ece`, evidence `bf15d0a`):**

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | |
| `npm run lint` | 0 | 0 errors, 18 warnings |
| `check-characterization-tags --all` / `check-elevated-ratchet` / `check-migration-filenames` | 0 / 0 / 0 | ok 34 / PASS / 7 |
| `npx jest --ci` | 0 | 1626 passed, 1 skipped |
| `supabase test db --local` (unseeded / seeded) | 0 / 0 | Files=10, Tests=188, PASS |
| Playwright club-authorization, admin-write-paths, save-and-rsvp, csrf-origin, admin-guard | 0 | 44 passed |

---

_Fixed: 2026-09-25T20:52:00Z (iteration 3); 2026-09-25T19:58:00Z (iteration 1)_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
