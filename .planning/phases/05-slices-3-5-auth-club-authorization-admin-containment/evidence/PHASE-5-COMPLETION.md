# Phase 5 completion: Slices 3, 4 and 5, with evidence

**Plan:** 05-19 · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-25
**Tree:** `main` @ `8c0cf58` (the after-floor's line 1; code identical to `941bee7`) + this plan's Task 2 (`552afaf`) and Task 3 commits · **Phase range:** `27adf51..HEAD` (86 phase commits before this one)

> **Success criteria 1, 2 and 5 are MET. Criteria 3 and 4 are PARTIAL.**
>
> - **MET:**
>   - Every authorization decision reads `getUser()`.
>   - Every state-changing API arm and every one of the 35 admin arms makes its own ban, profile and role decision, failing closed.
>   - The club checks collapsed into `requireClubRole`.
>   - Cross-club attempts are refused at both rings. The RLS half of that is on the local stack, and it reaches production with the DI-23 repair.
>   - Each slice closed on a green floor with the Validated list re-confirmed.
> - **Criterion 3 is PARTIAL:** the two cron routes still import the service module directly, and one of them still fails open. REFAC-14 in Phase 6 owns both.
> - **Criterion 4 is PARTIAL:** the Upstash store is built, selected by validated config and unit-tested, but no store is provisioned. Production rate limiting therefore still counts per instance, and the live contract test is skipped.
>
> **Requirements:**
>
> - **REFAC-11 is Complete.** Its last clause (DI-48) closed at 35 of 35 admin arms.
> - **REFAC-12 is Complete**, re-confirmed.
> - **REFAC-17 is Complete.**
> - **REFAC-13 is PARTIAL**, on its fail-open and service-role clauses (the cron routes).
> - **REFAC-18 is PARTIAL**, on "so it works across serverless instances".
>
> **DI-25 is PARTIAL.** Four admin payloads still fail `tsc` on `@supabase/supabase-js` 2.116.0, so the bump was not taken and no dependency moved in 05-19 (DI-53).
>
> **No production access, no push. Two local-only migrations, both waiting for DI-23.** Two Critical findings (F-006, F-007) are closed only locally. **Before any push to `main`, the owner has actions to take (§ 8).** CI on this phase's head is UNOBSERVED (§ 11).

---

## 1. How to read this note

Every claim cites a committed path. `evidence/<file>` means
`.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/<file>`. The command in
§ 12 extracts every backticked path, resolves `evidence/` against the phase directory, and checks each one
against `git ls-files`. A path it cannot find counts as missing, and the count must be 0. Deleted files
are named without backticks so that the check stays honest. Commit hashes are cited by their short form
and can be checked with `git show`.

The floors: `evidence/floor.before.txt` (base `4a9e272`), `evidence/floor.slice-3-after.txt` (`6b9a721`),
`evidence/floor.slice-4-after.txt` (`9903671`), and `evidence/floor.phase-after.txt` (`8c0cf58`). The
slice closes are `evidence/slice-3-close.md`, `evidence/slice-4-close.md` and `evidence/slice-5-close.md`.
Nothing in this note is taken from a planning document alone.

---

## 2. The five success criteria, clause by clause

### Criterion 1

> "Every authorization decision uses `getUser()` rather than `getSession()`, middleware is advisory-only,
> the ban check fails closed instead of letting a thrown error through, the onboarding guard cannot be
> bypassed by direct API calls, and env-var non-null assertions are replaced with validated config."

| Clause | Verdict | Evidence |
|---|---|---|
| Every authorization decision uses `getUser()` rather than `getSession()` | MET | The only production `getSession(` is `src/app/api/health/route.ts:160`, which gates nothing (`evidence/floor.phase-after.txt` block 15). `src/server/__tests__/getsession-gate.test.ts` fails if another appears. The request context (`src/server/context.ts:82`) and the proxy (`src/proxy.ts:114`) call `getUser()`. The admin helper that also called it is deleted, and census 16 is 0 |
| Middleware is advisory-only | MET, with one read-side residual stated | Every state-changing non-admin arm (39, completeness-tested in `src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts`) and every admin arm (35, `BAN_GUARDED_ARMS` in `src/__tests__/api/admin/admin-guard-defect.test.ts`) makes its own ban, profile and role decision. A handler called with no proxy still refuses (DEC-34, DEC-58; `90819ee`, `9f0e5b5`, `4cf4928`). **Residual:** the two admin page layouts and the admin path of the moderation reviews GET decide by role only, so for those three reads the proxy's ban read is still what refuses a banned admin (DI-55, Phase 6). This follows DEC-34's rule that GET arms carry no ban guard. The owner may read it as PARTIAL for exactly those three |
| The ban check fails closed instead of letting a thrown error through | MET | Proxy: a failed ban read gives 500, and a missing profile gives 403 or a sign-out (`src/proxy-defect.test.ts` rows c, d-api, d-page; `e2e/specs/no-profile-row.spec.ts`). Handlers: `requireActiveUser` denies a missing row. The legacy helper that admitted one is deleted (census 17 is 0) |
| The onboarding guard cannot be bypassed by direct API calls | MET | `requireOnboarded` on every state-changing arm except DEC-34's two wizard exemptions. The onboarding state is read from the database, so the cookie is a hint only. `e2e/specs/ban-and-onboarding-ring.spec.ts`: the direct POST gets 403 `Onboarding required`, including with the cookie deleted |
| Env-var non-null assertions are replaced with validated config | MET | Census 14 is 0 (15 in 6 files before). `src/lib/env.ts` readers, with the boot check in `src/instrumentation.ts` (`6e716fb`). 05-18 added the validated `RATE_LIMIT_REQUIRE_DISTRIBUTED` flag (`941bee7`) |

**Criterion 1: MET**, with DI-55 stated rather than absorbed.

### Criterion 2

> "The 19 hand-rolled club-membership checks collapse into `requireClubRole`, and a cross-club access
> attempt returns 403 at the authz ring and is independently denied at the RLS ring."

| Clause | Verdict | Evidence |
|---|---|---|
| The 19 hand-rolled checks collapse into `requireClubRole` | MET | Research § C counts the "19" as 17 gate and flag sites. There are 18 `requireClubRole(` call sites, because #15's composite has two arms, and 0 gate-site `club_members` reads remain (`evidence/floor.phase-after.txt` blocks 20 and 21, unchanged since `evidence/floor.slice-4-after.txt`). The guard has no admin bypass (`a6fd637`, `d8cf84e`) |
| A cross-club attempt returns 403 at the authz ring | MET | `e2e/specs/club-authorization.spec.ts`: 12 cross_club_attacker 403s, green in `evidence/playwright.phase-after.txt`. `src/__tests__/api/clubs/club-gates-characterization.test.ts`: 107 rows, unedited |
| …and is independently denied at the RLS ring | MET locally, reaching production with DI-23 | `supabase/tests/database/060-club-tenant-isolation.test.sql` (30 assertions) is green unseeded and seeded at the phase close (block 10, block 12). The events INSERT half (F-008, `5d9c22e`) is local-only until the DI-23 repair. The clubs, club_members and club_invitations denials rest on baseline policies production already has (`evidence/slice-4-close.md` § 7) |

**Criterion 2: MET.** The RLS clause is met on the local stack; its events half reaches production with DI-23.

### Criterion 3

> "Every fail-open endpoint fails closed, `verifyAdmin()` guards every admin route, and every remaining
> service-role use goes through `src/server/db/elevated/` with a registered justification."

| Clause | Verdict | Evidence |
|---|---|---|
| Every fail-open endpoint fails closed | PARTIAL | `.planning/audit/authz/fail-open-register.md` lists FO-01..FO-05. **Closed:** FO-01, calculate-popularity (`4cf4928`, F-001 Fixed); FO-03, the env-conditional auth ring (`e2d6d3a`, F-003 Fixed in 05-08); FO-05, the callback's profile sync (`077a081`). FO-04 was the positive control. **Open:** FO-02, `src/app/api/cron/send-reminders/route.ts:9`, still compares against the literal `Bearer undefined` when `CRON_SECRET` is unset (F-002, High, Phase 6 REFAC-14) |
| `verifyAdmin()` guards every admin route | MET, by its replacement | DEC-44 replaced the helper with `requireRole(ctx, "admin")`, composed after `requireActiveUser(ctx)` (DEC-58), at all 35 admin arms: 35 lines in 26 files (block 24). `admin-guard-characterization.test.ts` P0 re-derives the arm table from the tree on every run. The helper and its file are deleted (`b8e172e`; census 16 is 0). The layouts and the moderation reviews route decide through the request context and `hasRole` |
| Every remaining service-role use goes through `src/server/db/elevated/` with a registered justification | PARTIAL | Every non-cron use goes through `getElevatedClient()` with a row in `src/server/db/elevated/REGISTRY.md` (05-05, 05-10, 05-14, 05-15). The allow-list shrank from 25 entries to 2 (`evidence/allowlist-shrink.txt`; ratchet `committed=2 live=2`, block 5). **Not met:** `src/app/api/cron/send-feedback-requests/route.ts` and `src/app/api/cron/send-reminders/route.ts` still import `createServiceClient` directly (block 23). Phase 6 owns them (REFAC-14, the cron credential gates) |

**Criterion 3: PARTIAL.** The unmet halves are the two cron routes. Phase 6 owns them.

### Criterion 4

> "Rate limiting runs from a distributed store so it holds across serverless instances and now covers
> `/api/admin/*`; CSRF exposure is assessed against Supabase cookie SameSite behavior and protection added
> on state-changing routes wherever exposure remains."

| Clause | Verdict | Evidence |
|---|---|---|
| Rate limiting runs from a distributed store so it holds across serverless instances | PARTIAL | **In the code:** `src/server/ratelimit/upstashStore.ts` runs on `@upstash/ratelimit` 2.0.8 and `@upstash/redis` 1.38.2. `getRateLimitStore()` selects it when `UPSTASH_REDIS_REST_*` or `KV_REST_API_*` is configured (`941bee7`, DEC-59), with 14 unit tests. **Not in production:** no store is provisioned (DI-42). Production without one logs one error and counts per instance from the memory store, which is DEC-59's degrade-loudly default. `src/server/ratelimit/upstash.contract.test.ts` is skipped, the only skipped test in Jest (block 1). So "holds across serverless instances" has not been measured against a real store |
| …and now covers `/api/admin/*` | MET | `408064d`: 600 GET and 120 mutation per IP, per path, per minute (`src/server/ratelimit/policy.ts` `ADMIN_BUDGETS`). `src/server/ratelimit/policy.test.ts` asserts the 601st GET and the 121st POST get 429 (`evidence/ratelimit.txt`) |
| CSRF exposure is assessed against Supabase cookie SameSite behavior | MET | `evidence/csrf-assessment.md` quotes the installed `@supabase/ssr` 0.7.0 cookie defaults (`SameSite=Lax`, not `HttpOnly`, no `Secure`) and assigns seven residuals a severity and an owner |
| …and protection added on state-changing routes wherever exposure remains | MET, with one Low residual stated | `f245d58`: the proxy refuses cross-site `/api/*` mutations (`src/server/csrf.ts`; 41 unit cases; `e2e/specs/csrf-origin.spec.ts`). **Residual:** `/invites/[token]` accepts an invitation on GET. That page is outside `/api/` and so outside the check. The attacker must hold the invitation token, and the only effect is joining the club the victim was invited to (DI-41, owner decision; assessment § 4.1). The owner may read that route as exposure remaining, and then this clause is PARTIAL for exactly it |

**Criterion 4: PARTIAL**, on the distributed-store clause only.

### Criterion 5

> "After each of the three slices the Playwright specs pass and the Validated workflow list is
> re-confirmed — in particular every persona can still sign in, non-McGill sign-in is still rejected,
> banned users are still blocked, and organizers still reach their club surfaces."

| Clause | Verdict | Evidence |
|---|---|---|
| After each slice the Playwright specs pass | MET | Slice 3: 53/0 (`evidence/playwright.slice-3-after.txt`). Slice 4: 76/0 (`evidence/playwright.slice-4-after.txt`). Slice 5 and phase close: 91/0 (`evidence/playwright.phase-after.txt`). Each was a full suite from a clean reset on its first run |
| The Validated workflow list is re-confirmed | MET | 16 of 16 rows in `evidence/slice-3-close.md` § 3, `evidence/slice-4-close.md` § 3 and `evidence/slice-5-close.md` § 3; § 4 below |
| Every persona can still sign in | MET | `e2e/auth.setup.ts`: 10 of 10 persona sign-ins in each of the three runs |
| Non-McGill sign-in is still rejected | MET | `src/app/auth/callback/route.test.ts` test 4 ('rejects a non-McGill address, signs it out, and deletes the orphaned auth user'), unedited since before the phase, green in Jest 1438 |
| Banned users are still blocked | MET | `e2e/specs/banned-redirect.spec.ts` (3), unedited; `e2e/specs/ban-and-onboarding-ring.spec.ts` banned and suspended rows (JSON 403 on the API, `/banned` on pages); the banned-admin D4 rows at 35 arms |
| Organizers still reach their club surfaces | MET | `e2e/specs/club-owner-surfaces.spec.ts` (3), unedited; `e2e/specs/club-authorization.spec.ts` owner and organizer rows |

**Criterion 5: MET.**

---

## 3. Requirements, measured against their own sentences

**REFAC-11**: "Slice 3 (auth/session/ban/onboarding): `getUser()` at every authorization decision,
middleware is advisory-only and the ban check fails closed, the onboarding guard cannot be bypassed by
direct API calls, env-var non-null assertions are replaced with validated config"

| Clause | Verdict | Evidence |
|---|---|---|
| `getUser()` at every authorization decision | MET | § 2, criterion 1 row 1 |
| middleware is advisory-only | MET | § 2, criterion 1 row 2. This was PARTIAL at the slice-3 close only because of DI-48 (a banned admin refused only by the proxy on `/api/admin/*`). DI-48 closed at 35 of 35 arms (05-13 `90819ee`, `9f0e5b5`; 05-14 `4cf4928`). DI-55 is the read-side residual stated there |
| the ban check fails closed | MET | § 2, criterion 1 row 3 |
| the onboarding guard cannot be bypassed by direct API calls | MET | § 2, criterion 1 row 4 |
| env-var non-null assertions are replaced with validated config | MET | § 2, criterion 1 row 5 |

**REFAC-11: Complete (05-19).** It was recorded PARTIAL at 05-08. Every clause is now met.

**REFAC-12**: "Slice 4 (club authorization/membership): the 19 hand-rolled club-membership checks collapse
into `requireClubRole`, cross-club access attempts return 403 at the authz ring and are denied at the RLS
ring"

| Clause | Verdict | Evidence |
|---|---|---|
| the 19 checks collapse into `requireClubRole` | MET | § 2, criterion 2 row 1 |
| cross-club attempts return 403 at the authz ring | MET | § 2, criterion 2 row 2 |
| …and are denied at the RLS ring | MET locally; events half in production with DI-23 | § 2, criterion 2 row 3 |

**REFAC-12: Complete** (recorded Complete by 05-11 and re-confirmed here on the phase after-floor).

**REFAC-13**: "Slice 5 (admin/moderation/service-role containment): every fail-open endpoint fails closed,
`verifyAdmin()` guards every admin route, every remaining service-role use goes through
`src/server/db/elevated/` with a registered justification, `/api/admin/*` is included in rate limiting"

| Clause | Verdict | Evidence |
|---|---|---|
| every fail-open endpoint fails closed | PARTIAL | § 2, criterion 3 row 1: FO-02, the reminder cron, is still open (F-002, Phase 6) |
| `verifyAdmin()` guards every admin route | MET | § 2, criterion 3 row 2 (35 of 35 arms, through its replacement) |
| every remaining service-role use goes through the door with a registered justification | PARTIAL | § 2, criterion 3 row 3: the two cron routes (Phase 6) |
| `/api/admin/*` is included in rate limiting | MET | § 2, criterion 4 row 2 |

**REFAC-13: PARTIAL.** The unmet clauses are "every fail-open endpoint fails closed" and "every remaining
service-role use goes through `src/server/db/elevated/`", both at the two cron routes, which REFAC-14 (Phase 6)
owns. Every other part of the requirement is met.

**REFAC-17**: "CSRF exposure is assessed (SameSite on Supabase cookies) and protection is added on
state-changing routes where exposure remains"

| Clause | Verdict | Evidence |
|---|---|---|
| CSRF exposure is assessed (SameSite on Supabase cookies) | MET | § 2, criterion 4 row 3 |
| protection is added on state-changing routes where exposure remains | MET, with DI-41 stated | § 2, criterion 4 row 4 |

**REFAC-17: Complete** (recorded by 05-17, re-confirmed by 05-19). If the owner reads the GET invitation
acceptance as remaining exposure, this becomes PARTIAL until DI-41 is decided.

**REFAC-18**: "Rate limiting is moved to a distributed store (e.g. Upstash) so it works across serverless
instances"

| Clause | Verdict | Evidence |
|---|---|---|
| rate limiting is moved to a distributed store (e.g. Upstash) | MET in the code, not in production | § 2, criterion 4 row 1: the store, its selection and its boot policy are built and tested. Production has no store until DI-42 |
| so it works across serverless instances | PARTIAL (unproven) | No store exists, so the property has not been measured. The live contract test is skipped with its reason in the title (`evidence/floor.phase-after.txt` block 1). The unit tests use a mocked client |

**REFAC-18: PARTIAL.** 05-18 recorded it Complete. This note corrects that against the requirement's own
sentence, because the program measures a requirement against its words. The unmet clause is "so it works
across serverless instances". It closes when DI-42 item 1 is done and
`src/server/ratelimit/upstash.contract.test.ts` runs green against the provisioned store.

---

## 4. Validated-workflow re-confirmation, after all three slices

The per-slice tables are `evidence/slice-3-close.md` § 3, `evidence/slice-4-close.md` § 3 and
`evidence/slice-5-close.md` § 3. Every row below is green in the phase after-floor
(`evidence/floor.phase-after.txt` block 1, `evidence/playwright.phase-after.txt`). There are 16 bullets
in `.planning/PROJECT.md` (`grep -c '^- ✓'` = 16).

| # | Validated workflow | Slices that touched it | Re-confirmed at the phase close by |
|---|---|---|---|
| 1 | Google OAuth sign-in; non-McGill rejected | 3 (callback, proxy); 5 (proxy prologue) | `e2e/auth.setup.ts` (10 personas); `src/app/auth/callback/route.test.ts` test 4; `src/app/auth/callback/route-defect.test.ts` |
| 2 | Anonymous visitors browse public event and club content | 3 (four personalized routes 401); 5 (private profiles) | `e2e/specs/anonymous-browse.spec.ts` (3); `e2e/specs/event-read-path.spec.ts` (12); `e2e/specs/public-profile-privacy.spec.ts` |
| 3 | Onboarding interest tags; unfinished onboarding guarded | 3 (database truth, API guard); 5 (self-update on the cookie client under the F-006 grant) | `e2e/specs/ban-and-onboarding-ring.spec.ts` (wizard self-update, onboarding completion, redirect, direct-POST 403); `e2e/specs/protected-route-redirect.spec.ts` |
| 4 | Browse, search, filter | 5 (pending edits on the detail route only) | `src/__tests__/api/events/events-list-characterization.test.ts`, `src/__tests__/api/events/events-detail-characterization.test.ts` (unedited); `e2e/specs/event-read-path.spec.ts` |
| 5 | Save/unsave and RSVP | 3 (guards); 5 (CSRF check, DEFINER counter trigger) | `e2e/specs/save-and-rsvp.spec.ts` (3, unedited since 05-01); `e2e/specs/csrf-origin.spec.ts` PRESERVE rows |
| 6 | Recommendations with popularity fallback (F-041 caveat) | 3 (feedback guard); 5 (batch admin-only) | `src/lib/__tests__/recommendations.test.ts`; `src/lib/diversity.test.ts` |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs (F-016 caveat) | 3, 4 (every club gate; owner writes restored, F-087), 5 (`clubs` POST split) | `e2e/specs/club-owner-surfaces.spec.ts` (3); `e2e/specs/club-authorization.spec.ts` (19); `e2e/specs/club-invitation-acceptance.spec.ts` (4, local; F-016 stays Open for production). DI-49, DI-50 and DI-51 stand |
| 8 | Organizer events auto-approved; others moderated | 3 (guard); 4 (the flag through the guard, F-008 at the RLS ring) | `src/__tests__/api/clubs/club-gates-characterization.test.ts` P6; 060 tests 7-14; `e2e/specs/admin-moderation-queue.spec.ts` |
| 9 | Follow/unfollow clubs; public club pages | 3 (guard) | `e2e/specs/anonymous-browse.spec.ts`; the follow rows of `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts` |
| 10 | Organizer event and club analytics | 4 (gates) | `e2e/specs/club-authorization.spec.ts` analytics rows; `src/__tests__/api/events/analytics.test.ts`; `src/__tests__/api/clubs/analytics.test.ts` |
| 11 | Reviews and aggregate feedback | 3 (guard); 4 (flag); 5 (author-name read on the door) | `src/__tests__/api/events/reviews.test.ts`; `src/__tests__/api/service-role-routing.test.ts` |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log (F-007 caveat) | 3 (ban ring); 5 (the whole admin surface) | `e2e/specs/admin-moderation-queue.spec.ts`, `e2e/specs/admin-write-paths.spec.ts` (approvals, report resolution, ban, unban), `e2e/specs/admin-audit-row.spec.ts` (exactly one audit row; Recent Activity names the actor), `e2e/specs/admin-guard.spec.ts`, `e2e/specs/banned-redirect.spec.ts`. **Caveat, pre-existing:** the reports list answers 500 (F-092, Phase 6). F-007 is fixed locally, and production waits for DI-23 |
| 13 | In-app notifications and email reminders (F-038 caveat) | 3 (guards); 5 (admin notifications through the door) | `e2e/specs/admin-write-paths.spec.ts` (notifications asserted). Email reminders still have no automated test |
| 14 | Instagram scraper pipeline | none | `src/lib/classifier.test.ts` |
| 15 | A/B experiments (F-017 caveat) | 5 (admin guard only) | `src/lib/experiments.test.ts` |
| 16 | Interaction tracking | 3 (guard when signed in); 5 (popularity recompute admin-only) | `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts` P1/P5; the calculate-popularity rows of `src/__tests__/api/admin/admin-guard-defect.test.ts`. No e2e test covers the signal pipeline |

Rows 13 (email half) and 16 (signal pipeline) have no end-to-end test. That was also true at every
earlier close. Row 12 carries F-092, which was found during the phase and not introduced by it.

---

## 5. Every intentional behaviour change the phase shipped, with its authority

Source: `git log --grep="INTENTIONAL BEHAVIOUR CHANGE" 27adf51..HEAD` (19 commits), plus the two slice-3
changes whose bodies state it in other words (`7bef995`, `6e716fb`; `evidence/slice-3-close.md` § 5).

| Change | Finding | Commit | Authority | Seeded-visible? |
|---|---|---|---|---|
| `/api/auth-debug` deleted; it answers 404 | F-027 | `7bef995` | DEC-39 | No |
| A production boot with a required Supabase variable missing fails in `register()` | F-003 | `6e716fb` | DEC-37 | No |
| The proxy fails closed. Env unset gives 500. A thrown error or a failed ban read gives 500 (JSON on `/api/*`). **Banned `/api/*` callers get 403 JSON** instead of a 307. **No-profile users** get 403 on the API and are signed out on pages. **Onboarding is read from the database** | F-003, F-062, F-088, F-089 | `e2d6d3a` | DEC-35, DEC-36 | No: the seeded mid-onboarding persona was already redirected |
| The callback **grants no roles**, **fails closed** on profile sync, and sends a hostile `next` to `/` (**same-origin next**) | F-004, F-077, FO-05 | `077a081` | DEC-38 | No |
| **Banned callers are refused on every write arm, DELETE included** (the DEC-24 asymmetry closed). **Un-onboarded direct writes are refused.** An anonymous malformed feedback POST gets 401 | F-088, F-089 | `aa50ff6`, `aa2191e`, `c620d16` | DEC-34 | No |
| **Four personalized routes answer anonymous callers 401** (the F-028 split: four of eight; the rest are Phase 6) | F-028 | `7ff08c1` | DEC-39 | No |
| **The owner can edit and delete their club and change member roles again** (the door behind the owner gate) | F-087 | `4531ee2` | DEC-41 | Yes, for the owner's PATCH (200 instead of 500) |
| **A forged or cross-club approved event is refused by the database (local only until DI-23)** | F-008 | `5d9c22e` | DEC-42 | No |
| **Anonymous admin calls get 401.** Only **one route's non-admins moved to 403** (`recommendations/batch`; DI-52 corrects the plans' "three"). A banned admin gets `Account suspended`, and a no-profile caller gets `Profile not found`, at the handler | F-061, DI-48 | `90819ee`, `9f0e5b5` | DEC-44, DEC-58 | No |
| **calculate-popularity closed**: 401, 403 or banned 403 on both verbs | F-001 | `4cf4928` | DEC-44, DEC-58 | No |
| **The admin role change works and is audited**: validated, own id refused, admin kept | F-091 | `4cf4928` | DEC-45 | Yes, on `/moderation/users` (the toggle now lands) |
| **Audit rows are written** (every insert was silently rejected before). A rejected insert is logged. Recent Activity names the actor | F-073, F-072 | `d510914` | DEC-46 | Only after an action (the seed has no audit rows) |
| **Pending edits are visible to their owner** and to admins | F-086 | `b689b3b` | DEC-53 | No: no seeded row carries edits |
| **Private profiles give anonymous readers the not-found response.** No profile page reads an email | F-005 | `4d3073b` | DEC-48 | Yes, for private seeded profiles read anonymously |
| **Self-escalation and audit forgery are refused by the database (local only until DI-23)** | F-006, F-007 | `d7c2036` | DEC-47 | No |
| **Admin routes are rate limited** (600/120 per minute); the client IP prefers `x-real-ip` | F-058 clause | `408064d` | DEC-50 | No |
| **Cross-site mutations are refused** (403 `Cross-site request blocked`) | F-090 | `f245d58` | DEC-52 | No |
| Rate limiting counts in Upstash when configured. Production without a store logs one error and serves; the enforce flag refuses to start | REFAC-18 | `941bee7` | DEC-50 as amended by DEC-59 | No |

