---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 10
subsystem: api
status: complete
tags: [clubs, embed, postgrest, events, saved-events, F-080, F-050, DEC-27, REFAC-10, A4]

# Dependency graph
requires:
  - phase: 04-04
    provides: "F-080 DEFECT suite with four pins (A-D), each naming the plan that moves it; events-detail PRESERVE suite (two layers)"
  - phase: 04-07
    provides: "transformEventFromDB kept exported from @/lib/tagMapping; tag mapping centralised in src/lib/eventTags.ts"
  - phase: 04-09
    provides: "events list route filtering through applyEventListFilters; head count selects id; cursors built from raw rows before transform"
provides:
  - "src/lib/tagMapping.ts: EVENT_CLUB_EMBED (15 club columns, no contact_email) and EVENT_WITH_CLUB_SELECT ('*, ' + embed), both literal-typed"
  - "transformEventFromDB's real-club branch reads banner_url, website_url, discord_url, twitter_url, linkedin_url from the embed"
  - "Six list routes (events, events/new, events/following, events/happening-now, events/popular, calendar/events) select the shared literal"
  - "/api/users/saved-events returns the real club from a join (F-080 pin C)"
  - "evidence/club-join-latency.txt: measured medians closing research assumption A4"
  - "evidence/club-embed.txt: consumer census proving no rendered output changed"
