# Deferred Items — Phase 05

**Plan:** 05-01 · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-24

This is Phase 5's deferred-item register, opened by plan 05-01. It follows the format of the
Phase 4 register (`.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/deferred-items.md`),
which followed Phase 3's. It continues the `DI-` sequence: Phase 4 ended at "Next new item id:
DI-41", so **the first new item this phase defers is DI-41.** Decisions carry the `DEC-` prefix
and live in `evidence/phase-05-decisions.md` (DEC-33 through DEC-57). The prefix rule is Phase 3's,
in that register's § "The two `D-` sequences, disambiguated".

The rule is unchanged: **deferring silently is forbidden, and there is no row below without an
owner.** Later Phase 5 plans append to this file. They do not start a second one.

---

# Part 1 — Every inherited item, disposed

Each item that Phase 4's Part 5 table left open gets a row here. Items Phase 4 or earlier closed are
listed once at the end, so the sequence has no gaps. "Unchanged" means Phase 5 neither advances nor
re-plans the item, and its existing owner stands.

| Item | What it is | Disposition in Phase 5 | Owner |
|---|---|---|---|
| **DI-21** | The CSP has no local-development entry; the harness runs with `bypassCSP` | **Unchanged.** Playwright measured 40 passed with `bypassCSP` on (`evidence/floor.before.txt` block 13). The CSRF origin check (DEC-52) does not touch the CSP | Phase 6 |
| **DI-22** | `/moderation?status=pending` deep link ignored by the events queue | **Unchanged, carried to the phase owner.** CONTEXT § Deferred Ideas: a moderation-page behaviour fix outside REFAC-11/12/13. 05-13 edits the moderation layout's admin check only, not the queue's filter state | the phase owner |
| **DI-23** | The production migration-history repair is not performed | **Unchanged, and binding on every Phase 5 plan:** no `supabase db push`, no `--linked`. The two Phase 5 migrations (05-11 F-008; 05-16 F-006/F-007) are local-only until this item closes. DEC-43 and DEC-57 keep migration-dependent findings Open with `closes_in_phase: "08"` because of it | Phase 8 |
| **DI-25** | `@supabase/supabase-js` 2.81.1 → 2.116.0 minor, and the `@supabase/ssr` 0.7 → 0.12 major | **Minor: taken in Phase 5, per DEC-56,** as the last code change (05-19), after slices 4 and 5 rewrite the eight blocking sites (05-RESEARCH.md § H) and a throwaway-worktree `tsc` proof. **Major: split out as DI-43** below | 05-19 (minor); DI-43 (major) |
| **DI-26** | The blanket shared-cache directive (`vercel.json` `s-maxage=60`), and `/api/events`' own `s-maxage=30` | **Unchanged.** No Phase 5 plan adds or removes a cache header. DEC-39 sends the rsvp GET and `clubs/[id]/events` F-028 verdicts here | Phase 6 (REFAC-19) |
| **DI-27** | The five signed-in Tier 3 manual acceptance steps | **Unchanged** | the phase owner; CERT-05, Phase 7 |
| **DI-29** | No staging Supabase project for REFAC-07's staging clause | **Unchanged.** Phase 5 needs no staging environment | the phase owner to provision; CERT-01, Phase 7 |
| **DI-30** | REFAC-04's cast clause, on F-072 / F-073 (the F-071 half closed in Phase 4) | **To 05-14,** with the audit writer and the moderation pages' select change (DEC-46). Census on the base commit: 1 code site of `(supabase as any)`, `src/app/moderation/page.tsx:78` (`evidence/floor.before.txt` block 19) | 05-14 |
| **DI-33** | Three storage buckets and three pg_cron jobs exist only in production | **Unchanged.** The storage family (F-024, F-030..F-036) was re-pointed to `"08"` by 05-01 Task 2 to travel with it | Phase 8 (buckets); Phase 6 (the cron jobs) |
| **DI-36** | `GET /api/events/[id]` never returns `pending_edits`; its visibility gate is dead | **Registered as F-086** by 05-01 Task 2 (`.planning/audit/quality/phase-05-slice-defects.md#f-086--pending-edits-never-reach-their-creator`). Fixed per DEC-53. This DI id is retired in favour of the finding | 05-14 (F-086) |
| **DI-38** | `save-and-rsvp.spec.ts:53` raced its `waitForResponse` against `page.reload()` | **CLOSED by 05-01 Task 1** (`4a9e272`). The test now awaits `page.reload()` and reads `page.request.get("/api/users/saved-events")`. Proof: `--repeat-each=10` on that test, **10 passed, 0 failed** (Phase 4 measured 5 of 10 failing), and the full suite 40/0 in a single run on the same commit | `evidence/di-38-fix.txt`; `evidence/floor.before.txt` block 13 |
| **DI-39** | F-080's visual half: the organizer fallback and the detail route's missing club embed | **Unchanged.** Owner-decision item. F-080 stays `"04"` | the phase owner |
| **DI-40** | F-081's six identity mappings | **Unchanged.** Owner-decision item. F-081 stays `"04"` | the phase owner |
| Phase 2 residuals | Renovate app not installed / CI checks not required on `main`; the two Moderate production advisories (`dompurify`, `yaml`) | **Unchanged.** Measured on the base commit: 0 critical, 0 high, 2 moderate (`evidence/floor.before.txt` block 4). No package moves until 05-18/05-19 | the phase owner (Renovate); REFAC-19 review (advisories) |