`b8e172e` (the layouts and moderation reviews through the context) changed no bytes and no redirects.
Two log lines changed that are not response bytes: `user/engagement` POST's auth warning (DI-45) and the
proxy's `[Middleware] Error:` on the new 500 paths. Every other PRESERVE suite passed unedited across the
phase (`evidence/defect-ledger.md` records each DEFECT pin that moved, in its fix commit).

---

## 6. Checkpoints and decisions resolved by rule

**No phase owner was present at any point in Phase 5.** Every decision below is a rule-resolved default
under the mechanism in `evidence/phase-05-decisions.md` (a decision with no signed owner paragraph when
its plan starts is executed as written). No decision carries a signed owner paragraph.

| Decision | What it decided | Resolved by |
|---|---|---|
| DEC-33 | Slice order 3 → 4 → 5; CSRF in slice 5 | 05-01 default |
| **DEC-34** | **The write-guard contract**: `requireActiveUser` then `requireOnboarded` on every state-changing non-admin arm; two wizard exemptions; GET arms unguarded | 05-01 default |
| DEC-35 | A signed-in user with no profile row: 403 on the API, signed out on pages | 05-01 default |
| DEC-36 | The proxy's fail-closed shape; onboarding from the database | 05-01 default |
| DEC-37 | Validated config and the production boot check | 05-01 default |
| DEC-38 | The callback grants no roles and fails closed | 05-01 default |
| DEC-39 | The F-028 split (four routes in Phase 5); auth-debug deleted | 05-01 default |
| DEC-40 | `CLUB_ROLES` and the club guard | 05-01 default |
| **DEC-41** | **Owner club writes through the elevated door** rather than new owner UPDATE policies | 05-01 default |
| DEC-42 | The F-008 events INSERT policy | 05-01 default |
| DEC-43 | F-016 proven locally, not closed | 05-01 default |
| DEC-44 | `requireRole(ctx, "admin")` replaces the admin helper | 05-01 default |
| **DEC-45** | **Admin role changes**: enum-validated, own id refused, admin kept, audited | 05-01 default |
| DEC-46 | The audit writer through the door | 05-01 default |
| **DEC-47** | **The F-006/F-007 migration**: a column-scoped users grant and the audit-log write revocation | 05-01 default |
| DEC-48 | The public profile read through the door with one gate | 05-01 default |
| DEC-49 | Service-role containment: cookie client where a policy permits, else the door | 05-01 default |
| **DEC-50** | **The rate limiter**: budgets, fail-open on a store timeout, both env-name pairs | 05-01 default; its boot clause amended by DEC-59 |
| DEC-51 | The Upstash pins go through a blocking human legitimacy checkpoint | 05-01 default; the checkpoint was resolved by DEC-59 |
| **DEC-52** | **The CSRF origin check** in the proxy; no tokens | 05-01 default |
| DEC-53 | DI-36 becomes F-086; pending edits to their owner | 05-01 default |
| DEC-54 | No seed change in Phase 5 | 05-01 default |
| DEC-55 | Contract regeneration through the classifier only | 05-01 default |
| DEC-56 | DI-25 minor last, after a worktree proof (the proof failed on four sites; § 9) | 05-01 default |
| DEC-57 | Migration-dependent closures stay Open at "08" | 05-01 default |
| DEC-58 | A banned admin is refused at the handler | the 05-13 executor, under DI-48's owner note |
| **DEC-59** | **The 05-18 legitimacy checkpoint** ("use 2.0.8") and **production degrading loudly** without a store | the autonomous orchestrator, 2026-09-25 |