affects: [04-11, phase-05, phase-06, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared PostgREST select literals live next to the transform that consumes them, exported `as const` and composed only from literals (a template literal of a const is still a literal type), so supabase-js keeps inferring embed row types"
    - "A route-specific extra embed is composed onto the shared literal as one `as const` template (popular's POPULAR_EVENTS_SELECT)"
    - "Latency claims are recorded as interleaved A/B medians against the local PostgREST with an EXPLAIN of the equivalent SQL, plus a stated scale caveat"

key-files:
  created:
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/club-embed.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/club-join-latency.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.club-embed.txt
  modified:
    - src/lib/tagMapping.ts
    - src/app/api/events/route.ts
    - src/app/api/events/new/route.ts
    - src/app/api/events/following/route.ts
    - src/app/api/events/happening-now/route.ts
    - src/app/api/events/popular/route.ts
    - src/app/api/calendar/events/route.ts
    - src/app/api/users/saved-events/route.ts
    - src/app/api/events/[id]/route.ts
    - src/__tests__/api/events/club-fabrication-defect.test.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/defect-ledger.md

key-decisions:
  - "DEC-27 executed as written: only the non-visual half of F-080 shipped; pins A and D and the detail route's select are untouched"
  - "contact_email is excluded from EVENT_CLUB_EMBED and stays null on both transform branches (DEC-27 data minimisation, T-04-10-01)"
  - "saved-events keeps its two `any` casts: removing them needs more than deleting the cast (events.tags is string[] | null in the generated types, DBEvent.tags is string[])"
  - "The events.club_id index provenance is corrected in evidence: idx_events_club_id comes from the Phase 3 baseline migration (20260915214553_baseline.sql:1476), not 03-05; the event->club embed is served by clubs_pkey"

patterns-established:
  - "One shared embed literal per relation, imported by every route that embeds it, so a column added to the type cannot be silently blanked by one route's hand-written list"

requirements-completed: []  # REFAC-10 is not marked complete: its club-join clause is PARTIAL until the 04-11 owner decision (DEC-27)

# Metrics
duration: 8min
completed: 2026-09-23
---

# Phase 4 Plan 10: Shared Club Embed and Saved-Events Join (F-080 non-visual half) Summary

**The six list-shaped event routes and `/api/users/saved-events` now select one shared `EVENT_WITH_CLUB_SELECT` literal. Its club embed carries the five link columns the `Club` type promises and deliberately leaves out `contact_email`. saved-events stops fabricating a club from the organizer string. The join's cost is measured at +0.34 ms median (star to embed) and +0.17 ms (ten to fifteen columns) on the local stack.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-09-23T22:35:53Z
- **Completed:** 2026-09-23T22:44Z
- **Tasks:** 2
- **Files modified:** 14 (3 created, 11 modified)

## Accomplishments

- **One shared embed (pin B).** `EVENT_CLUB_EMBED` lists the ten columns every list route already asked for, plus `banner_url`, `website_url`, `discord_url`, `twitter_url` and `linkedin_url`. `EVENT_WITH_CLUB_SELECT` is `*, ` + that embed. Both are `as const`, and a scratch type probe confirmed supabase-js still infers the embed row. `row.club.banner_url` types as `string | null`, and `row.club.contact_email` is a type error. The real-club branch of `transformEventFromDB` reads the five with a null fallback. The organizer fallback is byte-unchanged.
- **Six routes adopted it.** `events` keeps `{ count: 'exact' }` on the main query, and the 04-09 head count still selects `id`. `new`, `following`, `happening-now` and `calendar/events` swap the literal, and `popular` composes it with its popularity embed as `POPULAR_EVENTS_SELECT`. No other line in any route changed.
- **saved-events joins the real club (pin C).** Its events read selects `EVENT_WITH_CLUB_SELECT`. The UTC floor (F-085) and everything else in the route are unchanged.
- **Detail route tells the truth.** The false "Clubs table does not exist" comment (F-050) in `/api/events/[id]` GET now says the read deliberately has no embed yet, that adding one changes "Hosted by" on every seeded detail page, and that this is F-080's gated half, decided at 04-11 (DEC-27). The change is comment-only, proven by the plan's `git diff -U0` filter.
- **Nothing rendered changed.** UI code reads only `name`, `logo_url` and `category` off an event's club. No event hands its whole club to another component, and saved-events' only UI consumer reads `savedEventIds`. Every seeded club has all five link columns NULL. Playwright: 40 passed, 0 failed, no spec edited, including `DEFECT F-080` (the detail page still says "Hosted by" the organizer label).
- **A4 closed with numbers.** See `evidence/club-join-latency.txt` and the section below.

## Task Commits

1. **Task 1: shared club embed adopted by the six list routes (F-080 pin B)**: `1150b0f` (fix)
2. **Task 2: saved-events real club (pin C), detail comment, latency, census, harness**: `9083430` (fix)

**Plan metadata:** see the docs commit that adds this file.

## Files Created/Modified

- `src/lib/tagMapping.ts`: `EVENT_CLUB_EMBED`, `EVENT_WITH_CLUB_SELECT`, five optional `DBClub` columns, and the real-club branch reading them.
- `src/app/api/events/route.ts`, `events/new`, `events/following`, `events/happening-now`, `calendar/events`: select `EVENT_WITH_CLUB_SELECT`.
- `src/app/api/events/popular/route.ts`: `POPULAR_EVENTS_SELECT = \`${EVENT_WITH_CLUB_SELECT}, popularity:event_popularity_scores(*)\` as const`.
- `src/app/api/users/saved-events/route.ts`: the events read selects `EVENT_WITH_CLUB_SELECT`.
- `src/app/api/events/[id]/route.ts`: a comment only.
- `src/__tests__/api/events/club-fabrication-defect.test.ts`: pin B and pin C moved; header lines "pin B FIXED in 04-10" and "pin C FIXED in 04-10"; 6 tests became 10.
- `evidence/club-embed.txt`, `evidence/club-join-latency.txt`, `evidence/playwright.club-embed.txt`: new.
- `evidence/defect-ledger.md`: two F-080 rows plus an evidence section (protocol steps 2 to 5).

## F-080 pin state after 04-10 (for 04-11)

| Pin | What it pins | State | Where |
|-----|--------------|-------|-------|
| A | The organizer fallback in `transformEventFromDB` fabricates `{ id: organizer, name: organizer, status: "approved" }`, even when a real `club_id` is present | **Unmoved, green.** Moves only if the owner ships the visual half | `club-fabrication-defect.test.ts` pin A (2 tests); `tagMapping.ts` organizer branch |
| B | The real-club branch blanked the five link columns | **FIXED in `1150b0f`** | pin B (4 tests) |
| C | saved-events selected `*` and fabricated its club | **FIXED in `9083430`** | pin C (2 tests) |
| D | `/api/events/[id]` selects `*`, so the detail response names the organizer label | **Unmoved, green.** Moves only if the owner ships the visual half | pin D (2 tests); e2e `event-read-path.spec.ts:182` `DEFECT F-080` |

If the owner ships the visual half at 04-11, the change is small. `/api/events/[id]` GET selects `EVENT_WITH_CLUB_SELECT` in place of `"*"`, and the organizer branch is removed or reshaped (research § Q(c) recommends `club: undefined`, with `event.organizer` kept for display). Pins A and D and the e2e test at `:182` move in that commit. On `/events/<seeded id>`, "Hosted by" changes from `Seed Organizer A|B|C` to "Seed Approved Club". Both detail-suite layers (`events-detail-characterization.test.ts`) must stay green. Their fixtures carry `organizer: null` and no `club` key, and the suite header excludes the select string and the club shape (`events-detail-characterization.test.ts:40-43`), so neither layer should move. The fake answers an embed from a fixture's `club` key, so pin D's select assertion is the one that must change.

## Measured join latency (A4)

Local stack, anon key, `GET /rest/v1/events?status=eq.approved&deleted_at=is.null&order=start_date.asc,id.asc`. There were 3 warm-up pairs, then N=20 per arm, interleaved.

| Comparison | Median before | Median after | Difference |
|------------|---------------|--------------|------------|
| `*` vs `EVENT_WITH_CLUB_SELECT` (the saved-events change; also what the detail route would pay at 04-11) | 0.89 ms | 1.24 ms | **+0.34 ms** |
| ten-column embed vs fifteen-column embed (the list routes' change) | 0.93 ms | 1.10 ms | **+0.17 ms** |

In Postgres, `EXPLAIN (ANALYZE, BUFFERS)` of the equivalent SQL shows one `Index Scan using clubs_pkey` per event row, with 0.137 ms execution. The seed has 2 approved events and 5 clubs, so these numbers are per-request overhead plus a two-row join, not a production timing (Phase 8 owns that).

## Decisions Made

See `key-decisions` in the frontmatter. The one 04-11 is most likely to rely on is the latency row for `*` vs embed. The same select on `/api/events/[id]` would add about a third of a millisecond locally.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Evidence accuracy] The index provenance in the research and plan was wrong**
- **Found during:** Task 2 (latency).
- **Issue:** The plan asked for "the statement that `events.club_id` is indexed (Phase 3, 03-05)". The index `idx_events_club_id` exists, but it is declared in `supabase/migrations/20260915214553_baseline.sql:1476` (the 03-04 baseline). 03-05's `20260915230000_fk_indexes_and_policy_gaps.sql` says in its header that it does not re-issue baseline indexes. It also does not serve this embed: the event-to-club lookup uses `clubs_pkey`.
- **Fix:** `evidence/club-join-latency.txt` § 4 states that the column is indexed, gives the true source, and shows from the EXPLAIN which index serves the embed.
- **Commit:** `9083430`.

**2. [Rule 3 - Acceptance wording] `grep -c "EVENT_WITH_CLUB_SELECT" saved-events/route.ts` returns 2, not 1**
- **Found during:** Task 2 acceptance.
- **Issue:** The criterion says "returns 1", but the import line also names the constant. There is exactly one select using it, which is the criterion's intent.
- **Fix:** None to the code. Recorded here.

**3. [Rule 2 - Evidence completeness] Pin B and pin C got guard tests beyond the moved assertion**
- **Found during:** Tasks 1 and 2.
- **Issue:** Moving the old assertions alone would not pin DEC-27's exclusion or the saved-events response.
- **Fix:** Added four tests: `contact_email` stays null even when the row carries one; an older ten-column embed yields null, not undefined; the embed literal names the five columns and not `contact_email`; a seeded-shape saved event carries the real club. The ledger records which of them hold before and after by design (the two guards) and which go red against the pre-fix code.
- **Commits:** `1150b0f`, `9083430`.

---

**Total deviations:** 3 (one evidence correction, one acceptance-wording note, one test-coverage addition). **Impact:** none on scope. No prohibition was crossed. Pins A and D, the organizer branch, the detail route's code, every PRESERVE suite and every e2e spec are unchanged.

## Issues Encountered

- Three suites mock `@/lib/tagMapping` with a factory that exports only `transformEventFromDB`: `src/app/api/events/route.test.ts` (PRESERVE), `get-events.test.ts` and `date-validation.test.ts`. In those suites `EVENT_WITH_CLUB_SELECT` resolves to `undefined`, so the list route's main query records `select(undefined, { count: "exact" })`. None of them asserts the main query's select string, so they pass unedited (PRESERVE suites may not be edited here). A future suite that asserts the main select through that mock would see `undefined`. The fix then belongs in the mock (`...jest.requireActual`), not in the route.
- The detail route's line `// Transform event to frontend format (cast needed: clubs relation may not exist in DB types)` is also stale. It was left alone because the plan scoped the comment change to the false line, and the cast remains necessary while the read selects `*`. If 04-11 ships the visual half, the cast and its comment go with it.

## Known Stubs

None. `contact_email: null` on the real-club branch is intentional (DEC-27) and commented at the line.

## Threat Flags

None beyond the plan's register. The five link columns now appear in anonymous, cacheable list payloads. They are public club profile fields, already rendered on `/clubs/[id]`, and T-04-10-02 accepts row visibility under F-022 (Phase 5). `contact_email` stays out (T-04-10-01, asserted by the DEFECT suite and the plan's regex).

