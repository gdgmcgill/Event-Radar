# Slice 4 close-out: club authorization, owner writes, the RLS ring

**Plan:** 05-11 · **Phase:** 05 · **Recorded:** 2026-09-24 · **Measured on:** `9903671` (the last code-bearing slice-4 commit), slice-3 head `6b9a721` · **Author:** executor, local stack only

Slice 4 covered club authorization and membership. The order was: characterization (05-09: the 107-row PRESERVE table, the F-087 DEFECT pins, the club authorization spec, the RLS before-probe), then guard adoption and owner writes (05-10: `requireClubRole` at every § C site, `hasRole` for the events-side admin checks, F-087 through the elevated door), then the RLS ring and this close-out (05-11: the F-008 migration, pgTAP 060, the local schema push, the F-016 spec, the floor). Every claim below cites a command output in an evidence file or a commit. Nothing is taken from a planning document.

## 1. Floor, before and after

Source: `evidence/floor.slice-3-after.txt` (head `6b9a721`) and `evidence/floor.slice-4-after.txt` (line 1 `head=9903671…`). The commands and their order were the same. Censuses 20 and 21 are new.

| # | Command | Slice 3 after | Slice 4 after | Verdict |
|---|---------|---------------|---------------|---------|
| 1 | `npx jest --ci` | 1013 passed; 63 suites | 1135 passed / 0 failed / 0 skipped; 65 suites | at or above |
| 2 | `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings | equal |
| 3 | `npx tsc --noEmit` | exit 0 | exit 0 (the new spec and the regenerated types included) | equal |
| 4 | `npm audit --audit-level=high --omit=dev` | 0 high, 0 critical, 2 moderate | the same 2 moderate (dompurify, yaml) | equal |
| 5 | `node scripts/check-elevated-ratchet.mjs` | committed=25 live=24 | committed=25 live=22 | as required (05-10) |
| 6 | `node scripts/check-migration-filenames.mjs` | 4 parse | 5 parse | +1, the F-008 migration |
| 7 | `node scripts/check-characterization-tags.mjs --all` | ok 27 | ok 29 | at or above |
| 8 | `validate.mjs --quick` | 118 / 2 failed / 1 skipped | 118 / 2 failed / 1 skipped | equal; the same by-design snapshot FAILs |
| 8b | `validate.mjs --check endpoints` | 5 passed | 5 passed | equal |
| 9 | `supabase db reset --local` | exit 0, 4 migrations | exit 0, 5 migrations | rebuilds from zero |
| 10 | pgTAP, unseeded | Files=6 Tests=86 PASS | **Files=7 Tests=116 PASS** | +060 (30 assertions) |
| 11 | seed load | 10 personas, 5 clubs, 6 memberships, 5 events, 2 rsvps, 0 saved | identical | equal (DEC-54) |
| 12 | pgTAP, seeded | Files=6 Tests=86 PASS | **Files=7 Tests=116 PASS** | +060 |
| 13 | `npx playwright test` | 53 passed, 0 failed | **76 passed, 0 failed**, first run | at or above |
| 13c | F-016 membership restored | — | 0 rows for onboarded_student in approvedClub; club_members total 6 | restored (T-05-11-05) |
| 14 | env non-null assertion census | 0 | 0 | held |
| 15 | `getSession(` census | 1 (api/health:160) | the same one | unchanged, as required |
| 16 | `verifyAdmin()` census | 34 lines | 34 lines | equal (slice 5's) |
| 17 | legacy ban helper census | 0 | 0 | held |
| 18 | `from("club_members")` census | 42 | **24** | slice 4 drove it down by 18 |
| 19 | `(supabase as any)` census | 3 lines, 1 code site | the same | equal (slice 5's, F-072) |
| 20 | `requireClubRole(` call sites under `src/app/api` | 0 | **18** (the 17 § C sites; #15 has two arms) | the collapse, measured |
| 21 | `from("club_members")` in the 13 gate files | 28 (22 club-route + 6 events-side) | **10, none a gate-site read** | every membership decision is the guard |

Every row is at or above its slice-3 value. The stack was left reset and seeded (block 22). Port 3000 was free before the Playwright run, after it, and at the end.

## 2. Playwright, before and after

| Run | File | Count | Exit |
|-----|------|-------|------|
| Slice 3 after (full) | `evidence/playwright.slice-3-after.txt` Part 2 | 53 passed | 0 |
| 05-10 targeted (`club-authorization.spec.ts`, clean reset) | `evidence/club-guard-adoption.txt` §3d | 29 passed (10 setup + 19) | 0 |
| 05-11 targeted, run 1 (`club-invitation-acceptance.spec.ts`, uncommitted) | `evidence/playwright.slice-4-after.txt` Part 1 | 13 passed, 1 failed: the spec's own over-assertion on `user.email` (DI-49 part 2), not the product path | 1 |
| 05-11 targeted, run 2 (same stack, no reset) | the same, Part 1 | 14 passed | 0 |
| **Slice 4 after (full suite, clean reset, head `9903671`)** | `evidence/playwright.slice-4-after.txt` Part 2 | **76 passed, 0 failed** | **0** |

76 = 53 + 19 (`club-authorization.spec.ts`) + 4 (`club-invitation-acceptance.spec.ts`). It was the first run, with no retry, so the one flake re-run the plan allowed was not used. The count passed in from earlier executors ("at least 82, 53 + 29") counted the 10 setup tests twice. `git diff --stat 6b9a721 9903671 -- e2e playwright.config.ts` lists only those two spec files, so the ten existing specs passed unedited. `club-authorization.spec.ts` was created by 05-09 and its F-087 test was flipped by 05-10.

## 3. Validated-workflow re-confirmation

Slice 4's production footprint is `git diff --name-only 6b9a721 9903671 -- src supabase/migrations` with tests excluded:

- 13 route files: nine club routes (`clubs/[id]` and its `analytics`, `events`, `invites`, `members`, `members/role` and `transfer`, plus `clubs/banner` and `clubs/logo`) and four events-side routes (`events/[id]`, `events/[id]/analytics`, `events/[id]/reviews`, `events/create`)
- `src/server/authz/requireClubRole.ts`, `src/lib/roles.ts` (a type-only parameter widening), `src/server/db/elevated/REGISTRY.md`, and `src/lib/supabase/types.ts` (generated: one function entry)
- `supabase/migrations/20260923120000_events_insert_club_scope.sql`

No page, layout, component, hook, store or `src/types` file is in that diff. `git diff --name-only 6b9a721 9903671 -- src/components src/hooks src/store src/types 'src/app/**/page.tsx' 'src/app/**/layout.tsx'` prints nothing.

All 16 PROJECT.md Validated bullets (`grep -c '^- ✓' .planning/PROJECT.md` = 16) are listed below. Every named test is green in the runs in section 1.

| # | Validated workflow (PROJECT.md) | Touched by slice 4? | Re-confirmed after slice 4 by |
|---|-------------------------------|---------------------|-------------------------------|
| 1 | Sign in with Google OAuth; non-McGill emails rejected | No. No auth file is in the diff | **Every persona still signs in:** `auth.setup.ts`, 10 of 10 in the full run. Non-McGill: `src/app/auth/callback/route.test.ts` test 4, unedited, in Jest 1135 |
| 2 | Anonymous visitors browse public event and club content | Partly. `clubs/[id]/events` GET's `isOrganizer` flag moved to the guard (05-10). It stays anonymous-readable | `anonymous-browse.spec.ts` (3), including 'an anonymous visitor browses public club content'; `event-read-path.spec.ts` (12); the club-gates PRESERVE P1 row for #2 (anonymous 200), unedited |
| 3 | Onboarding interest tags; guard on unfinished onboarding | No | `ban-and-onboarding-ring.spec.ts`: 'can still complete onboarding', 'is sent to onboarding from the home page', the direct-POST 403; `protected-route-redirect.spec.ts` (2) |
| 4 | Browse, search, filter events by tag, date, time of day | Only `events/[id]` GET's `pending_edits` admin check (moved to `hasRole`, 05-10). The list route is absent from the diff | `events-list-characterization.test.ts` and `events-detail-characterization.test.ts` pass unedited (`git diff --stat 6b9a721` on both is empty); `event-read-path.spec.ts` (12) |
| 5 | Save/unsave events and RSVP | No | `save-and-rsvp.spec.ts` (3); the save, rsvp and saved-events PRESERVE suites, unedited |
| 6 | Personalized recommendations with popularity fallback (F-041 caveat) | No | `src/lib/__tests__/recommendations.test.ts`, `src/lib/diversity.test.ts` |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs (F-016 caveat) | **Yes.** Every club gate (05-10); owner edit, delete, role change and transfer through the door (F-087); the F-016 path proven | **Organizers reach their club surfaces and switch clubs:** `club-owner-surfaces.spec.ts` (3), unedited ('is routed from /my-clubs to the multi-club surface and sees the approved club'). **Edit works again:** `club-authorization.spec.ts` 'FIXED F-087: the owner's own club PATCH answers 200, and status stays unwritable'. **Owner and organizer reads:** the owner views invitations, members and analytics; the organizer views members and analytics. **Invite and accept:** `club-invitation-acceptance.spec.ts` (4), locally (F-016 stays Open for production, § 6). **Post events:** `date-validation.test.ts` and 060 tests 8-9. Caveats registered: DI-49 (the member list is truncated for organizers and nameless for owners) and DI-50 (the transfer rollback) |
| 8 | Organizer events auto-approved; others moderated | **Yes.** The auto-approve flag moved to the guard (05-10), and the database now enforces the same rule (F-008) | The club-gates PRESERVE P6 #17 rows (six outcomes: member of approved club → approved; non-member, member of a pending club, no club → pending; admin → approved), unedited; 060 tests 7-9 and 11-14 (the same rule at the RLS ring); the after-probes, where a member's approved insert gives `INSERT 0 1` (`schema-push-slice-4.txt` block 6b); `admin-moderation-queue.spec.ts` (3) |
| 9 | Follow/unfollow clubs; public club pages | Only the `clubs/[id]/events` flag (row 2). The follow routes are absent from the diff | `anonymous-browse.spec.ts` public club content; `write-handlers-characterization.test.ts` follow rows, unedited |
| 10 | Organizer event-level and club-level analytics | **Yes.** Both analytics gates are now `requireClubRole` (05-10) | `club-authorization.spec.ts` 'the club owner › can view club analytics' and 'the club's organizer › can view club analytics'; the attacker's analytics 403s; `src/__tests__/api/events/analytics.test.ts` and `src/__tests__/api/clubs/analytics.test.ts`, unedited |
| 11 | Attendees review past events; aggregate feedback | The reviews GET `isOrganizer` flag moved to the guard (05-10) | `src/__tests__/api/events/reviews.test.ts`: one fixture line gained `role: "organizer"`, with no assertion changed (`slice-3-fixture-completions.md`, slice-4 heading); club-gates P6 #14 |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log (F-007 caveat) | Only the events-side inline admin checks moved to `hasRole` (05-10). The admin routes are absent from the diff (slice 5) | **Banned users still blocked:** `banned-redirect.spec.ts` (3) and the `ban-and-onboarding-ring.spec.ts` banned and suspended rows. Admin: `admin-moderation-queue.spec.ts` (3), `admin-login-cookie-equivalence.spec.ts` (1); the composite-arm admin rows (P4) in club-gates PRESERVE; 060 test 13 (the admin insert arm) |
| 13 | In-app notifications and email reminders (F-038 caveat) | No. `events/create`'s follower notification is unchanged apart from the flag's source | No e2e test covers this workflow, before or after (the same gap as the slice-1 and slice-3 closes). The notifications write arms are pinned by `write-handlers-characterization.test.ts`, unedited |
| 14 | Instagram scraper pipeline, classify and ingest with dedup | No | `src/lib/classifier.test.ts` |
| 15 | A/B experiment framework (F-017 caveat) | No | `src/lib/experiments.test.ts` |
| 16 | Interaction tracking feeds popularity and interaction signals | No | `write-handlers-characterization.test.ts` P1/P5 rows, unedited. No e2e test covers the signal pipeline |

Rows 13 and 16 still have no end-to-end coverage. That gap is stated here rather than filled with a test that does not exist, as at the earlier closes.

## 4. Findings, the RLS matrix, and deferred items

**Closed (status set to `Fixed` in `.planning/audit/findings.json` by this plan):**

- **F-087** (Medium): owner club writes were denied by RLS. Fixed by 05-10 `4531ee2` (INTENTIONAL BEHAVIOUR CHANGE), with `a6fd637` for the transfer demotion (DEC-40). The validation criterion's three clauses: the DEFECT rows D1 ×2, D2, D4 and D5 moved (`defect-ledger.md`); the e2e 'FIXED F-087' test is green; and 060 tests 17 and 19 assert that a direct owner UPDATE on `clubs` and on `club_members` still affects 0 rows. The door needs no migration, so it holds in production on deploy.

**Fixed locally, kept Open with `closes_in_phase: "08"` (DEC-43, DEC-57):** F-008 and F-016, § 6.

**The RLS matrix after, row by row against `evidence/rls-ring-before.txt`** (re-run with the same method on the seeded stack, `schema-push-slice-4.txt` block 6b; every probe is one psql invocation holding one rolled-back transaction, with the impersonation proven; counts are 5/6/0 before and after):

| # | Actor · statement | Before (05-09) | After (05-11) | pgTAP 060 |
|---|---|---|---|---|
| P1 | attacker · approved event in approvedClub, `created_by` = club_owner | `INSERT 0 1` (HOLE, F-008) | **ERROR 42501** | tests 4, 6 |
| P2 | attacker · approved event in approvedClub, `created_by` = attacker | `INSERT 0 1` (HOLE, F-008) | **ERROR 42501** | test 5 |
| P2-allow (new) | club_member · approved event in approvedClub, own id | — | `INSERT 0 1` (allowed: member of an approved club) | tests 8, 9 |
| P2-pending (new) | attacker · PENDING event in approvedClub, own id | (allowed under `true`) | `INSERT 0 1` (allowed, DEC-42) | test 7 |
| P2-admin (new) | admin · approved event, no creator, no club | (allowed under `true`) | `INSERT 0 1` (the admin arm) | tests 13, 14 |
| P3 | club_owner · UPDATE clubs, own club | `UPDATE 0` | `UPDATE 0` (unchanged: the door is the owner path, DEC-41) | tests 16-18 |
| P4 | club_owner · UPDATE club_members role | `UPDATE 0` | `UPDATE 0` (unchanged) | tests 19, 21, 22 |
| P5 | attacker · DELETE club_members of approvedClub | `DELETE 0` | `DELETE 0` | tests 20, 22 |
| P6 | club_owner · DELETE a member | `DELETE 1` | `DELETE 1` | tests 23, 24 |
| P7 | attacker · INSERT club_invitations for approvedClub | ERROR 42501 | ERROR 42501 | tests 25-27 |
| P8 | anon · INSERT events | ERROR 42501 | ERROR 42501 | test 15 |
| — | attacker · INSERT clubs; self-insert into club_members as owner | (§ D: 42501) | — | tests 28, 29 |

Only P1 and P2 changed, and both changed from hole to 42501. The mutation check turns 060 red when the policy is removed (6 of 30, the allow rows). Re-creating the policy as `WITH CHECK (true)` turns tests 4-6 and 10-11 red, the deny rows (`schema-push-slice-4.txt` blocks 10 and 10b).

**Deferred items registered at this close** (`evidence/deferred-items.md`, "Slice 4 (05-09, 05-10), registered by 05-11"):

- **DI-49:** the club member list is shaped by RLS. An organizer gets only their own row (05-09). The owner gets `user: null` for every other member, so the dashboard shows "User" or a raw id. This was measured on this plan's first F-016 run.
- **DI-50:** the transfer rollback re-promotes the target instead of restoring its role, so a failed demotion leaves two owners (05-10).
- **DI-51:** a non-creator club member passes the `events/[id]` PATCH and DELETE gates, but events UPDATE RLS is creator-only. The result is a 500, or a false-success delete (research § D's "register as a note", never registered before).

The next id is DI-52.

`node .planning/audit/tools/validate.mjs --check findings` passes 8 of 8 and exits 0 after the edits. `FOUNDATION_AUDIT.md` was regenerated with `gen-foundation-audit.mjs` (91 findings, 91 ids referenced; Open 66 → 65, Fixed 25 → 26).

## 5. INTENTIONAL BEHAVIOUR CHANGEs shipped in slice 4

| Commit | Change | Pinned by |
|--------|--------|-----------|
| `4531ee2` (05-10) | Club owners can edit and soft-delete their club, change member roles and transfer ownership again: the write runs on the elevated door behind the owner gate and the column whitelist (F-087). The owner's PATCH answers 200 instead of 500. The DELETE really deletes instead of reporting false success and writing a false audit row. `status` stays unwritable | `club-owner-writes-defect.test.ts` D1, D2, D4; e2e 'FIXED F-087' |
| `a6fd637` (05-10) | The transfer demotes the old owner by `(club_id, user_id)` rather than by membership id (DEC-40). No wire bytes change | D5 |
| `5d9c22e` (05-11) | **Locally, until DI-23:** a forged or cross-club approved event insert is refused by the database (42501). That covers an approved event under another user's `created_by`, by a non-member of the club, into a pending club, or with no club. A pending event under one's own id may still name any club (DEC-42), and admins may insert anything | pgTAP 060; `schema-push-slice-4.txt` |

No change was made to any 403 body: the 107 PRESERVE rows pass unedited and the 12 e2e attacker 403s are byte-equal to § C.

## 6. Local-only closures, pending DI-23

The two Phase 5 migrations are local-only until the Phase 8 migration-history repair (DI-23). Nothing in slice 4 wrote production. There was no push subcommand and no linked-project flag, and `.env.local` was not read.

- **F-008** (High): fixed and proven locally by `5d9c22e` (the policy, 060, the mutation check, and the after-probes P1 and P2 at 42501). In production the policy is still `WITH CHECK (true)` until the repair applies `20260923120000_events_insert_club_scope.sql`. The authz ring (`POST /api/events/create`) already refuses both shapes, but a direct PostgREST write does not pass through it. The status stays Open with `closes_in_phase: "08"`.
- **F-016** (Medium): proven locally by `9903671` (`club-invitation-acceptance.spec.ts`: A invites B, B opens and accepts, B is a member, the membership is restored). In production the invitee policies (`20260916000000_invitation_policy_fixes.sql`) are not applied, so acceptance is still broken there. The status stays Open with `closes_in_phase: "08"`.

## 7. REFAC-12, measured clause by clause

REFAC-12: "Slice 4 (club authorization/membership): the 19 hand-rolled club-membership checks collapse into `requireClubRole`, cross-club access attempts return 403 at the authz ring and are denied at the RLS ring."

| Clause | Evidence | Verdict |
|--------|----------|---------|
| the 19 hand-rolled club-membership checks collapse into `requireClubRole` | Research § C counts the "19" as 17 gate and flag sites; the remaining `club_members` hits are data reads and writes. Census 20: 18 `requireClubRole(` call sites (#15's composite has two arms). Census 21: the 13 gate files hold 10 `club_members` reads, and every one is a target read, a listing or a write, with 0 gate-site reads. The guard has no admin bypass (the 05-10 executable-code check). Commits `a6fd637`, `d8cf84e` | **Met** |
| cross-club access attempts return 403 at the authz ring | `club-authorization.spec.ts`: 12 cross_club_attacker 403s, byte-equal to § C, green in the 76/0 run. `club-gates-characterization.test.ts` P2 (the non-member at every refusing site) and P4 (an admin with no membership at all 12 gates), 107 rows unedited | **Met** |
| (cross-club access attempts) are denied at the RLS ring | 060: the attacker is refused at events INSERT (tests 4-6, the F-008 half), clubs UPDATE and INSERT (16, 28), club_members UPDATE, DELETE and INSERT (20, 21, 29) and club_invitations INSERT (25), with owner-side integrity reads (18, 22, 27, 30). It is green unseeded and seeded and proven to bite (§ 4). The events INSERT half is local-only until DI-23. The club-table denials rest on baseline policies production already has | **Met on the local stack**; production for the events half with DI-23 |

**Verdict: Complete (05-11).** Every clause is evidenced. REFAC-12 is ticked in `.planning/REQUIREMENTS.md`, and its traceability row says the RLS clause's events half is proven locally and reaches production with the DI-23 repair (Phase 8). That is the same local-proof rule DEC-57 applies to F-008.

Slice 4's floor is green, so slice 5 may start.