**The owner should review these first:** DEC-34, DEC-41, DEC-45, DEC-47, DEC-50, DEC-52, and DEC-59.

**The one human checkpoint of the phase** was 05-18 Task 2 (`checkpoint:human-verify`,
`gate="blocking-human"`, the Upstash package legitimacy). **No human answered it.** The autonomous
orchestrator resolved it by rule under DEC-59 (`db1a43f`), and the verdict "use 2.0.8" was appended
verbatim to `evidence/upstash-legitimacy.txt` (`01941cc`). The owner's countersignature is owner action
(a) below.

Per-plan rule-resolved readings (each recorded in its SUMMARY):

- 05-12 measured the legacy-401 set as one route, not three (DI-52).
- 05-14 kept the non-owner `pending_edits` strip that the PRESERVE suite requires.
- 05-15 gave the events-appeal pre-read its own door row, and measured the soft 404.
- 05-16 also revoked TRUNCATE on the audit log.
- 05-19 (this plan) did not bump supabase-js (§ 9) and did not edit CLAUDE.md (DI-46).

---

## 7. Local-only closures, pending DI-23

Nothing in Phase 5 read or wrote production. No push subcommand was run, no linked-project flag was
used, and `.env.local` was not read. The migrations below exist only on the local stack until the Phase 8
migration-history repair (DI-23) or an owner-authorized early apply (owner action (c)).