## User Setup Required

None.

## Next Phase Readiness

- **04-11 (owner checkpoint):**
  - Put DEC-27's visual half to the owner. The pin table above is the exact state: B and C are FIXED, A and D are unmoved and green.
  - Until the owner decides, ROADMAP criterion 2 is PARTIAL. The join exists on the list routes and saved-events; the detail route and the fallback are unchanged.
  - F-080 stays Open in `findings.json`; it was not flipped here. If the owner declines, record the PARTIAL. If the owner accepts, pins A and D and the e2e test at `event-read-path.spec.ts:182` move in the fix commit.
  - The measured cost of giving the detail route the embed is +0.34 ms median locally.
  - DI-38 (the save-and-rsvp reload race) did not fire in this plan's single run, but it can still fail a final Playwright floor.
- **Floors after this plan:**
  - Jest: **721 passed / 0 skipped / 721**, 50 of 50 suites (+4 tests, all in the F-080 DEFECT suite)
  - tsc: clean, tests included
  - Lint: 0 errors / 19 warnings
  - Build: exit 0 (the Playwright webServer's `next build`)
  - Tag gate: `ok 18 files`
  - Ratchet: `committed=25 live=25 delta=0`
  - Playwright: **40** passed / 0 failed
- **Local stack:** reset and re-seeded after the Playwright run (10 personas, 5 clubs, 6 memberships, 5 events, 2 RSVPs, 0 saved events). Port 3000 is free (`lsof` exit=1).
- **Guards:** `git diff --stat a94d021` on `src/__tests__/api/events/*-characterization.test.ts` and `e2e/` is empty. No file under `supabase/migrations/` was touched.

## Self-Check: PASSED

- FOUND: src/lib/tagMapping.ts (`EVENT_CLUB_EMBED`, `EVENT_WITH_CLUB_SELECT`), evidence/club-embed.txt, evidence/club-join-latency.txt (114 lines, min 15), evidence/playwright.club-embed.txt (ends `exit=0`, 40 passed, 0 failed)
- FOUND: commits 1150b0f, 9083430
- No tracked file deleted by either task commit (`git diff --diff-filter=D` empty)

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 10*
