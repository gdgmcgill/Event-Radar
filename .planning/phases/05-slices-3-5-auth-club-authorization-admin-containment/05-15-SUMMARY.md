---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 15
subsystem: auth
tags: [service-role, elevated-door, rls, allow-list, ratchet, public-profile, F-005, DEC-48, DEC-49, REFAC-13]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-12: the F-005 DEFECT pin. 05-13/05-14: the admin seam preamble, the audit writer on the door, and the calculate-popularity and admin role-change rows. Floor: Jest 1301/1301, tag gate ok 34, ratchet committed 25 / live 20"
provides:
  - "Seventeen route files and the public profile page no longer import @/lib/supabase/service. Each operation an existing policy permits runs on the cookie client; the rest go through getElevatedClient() with a REGISTRY row"
  - "Ten REGISTRY rows: notify another user, set another user's roles on approval, ban/unban, club appeal status reset, cross-user name reads, appeal pre-read, club creation, batch scoring, friend suggestions, public profile of another user"
  - "eslint.elevated-allowlist.mjs regenerated once to exactly the two cron routes (committed=2 live=2)"
  - "F-005 fixed: one visibility gate shared by generateMetadata and the page, a ten-column select without email, and anonymous readers of a private profile get the not-found response"
  - "src/__tests__/api/service-role-routing.test.ts: which client performs each operation, 24 cases over all 17 route files"
  - "e2e/specs/admin-write-paths.spec.ts and e2e/specs/public-profile-privacy.spec.ts, green on a clean reset (full suite 91/91)"