**Closed before Phase 5, not re-planned:** DI-19, DI-20, DI-24, DI-28, DI-31, DI-32, DI-34, DI-35,
DI-37 (Phase 4 register, Part 5).

---

# Part 2 — Every research assumption, disposed

`05-RESEARCH.md` § Assumptions Log lists six `[ASSUMED]` claims. Each gets a written disposition
and an owner, so no Phase 5 plan executes on an assumption nobody is holding.

| Assumption | Claim | Disposition | Owner |
|---|---|---|---|
| **A1** | `instrumentation.ts` `register()` may also run in the build's prerender workers, so a boot env check needs a `NEXT_PHASE !== "phase-production-build"` guard | **Closes by 05-04's build proof:** `npm run build` with CI's env (placeholder `NEXT_PUBLIC_*`, no service key) must pass with the guard in place (DEC-37) | 05-04 |
| **A2** | `supabase gen types` output is unaffected by GRANT/REVOKE/POLICY changes | **Closes by the type regeneration** in the two migration plans: the `diff -u` of regenerated types against `src/lib/supabase/types.ts` must be empty after 05-11 (policy only) and after 05-16 (grants, policies, and a trigger function's security attribute). If it is not empty, the plan records the delta and commits the regenerated file in the same commit (CI drift gate) | 05-11, 05-16 |
| **A3** | Chrome's "Lax-by-default + 2-minute POST" exception does not apply to cookies with an explicit `SameSite=Lax` | **Carried into the CSRF assessment** (`evidence/csrf-assessment.md`, 05-17). It stays ASSUMED there, with the reasoning stated. The origin check (DEC-52) covers the window regardless, so no severity rests on it (F-090's rationale says so) | 05-17 |
| **A4** | The Vercel Marketplace Upstash integration injects `KV_REST_API_*` rather than `UPSTASH_REDIS_REST_*` | **Mitigated by reading both names** (DEC-50): `UPSTASH_REDIS_REST_URL ?? KV_REST_API_URL`, and the token likewise. Recorded in DI-42's provisioning step. No behaviour depends on which name is right | 05-18; the phase owner at provisioning (DI-42) |
| **A5** | Vercel overwrites `X-Forwarded-For` on non-Enterprise plans | **Mitigated by preferring `x-real-ip`** in the limiter's client-IP function (DEC-50) | 05-17 |
| **A6** | Production has few or no users with `onboarding_completed` false/null, and none without a `public.users` row | **Owner action.** Production is not read in Phase 5. A read-only count is item 2 of DI-42. Until it is taken, DEC-35 and DEC-36 are correct but their production blast radius is unmeasured | the phase owner (DI-42), before the first push to `main` |

---

# Part 3 — Items plan 05-01 defers

## DI-41 — `/invites/[token]` auto-accepts an invitation on GET

- **Found by:** 05-RESEARCH.md C14. Re-read by 05-01 Task 2 for F-090
  (`.planning/audit/quality/phase-05-slice-defects.md#f-090--no-origin-check-on-state-changing-api-routes`).
- **What it is.** `src/app/invites/[token]/page.tsx:137-147` inserts a `club_members` row and marks
  the invitation `accepted` while rendering a GET. A `SameSite=Lax` cookie is sent on a top-level
  cross-site navigation, so a cross-site link can make a signed-in invitee join a club they were
  invited to. The DEC-52 origin check covers non-GET `/api/*` requests only, so it does not reach
  this page.
- **Why deferred.** The attacker must already hold the invitation token (the secret), RLS pins the
  invitee's email, and the only effect is joining a club the victim was invited to. The fix
  (acceptance behind a confirm button that POSTs through the origin check) is a UX change to a
  Validated workflow. Phase 5 does not make visual changes without an owner.
- **Why not cosmetic.** It is a state change on GET, which is the residual CSRF shape REFAC-17
  asks the assessment to name. It is recorded as a Low residual in `evidence/csrf-assessment.md`
  (05-17).
- **Travels with it:** `GET /api/recommendations` writing `experiment_assignments`
  (`src/app/api/recommendations/route.ts:230`). That one is benign, so it has no DI of its own and is
  named in the assessment.
- **Owner:** the phase owner (whether to convert acceptance to a POST).

## DI-42 — Owner actions required before any push to `main`

- **Found by:** 05-01, collecting CONTEXT's "owner actions recorded, not performed" and DEC-50's
  boot requirement.
