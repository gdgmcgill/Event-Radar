---
phase: 4
slug: slices-1-2-saved-events-rsvp-and-the-event-read-path
status: draft
nyquist_compliant: false
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
| *filled by the planner from each PLAN.md task's `<verify>`; the requirement → test map below is the source* | | | | | | | | | |

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
- [ ] Seed extension: an organizer-only event row (no `club_id`) and RSVP/saved rows for the Slice 1 personas; sha256 re-derived twice; 21 seed-coverage pgTAP assertions re-run
- [ ] Playwright: an anonymous-browse spec that types `a,b` into search; an event-page club assertion

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Save/unsave and RSVP against a Vercel preview with a real McGill account | success criterion 4 (deployed path) | needs a real identity-provider session; no persona traverses `/auth/callback` | Phase 2 `02-UAT.md` test 1, step 5 — record URL and date |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
