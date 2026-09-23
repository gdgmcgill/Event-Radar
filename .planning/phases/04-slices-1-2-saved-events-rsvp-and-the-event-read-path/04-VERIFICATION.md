---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
verified: 2026-09-23T23:51:44Z
status: human_needed
score: 3/4 must-haves verified (1 PARTIAL, disclosed, pending owner decision)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Read evidence/visual-fix-decision.md and decide option-defer (status quo, already shipped) / option-ship-club / option-ship-both for F-080's visual half (real club on the detail page) and F-081's six tag identity mappings."
    expected: "Owner records a signed paragraph under 'Outcome' in evidence/visual-fix-decision.md naming the chosen option. If option-ship-club or option-ship-both, a follow-up plan executes the code changes listed under 'Reversing this decision' in the same file, then REFAC-10 and ROADMAP criterion 2 flip from PARTIAL to Complete/MET."
    why_human: "This is a scope/product decision (does the app show the real club or the organizer string on the event detail page, and do 6 tags get renamed), not a code-correctness question. The plan's own must_haves defined 'resolved by rule when no owner answer is available' as an acceptable phase-closing outcome, and the rule fired exactly as written — but the rule's own text calls it 'a default, not a verdict' and explicitly asks for an owner to close the question in writing. No amount of re-running tests resolves it: the code artifacts on both sides of the decision already exist (real join present on list routes; fabrication fallback still present in the shared transform and the detail route), each behind the option not chosen."
---

# Phase 4: Slices 1–2 — Saved Events/RSVP and the Event Read Path Verification Report

