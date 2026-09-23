# Phase 4 completion — Slices 1 and 2, evidenced

**Plan:** 04-11 · **Phase:** 04-slices-1-2-saved-events-rsvp-and-the-event-read-path · **Recorded:** 2026-09-23
**Tree:** `main` @ `d0135a3` (the after-floor's line 1) + this plan's Task 3 commit · **Phase range:** `794556a..HEAD`

> **Success criteria 1, 3 and 4 are MET. Criterion 2 is PARTIAL on its first clause.** The seam kit runs
> the five Slice 1 handlers, RSVP counts are head-only COUNT reads, and every PRESERVE suite passed
> unedited across both slices. Tags are centralized with unknown tags surfaced, and `%`/`_` are escaped.
> The list routes and saved-events return the real club from a join, but `transformEventFromDB` still
> fabricates a club from the organizer string when a row has none, and `/api/events/[id]` still reads
> without the embed. The fix for that half changes seeded rendering. The owner checkpoint that could have
> authorized it was **resolved by rule — no owner answer was available — to `option-defer`**
> (`evidence/visual-fix-decision.md`).
>
> **REFAC-09 is Complete. REFAC-10 is PARTIAL**, naming its first clause: "events list uses a real club
> join instead of fabricating club objects". Its other three clauses are met.
>
> **No production access, no migration, no package change, no push.** CI on this phase's head is
> UNOBSERVED (§ 7).

---

## How to read this note

Every claim cites a committed path. `evidence/<file>` means
`.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/<file>`. The command in § 8
extracts every backticked path, resolves `evidence/` against the phase directory, and checks each one
against `git ls-files`. A path it cannot find counts as missing. The count must be 0. Commit hashes are
cited by their short form and can be checked with `git show`.

The floors: `evidence/floor.before.txt` (base `794556a`), `evidence/floor.slice-1-after.txt` (`9530d35`),
and `evidence/floor.phase-after.txt` (`d0135a3`). Nothing in this note is taken from a planning document
alone.

---

## 1. The four success criteria, clause by clause

### Criterion 1

> "Saved-events and RSVP handlers run through the seam kit, RSVP counts come from a count query or DB
> function instead of loading all rows, and characterization tests tagged PRESERVE or DEFECT (referencing
> their `F-nnn`) pass before and after the refactor."

| Clause | Verdict | Evidence |
|---|---|---|
| Saved-events and RSVP handlers run through the seam kit | MET | `a5ee4fc` adopts `createRequestContext()` + `requireUser()` in `src/app/api/events/[id]/save/route.ts`, `src/app/api/events/[id]/rsvp/route.ts`, `src/app/api/users/saved-events/route.ts` and `src/app/api/calendar/events/route.ts`. `fe4e9f9` adopts it in `src/app/api/events/[id]/friends/route.ts`. Byte-preservation runs are in `evidence/slice-1-seam-adoption.txt` |
| RSVP counts come from a count query instead of loading all rows | MET | `d40dee4`: two parallel `select("id", { count: "exact", head: true })` reads (DEC-23). `src/__tests__/api/events/rsvp-count-defect.test.ts` moved in the same commit (`evidence/defect-ledger.md`, the F-079 rows). F-079 is `Fixed` in `.planning/audit/findings.json` |
| Characterization tests tagged PRESERVE or DEFECT, citing their F-nnn, pass before and after | MET | Before: `evidence/slice-1-characterization.txt`, `evidence/slice-2-characterization.txt`, and the ancestry proofs `evidence/slice-1-unmodified.txt` and `evidence/slice-2-unmodified.txt`. The tests bite: `evidence/slice-1-mutation-check.txt`, `evidence/slice-2-mutation-check.txt`. After: each of the six Phase 4 characterization suites (`src/__tests__/api/events/*-characterization.test.ts`, all tagged PRESERVE) was last committed by the plan that wrote it (`git log --format=%h -- <suite>` prints only 04-02 commits `f16a7ad`/`1338aee`/`5ea616f` or 04-04 commits `72baa0c`/`5efe9ce`), and all pass at phase close (`evidence/jest.phase-after.suites.txt`). Tag gate: `scripts/check-characterization-tags.mjs --all` reports `ok 18 files` (`evidence/floor.phase-after.txt` block 17) |

**Criterion 1: MET.**

### Criterion 2

> "The events list returns clubs from a real join instead of fabricating club objects, and the dual date
> schema is resolved to the authoritative columns determined in AUDIT-19."

| Clause | Verdict | Evidence |
|---|---|---|
| The events list returns clubs from a real join instead of fabricating club objects | PARTIAL | **Delivered:** `1150b0f` gives the six list routes one shared `EVENT_WITH_CLUB_SELECT` embed with the five real link columns (`src/lib/tagMapping.ts`). `9083430` gives `src/app/api/users/saved-events/route.ts` the real club (F-080 pins B and C; `evidence/club-embed.txt`). **Not delivered:** the organizer fallback in `transformEventFromDB` still fabricates `{ id: organizer, name: organizer }` for any row with no embedded club. That includes a list row whose event has no `club_id`. `src/app/api/events/[id]/route.ts` GET still selects `*`, so the detail page says "Hosted by Seed Organizer C" (pins A and D in `src/__tests__/api/events/club-fabrication-defect.test.ts`; Playwright `DEFECT F-080` at `e2e/specs/event-read-path.spec.ts:182`, green in `evidence/playwright.phase-after.txt`). **Why:** the checkpoint was resolved by rule to `option-defer` (`evidence/visual-fix-decision.md`). Deferred as DI-39 (`evidence/deferred-items.md`) |
| The dual date schema is resolved to the authoritative columns determined in AUDIT-19 | MET | AUDIT-19 (`.planning/REQUIREMENTS.md`) determined `start_date`/`end_date`. The last references to `event_date`/`event_time` were removed by `a037d95` (analytics fixtures, webhook comment), `2db5d2a` (the `transformEventFromDB` docblock) and `9083430` (the detail route comment). Census: 8 lines in 4 files before (`evidence/floor.before.txt` block 14), **0 lines** after (`evidence/floor.phase-after.txt` block 14). F-050 is `Fixed` |

**Criterion 2: PARTIAL**, on its first clause only.

### Criterion 3

> "Tag mapping is centralized with unknown tags surfaced rather than silently coerced to SOCIAL, and `%`
> and `_` are escaped in search input."

| Clause | Verdict | Evidence |
|---|---|---|
| Tag mapping is centralized | MET | `2db5d2a` moves `TAG_ALIASES` and `mapTags` into `src/lib/eventTags.ts`. `src/lib/tagMapping.ts` re-exports it and has no alias table left. A golden table proved no mapped output changed (`evidence/tag-centralization.txt` §§ 1-2) |
| Unknown tags surfaced rather than silently coerced to SOCIAL | MET | `46731e6`: `partitionTags` returns `{ mapped, unmapped }`, and `transformEventFromDB` logs `[tags] Unmapped tags rendered as Social` with the event id. A completeness test over every `EventTag` member is in `src/lib/eventTags.test.ts` (123 tests, `evidence/jest.phase-after.suites.txt`). Unknown tags still render as Social (DEC-26). The clause's word is "silently", and that is now false. The six members that do not map to themselves are F-081's deferred half (DI-40), outside the clause's letter |
| `%` and `_` are escaped in search input | MET | `c20d59b`: `src/lib/searchFilter.ts` (`ilikeContainsFilter`), with 29 unit tests in `src/lib/searchFilter.test.ts`. `src/__tests__/api/events/search-escaping-defect.test.ts` moved in the same commit. The local-only probe `scripts/probes/search-escape-probe.ts` matched each character literally against the real PostgREST (`evidence/search-escape-probe.txt`). Shipped under DEC-32, not the checkpoint (§ 4) |

**Criterion 3: MET.**

### Criterion 4

> "After each slice the Playwright happy-path specs pass and the Validated workflow list in PROJECT.md is
> re-confirmed — browse, search, filter, save, and RSVP behave exactly as before, with no intentional
> visual change shipped alongside either slice."

| Clause | Verdict | Evidence |
|---|---|---|
| After each slice the Playwright happy-path specs pass | MET | Slice 1: 37 passed, 0 failed from a clean reset (`evidence/playwright.slice-1-after.txt`). Slice 2 and phase close: 40 passed, 0 failed from a clean reset (`evidence/playwright.phase-after.txt`). The first phase-close run was 39/1, failing only on DI-38's known harness race in `e2e/specs/save-and-rsvp.spec.ts:53`. It is kept in `evidence/playwright.phase-after.run1-flake.txt`, and the re-run was done under the plan's rule (`evidence/floor.phase-after.txt` block 13) |
| The Validated workflow list is re-confirmed | MET | Slice 1: `evidence/slice-1-close.md` § 3. Both slices: § 3 below, 16 of 16 rows |
| Browse, search, filter, save and RSVP behave exactly as before | MET on seeded data, with two decided production-visible fixes named | Every PRESERVE suite passed unedited across both slices (criterion 1 row 3). The harness's browse, search (`Music Night`), filter, save and RSVP tests pass from a clean reset (`evidence/playwright.phase-after.txt`). Two decided behaviour changes apply outside plain-text terms and the seed: a search containing `%`, `_`, `\`, `,`, a parenthesis or `"` now matches literally (F-082, DEC-32 (c) scopes this clause to terms the defect does not mishandle), and Load More now renders for a filtered result over 30 in production (F-083, DEC-25; the seed has 2 approved events). § 4 lists both |
| No intentional visual change shipped alongside either slice | MET, scoped by DEC-32 | Under `option-defer`, F-080's and F-081's seeded deltas did not ship (`evidence/visual-fix-decision.md`), and no page, component, hook or store file changed in the phase (§ 3's diff). The one seeded-visible result change is F-082's: a `%` or `_` search returns no seeded event instead of both, and the `a,b` feed shows "No events found" both before and after. DEC-32 (`evidence/phase-04-decisions.md`) argues that criterion 3 mandates this and criterion 4 is scoped, not overridden. The owner may reject that reading, since no owner ratified DEC-32 (§ 4). If so, this clause reads PARTIAL for exactly those inputs |

**Criterion 4: MET**, with the DEC-32 scoping stated above rather than absorbed.

---

## 2. Requirements, measured against their own sentences

**REFAC-09** — "Slice 1 (saved events + RSVP): handlers use the seam kit, RSVP counts use a count query or
DB function instead of loading all rows, characterization tests pass before and after"

| Clause | Verdict | Evidence |
|---|---|---|
| handlers use the seam kit | MET | `a5ee4fc`, `fe4e9f9`; `evidence/slice-1-seam-adoption.txt` |
| RSVP counts use a count query | MET | `d40dee4`; `evidence/defect-ledger.md` |
| characterization tests pass before and after | MET | `evidence/slice-1-characterization.txt` (before); `evidence/slice-1-close.md` § 1 and `evidence/jest.phase-after.suites.txt` (after, still green at phase close) |

**REFAC-09: Complete** (recorded Complete by 04-06, re-confirmed here after Slice 2).

**REFAC-10** — "Slice 2 (event read path): events list uses a real club join instead of fabricating club
objects, the dual date schema is resolved to the authoritative columns from AUDIT-19, tag mapping is
centralized with unknown tags surfaced instead of silently coerced to SOCIAL, `%`/`_` are escaped in search"

| Clause | Verdict | Evidence |
|---|---|---|
| events list uses a real club join instead of fabricating club objects | PARTIAL | § 1, criterion 2 row 1. The join exists on the list routes; the fabrication remains (DI-39) |
| the dual date schema is resolved to the authoritative columns from AUDIT-19 | MET | § 1, criterion 2 row 2 |
| tag mapping is centralized with unknown tags surfaced | MET | § 1, criterion 3 rows 1-2 |
| `%`/`_` are escaped in search | MET | § 1, criterion 3 row 3 |

**REFAC-10: PARTIAL.** The unmet clause is "events list uses a real club join instead of fabricating club
objects". It closes when DI-39 ships (`evidence/visual-fix-decision.md` § "Reversing this decision").

---

## 3. Validated-workflow re-confirmation, after both slices

The phase's production footprint is `git diff --name-only 794556a HEAD -- src/app src/lib src/server
src/components src/hooks src/store src/proxy.ts src/types supabase/migrations`, excluding test files:

- **Slice 1 routes:** save, rsvp, friends, saved-events, calendar/events.
- **Slice 2 routes:** `src/app/api/events/route.ts`; `src/app/api/events/[id]/route.ts` (a GET comment only, `9083430`); and events/new, events/following, events/happening-now and events/popular (the select literal only, `1150b0f`).
- **Libraries:** `src/lib/tagMapping.ts`, `src/lib/eventTags.ts`, `src/lib/searchFilter.ts`, `src/lib/eventCursor.ts`.
- **Seam files:** `src/server/context.ts`, `src/server/db/elevated/index.ts` (comment), `src/server/db/elevated/REGISTRY.md`.

**No page, component, hook, store, proxy, type or migration file is in that diff.**

Test counts are from `evidence/jest.phase-after.suites.txt`. Playwright tests are from
`evidence/playwright.phase-after.txt` (40 passed). All 16 bullets of `.planning/PROJECT.md`
(`grep -c '^- ✓'` = 16) are listed below.

| # | Validated workflow | Touched by the phase? | Re-confirmed after both slices by |
|---|---|---|---|
| 1 | Google OAuth sign-in; non-McGill rejected | No: `src/app/auth/`, `src/proxy.ts` absent from the diff | `src/app/auth/callback/route.test.ts` (8); `src/proxy.test.ts` (20); `e2e/auth.setup.ts` persona sign-ins |
| 2 | Anonymous visitors browse public event and club content | Yes: the list and detail read path | `e2e/specs/anonymous-browse.spec.ts` (3); `e2e/specs/event-read-path.spec.ts` PRESERVE tests; `src/__tests__/api/events/events-list-characterization.test.ts` (33) and `src/__tests__/api/events/events-detail-characterization.test.ts` (16), both unedited |
| 3 | Onboarding interest tags; unfinished onboarding guarded | No: `src/proxy.ts`, `src/app/onboarding/` absent | `src/proxy.test.ts` (20); `e2e/specs/protected-route-redirect.spec.ts` (2) |
| 4 | Browse, search, filter by tag, date, time of day | **Yes, Slice 2's own workflow** | `src/__tests__/api/events/events-list-characterization.test.ts` (33, unedited); `src/app/api/events/route.test.ts` (19); `src/__tests__/api/events/get-events.test.ts` (24); `src/hooks/useEvents.test.ts` (20); `src/components/events/EventFilters.test.tsx` (5); `src/components/events/FilterSidebar.test.tsx` (4); `src/lib/eventTags.test.ts` (123); `src/lib/searchFilter.test.ts` (29); `src/lib/eventCursor.test.ts` (33); Playwright `e2e/specs/anonymous-browse.spec.ts` search test and all 12 of `e2e/specs/event-read-path.spec.ts` |
| 5 | Save/unsave and RSVP | **Yes, Slice 1's own workflow** | `e2e/specs/save-and-rsvp.spec.ts` (3; its first test passed in the floor run after DI-38 fired in run 1). PRESERVE suites, all unedited: `src/__tests__/api/events/save-characterization.test.ts` (21), `src/__tests__/api/events/saved-events-characterization.test.ts` (14), `src/__tests__/api/events/calendar-events-characterization.test.ts` (12), `src/__tests__/api/events/rsvp-characterization.test.ts` (20). Also `src/__tests__/api/events/rsvp.test.ts` (14) |
| 6 | Recommendations with popularity fallback (F-041 caveat) | Only `src/app/api/events/popular/route.ts`'s select, which gained five club columns no renderer reads (`evidence/club-embed.txt`) | `src/lib/__tests__/recommendations.test.ts` (13); `src/lib/diversity.test.ts` (12). The popular route has no dedicated suite; its change is shown non-rendering by the consumer census |
| 7 | Organizers create/edit clubs, post events, invite, roles (F-016 caveat) | Only a GET comment in `src/app/api/events/[id]/route.ts`; PATCH untouched | `e2e/specs/club-owner-surfaces.spec.ts` (3); `src/__tests__/api/events/date-validation.test.ts` (22, create and PATCH) |
| 8 | Organizer events auto-approved; others moderated | No: `src/app/api/events/create/`, moderation routes absent | `src/__tests__/api/events/date-validation.test.ts` (22); `e2e/specs/admin-moderation-queue.spec.ts` (3) |
| 9 | Follow/unfollow clubs; public club pages | Only `src/app/api/events/following/route.ts`'s select (as row 6) | `e2e/specs/anonymous-browse.spec.ts` "an anonymous visitor browses public club content". The following route has no dedicated suite; `evidence/club-embed.txt` shows the change is non-rendering |
| 10 | Organizer event and club analytics | No: routes absent; suite fixtures moved to `start_date` (`a037d95`) | `src/__tests__/api/events/analytics.test.ts` (4); `src/__tests__/api/clubs/analytics.test.ts` (5); `src/app/api/admin/analytics/users/route.test.ts` (3) |
| 11 | Reviews and aggregate feedback | No: reviews route absent | `src/__tests__/api/events/reviews.test.ts` (13) |
| 12 | Admin moderation, bans, reports, audit log (F-007 caveat) | No | `e2e/specs/admin-moderation-queue.spec.ts` (3); `e2e/specs/banned-redirect.spec.ts` (3); `e2e/specs/admin-login-cookie-equivalence.spec.ts` (1); `src/lib/__tests__/ban.test.ts` (4); `src/__tests__/moderation/audit-shape.test.ts` (6) |
| 13 | In-app notifications and email reminders (F-038 caveat) | No: `src/app/api/notifications/`, `src/app/api/cron/` absent | Untouched per the diff. **No automated test covers it**, before or after |
| 14 | Instagram scraper pipeline | No: `src/lib/classifier.ts` absent; the edge function changed one comment (`a037d95`) | `src/lib/classifier.test.ts` (39) |
| 15 | A/B experiments (F-017 caveat) | No | `src/lib/experiments.test.ts` (11) |
| 16 | Interaction tracking | No: `src/app/api/interactions/`, `src/hooks/useTracking.ts` absent | Untouched per the diff. **No dedicated suite exists** |

Rows 13 and 16 have no test. That gap is stated rather than filled, exactly as in `evidence/slice-1-close.md`.

---

## 4. Every intentional behaviour change the phase shipped, with its authority

| Change | Finding | Commit | Authority | Visible on seeded data? |
|---|---|---|---|---|
| A search containing `%`, `_`, `\`, `,`, a parenthesis or `"` matches literally. `%`/`_` returned both approved events before and none after; `a,b` went from an API 500 to a 200 | F-082 | `c20d59b` | **DEC-32**, not the 04-11 checkpoint. Its rule (b), restated: a seeded-visible fix goes to the checkpoint when its ROADMAP clause can be delivered without the visible change, and ships under a numbered decision only when **no** delivery leaves seeded output unchanged. Criterion 3 names `%` and `_`, so no delivery can | Yes, for those inputs only (`evidence/playwright.escaping.txt`) |
| Load More renders for a filtered feed over 30 results; `/api/events` emits `nextCursor`/`prevCursor` and a 400 for a bad cursor | F-083 | `38a7091`, `ea71bb6` | DEC-25 (planner's decision, no owner override) | No: the seed has 2 approved events. Traversal proven in `evidence/playwright.pagination.txt` |
| RSVP counts are no longer capped at `max_rows` (1000); identical below it | F-079 | `d40dee4` | DEC-23 | No (2 seeded RSVPs) |
| The friends-going fallback returns real mutual follows | F-071 | `1351480` | Registered finding, fixed in Slice 1 | No: the fallback runs only when the RPC errors (`evidence/slice-1-close.md` § 5) |
| Three server-side auth-error `console.warn` lines dropped; the 401 bytes are unchanged | — | `a5ee4fc` | DEC-29 (three lines, not four; `evidence/slice-1-close.md` § 6) | No |
| A `[tags]` server warning per event with an unmapped tag | F-081 (surfacing half) | `46731e6` | DEC-26 | No: log only |
| List payloads carry five club link columns; saved-events carries the real club | F-080 (non-visual half) | `1150b0f`, `9083430` | DEC-27 | No: no renderer reads them (`evidence/club-embed.txt`) |

F-080's visual half and F-081's identity mappings did **not** ship (`option-defer`, by rule). Beyond the
rows above, plain-text search, browse, filter, save and RSVP render identically on seeded data. The
evidence is the unedited PRESERVE suites (§ 1, criterion 1) and the harness from a clean reset
(`evidence/playwright.phase-after.txt`, including the `Music Night` search and the three save/RSVP tests).

---

## 5. Deferred items, assumptions and findings

**DI dispositions** (full table: `evidence/deferred-items.md` Part 5):

- **DI-24:** CLOSED (`9530d35`, `ea71bb6`).
- **DI-25:** re-deferred to Phase 5 per DEC-28 (`evidence/di-25-enumeration.txt`).
- **DI-31:** CLOSED by 04-03 (`59a4975`).
- **DI-34:** CLOSED by 04-03 (`c85cf71`; `evidence/boundary-widening.txt`).
- **DI-35:** CLOSED by 04-03 (`29c354b`; `evidence/di-35-narrowing.txt`). The fail-closed ban check stays with REFAC-11 in Phase 5.
- **DI-36:** Phase 5.
- **DI-37:** travels with DI-40.
- **DI-38:** re-owned to Phase 5. It fired again here.
- **DI-39 and DI-40 are new.** Both are owned by the phase owner.

**Research assumptions:**

- A1 stays ASSUMED (Phase 8).
- A2 CLOSED (`evidence/search-escape-probe.txt`).
- A3 moot (DEC-30).
- A4 CLOSED (`evidence/club-join-latency.txt`, +0.34 ms median).
- A5 CLOSED (`evidence/di-25-enumeration.txt`).
- A6 decided by DEC-25 and executed.
- A7 deferred by rule (DI-40).
- A8 CLOSED (`evidence/floor.before.txt`).

**Findings.**

- **Closed this phase (`Fixed` in `.planning/audit/findings.json`, each with a resolution citing this note or `evidence/slice-1-close.md`):**
  - F-079 and F-071 (04-06).
  - F-050, F-066 (both clauses), F-082 and F-083 (this plan).
  - F-083's resolution carries the composite `(start_date, id)` index follow-up to Phase 8 (`evidence/pagination-contract.txt` § 4).
- **Open with a partial fix recorded:**
  - F-080 (DI-39).
  - F-081 (DI-40).
- **Open, other owners:** F-084 and F-085 (Phase 6).

The register was regenerated by `.planning/audit/tools/gen-foundation-audit.mjs`: Open 71 → 67, Fixed 14 → 18.

---

## 6. The phase floor, at close

From `evidence/floor.phase-after.txt`, on `d0135a3`:

- **Jest:** 721 passed, 0 skipped, 50 of 50 suites. The before-floor was 358/5 with 1 skipped suite.
- **Lint:** 0 errors / 19 warnings.
- **tsc:** clean, test files included.
- **Audit:** 0 high, 0 critical.
- **Ratchet:** `committed=25 live=25 delta=0`.
- **Migration filenames:** 4, unchanged.
- **validate --quick:** 118/2/1, the same two by-design FAILs.
- **pgTAP:** 86 on both runs; 040 is 21 SKIP unseeded and 21 ok seeded. Equal to the before-floor, with no schema change.
- **Playwright:** 40/0.
- **Stale-date census:** 0.
- **`(supabase as any)` under `src/app/api/`:** 0.
- **After the register edit** (block 17): `validate.mjs --check findings` passes 8/8, and the tag gate reports `ok 18 files`.
- **Stack state:** left reset and seeded (block 16), port 3000 free.

---

## 7. CI observation

CI run UNOBSERVED — no push was authorized in this phase.

The phase's commits are local on `main`. The last observed green CI run is Phase 3's `35055404669`
(`evidence/deferred-items.md`, DI-32 row). Whether `ci`, `types` and `e2e` pass on this head is unknown
until the owner pushes. No claim is made without a run.

---

## 8. Citation count

Command, run from the repository root after this note was staged:

```
node -e 'const fs=require("fs"),cp=require("child_process");const D=".planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/";const t=fs.readFileSync(D+"evidence/PHASE-4-COMPLETION.md","utf8");const tr=new Set(cp.execSync("git ls-files").toString().split("\n"));const ps=new Set([...t.matchAll(/`((?:\.planning|src|e2e|scripts|supabase|evidence)\/[^`\s*<]+?)(?::\d+(?:-\d+)?)?`/g)].map(m=>m[1].startsWith("evidence/")?D+m[1]:m[1]).map(p=>p.replace(/\/$/,"")));const miss=[...ps].filter(p=>!tr.has(p)&&![...tr].some(f=>f.startsWith(p+"/")));console.log("distinct="+ps.size+" missing="+miss.length);miss.forEach(m=>console.log("MISSING "+m))'
```

Result: **`distinct=100 missing=0`**. 100 distinct committed paths are cited, and 0 are missing.

*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 04-11 — Task 3*