| Finding | Severity | Local proof | Production state today |
|---|---|---|---|
| **F-006**: a user can make themselves admin and lift their own ban | Critical | `supabase/migrations/20260923130000_users_grants_audit_log_insert.sql` (`d7c2036`); `supabase/tests/database/050-users-privilege-escalation.test.sql`, red on the old schema and green unseeded and seeded; the mutation check and four manual grant mutations (`evidence/schema-push-slice-5.txt`) | **Open.** The table-level grant still allows it |
| **F-007**: anyone can forge audit rows | Critical | The same migration; `supabase/tests/database/055-admin-audit-log-insert.test.sql`; `e2e/specs/admin-audit-row.spec.ts` for the genuine write path | **Open** |
| **F-008**: a forged approved event insert | High | `supabase/migrations/20260923120000_events_insert_club_scope.sql` (`5d9c22e`); 060 tests 4-14 (`evidence/schema-push-slice-4.txt`) | **Open** (`WITH CHECK (true)`); the authz ring refuses it at `POST /api/events/create` |
| **F-016**: club invitation acceptance | Medium | `e2e/specs/club-invitation-acceptance.spec.ts` (`9903671`); the invitee policies are in `supabase/migrations/20260916000000_invitation_policy_fixes.sql` | **Open** (broken in production) |

