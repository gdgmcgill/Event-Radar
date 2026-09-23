---
phase: 4
slug: slices-1-2-saved-events-rsvp-and-the-event-read-path
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-16
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from
> `04-RESEARCH.md` § Validation Architecture; every number there was produced by running the command.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.2.0 via `ts-jest` 29.4.6, two projects (`node`, `jsdom`; routing is by directory, `src/hooks/**` → jsdom) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --ci --selectProjects node <path>` (≈2 s for one suite) |
| **Full suite command** | `npx jest --ci` (measured 2.4 s, 35 suites) |
| **DB tests** | `supabase test db --local` (pgTAP, 86 assertions) |
| **E2E** | `npx playwright test` (config builds and starts the app; never `next dev`) — 27 specs |
| **Structural gates** | `node scripts/check-elevated-ratchet.mjs` (24/24, shrink-only), `node scripts/check-migration-filenames.mjs`, `node .planning/audit/tools/validate.mjs --quick` (118 passed, 2 by-design failures) |
| **Estimated runtime** | ~3 s unit; ~2 min pgTAP + Playwright from a clean reset |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --ci --selectProjects node <the suite this task touched>`
- **After every plan wave:** Run `npx jest --ci` + `npm run lint` + `npx tsc --noEmit` + `node scripts/check-elevated-ratchet.mjs`
- **After every slice (the "after" evidence):** the full floor table in RESEARCH § Validation Architecture, plus `npx playwright test` and `supabase test db --local`
- **Before `/gsd-verify-work`:** full floor green and a green CI run id for all three jobs (`ci`, `types`, `e2e`)
- **Max feedback latency:** 5 seconds for unit sampling

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | REFAC-09, REFAC-10 | T-04-01-05 | floor measured on a named commit | floor capture | `head -1 evidence/floor.before.txt` matches `base=<sha>`; 13 exit-coded blocks | ❌ W0 | ⬜ |
| 04-01-T2 | 04-01 | 1 | REFAC-09, REFAC-10 | T-04-01-01, -02 | every DEFECT id resolves in the register | gate | `node .planning/audit/tools/validate.mjs --check findings && node scripts/check-characterization-tags.mjs --all` | ❌ W0 | ⬜ |
| 04-01-T3 | 04-01 | 1 | REFAC-09, REFAC-10 | T-04-01-SC | no package enters the main tree | doc + census | `grep -c '^## DEC-' evidence/phase-04-decisions.md` ≥ 10 (DEC-23..DEC-32); `git worktree list` one line | ❌ W0 | ⬜ |
| 04-02-T1 | 04-02 | 2 | REFAC-09 | T-04-02-01, -02 | save/saved-events/calendar pinned on unmodified source | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "(save\|saved-events\|calendar-events)-characterization\|saved-events-time-floor-defect"` | ❌ W0 | ⬜ |
| 04-02-T2 | 04-02 | 2 | REFAC-09 | T-04-02-04 | body user_id ≠ session → 403 preserved; count blind to implementation | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "rsvp-(characterization\|count-defect)"` | ❌ W0 | ⬜ |
| 04-02-T3 | 04-02 | 2 | REFAC-09 | T-04-02-02 | every assertion bites (mutation cycles) | e2e + unit | `npx jest --ci && node scripts/check-characterization-tags.mjs --all`; `npx playwright test` (before + 1) | ⚠️ extends existing spec | ⬜ |
| 04-03-T1 | 04-03 | 2 | REFAC-09 | T-04-03-01, -03 | indirect service-role reach fails lint and the ratchet | gate | `node scripts/check-elevated-ratchet.mjs && npm run lint` (committed=25 live=25 delta=0) | ✅ | ⬜ |
| 04-03-T2 | 04-03 | 2 | REFAC-09 | T-04-03-02, -04 | dynamic import / bare key read fail lint; gates in CI | gate | `npm run lint && node scripts/check-characterization-tags.mjs --all && grep -c "check-elevated-ratchet.mjs" .github/workflows/ci.yml` | ✅ | ⬜ |
| 04-03-T3 | 04-03 | 2 | REFAC-09 | T-04-03-05 | seam no longer implies a ban check | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "src/server" && npx tsc --noEmit` | ✅ | ⬜ |
| 04-04-T1 | 04-04 | 3 | REFAC-10 | T-04-04-03 | list contract no Slice 2 fix may move; F-082/F-083 pinned | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "events-list-characterization\|search-escaping-defect\|pagination-contract-defect"` | ❌ W0 | ⬜ |
| 04-04-T2 | 04-04 | 3 | REFAC-10 | T-04-04-03 | detail visibility rules pinned; F-080/F-081 pinned | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "events-detail-characterization\|club-fabrication-defect\|tag-coercion-defect"` | ❌ W0 | ⬜ |
| 04-04-T3 | 04-04 | 3 | REFAC-10 | T-04-04-01 | comma → 500 leak proven against real PostgREST | e2e | `npx jest --ci && node scripts/check-characterization-tags.mjs --all`; `npx playwright test` (+9) | ❌ W0 | ⬜ |
| 04-05-T1 | 04-05 | 3 | REFAC-09 | T-04-05-01 | seam adoption changes no response byte | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "(save\|saved-events\|calendar-events\|rsvp)-(characterization\|count-defect\|time-floor-defect)\|rsvp.test\|friends-defect" && npx tsc --noEmit && npm run lint` | ✅ (04-02) | ⬜ |
| 04-05-T2 | 04-05 | 3 | REFAC-09 | T-04-05-06 | RSVP counts are server-side COUNTs | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "rsvp" && npx tsc --noEmit` | ✅ (04-02) | ⬜ |
| 04-05-T3 | 04-05 | 3 | REFAC-09 | — | friends fallback receives an id array; no cast under src/app/api | unit (node) | `npx jest --ci && npx tsc --noEmit && npm run lint` | ✅ | ⬜ |
| 04-06-T1 | 04-06 | 4 | REFAC-10 | — | fixtures use authoritative start_date | unit (node) + grep | `npx jest --ci --selectProjects node --testPathPatterns "analytics"` | ✅ | ⬜ |
| 04-06-T2 | 04-06 | 4 | REFAC-09, REFAC-10 | T-04-06-01, -02 | tests type-checked without widening a handler | gate | `npx tsc --noEmit && npx jest --ci && npm run build` | ✅ | ⬜ |
| 04-06-T3 | 04-06 | 4 | REFAC-09 | T-04-06-03 | Slice 1 after-evidence; Validated list re-confirmed | full floor + e2e + pgTAP | `node .planning/audit/tools/validate.mjs --check findings && node scripts/check-characterization-tags.mjs --all && npx jest --ci`; `npx playwright test`; `supabase test db --local` | ✅ | ⬜ |
| 04-07-T1 | 04-07 | 5 | REFAC-10 | T-04-07-01 | mapping move is byte-identical | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "eventTags\|tag-coercion-defect" && npx tsc --noEmit` | ❌ W0 | ⬜ |
| 04-07-T2 | 04-07 | 5 | REFAC-10 | T-04-07-04 | unmapped tags surfaced, completeness enforced | unit (node) | `npx jest --ci && npx tsc --noEmit && npm run lint` | ❌ W0 | ⬜ |
| 04-08-T1 | 04-08 | 5 | REFAC-10 | T-04-08-01, -02 | `% _ , ( ) " \` escaped before or() | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "searchFilter\|search-escaping-defect\|get-events\|events-list-characterization"` | ❌ W0 | ⬜ |
| 04-08-T2 | 04-08 | 5 | REFAC-10 | T-04-08-04, -05 | literal matching proven live; probe local-only | live probe + e2e | `npx tsx scripts/probes/search-escape-probe.ts`; `npx playwright test` | ❌ W0 | ⬜ |
| 04-09-T1 | 04-09 | 6 | REFAC-10 | T-04-09-01 | malformed/injection-shaped cursors rejected | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns "eventCursor"` | ❌ W0 | ⬜ |
| 04-09-T2 | 04-09 | 6 | REFAC-10 | T-04-09-01, -03 | cursor contract; 0 skipped suites and tests | unit (node) | `npx jest --ci && npx tsc --noEmit && npm run lint` | ⚠️ rewrite of skipped suite | ⬜ |
| 04-09-T3 | 04-09 | 6 | REFAC-10 | T-04-09-03 | keyset + search AND on real PostgREST | e2e | `npx jest --ci && node scripts/check-characterization-tags.mjs --all`; `npx playwright test` (+3) | ✅ | ⬜ |
| 04-10-T1 | 04-10 | 7 | REFAC-10 | T-04-10-01 | shared embed excludes contact_email | unit (node) | `npx jest --ci && npx tsc --noEmit && npm run lint` | ✅ | ⬜ |
| 04-10-T2 | 04-10 | 7 | REFAC-10 | T-04-10-03 | join cost measured; no rendered change | unit + e2e + timing | `npx jest --ci && npx tsc --noEmit`; `npx playwright test` | ✅ | ⬜ |
| 04-11-T1 | 04-11 | 8 | REFAC-10 | T-04-11-01 | owner decides the visual fixes | checkpoint:decision | `test -s evidence/playwright.slice-2-before.txt` | ✅ | ⬜ |
| 04-11-T2 | 04-11 | 8 | REFAC-10 | T-04-11-01 | code matches the decision; changes logged | unit + tag gate | `npx jest --ci && npx tsc --noEmit && npm run lint && node scripts/check-characterization-tags.mjs --all` | ✅ | ⬜ |
| 04-11-T3 | 04-11 | 8 | REFAC-09, REFAC-10 | T-04-11-03 | phase closes on cited evidence | full floor + e2e + pgTAP | `node .planning/audit/tools/validate.mjs --check findings && npx jest --ci && node scripts/check-characterization-tags.mjs --all && node scripts/check-elevated-ratchet.mjs`; `npx playwright test` | ✅ | ⬜ |

### Requirement → test map (from RESEARCH.md)

| Req | Behaviour | Test type | Automated command | Exists? |
|---|---|---|---|---|
| REFAC-09 | save toggle: unsaved→saved→unsaved, 401 anon, 404 missing event, ban blocks POST only | unit (node) | `npx jest --ci --selectProjects node src/__tests__/api/events/save-characterization` | ❌ Wave 0 |
| REFAC-09 | saved-events list: 401 anon, three sort orders, past-event exclusion | unit (node) | `… saved-events-characterization` | ❌ Wave 0 |
| REFAC-09 | RSVP GET `{counts:{going,interested,total}, user_rsvp}`, `total === going + interested`, anon gets counts + `null` | unit (node) | `npx jest --ci --selectProjects node src/__tests__/api/events/rsvp` | ⚠️ partial (error paths only) |
| REFAC-09 | DEFECT: counts come from a row-returning select capped at `max_rows = 1000` | unit (node) | `… rsvp-count-defect` | ❌ Wave 0, new `F-nnn` |
| REFAC-09 | seam adoption changes no response byte | unit (node) | PRESERVE suites, before and after | ❌ Wave 0 |
| REFAC-09 | F-071 fix: `.in()` receives an array; `grep -rn "(supabase as any)" src/app/` → 0 | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns friends-defect` | ✅ exists (DEFECT) |
| REFAC-10 | `/api/events/[id]` and `/api/users/saved-events` return a real club | unit + e2e | `… events-detail-characterization` + Playwright event-page assertion | ❌ Wave 0, needs an organizer-only seed row |
| REFAC-10 | DEFECT: `transformEventFromDB` fabricates `club.id` from `organizer` | unit (node) | `… club-fabrication-defect` | ❌ Wave 0, new `F-nnn` |
| REFAC-10 | no `event_date`/`event_time` outside archived DDL | grep + unit | `command grep -rn "event_date\|event_time" src/ supabase/ \| grep -v _archive_pre_baseline` → 0 | ❌ Wave 0 (8 hits / 4 files today) |
| REFAC-10 | every `EventTag` member round-trips through the mapping | unit (node) | `… eventTags.test.ts` over `Object.values(EventTag)` | ❌ Wave 0 |
| REFAC-10 | DEFECT: 6 of 12 members do not round-trip; unknown tags become `social` | unit (node) | `… tag-coercion-defect` | ❌ Wave 0, new `F-nnn` |
| REFAC-10 | `%`, `_`, `,`, `(`, `)`, `"`, `\` escaped in search input | unit (node) | `… searchFilter.test.ts`, one assertion per character | ❌ Wave 0 |
| REFAC-10 | DEFECT: a comma in the search box returns 500 echoing the internal filter | unit + e2e | `… search-escaping-defect` + anonymous-browse spec typing `a,b` | ❌ Wave 0, new `F-nnn` |
| REFAC-10 | the decided pagination contract | unit (node) | `npx jest --ci --selectProjects node src/app/api/events/route.test.ts` (currently `describe.skip`) | ⚠️ rewrite, do not delete |
| REFAC-10 | the hook and the route agree | unit (jsdom) | `npx jest --ci --selectProjects jsdom src/hooks/useEvents.test.ts` | ⚠️ asserts against a mocked fetch |
| F-066 / DI-24 | zero skipped suites and test files type-checked | gate | `npx jest --ci` → 0 skipped suites; `npx tsc --noEmit` clean after the `exclude` entries go | ❌ 77 errors / 8 files today |
| Both | every Validated workflow behaves identically | e2e | `npx playwright test` → 27 (+ new) passed | ✅ |
| Both | schema and RLS unchanged | pgTAP | `supabase test db --local` → 86 | ✅ |
| Both | types match the migrations | gate | the `types` CI job | ✅ |
| DI-31 | the ratchet is enforced in CI | gate | a new `.github/workflows/ci.yml` step running `node scripts/check-elevated-ratchet.mjs` | ❌ not wired |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Mint the new `F-nnn` findings (RSVP count cap, club fabrication, tag coercion, search escaping, pagination divergence; `events.rsvp_count` as a candidate) in `.planning/audit/findings.json` by surgical per-record insertion, regenerate `FOUNDATION_AUDIT.md`, keep `validate.mjs --check findings` green — DEFECT test headers need the ids
- [ ] `src/__tests__/api/events/save-characterization.test.ts`, `saved-events-characterization.test.ts`, `rsvp` happy-path additions, `rsvp-count-defect.test.ts` — PRESERVE/DEFECT suites written against **unmodified** source, with a mutation cycle captured per PRESERVE suite
- [ ] `src/__tests__/api/events/events-detail-characterization.test.ts`, `club-fabrication-defect.test.ts`, `tag-coercion-defect.test.ts`, `search-escaping-defect.test.ts`, `eventTags.test.ts`, `searchFilter.test.ts`
- [x] ~~Seed extension~~ — **not needed (DEC-30, plan 04-01).** The seed already holds RSVP rows (`scripts/seed/personas.ts:566-579`: one going, one cancelled), which research Pitfall 3 missed; an organizer-only event would itself create a seeded visual delta the moment F-080 lands. The sha256 determinism proof is untouched.
- [ ] Playwright: an anonymous-browse spec that types `a,b` into search; an event-page club assertion

Every other ❌ W0 row in the per-task map (the 04-01 evidence files and tag gate, `eventTags.test.ts`, `searchFilter.test.ts`, `eventCursor.test.ts`, `scripts/probes/search-escape-probe.ts`) is created by the task that verifies with it, test-first where the task is `tdd="true"`, before that task's `<automated>` command runs — so no verify command references a file nothing creates.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Save/unsave and RSVP against a Vercel preview with a real McGill account | success criterion 4 (deployed path) | needs a real identity-provider session; no persona traverses `/auth/callback` | Phase 2 `02-UAT.md` test 1, step 5 — record URL and date |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 30 tasks across 04-01..04-11, including the 04-11 checkpoint
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — planned coverage; see the note under Wave 0 Requirements
- [x] No watch-mode flags — every Jest command runs with `--ci`; no plan uses `--watch`
- [ ] Feedback latency < 5s — execution-time: research measured 2.4 s for the full Jest suite, but the per-task commands also run `tsc` and lint and are timed during execution
- [x] `nyquist_compliant: true` set in frontmatter

Checked items are true at planning time (revision of 2026-09-23). The unchecked item, the `wave_0_complete` flag (flipped by 04-01, 04-02 and 04-04 as their Wave 0 files land) and Approval are execution-time and owner-time items, left open deliberately.

**Approval:** pending