- **What it is.** Three owner actions. The phase performs none of them, because production is
  never touched:
  1. **Provision Upstash on Vercel, with both env-name pairs** (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
     and the Marketplace's `KV_REST_API_URL`/`KV_REST_API_TOKEN`), **before any push to `main`**.
     ~~Vercel deploys `main`, and by DEC-50 a production boot with no store configured fails.~~
     **Amended by DEC-59 Part 2, as built in 05-18:** a production boot with no store no longer
     fails. It logs one `[RateLimit] no distributed store is configured in production` error and
     rate-limits per instance from the memory store (the pre-Phase-5 behaviour). Co-locate the
     database with Vercel `iad1`. **Step 1b, after provisioning:** set
     `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` in the production environment, which makes a missing
     store a boot failure again (DEC-50's intent, now opt-in). **Step 1c:** countersign the 05-18
     package verdict ("use 2.0.8": `@upstash/ratelimit` 2.0.8, `@upstash/redis` 1.38.2), which the
     autonomous orchestrator recorded by rule (DEC-59), from `evidence/upstash-legitimacy.txt`.
  2. **A read-only count** of production users with `onboarding_completed` false or null, and of
     auth users with no `public.users` row (assumption A6). After the DEC-36 proxy ships, the
     first group is redirected to onboarding and the second is signed out (DEC-35).
  3. **Optional:** an early, owner-authorized production apply of the two Phase 5 migrations
     (F-008 in 05-11; F-006/F-007 in 05-16), ahead of the DI-23 repair. F-006 and F-007 are
     Critical, and they stay open in production until one of the two happens.
- **Why deferred.** Each needs production credentials or creates a billable resource. Orchestrator
  decision 3 forbids both.
- **Why not cosmetic.** Item 1 is no longer a deploy blocker (DEC-59), but until it is done
  production rate limiting is per instance, so budgets do not hold across serverless instances
  (REFAC-18's goal is unmet in production). Items 2 and 3 set the blast radius of Phase 5's fail-closed changes and the exposure window
  of two Criticals.
- **Owner:** the phase owner. Item 1 should be done before the first push to `main` that carries
  05-18's store selection; skipping it degrades rate limiting rather than taking the site down.
  Phase 8 re-checks it as a deploy prerequisite.

## DI-43 — `@supabase/ssr` 0.7 → 0.12, the major

- **Found by:** DI-25 (Phase 3), split out here because DEC-56 takes DI-25's minor half in Phase 5.
- **What it is.** The `@supabase/ssr` major changes cookie and session handling.
- **Why deferred.** It changes behaviour under the exact surface Phase 5 refactors (proxy session
  refresh, callback, signout). The harness could not tell its effects apart from the slice's
  (CONTEXT Area 1 bullet six; CONTEXT § Deferred Ideas).
- **Why not cosmetic.** Staying on an old major of the session library is a dependency-currency
  debt with security relevance. The `ssr` 0.7 peer range (`^2.43.4`) still admits supabase-js
  2.116.0, so nothing blocks Phase 5 on it.
- **Owner:** Phase 6 close-out at the earliest, Phase 8 by default.

---

# Part 4 — Items later Phase 5 plans defer

*(Empty at 05-01. Append new items here as `DI-44`, `DI-45`, … with: found by, what it is, why it
was not fixed in the plan that found it, why it is not merely cosmetic, and its owner.)*

## Slice 3 (05-02..05-07), registered by 05-08

Source: the "Deferred items found" and "Observations for later plans" sections of the 05-02..05-07
SUMMARYs. 05-02 and 05-04 list none; 05-05, 05-06 and 05-07 list only observations. Each
observation below is registered once. Observations that were already acted on are listed after
DI-47 with where they closed, so none is dropped silently.

## DI-44 — `recommendations/feedback` keeps an unreachable body-`user_id` fallback, and the anon-role write of a foreign `user_id` is unprobed

- **Found by:** 05-03 (candidate DI), re-stated by 05-06 and 05-07.
- **What it is.** `src/app/api/recommendations/feedback/route.ts:129` and `:182` take
  `authUser?.id ?? body.user_id`. Before 05-06 an anonymous caller could write thumbs feedback
  (upsert) and analytics feedback (insert) attributed to any `user_id` the body named. 05-06
  (`aa50ff6`) put an anonymous branch first, so the fallback can no longer run through this handler.
  A comment at `:94` marks it unreachable. Two things remain: the dead fallback code, and the
  question whether the tables' RLS refuses an anon-role write with a foreign `user_id` when it
  comes straight to PostgREST, bypassing the handler.
- **Why deferred.** 05-06 and 05-07 were told to keep every read and write unchanged apart from the
  guard, and the file was outside 05-07's list. The RLS probe is local-stack database work, not
  slice-3 handler work. No finding in `findings.json` covers it (05-03 searched for
  `recommendations/feedback`, body `user_id` and impersonation). This plan registers it as a DI and
  not as a finding because the handler path is closed and the database half has not been measured.
- **Why not cosmetic.** If the RLS half is open, it is a write-impersonation path that skips the
  handler. The dead fallback is also the kind of code that a later edit could make reachable again.
- **Owner:** slice 5 (05-15/05-16, the service-role and RLS privilege work) for the anon-role probe.
  Phase 6 for removing the dead fallback, unless 05-15 already rewrites that handler.

## DI-45 — Auth-failure log lines removed by the context adoption

- **Found by:** 05-06 (deviation 4). The same kind of change as Phase 4's DEC-29.
- **What it is.** `POST /api/user/engagement` no longer logs
  `Unauthenticated request to /api/user/engagement:` when `getUser()` returns an auth error, because
  `createRequestContext()` does not expose the auth error object. `GET` on the same route still
  logs it (`src/app/api/user/engagement/route.ts:66`). No response byte changed, and no test pinned
  the log.
- **Why deferred.** Adding it back would mean widening the context's surface for a log line, and
  DEC-29 already moves auth-failure logging to Phase 6's structured logging.
- **Why not cosmetic.** Auth-failure signals are what an operator uses to spot credential stuffing
  or a broken session refresh. Losing them silently, route by route, erodes observability. The
  structured-logging work needs this list so it restores them deliberately.
- **Owner:** Phase 6 (structured logging, with DEC-29's three lines from Phase 4).

## DI-46 — CLAUDE.md cites `PROTECTED_ROUTES` at `src/proxy.ts:114`; it is now at line 188

- **Found by:** 05-05 ("Observations for later plans").
- **What it is.** The project CLAUDE.md says the `PROTECTED_ROUTES` array is at `src/proxy.ts:114`.
  After 05-05's proxy rewrite it is at `:188`. The literal, its eight entries and the regex
  re-derivation command CLAUDE.md gives all still work. Only the line number is stale.
- **Why deferred.** Executors do not edit CLAUDE.md. It is the owner's instruction file, and a change
  to it needs the owner's own hand.
- **Why not cosmetic.** CLAUDE.md is the file every agent reads first, and it calls this line "the
  only authority". A wrong pointer sends a reader to the wrong code on the auth path. The damage is
  limited because the re-derivation command is correct, so the fix is one number.
- **Owner:** the phase owner (a one-line CLAUDE.md edit). Re-check whenever `src/proxy.ts` changes
  again: 05-17 adds the CSRF origin check to the proxy.

## DI-47 — Branches and prose left behind by the handler ring

- **Found by:** 05-07 ("Observations for later plans").
- **What it is.**
  (a) `src/app/api/profile/inferred-tags/route.ts:34`: the handler's own
  `404 {"error":"Profile not found"}` cannot be reached by a caller with no `users` row, because
  `requireActiveUser` answers 403 first. It remains only for a row deleted between the context read
  and the handler's read.
  (b) `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts` and `writeHandlerTable.ts`
  still describe "the legacy ban helper", which was deleted in `c620d16`. The `legacyBan` flag now
  records which arms used it before 05-06/05-07. Both files must stay unedited as PRESERVE
  instruments.
- **Why deferred.** (a) The plan said to keep every read and write otherwise unchanged, and the
  branch still covers a real race. (b) Editing a PRESERVE file needs a ledger row and a reason
  stronger than prose.
- **Why not cosmetic.** (a) Two bodies with the same text and different statuses (403 from the
  guard, 404 from the handler) are a contract ambiguity. Phase 7's persona matrix is generated from
  `endpoints.json`, and it has to pick one. (b) is the cosmetic half, kept here so the two are
  cleaned together.
- **Owner:** Phase 6 (endpoint contract work, REFAC-19), with (b) done under a ledger row when those
  suites are next legitimately edited.

## DI-48 — On the admin and moderation surface, the ban is still enforced only by the proxy

- **Found by:** 05-08, while measuring REFAC-11 clause by clause (`slice-3-close.md` § 7).
- **What it is.** DEC-34's handler-ring ban guard covers every state-changing *non-admin* arm (39
  arms, completeness-tested). The admin and moderation arms authorize through `verifyAdmin()`
  (`src/lib/admin.ts`, 33 callsites), which reads `roles` only. The seam's `requireRole`
  (`src/server/authz/requireRole.ts`) has no ban check either. So a banned user who still holds the
  `admin` role is refused on `/api/admin/*` only by the proxy's ban read. That read fails closed
  since 05-05 (`e2d6d3a`), but by CONTEXT Area 1 the proxy is meant to be advisory ("nothing in the
  proxy is load-bearing for authz").
- **Why deferred.** The admin arms are slice 5's (REFAC-13, 05-12/05-13 replace `verifyAdmin()`
  with the seam). Guarding them in slice 3 would mean touching 25 admin files twice. No `src/` file
  changes in 05-08.
- **Why not cosmetic.** It is the one place where REFAC-11's "middleware is advisory-only" clause
  is not yet true, and it is why REFAC-11 is recorded PARTIAL at the slice-3 close. The exposure is
  narrow: the caller must be both banned and an admin, the proxy does refuse them today, and F-006
  (a non-admin clearing `banned_at`) is slice 5's.
- **Owner:** slice 5, 05-12/05-13. When the admin arms adopt the seam, compose
  `requireActiveUser(ctx)` before `requireRole(ctx, "admin")` (or make `requireRole` read the ban
  columns it already has in the context row), pin it with an admin-arm DEFECT row, and then flip
  REFAC-11 to Complete. If the phase owner decides a banned admin is out of scope, record that as a
  decision and close this item.
- **Status (05-13): 33 of 35 arms fixed; open for the two calculate-popularity arms.** DEC-58 composes
  `requireActiveUser(ctx)` ahead of `requireRole(ctx, "admin")` at all 33 former helper arms
  (05-13 `90819ee`, `9f0e5b5`); `BAN_GUARDED_ARMS` in `admin-guard-defect.test.ts` holds those 33.
  `admin/calculate-popularity` POST and GET have no user gate yet (F-001); 05-14 gives them one and,
  under DEC-58, composes the same guard, after which `BAN_GUARDED_ARMS` holds all 35 and 05-19 can flip
  REFAC-11. Not covered by DI-48's wording and left proxy-enforced: the two admin page layouts and the
  admin path of `GET /api/moderation/reviews/[targetType]/[targetId]` read the role only (05-13 moved
  them to the request context without adding a ban read); recorded in 05-13-SUMMARY.md for 05-19.
- **Status (05-14): 35 of 35 arms fixed; closed for the `/api/admin/*` surface DI-48 names.**
  `admin/calculate-popularity` POST and GET now open with `createRequestContext()`,
  `requireActiveUser(ctx)`, `requireRole(ctx, "admin")` (05-14 Task 1); both ids joined
  `FIXED_ARMS` and `BAN_GUARDED_ARMS`, which each hold all 35 arms (a subset test pins it).
  REFAC-11's flip is 05-19's. The layouts and the moderation reviews admin path above are unchanged.

**Observations already acted on (no DI):**
- *`src/server/context.ts` docblock names the legacy helper* (05-06): rewritten by 05-07. The header
  now says `src/lib/ban.ts` exports only `isBanned`, and `grep -rn checkBanStatus src` exits 1.
- *PRESERVE docblocks in the save and rsvp suites say "ban asymmetry, pinned for Phase 5"* (05-06
  deviation 1): removed by 05-07 as comment-only lines (05-07 deviation 1).
- *The un-onboarded persona is now redirected from the database, and banned API callers get 403
  JSON* (05-05, 05-06, 05-07 notes for 05-08): pinned end to end by
  `e2e/specs/ban-and-onboarding-ring.spec.ts` (05-08 `80f9533`).
- *The guard runs before body validation in `interactions` and `feedback`* (05-07): this is intended,
  so it is not a DI. It is listed in `slice-3-close.md` § 5 as an INTENTIONAL BEHAVIOUR CHANGE.

---

## Slice 4 (05-09, 05-10), registered by 05-11

The 05-09 and 05-10 SUMMARYs each list "Deferred items found" for 05-11 to register. There are
three: two named candidates, and one research § D row that says "register as a note" and was not
registered anywhere (`grep -i 'non-creator'` over this file and `findings.json` exits 1 before
this edit). 05-11 changes no handler, so each item below is the state on the slice-4 floor.

## DI-49 — The club member list is shaped by RLS: truncated for organizers, nameless for owners

- **Found by:** part 1 by 05-09 (`evidence/slice-4-characterization.txt` §4, read-only and rolled
  back); part 2 by 05-11, on the first run of `e2e/specs/club-invitation-acceptance.spec.ts`.
- **What it is.** `GET /api/clubs/[id]/members` admits owners and organizers (`CLUB_ROLES`, gate #6),
  then answers from the cookie client, so RLS shapes the answer without an error.
  (1) The listing: the `club_members` SELECT policies are `Club owners can view all club members`
  (`is_club_owner`) and `Users see own memberships`, so an organizer receives only their own row.
  club_member sees 1 of the approved club's 3 memberships.
  (2) The enrichment: each member's `user` is read from `users`, whose SELECT policies are
  `Users can read own profile` and `Admins can view all profiles`. So even the OWNER gets `user: null`
  for every member but themselves, and the dashboard renders "User" (`ClubDashboard.tsx:175`) or the
  raw `user_id` (`ClubSettingsTab.tsx:716`) for them. Measured by 05-11: after the invitee joined, the
  owner's list carried their row (`user_id`, `role: "organizer"`) with `user` absent.
- **Why deferred.** Two fixes are possible, and they differ in product terms. (a) Policies: a
  `club_members` SELECT policy for members of the same club, plus a narrow name-and-avatar read
  of `users` (a view or an RPC). A public `users` SELECT would expose email and ban columns, which is
  also why 05-15's appeal and review name reads go through the door. Being migrations, these are
  local-only until DI-23. (b) An elevated read behind the gate: a new REGISTRY row, and a service-role
  widening. Slice 4's scope was the authz ring, F-087 and F-008, and no slice-4 plan was allowed to
  widen a read.
- **Why not cosmetic.** A Validated organizer workflow (PROJECT.md "manage member roles") shows the
  organizer an incomplete roster and the owner a roster of unnamed members, with no error. The
  Playwright test "the club's organizer › can view members" asserts only the organizer's own row, and
  the F-016 spec asserts `user_id` and `role` only (its comment says why). So nothing pins either part,
  in either direction.
- **Owner:** the phase owner, to choose (a) or (b). (a) travels with DI-23 (Phase 8). (b) would be a
  Phase 6 REGISTRY row. It is recorded in `slice-4-close.md` § 4.

## DI-50 — The ownership-transfer rollback does not restore the target's previous role

- **Found by:** 05-10 (SUMMARY "Deferred items found"), reading
  `src/app/api/clubs/[id]/transfer/route.ts`.
- **What it is.** The transfer promotes the target (`role = 'owner'` by the target's membership id),
  then demotes the caller (`role = 'organizer'` by `(club_id, user_id)`). If the demotion fails, the
  "rollback" sets the target's role to `owner` again, which it already is. It does not restore the
  target's original role (`targetMember.role`, already read). A failed demotion therefore leaves
  the club with **two owners**, and the handler returns 500.
- **Why deferred.** It is pre-existing, and 05-10 preserved it byte for byte: that plan moved only the
  writing client and the demotion filter (DEC-40). The fix is a behaviour change on an error path, and it
  needs its own DEFECT pin (the fake's elevated client failing the second update) before it moves.
- **Why not cosmetic.** Two owners is an authorization state. Both can then transfer, delete the club
  and change roles, and nothing in the product removes the extra owner except an admin.
- **Owner:** Phase 6 (the elevated-door services work). Pin it with a DEFECT row in
  `club-owner-writes-defect.test.ts`'s family, then restore `targetMember.role` in the rollback. The
  better fix is to do both updates in one statement or one RPC.

## DI-51 — Non-creator club members pass the events/[id] PATCH and DELETE gates that RLS then refuses

- **Found by:** 05-RESEARCH.md § D ("events UPDATE … a handler/RLS mismatch for non-creator members →
  500", Phase 5 action "pin; register as a note (not widened)"), and observed again by 05-09.
- **What it is.** The composite gates in `src/app/api/events/[id]/route.ts` PATCH and DELETE admit
  the creator, an admin, or a member of the event's club (`requireClubRole(…, CLUB_ROLES, …)` since
  05-10). The `events` UPDATE policies are `Organizers can update own events` (`created_by`) and
  `Admins can update any event`. So on the real stack a club member who did not create the event
  gets a 500 from PATCH (the update matches 0 rows and `.single()` errors), and the DELETE soft-delete
  (`update({ deleted_at })`, no `.select()`) matches 0 rows and reports success without deleting.
  05-09 pinned only the authz-ring half, in the fake.
- **Why deferred.** It is the events-side twin of F-087. The fix is the same choice, the elevated door
  behind the member gate or an UPDATE policy for club members, and the policy route is local-only
  until DI-23. No slice-4 plan names it. Research § D said not to widen it.
- **Why not cosmetic.** The DELETE arm reports a false success to the organizer, the same
  data-integrity shape that raised F-087 to Medium.
- **Owner:** the phase owner, to register as a finding with F-087's shape in 05-19's final register
  pass, or to record that event editing is creator-only by design and narrow the gate to match.

---

## Slice 5 (05-12..05-18) and the phase close, registered by 05-19

Source: the "Deferred items found", "Observations for later plans", "Notes for later plans" and
"Human-verify items carried to 05-19" sections of the 05-12..05-18 SUMMARYs, plus 05-19's own DI-25
measurement (`evidence/di-25-bump.txt`). Each item is registered once. One item became a finding
rather than a DI: `GET /api/admin/reports` answering 500 on either client (05-15, 05-16) is **F-092**
(`.planning/audit/quality/phase-05-close-defects.md`), owner Phase 6. Owner actions carried from
05-18 (the Upstash countersignature, provisioning, the enforce flag) were already folded into DI-42
by 05-18 and are not re-registered.

## DI-52 — The "legacy-401" set was overstated in the plans: only one route's non-admins moved

- **Found by:** 05-12 (measurement), confirmed by 05-13's commit bodies (`90819ee`, `9f0e5b5`).
- **What it is.** Research § B, DEC-44's evidence and the 05-13/05-19 plan texts say three routes
  answered a non-admin 401 and would move to 403. Measured: `admin/clubs` GET and
  `admin/organizer-requests` GET already answered a non-admin `403 {"error":"Forbidden"}` (PRESERVE P1
  in `src/__tests__/api/admin/admin-guard-characterization.test.ts`). Only `recommendations/batch`
  POST moved from 401 to 403 (D2).
- **Why deferred.** It is a planning-register correction, not a product defect. Nothing is left to
  fix in code.
- **Why not cosmetic.** The completion note's INTENTIONAL BEHAVIOUR CHANGE list is what an owner reads
  before deploying. Saying "three routes" would overstate the change a non-admin can see.
- **Owner / state:** **CLOSED at registration.** `evidence/PHASE-5-COMPLETION.md` § 5 and F-061's
  resolution state the measured change (one route).

## DI-53 — DI-25 is PARTIAL: four admin payloads still block `@supabase/supabase-js` 2.116.0

- **Found by:** 05-19 Task 1 (`evidence/di-25-bump.txt`, the throwaway-worktree proof).
- **What it is.** On 2.116.0, `npx tsc --noEmit` exits 2 with four TS2345 errors, all admin write
  payloads typed as `Record<string, unknown>` or `Record<string, Json>`:
  `src/app/api/admin/events/[id]/edits/route.ts:76` (`liveUpdates`),
  `src/app/api/admin/events/[id]/route.ts:46` (`updateData`),
  `src/app/api/admin/experiments/[id]/route.ts:109` (the update payload) and
  `src/app/api/admin/featured/[id]/route.ts:48` (`updates`). Research § H assigned all four to slice 5;
  05-13/05-14/05-15 touched the files but did not retype them. The other four sites of the Phase 4
  enumeration are cleared (`4cf4928`, `4531ee2`, `d8cf84e`, `d510914`). The bump was not taken.
- **Why deferred.** The plan's stop rule ("do not bump"), and the retyping is a behaviour decision:
  site 1 copies every key of the row's `pending_edits` JSON into the update, so typing it honestly
  means filtering keys to the table's columns on an admin write path.
- **Why not cosmetic.** `RejectExcessProperties` exists to catch exactly the F-073 class (a write
  naming a column that does not exist, rejected silently). Staying on 2.81.1 keeps that class
  invisible to the compiler on these four writes, and it keeps the SDK a minor behind.
- **Owner:** Phase 6 (REFAC-15: a zod contract at each of the four boundaries yields a typed payload).
  Then the bump as its own commit, by DEC-28's worktree method. `@supabase/ssr` stays DI-43.

## DI-54 — `users` still grants DELETE and TRUNCATE to anon and authenticated; one policy is inert

- **Found by:** 05-16 (post-state probe, `evidence/schema-push-slice-5.txt` block 7).
- **What it is.** After `20260923130000_users_grants_audit_log_insert.sql`, anon and authenticated
  still hold DELETE and TRUNCATE on `public.users`. DELETE has no policy, so it affects 0 rows.
  TRUNCATE bypasses RLS, but PostgREST exposes no TRUNCATE and the foreign keys into `users` make a
  plain TRUNCATE fail. The "Users can insert own profile" policy is now inert, because authenticated
  has no INSERT privilege.
- **Why deferred.** Slice 5's migration was scoped to F-006/F-007 (DEC-47). The baseline's blanket
  `GRANT ALL` pattern is on most tables, so a per-table privilege sweep is the right unit.
- **Why not cosmetic.** A privilege that no path uses today is one policy change away from being
  reachable. Least privilege is enforced at the grant, not by the absence of a policy.
- **Owner:** Phase 7 (the per-table pgTAP and privilege sweep); the migration is local-only until DI-23.

## DI-55 — The admin page layouts and the moderation reviews admin path decide by role only

- **Found by:** 05-13 (carried by 05-14 and 05-15).
- **What it is.** `src/app/admin/layout.tsx`, `src/app/moderation/layout.tsx` and the admin path of
  `GET /api/moderation/reviews/[targetType]/[targetId]` decide admin with `hasRole(ctx.profile, "admin")`
  and do not read the ban. DI-48's `/api/admin/*` surface is closed (35 of 35 arms); these three are
  outside its wording. The proxy's fail-closed ban read refuses a banned admin on all three today.
- **Why deferred.** Pages redirect rather than answer JSON, and the reviews route is a read. DEC-58
  chose not to give `requireRole` a ban responsibility.
- **Why not cosmetic.** For these three the proxy is still load-bearing for the ban decision, which
  is the thing REFAC-11 says it must not be. The exposure is narrow (banned and admin, reads only).
- **Owner:** Phase 6. Compose `requireActiveUser` (or a page-shaped equivalent) in the layouts and the
  route, or record the page-layer exception as a decision.

## DI-56 — `/users/[id]` can only soft-404

- **Found by:** 05-15 (`evidence/allowlist-shrink.txt` § 2).
- **What it is.** The root `src/app/loading.tsx` streams every page with HTTP 200 before the page runs,
  so `notFound()` renders the not-found UI with `noindex` but cannot set 404. A missing profile and a
  private profile read anonymously both answer 200 with the not-found page. F-005 is Fixed on that
  reading (its resolution says so).
- **Why deferred.** A literal 404 needs a proxy check or the root loading boundary removed, both
  wider than F-005's fix.
- **Why not cosmetic.** Status codes are what crawlers and monitors read; a 200 "not found" page is a
  soft 404 in search-engine terms.
- **Owner:** Phase 6 (routing and caching work, REFAC-19).

## DI-57 — The public profile title repeats the site suffix

- **Found by:** 05-15.
- **What it is.** `/users/[id]` renders its title as "Name | UNI-VERSE | UNI-VERSE": the page's own
  title carries the suffix and the root layout's template adds it again. Pre-existing.
- **Why deferred.** Fixing it is a visible change, and Phase 5 ships no visual change without an owner.
- **Why not cosmetic.** It is mostly cosmetic. It is registered so that it is not lost, and because
  the title is also what search results and shared links show.
- **Owner:** the phase owner (a one-line visual fix when a visual change is authorized).

## DI-58 — Stale generated contract text for two admin surfaces

- **Found by:** 05-14.
- **What it is.** (a) `classify-inventory.mjs`'s verdict text for
  `api.moderation.reviews.targetType.targetId` still says "inline roles check on the service client …
  not verifyAdmin()"; 05-13 moved that route to the request context. (b) The audit-time signals in
  `.planning/audit/inventory/endpoints.json` for calculate-popularity still list `ADMIN_API_KEY` in
  `env_vars_referenced` and `env_gated_auth: true`; 05-14 deleted the gate. Only
  `gen-endpoint-inventory.mjs` refreshes signals, and no Phase 5 plan runs it.
- **Why deferred.** Outside every slice-5 plan's allowed contract set (DEC-55 regenerates
  `expected_status` only).
- **Why not cosmetic.** Phase 7's persona matrix is generated from `endpoints.json`; a stale signal can
  generate a test for a gate that no longer exists.
- **Owner:** Phase 6 (REFAC-19's contract regeneration).

## DI-59 — Stale prose and line references left by slice 5

- **Found by:** 05-13, 05-15 and 05-17.
- **What it is.**
  (a) `scripts/check-elevated-ratchet.mjs` generates the allow-list header sentence "N of the M
  entries below are dynamic routes, so this is the majority case", which is false at 0 of 2
  (`eslint.elevated-allowlist.mjs`).
  (b) `src/middlewareRateLimit.test.ts` and `scripts/smoke.sh:96` cite line numbers in
  `src/middlewareRateLimit.ts` (for example `:28 LIMITS.POST`) that no longer exist; the constants are
  still true in `src/server/ratelimit/policy.ts`.
  (c) `src/__tests__/api/admin/adminArmTable.ts` line 8 still names `src/lib/admin.ts`, which
  `b8e172e` deleted.
- **Why deferred.** (b) and (c) are PRESERVE or DEFECT instruments that are edited only under a
  ledger row; (a) is a script template outside every slice-5 plan's scope.
- **Why not cosmetic.** A pointer to a line or file that is gone sends the next reader to the wrong
  place on the rate-limit and admin paths. It is travelling with DI-47(b) so all three are cleaned together.
- **Owner:** Phase 6, with DI-47(b), under ledger rows where a characterization file is touched.

**DI-46 extended by 05-19.** Measured on 2026-09-25: `CLAUDE.md:50` cites `PROTECTED_ROUTES` at
`src/proxy.ts:114`; it is now at `src/proxy.ts:196` (05-17 added the rate-limit and CSRF prologue).
`CLAUDE.md:67` and `CLAUDE.md:90` describe `verifyAdmin()` in `lib/admin.ts`, deleted by `b8e172e`;
admin decisions are `requireActiveUser(ctx)` then `requireRole(ctx, "admin")` from `src/server/authz/`.
`.claude/CLAUDE.md:327-328` name `src/lib/admin.ts` and the `verifyAdmin()` return shape, and
`.claude/CLAUDE.md:346` still lists "admin auto-assignment" among the callback's responsibilities
(removed by `077a081`). The 05-19 orchestrator asked for a `docs(05-19)` commit correcting these; the
executor did not make it, because DI-46's own rule is that executors do not edit CLAUDE.md, and an
agent's instruction is not the owner's authorization. **Owner: the phase owner** (a short, fact-only
edit of both files; citing the re-derivation command instead of a line number keeps it from going
stale again).

---

# Part 5 — Final state of every item at the phase close (05-19)

Mirrored in `evidence/PHASE-5-COMPLETION.md` § 9. Where a state changed at the close, the reason is
given in the row.

| Item | Final state | Owner |
|---|---|---|
| DI-21 | unchanged | Phase 6 |
| DI-22 | unchanged | the phase owner |
| DI-23 | unchanged and binding. F-006, F-007, F-008 and F-016 wait on it | Phase 8 |
| DI-25 | **PARTIAL.** Four of the eight sites were cleared; four admin payloads still fail `tsc` on 2.116.0, so the bump was not taken (`evidence/di-25-bump.txt`). Carried as DI-53 | Phase 6 (DI-53) |
| DI-26 | unchanged | Phase 6 |
| DI-27, DI-29 | unchanged | the phase owner; Phase 7 |
| DI-30 | **CLOSED.** The last `(supabase as any)` code site was removed by `d510914` (05-14; `evidence/floor.phase-after.txt` block 19, 0 code sites) | — |
| DI-33 | unchanged | Phase 8 (buckets); Phase 6 (cron jobs) |
| DI-36 | retired into F-086, which is now Fixed | — |
| DI-38 | CLOSED (05-01) | — |
| DI-39, DI-40 | unchanged | the phase owner |
| DI-41 | open, a Low CSRF residual | the phase owner |
| DI-42 | open. The completion note's § 8 (a)-(c) is its checklist | the phase owner |
| DI-43 | unchanged | Phase 6 at the earliest, Phase 8 by default |
| DI-44 | **re-owned.** Slice 5 did not take the anon-role RLS probe, so it moves to Phase 7's per-table RLS sweep. The dead fallback stays with Phase 6 | Phase 7 (probe), Phase 6 (code) |
| DI-45 | unchanged | Phase 6 |
| DI-46 | open, extended by 05-19 | the phase owner |
| DI-47 | unchanged; travels with DI-59 | Phase 6 |
| DI-48 | **CLOSED** at 35 of 35 `/api/admin/*` arms (05-13, 05-14). The read-side remainder is DI-55 | — |
| DI-49 | unchanged | the phase owner |
| DI-50 | unchanged | Phase 6 |
| DI-51 | unchanged. It was not registered as a finding at the close, because its owner text makes that the phase owner's choice | the phase owner |
| DI-52 | CLOSED at registration | — |
| DI-53 to DI-59 | new at 05-19 | see each entry |

| Assumption | Final state |
|---|---|
| A1 | CLOSED (05-04's CI-env build; re-measured at the close, `evidence/floor.phase-after.txt` block 8d) |
| A2 | CLOSED (the types diff was empty after 05-11, after 05-16 and at the close, block 8c) |
| A3 | stays ASSUMED; the origin check covers it (`evidence/csrf-assessment.md` § 4.6) |
| A4 | MITIGATED (both pairs are read); confirmed only at provisioning (DI-42) |
| A5 | MITIGATED (`x-real-ip` first, `408064d`) |
| A6 | OPEN; owner action (DI-42 item 2) |

---

**Next new item id: DI-60.**

*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Plan: 05-01*