Each is `Open` with `closes_in_phase: "08"` in `.planning/audit/findings.json`, and each resolution says
"production closes with the DI-23 repair". DI-23 itself is unchanged and binding (`evidence/deferred-items.md` Part 1).

---

## 8. Owner actions, in order

These are the actions only the owner can take. The phase performed none of them, because production is
never touched. **Vercel deploys `main` automatically, so (a) and (b) come BEFORE any push to main.**

**(a) Countersign the Upstash packages, then provision Upstash on Vercel, BEFORE any push to main.**

1. **Countersign** DEC-59's verdict "use 2.0.8" from `evidence/upstash-legitimacy.txt`. The pins are
   `@upstash/ratelimit` 2.0.8 and `@upstash/redis` 1.38.2, exact. One registry fact the orchestrator's
   table did not show:
   - 2.0.8 was published by hand by `cahidarda`, a listed maintainer, with **no provenance attestation**.
   - The plan's proposed 2.1.0 was published from GitHub Actions **with** SLSA provenance.
   - Both tarballs' checksums match the registry.

   If you prefer provenance over age, the change is one reviewed `npm install --save-exact @upstash/ratelimit@2.1.0`.
   Its peer range also accepts the installed `@upstash/redis` 1.38.2. The full reversal path is in
   DEC-59 § "Reversing".