affects: [05-16, 05-17, 05-19, 06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split a route by operation, not by file: ctx.supabase for every operation a policy already permits, getElevatedClient() inline at the one call that needs it, each with a REGISTRY.md comment naming its row"
    - "One module-level loader serves generateMetadata and the page, so the two exports' visibility gates cannot drift apart"
    - "Routing unit suite: two thin recording fakes (cookie A, elevated B) keyed by <table>.<op>, asserting the ordered call list per client"

key-files:
  created:
    - src/__tests__/api/service-role-routing.test.ts
    - e2e/specs/admin-write-paths.spec.ts
    - e2e/specs/public-profile-privacy.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/service-role-migration.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/allowlist-shrink.txt
  modified:
    - src/app/api/admin/clubs/[id]/route.ts
    - src/app/api/admin/events/[id]/edits/route.ts
    - src/app/api/admin/events/[id]/status/route.ts
    - src/app/api/admin/organizer-requests/[id]/route.ts
    - src/app/api/admin/organizers/route.ts
    - src/app/api/admin/reports/[id]/route.ts
    - src/app/api/admin/reports/route.ts
    - src/app/api/admin/users/[id]/ban/route.ts
    - src/app/api/clubs/[id]/appeal/route.ts
    - src/app/api/events/[id]/appeal/route.ts
    - src/app/api/clubs/route.ts
    - src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
    - src/app/api/profile/avatar/route.ts
    - src/app/api/profile/banner/route.ts
    - src/app/api/recommendations/batch/route.ts
    - src/app/api/users/[id]/route.ts
    - src/app/api/users/me/suggestions/route.ts
    - src/app/users/[id]/page.tsx
    - src/__tests__/pages/public-profile-defect.test.tsx
    - src/server/db/elevated/REGISTRY.md
    - eslint.elevated-allowlist.mjs
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md

key-decisions:
  - "Every research § F 'permits' cell was checked again against the policy text, both in the production capture and on the live local stack (43 identical; the only difference, events INSERT from F-008, touches no moved operation). No cell was wrong, and no policy was widened"
  - "The events-appeal pre-read stays on the door, with its own row. On the cookie client a non-creator could not see a rejected event, so 403 Forbidden would become 404. Phase 7 is named as the retirement point"
  - "profile/avatar, profile/banner and users/[id] PATCH moved to the cookie client without breaking anything before 05-16: the local stack still has the table-level grant, and every column they write is in 05-16's GRANT list. The avatar/banner fallback (keep them on the door until 05-16) was not needed"
  - "/users/[id] cannot answer HTTP 404, because the root src/app/loading.tsx streams a 200 before the page runs (Next's documented soft 404). The privacy spec therefore asserts that a private profile gives an anonymous reader the same response as a missing one: same status, same title, the noindex meta, and neither name nor email"
  - "generateMetadata calls notFound() for a missing profile too, as the plan says. It used to return a 'User Not Found' title. The page already 404'd these profiles"

patterns-established:
  - "An operation-level REGISTRY row lists every calling module, so the notify row has seven callers rather than seven rows"

requirements-completed: []  # REFAC-13 continues in 05-16..05-19 (rate limiting, CSRF and the slice close); the plan's requirements tag is not marked complete here

# Metrics
duration: 24min
completed: 2026-09-24
---

# Phase 5 Plan 15: Service-role containment and F-005 Summary

**The service-role client now has one registered door, plus the two cron routes that Phase 6 owns. Seventeen route files and the public profile page were split by operation: each operation an existing RLS policy already permits runs on the caller's cookie client, and each of the rest goes through `getElevatedClient()` with a written REGISTRY reason. The allow-list is down from 25 entries to 2. F-005 is closed: a private profile gives an anonymous reader the not-found response, and no profile page reads the owner's email.**

## Performance

- **Duration:** about 24 min
- **Started:** 2026-09-24T21:55:44Z
- **Completed:** 2026-09-24T22:19:14Z
- **Tasks:** 3 of 3
- **Files:** 5 created, 22 modified

## Accomplishments

- **Admin family (Task 1).** The eight admin files now use the cookie client for every clubs, moderation_reviews, club_members, organizer_requests, event_reports, events and users-SELECT operation. The door handles only:
  - notifications to another user
  - another user's roles
  - the ban columns

  `admin/organizers`, `admin/reports` and `admin/reports/[id]` need no door at all.
- **Non-admin family (Task 2).**
  - `profile/avatar`, `profile/banner` and the `users/[id]` self-update use the cookie client only.
  - The appeals put their review, and for events the status reset and re-read, on the cookie client.
  - `clubs` POST checks for duplicate names and reads the caller's own roles on the cookie client.
  - Moderation reviews keep only the author-name lookup on the door.
  - Suggestions read the caller's own rows and the public follower lists on the cookie client.
- **F-005 (Task 3).**
  - One loader, `loadProfileTarget`, serves both `generateMetadata` and the page. It reads the viewer from `getRequestContext()`.
  - It reads the target through the door with the ten-column select.
  - It returns null for a missing target, or for an anonymous viewer when the profile is private.
  - The target's activity rows go through the same door.
- **Allow-list.** Regenerated once with `--write`: 25 entries down to 2 (`send-feedback-requests`, `send-reminders`), and the ratchet reports `committed=2 live=2 delta=0`. A throwaway importer outside the door fails both lint and the ratchet (probe recorded, then removed).
- **Proof.**
  - The routing suite has 24 cases and goes red when the pre-migration sources are put back (12/12 in Task 1; 10/24 in Task 2, where the rows that stay green are expected).
  - The F-005 ledger protocol is recorded: unedited red on exactly P1–P3, moved green, pre-fix red, `cmp` identical.
  - `admin-write-paths.spec.ts` covers club approval, report resolution, organizer-request approval, a ban with content suspension, and the unban, on the real policies. It leaves no residue.
  - `public-profile-privacy.spec.ts` goes red against the pre-fix page.
  - The full Playwright suite passes 91/91 after a clean reset and seed.

## Task Commits

1. **Task 1: admin service-role sites split between the cookie client and the door.** `26cbb2a` (refactor)
2. **Task 2: non-admin service-role sites through the cookie client or the door.** `f99cf6d` (refactor)
3. **Task 3: F-005 narrowed door read with one gate; allow-list shrinks to two.** `4d3073b` (fix, INTENTIONAL BEHAVIOUR CHANGE)

## Floor after this plan

| Gate | Before (05-14) | After |
|---|---|---|
| `npx jest --ci` | 1301 passed | 1325 passed, 0 failed, 71 suites (+24 routing cases) |
| `node scripts/check-characterization-tags.mjs --all` | ok 34 | ok 34 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors, 19 warnings | 0 errors, 18 warnings (none in a touched file) |
| `node scripts/check-elevated-ratchet.mjs` | committed 25 / live 20 | committed 2 / live 2, PASS |
| Playwright (full suite, clean reset) | 31/31 (the admin subset) | 91/91 |

## Decisions Made

See `key-decisions` above. None needed a new DEC id: each one applies DEC-48 or DEC-49 as written, and the deviations below say where the wording and the measurement differed.

## Deviations from Plan

### Rule-resolved choices

**1. Ten REGISTRY rows, not nine: the events-appeal pre-read has its own row.**
- The plan puts the events update and the review on the cookie client but does not place the pre-read.
- On the cookie client, a non-creator cannot see a rejected or suspended event. The route's 403 `{"error":"Forbidden"}` would become 404 `{"error":"Event not found"}`, a wire change that no finding covers.
- The routing suite pins the 403. The row names Phase 7's per-table RLS review as its retirement point.

**2. The suggestions row does not say "follows".** The caller's own `user_follows` and the club follower lists are world-readable, so those reads moved to the cookie client. The row names only what still needs the door. The RSVP-mates read stays on the door because its `events(title)` embed would lose the titles of non-approved events.

**3. The plan's "404" for a private profile is a soft 404, measured.**
- `src/app/loading.tsx` streams every page with HTTP 200, so a page's `notFound()` renders the not-found UI with `noindex` and cannot change the status. A missing profile has always answered the same way.
- The first full run, which asserted a literal 404, failed on it (90/1). The probe in `allowlist-shrink.txt` § 2 measured all three cases (missing, public, private).
- The spec now asserts that the anonymous private response equals the missing-profile response (status, title, `noindex`) and carries neither the name nor the email. It passes on a fresh reset.
- A hard 404 would need a check in the proxy, or the root loading boundary removed. That is left for 05-19 as a candidate deferred item.

**4. The regenerated allow-list diff has one non-removal line.** It is the header sentence the script generates from the list count ("0 of the 2 entries below are dynamic routes, so this is the majority case"). The file was not hand-edited. The template prose is now stale; see below.

**5. The routing suite has its own thin fake instead of the shared `fakeSupabase` helper.** The helper has no `upsert`, `contains`, `not`, `ilike`, `storage` or cross-client split, and PRESERVE suites depend on it. The new suite pins routing only; the query shapes stay pinned by the existing suites.

### Auto-fixed Issues

None. No bug was found in code this plan changed.

## Deferred items found (for 05-19 to register)

- **`GET /api/admin/reports` answers 500 on either client** (pre-existing). Its embed `reporter:users!event_reports_reporter_id_fkey(id, display_name, avatar_url)` names a relationship that does not exist: `reporter_id` references `auth.users`, and `users` has no `display_name`. PostgREST returns PGRST200. The probe is recorded in `service-role-migration.txt` § 4.
- **`/users/[id]` cannot return HTTP 404** while `src/app/loading.tsx` wraps the root. Missing and private profiles are soft 404s (200 with `noindex`).
- **Stale generated prose** in `scripts/check-elevated-ratchet.mjs`'s template: "N of the M entries below are dynamic routes, so this is the majority case" is false at 0 of 2.
- **The public profile's title** renders as "Name | UNI-VERSE | UNI-VERSE". The page's title already carries the suffix and the layout template adds it again. This is pre-existing and was only observed here.
- **Carried, unchanged:** `CLAUDE.md:67` and `.claude/CLAUDE.md:327` still describe `verifyAdmin()`. `findings.json` statuses for F-005 and the slice-5 findings are left for 05-19 (DEC-57).

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema change. The threat register's mitigations were applied:
- **T-05-15-01:** the allow-list holds 2 entries, and the ratchet and lint are green. The probe importer fails both.
- **T-05-15-02:** each cell was re-verified against the policy text. The routing suite and `admin-write-paths.spec.ts` pass on the real stack.
- **T-05-15-03:** narrowed select, one shared gate, unit and e2e assertions including no email in the HTML.
- **T-05-15-04:** no policy was touched.
- **T-05-15-05:** the fixture auth user and every fixture row are removed in `afterAll`. The residue query shows 0.

## Issues Encountered

- The first full Playwright run failed the privacy spec on a literal 404 (deviation 3).

## Next Phase Readiness

- 05-16 can start: the stack is reset and seeded, port 3000 is free, and the tree is clean apart from the three untracked files that must stay untracked.
- 05-16's floor list names `public-profile-privacy.spec.ts` and `admin-write-paths.spec.ts`. Both exercise the cookie-client self-update and admin writes that the F-006 grant must still allow.

## Self-Check: PASSED

- FOUND: src/__tests__/api/service-role-routing.test.ts, e2e/specs/admin-write-paths.spec.ts, e2e/specs/public-profile-privacy.spec.ts, evidence/service-role-migration.txt, evidence/allowlist-shrink.txt
- FOUND: commits 26cbb2a, f99cf6d, 4d3073b
- Jest 1325/1325, tsc exit 0, lint 0 errors, tag gate ok 34, ratchet committed=2 live=2, Playwright 91/91

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
