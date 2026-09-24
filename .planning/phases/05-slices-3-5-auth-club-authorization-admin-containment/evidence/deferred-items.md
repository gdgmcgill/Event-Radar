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
     Vercel deploys `main`, and by DEC-50 a production boot with no store configured fails.
  2. **A read-only count** of production users with `onboarding_completed` false or null, and of
     auth users with no `public.users` row (assumption A6). After the DEC-36 proxy ships, the
     first group is redirected to onboarding and the second is signed out (DEC-35).
  3. **Optional:** an early, owner-authorized production apply of the two Phase 5 migrations
     (F-008 in 05-11; F-006/F-007 in 05-16), ahead of the DI-23 repair. F-006 and F-007 are
     Critical, and they stay open in production until one of the two happens.
- **Why deferred.** Each needs production credentials or creates a billable resource. Orchestrator
  decision 3 forbids both.
- **Why not cosmetic.** Item 1 is a deploy blocker: skipping it takes production down on the next
  push. Items 2 and 3 set the blast radius of Phase 5's fail-closed changes and the exposure window
  of two Criticals.
- **Owner:** the phase owner. It must be done before the first push to `main` that carries
  05-18's boot requirement. Phase 8 re-checks it as a deploy prerequisite.

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

---

**Next new item id: DI-44.**

*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Plan: 05-01*