2. **Provision Upstash** (the Vercel Marketplace integration, co-located with `iad1`). Then set either
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or the Marketplace's `KV_REST_API_URL` /
   `KV_REST_API_TOKEN`, in the production environment. The code reads whole pairs only, `UPSTASH_*`
   first.
3. **Then set `RATE_LIMIT_REQUIRE_DISTRIBUTED=true`** so that a missing store becomes a boot failure
   again.

Without step 2, a deployed build still boots and serves: DEC-59 replaced DEC-50's refuse-to-start
rule. But it logs `[RateLimit] no distributed store is configured in production` on every cold start,
and its budgets hold only per instance. The plan text predates DEC-59 and says a storeless production
server "refuses to start". As built, it refuses only when the flag is set (`evidence/upstash-install.txt`
§ 10). Afterwards, optionally, run `src/server/ratelimit/upstash.contract.test.ts` against a disposable
store. That is what turns REFAC-18 Complete (DI-42).

**(b) An owner-authorized, read-only count before deploy (research A6, DI-42 item 2).** Count production
users with `onboarding_completed` false or null, and auth users with no `public.users` row. After this
phase deploys, the first group is redirected to onboarding by database truth (DEC-36), and the second
group is signed out by the fail-closed profile check (DEC-35). The count sets the blast radius.