**Phase Goal:** The seam kit is proven end-to-end on the two highest-traffic user workflows, and the data-shape confusion sitting under the event read path is settled before anything downstream depends on it.
**Verified:** 2026-09-23T23:51:44Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Derived from ROADMAP.md's 4 stated Success Criteria for Phase 4 (the roadmap contract), cross-checked against REQUIREMENTS.md (REFAC-09, REFAC-10) and the phase's own evidence.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Saved-events and RSVP handlers run through the seam kit; RSVP counts come from a count query instead of loading all rows; PRESERVE/DEFECT characterization tests pass before and after | ✓ VERIFIED | `createRequestContext()`/`requireUser()` confirmed present in `src/app/api/events/[id]/save/route.ts`, `src/app/api/events/[id]/rsvp/route.ts`, `src/app/api/users/saved-events/route.ts`, `src/app/api/calendar/events/route.ts`, `src/app/api/events/[id]/friends/route.ts` (grep, re-derived). RSVP route uses two `.select("id", { count: "exact", head: true })` reads at `src/app/api/events/[id]/rsvp/route.ts:104,109` — no `select("*")`/row-loading count pattern remains. Independently re-ran `npx jest --ci`: **50 suites, 744 passed, 0 skipped** (matches REVIEW-FIX's post-fix floor). `node scripts/check-characterization-tags.mjs --all` → `ok 18 files`, all 6 Phase 4 PRESERVE/DEFECT suites present and tagged with their F-nnn |
| 2 | The events list returns clubs from a real join instead of fabricating club objects, and the dual date schema is resolved to the authoritative columns from AUDIT-19 | ⚠️ PARTIAL — see Human Verification | **Date-schema clause VERIFIED:** `git grep -c "event_date\|event_time"` in application code returns 0 (re-derived); AUDIT-19 columns `start_date`/`end_date` are the ones in use. **Club-join clause: real join confirmed present** on 8 route files including `src/app/api/events/[id]/route.ts` (`grep -rln "EVENT_WITH_CLUB_SELECT" src/app/api` — 8 files), but the shared transform (`src/lib/tagMapping.ts:125-129`, `else if (dbEvent.organizer) { club = { id: dbEvent.organizer, name: dbEvent.organizer } }`) still fabricates a club, and the detail route (`src/app/api/events/[id]/route.ts:87`) still `.select("*")` with no embed — confirmed by reading the route's own in-code comment, which names this as the deliberately-deferred half of F-080. This is disclosed as PARTIAL by ROADMAP.md itself (not a hidden gap) and routed to the phase owner via the 04-11 checkpoint (`evidence/visual-fix-decision.md`), resolved by rule to `option-defer` because no owner was present |
| 3 | Tag mapping is centralized with unknown tags surfaced rather than silently coerced to SOCIAL; `%` and `_` are escaped in search input | ✓ VERIFIED | `src/lib/eventTags.ts` holds `TAG_ALIASES`/`partitionTags`/`mapTags`; `src/lib/tagMapping.ts` re-exports them and has no alias table of its own (grep confirmed). `partitionTags` returns `{mapped, unmapped}` and `src/lib/tagMapping.ts:97` logs `"[tags] Unmapped tags rendered as Social"`. `src/lib/searchFilter.ts` implements `ilikeContainsFilter`/`escapeLikeLiteral`/`postgrestQuotedValue`, wired into `src/app/api/events/route.ts:357-358` (grep confirmed, not orphaned). Behavioral spot-check: `npx jest -t "constructor"` → the CR-01 prototype-pollution regression test (`eventTags.test.ts`) passes, confirming `TAG_ALIASES` lookup uses `Object.prototype.hasOwnProperty.call(...)` and not a bare `[key]` lookup |
| 4 | After each slice the Playwright happy-path specs pass and the Validated workflow list in PROJECT.md is re-confirmed; browse/search/filter/save/RSVP behave as before with no intentional visual change shipped | ✓ VERIFIED | `evidence/playwright.phase-after.txt` tail shows `40 passed (23.8s)` / `exit=0` (file exists, read directly — not re-run per task instructions). `git status --porcelain` at HEAD is clean apart from the three pre-existing untracked paths (`.agents/`, `docs/product-master-plan.md`, `skills-lock.json`) — no uncommitted app changes. `git diff --name-only 794556a HEAD` (per `PHASE-4-COMPLETION.md` §3) confirms no page/component/hook/store file is in the phase diff, consistent with "no intentional visual change" beyond the two disclosed, decided exceptions (F-082 search-character behavior under DEC-32; F-083 pagination under DEC-25), both named and scoped in the completion note |

**Score:** 3/4 truths VERIFIED, 1 truth PARTIAL and routed to human verification (not counted as verified; not a code defect).

### Post-Completion Code Review Fixes — Regression Check

`04-REVIEW.md` (standard depth, 52 files) found 1 Critical + 3 Warnings *after* `PHASE-4-COMPLETION.md` was written. `04-REVIEW-FIX.md` claims all 4 were fixed in commits `e45552a`, `c201ca5`, `8f3accb`, `ef49fc0` (+ `49c54d8` docs). Independently re-verified, not trusted from the summary:

| Finding | Fix commit | Re-verified how | Result |
|---|---|---|---|
| CR-01 (prototype-key tag lookup) | `e45552a` | `grep -n "hasOwnProperty" src/lib/eventTags.ts` + `npx jest -t "constructor"` | ✓ Present, test passes |
| WR-01 (unvalidated page/limit) | `c201ca5` | Commit exists (`git show --stat`), part of full `npx jest --ci` run (744/744) | ✓ Commit present, full suite green |
| WR-02 (friends fallback swallows errors) | `8f3accb` | Commit exists; friends-defect suite is part of the 744-passing set | ✓ Commit present |
| WR-03 (calendar-impossible cursor dates) | `ef49fc0` | Commit exists; `eventCursor.test.ts` part of the 744-passing set | ✓ Commit present |

No regression: re-derived `npx jest --ci` (744/744, 0 skipped), `npx tsc --noEmit` (clean), `npm run lint` (0 errors/19 warnings, all pre-existing per REVIEW-FIX), `node scripts/check-elevated-ratchet.mjs` (`committed=25 live=25 delta=0 PASS`), `node scripts/check-characterization-tags.mjs --all` (`ok 18 files`), `grep -rn "supabase as any" src/app/api` (0 matches) — all match the fix report's claimed post-fix floor exactly. The completion note's own floor (721 passed, pre-review-fix) is now superseded by 744; this is expected and the REVIEW-FIX report is explicit about it (+23 new tests, no PRESERVE assertion weakened).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/events/[id]/save/route.ts`, `rsvp/route.ts`, `src/app/api/users/saved-events/route.ts`, `src/app/api/calendar/events/route.ts`, `src/app/api/events/[id]/friends/route.ts` | Seam kit adoption | ✓ VERIFIED | All 5 import and call `createRequestContext()`; save/rsvp/saved-events/calendar also call `requireUser()` (rsvp and friends are deliberately anonymous-tolerant, documented in-line) |
| `src/lib/eventTags.ts` | Centralized tag mapping module | ✓ VERIFIED | Exists, substantive (123 tests in `eventTags.test.ts`), wired (re-exported by `tagMapping.ts`, consumed by all list/detail routes) |
| `src/lib/searchFilter.ts` | `%`/`_` escaping | ✓ VERIFIED | Exists, substantive (29 tests), wired into `src/app/api/events/route.ts` |
| `src/lib/eventCursor.ts` | Cursor pagination contract (F-083) | ✓ VERIFIED | Exists, wired into `src/app/api/events/route.ts` (`decodeEventCursor` called at line 319) |
| `src/lib/tagMapping.ts` (`EVENT_WITH_CLUB_SELECT`, `transformEventFromDB`) | Shared club embed + transform | ⚠️ PARTIAL | Embed constant exists and is used by 8 routes; the transform's `else if (dbEvent.organizer)` branch still fabricates a club object — the disclosed unmet clause |
| `evidence/PHASE-4-COMPLETION.md` | Criteria/requirements evidenced with citations | ✓ VERIFIED | 263 lines, 100 distinct cited paths, independently re-ran the citation-check script from the note itself: `distinct=100 missing=0` |
| `evidence/visual-fix-decision.md` | Checkpoint outcome record | ✓ VERIFIED | 65 lines, records option-defer resolved by rule, names the reversal path explicitly |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/api/events/route.ts` | `src/lib/searchFilter.ts` | `ilikeContainsFilter()` calls at lines 357-358 | WIRED | Confirmed by grep; not merely imported |
| `src/app/api/events/route.ts` | `src/lib/eventCursor.ts` | `decodeEventCursor()` call at line 319 | WIRED | Confirmed |
| `src/lib/tagMapping.ts` | `src/lib/eventTags.ts` | `import { mapTags, partitionTags }` | WIRED | Re-export confirmed, no duplicate alias table left in `tagMapping.ts` |
| `PHASE-4-COMPLETION.md` | `.planning/audit/findings.json` | Findings the note calls "Fixed" are actually `Fixed` in the register | WIRED | Independently queried the register: F-079, F-071, F-050, F-066, F-082, F-083 all `Fixed`; F-080, F-081 both `Open` — exactly as the note states |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| REFAC-09 | 04-01, 04-02, 04-03, 04-05, 04-06, 04-11 | Slice 1 seam kit + count queries + characterization pass before/after | ✓ SATISFIED | REQUIREMENTS.md marks `[x]` Complete; independently re-derived (seam kit grep, count-query grep, 744/744 Jest) |
| REFAC-10 | 04-01, 04-04, 04-06..04-11 | Slice 2: real club join, dual-date resolution, centralized tags, search escaping | ⚠️ PARTIAL (disclosed) | REQUIREMENTS.md marks `[ ]` (PARTIAL), naming the same unmet clause independently confirmed in this report's Truth #2. Three of four clauses SATISFIED; one clause pending an owner decision, not a code defect |

No orphaned requirements: `grep -n "Phase 4" .planning/REQUIREMENTS.md` returns only the REFAC-09/REFAC-10 rows and the REFAC-04 cross-reference (F-071, closed this phase per the completion note and independently confirmed `Fixed` in the register) — all plans' `requirements:` frontmatter fields are exactly `[REFAC-09]`, `[REFAC-10]`, or `[REFAC-09, REFAC-10]`, matching the phase's declared scope.

### Anti-Patterns Found

None. Scanned all 11 phase-touched route/lib files (`save`, `rsvp`, `saved-events`, `calendar/events`, `friends`, `events/route.ts`, `events/[id]/route.ts`, `tagMapping.ts`, `eventTags.ts`, `searchFilter.ts`, `eventCursor.ts`) for `TBD|FIXME|XXX` — zero matches. `npm run lint` reports 0 errors; the 19 warnings are all in files outside this phase's diff (`my-events/page.tsx`, `app/page.tsx`, `SignOutButton.tsx`, `ClubDiscoveryCard.tsx`, `ClubSettingsTab.tsx`, `FollowButton.tsx`, `OnboardingWizard.tsx`), confirmed pre-existing per `04-REVIEW-FIX.md`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full test suite passes at claimed post-review-fix count | `npx jest --ci` | 50 suites, 744 passed, 0 skipped | ✓ PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint clean of errors | `npm run lint` | 0 errors, 19 warnings (pre-existing) | ✓ PASS |
| Elevated-client ratchet holds | `node scripts/check-elevated-ratchet.mjs` | `committed=25 live=25 delta=0 PASS` | ✓ PASS |
| Characterization tag gate | `node scripts/check-characterization-tags.mjs --all` | `ok 18 files` | ✓ PASS |
| No untyped service-role casts under API routes | `grep -rn "supabase as any" src/app/api` | 0 matches | ✓ PASS |
| CR-01 prototype-pollution regression fix holds | `npx jest -t "constructor"` | 1 passed (eventTags.test.ts) | ✓ PASS |
| Completion note's citation-count script | re-ran the exact script from `PHASE-4-COMPLETION.md` §8 | `distinct=100 missing=0` | ✓ PASS |
| Playwright happy-path specs (phase close) | Not re-run (task instruction: do not run Playwright unless nothing else can verify) | `evidence/playwright.phase-after.txt` read directly: `40 passed (23.8s)`, `exit=0` | ✓ PASS (evidence-file based) |

Step 7c (Probe Execution): No `scripts/*/tests/probe-*.sh` convention exists in this repo, and neither the PLAN nor SUMMARY files declare a probe of that shape. The phase's own "probe" is `scripts/probes/search-escape-probe.ts` (F-082/A2), a local-only live-PostgREST check documented as already run and logged in `evidence/search-escape-probe.txt`; re-running it would require the local Supabase stack, which the task instructions say to avoid unless nothing else can verify — and the escaping logic was already independently confirmed via source inspection (`searchFilter.ts` wired into `route.ts`) and the passing `searchFilter.test.ts` unit suite (29 tests, part of the 744). Not re-run; not required to reach a verifiable status on Truth #3.

### Human Verification Required

### 1. Owner decision on F-080/F-081 (club fabrication and tag identity mappings)

**Test:** Read `evidence/visual-fix-decision.md`. Decide whether to keep `option-defer` (current, shipped state) or authorize `option-ship-club` / `option-ship-both`, per the options table in that file.
**Expected:** A signed paragraph is added under that file's "Outcome" section naming the chosen option. If a ship option is chosen, a follow-up plan (the file names the exact commits/changes required) executes it, and REFAC-10 / ROADMAP criterion 2 are updated from PARTIAL to Complete/MET at that time.
**Why human:** This is a product/UX scope decision (what "Hosted by" shows on the event detail page; whether 6 tags get renamed on badges and filters), not a code-correctness defect. Both code paths already exist in the repository — the real join (shipped) and the fabrication fallback (also still present, intentionally, pending this decision). No test or grep can determine which the phase owner wants; the plan's own `04-11-PLAN.md` must_haves explicitly designed "resolved by rule when no owner answer is available" as one of two valid resolutions to this exact question, and the rule fired because no owner was present during execution — not because of a defect.

### Gaps Summary

No code defects were found. All re-derived commands (`npx jest --ci`, `npx tsc --noEmit`, `npm run lint`, `node scripts/check-elevated-ratchet.mjs`, `node scripts/check-characterization-tags.mjs --all`, `grep -rn "supabase as any" src/app/api`) match the phase's own claimed floor exactly, including the post-review-fix delta (721 → 744 tests). The only unmet item is REFAC-10's first clause ("events list uses a real club join instead of fabricating club objects" — specifically the organizer-fallback branch of `transformEventFromDB` and the missing embed on `GET /api/events/[id]`), which is:

1. Disclosed, not hidden — ROADMAP.md's own Phase 4 section states criterion 2 is PARTIAL and names the clause; REQUIREMENTS.md's REFAC-10 row states the same with citations.
2. The product of a checkpoint mechanism the plan itself designed (`04-11-PLAN.md` must_haves) to handle exactly this "owner unavailable" case, executed exactly as written (rule fired, no executor discretion used, recorded in `evidence/visual-fix-decision.md`).
3. Reversible on record: the same evidence file lists the exact commits/changes needed to ship either alternative, so closing it later does not require re-discovery.
4. Not a blocker for the next phase's stated dependency: ROADMAP.md's Phase 5 entry names its dependency on Phase 4 as "the characterization harness from Slices 1–2 must exist," not the club-join clause — and the characterization harness (Truth #1, criterion 1) is fully VERIFIED.

Given this is a genuine, disclosed, designed-for human decision point rather than a code defect or a hidden regression, status is `human_needed` rather than `gaps_found`. It is not `passed` because criterion 2's first clause is, as a factual matter, not yet true in the codebase, and marking it passed via override would substitute this verifier's judgment for the owner decision the phase's own plan explicitly reserved for a human.

---

_Verified: 2026-09-23T23:51:44Z_
_Verifier: Claude (gsd-verifier)_