**(c) Optionally, an earlier targeted production apply** of `supabase/migrations/20260923120000_events_insert_club_scope.sql`
and `supabase/migrations/20260923130000_users_grants_audit_log_insert.sql`, ahead of the DI-23 repair.
Otherwise two Criticals (F-006, F-007) and one High (F-008) stay open in production until Phase 8 (§ 7).
F-016's policies (`supabase/migrations/20260916000000_invitation_policy_fixes.sql`) travel with the
same repair.

**(d) The DI-41 decision:** whether invitation acceptance moves behind a confirm button that POSTs
through the origin check (a UX change to a Validated workflow).

**(e) Unchanged owner items, carried:**

- DI-22: the moderation deep link.
- DI-39: F-080's visual half.
- DI-40: F-081's identity mappings.
- DI-49: the club member list shaped by RLS, (a) policies or (b) the door.
- DI-51: register the events-side member-gate mismatch as a finding, or narrow the gate to creator-only.
- DI-57: the duplicated profile title suffix, a visual change.
- DI-46: a short, fact-only CLAUDE.md edit. The measured stale lines are in `evidence/deferred-items.md`
  under DI-46. The orchestrator asked this plan to make that edit, and it did not: executors do not edit
  CLAUDE.md without the owner's own authorization.

F-078 (the fuzzy-search function) is registered to Phase 6, not to the owner.

---

## 9. Deferred items and assumptions, final state at the phase close

Full text: `evidence/deferred-items.md`.

| Item | Final state | Owner |
|---|---|---|
| DI-21 (CSP in local dev) | unchanged | Phase 6 |
| DI-22 (moderation deep link) | unchanged | phase owner |
| DI-23 (production migration repair) | unchanged, binding; four closures wait on it (§ 7) | Phase 8 |
| **DI-25** (supabase-js 2.116.0) | **PARTIAL.** Four of eight sites were cleared in the phase (`4cf4928`, `4531ee2`, `d8cf84e`, `d510914`). Four admin payloads still fail `tsc` (`evidence/di-25-bump.txt`), so the bump was not taken. Carried as DI-53 | Phase 6 |
| DI-26 (shared-cache directive) | unchanged | Phase 6 |
| DI-27, DI-29 (manual acceptance steps; staging) | unchanged | phase owner; Phase 7 |
| DI-30 (the REFAC-04 cast clause) | **CLOSED**: the last `(supabase as any)` code site was removed by `d510914` (census 19 is 0) | — |
| DI-33 (production-only buckets and cron jobs) | unchanged | Phase 8 / Phase 6 |
| DI-36 | retired into F-086, now Fixed | — |
| DI-38 (harness race) | CLOSED by 05-01 (`4a9e272`) | — |
| DI-39, DI-40 | unchanged | phase owner |
| DI-41 (GET invitation acceptance) | open; a Low residual in the CSRF assessment | phase owner |
| DI-42 (owner actions before a push) | open; § 8 (a)-(c). Item 1 amended by DEC-59 | phase owner |
| DI-43 (`@supabase/ssr` major) | unchanged | Phase 6 at the earliest, Phase 8 by default |
| DI-44 (feedback's dead body-`user_id` fallback; anon-role RLS probe) | open. The anon-role probe was not taken in slice 5; it moves to Phase 7's per-table RLS sweep, and removing the dead fallback stays with Phase 6 | Phase 7 (probe), Phase 6 (code) |
| DI-45 (lost auth-failure log lines) | unchanged | Phase 6 |
| DI-46 (CLAUDE.md facts) | open, extended by 05-19 with the stale lines the phase caused | phase owner |
| DI-47 (unreachable 404, stale PRESERVE prose) | unchanged, travels with DI-59 | Phase 6 |
| **DI-48** (banned admin refused only by the proxy) | **CLOSED** at 35 of 35 `/api/admin/*` arms (05-13, 05-14). The read-side remainder is DI-55 | — |
| DI-49, DI-50, DI-51 | unchanged | phase owner; Phase 6; phase owner |
| DI-52 (the overstated legacy-401 set) | CLOSED at registration (a correction) | — |
| DI-53 (DI-25's four sites) | new | Phase 6 |
| DI-54 (`users` DELETE/TRUNCATE grants; inert insert policy) | new | Phase 7 |
| DI-55 (layouts and the moderation reviews admin path decide by role only) | new | Phase 6 |
| DI-56 (soft 404 on `/users/[id]`) | new | Phase 6 |
| DI-57 (duplicated title suffix) | new | phase owner |
| DI-58 (stale generated contract text) | new | Phase 6 |
| DI-59 (stale prose and line references) | new | Phase 6 |

The next id is DI-60.

**Research assumptions** (`evidence/deferred-items.md` Part 2):

| Assumption | Final state |
|---|---|
| A1: `register()` runs in build workers and needs a guard | CLOSED by 05-04's CI-env build (`evidence/build-ci-env.txt`), and re-measured green at the phase close (block 8d) |
| A2: grants and policies do not change the generated types | CLOSED. The types diff was empty after 05-11, after 05-16 (`evidence/schema-push-slice-5.txt`) and at the phase close (block 8c) |
| A3: Chrome's Lax+POST window does not apply to explicit Lax | Stays ASSUMED. The origin check covers it either way (`evidence/csrf-assessment.md` § 4.6) |
| A4: Marketplace injects `KV_REST_API_*` | MITIGATED by reading both pairs (`941bee7`). It is confirmed only when the owner provisions (§ 8 (a)) |
| A5: Vercel overwrites `X-Forwarded-For` | MITIGATED: the limiter prefers `x-real-ip` (`408064d`) |
| A6: few un-onboarded or profile-less production users | OPEN. This is owner action (b) |

**Findings.**

- **Closed this phase:** 16 findings are `Fixed` in `.planning/audit/findings.json`:
  - Slice 3 (05-08): F-003, F-004, F-027, F-062, F-077, F-088, F-089.
  - Slice 4 (05-11): F-087.
  - Slice 5 (05-19): F-001, F-005, F-061, F-067, F-073, F-086, F-090, F-091.

  The per-slice lists are in `evidence/slice-3-close.md` § 4, `evidence/slice-4-close.md` § 4 and
  `evidence/slice-5-close.md` § 4.
- **F-005's reading:** the fix answers with Next's streamed not-found page (HTTP 200 with `noindex`),
  which is the same response a missing profile gets. It is not a literal 404. Its resolution says so,
  and DI-56 carries the literal 404.
- **Open with a partial fix recorded:**
  - F-072 (pgTAP clause, Phase 7).
  - F-058 (wrapper and correlation, Phase 6).
  - F-040 (`CRON_SECRET`, Phase 6).
  - F-028 (three routes, Phase 6).
- **Local-only, Open at "08":** F-006, F-007, F-008, F-016.
- **New:** F-092 (the reports list returns 500, Phase 6).
- **Register:** 92 findings, Open 58, Fixed 34. `validate.mjs --check findings` passes 8/8.

---

## 10. The phase floor, at close

From `evidence/floor.phase-after.txt`, on `8c0cf58` (code = `941bee7`), from a clean reset:

- **Jest:** 1438 passed, 0 failed, 1 skipped (the Upstash live contract; the JSON check proves it is the only one), 76 suites. Before-floor: 744.
- **Playwright:** 91 passed, 0 failed, first run. Before-floor: 40.
- **pgTAP:** Files=9, Tests=156, unseeded and seeded. Before-floor: 6 files, 86 tests.
- **Lint / tsc / audit:** 0 errors (18 warnings) / exit 0 / 0 high, 0 critical, 2 moderate.
- **CI-env build:** exit 0. **Types drift:** none.
- **Ratchet:** `committed=2 live=2 delta=0` (before-floor 25/25). **Migrations:** 6 parse. **Tag gate:** ok 34.
- **validate --quick:** 118/2/1, the same two by-design FAILs. **--check endpoints:** 5/5.
- **Censuses:**
  - env non-null assertions: 0.
  - `getSession(`: 1, the health route.
  - admin helper: 0.
  - legacy ban helper: 0.
  - `(supabase as any)` code sites: 0.
  - gate-site `club_members` reads: 0.
  - service-module importers: the door and the two cron routes.
  - `requireRole(ctx, "admin")`: 35 arms.
- **The service-key lint rule bites:** block 25.
- **Stack state:** left reset and seeded (block 22). Port 3000 is free. The DI-25 throwaway worktree is removed, and `git worktree list` shows one line (`evidence/di-25-bump.txt` block 7).

---

## 11. CI observation

CI run UNOBSERVED — no push was authorized in this phase.

The phase's commits are local on `main`. Whether `ci`, `types` and `e2e` pass on this head is unknown
until the owner pushes. No claim is made without a run. The push itself is gated on § 8 (a) and (b).

---

## 12. Citation count

Command, run from the repository root after this note was staged:

```
node -e 'const fs=require("fs"),cp=require("child_process");const D=".planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/";const t=fs.readFileSync(D+"evidence/PHASE-5-COMPLETION.md","utf8");const tr=new Set(cp.execSync("git ls-files").toString().split("\n"));const ps=new Set([...t.matchAll(/`((?:\.planning|src|e2e|scripts|supabase|evidence)\/[^`\s*<]+?)(?::\d+(?:-\d+)?)?`/g)].map(m=>m[1].startsWith("evidence/")?D+m[1]:m[1]).map(p=>p.replace(/\/$/,"")));const miss=[...ps].filter(p=>!tr.has(p)&&![...tr].some(f=>f.startsWith(p+"/")));console.log("distinct="+ps.size+" missing="+miss.length);miss.forEach(m=>console.log("MISSING "+m))'
```

Result: **`distinct=80 missing=0`**. 80 distinct committed paths are cited, and 0 are missing.

*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Plan: 05-19, Task 3*
