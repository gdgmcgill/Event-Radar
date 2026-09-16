---
quick_id: 260916-nst
type: quick
description: "Clear pre-Phase-4 blockers: DI-20 flaky useEvents test, DI-28 CLAUDE.md tracking, research cache ignore"
status: complete
date: 2026-09-16
files_modified:
  - src/hooks/useEvents.test.ts
  - .gitignore
  - .claude/CLAUDE.md
  - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/deferred-items.md
  - .planning/STATE.md
---

# Quick Task 260916-nst: Clear the pre-Phase-4 blockers that can be cleared from this machine

**Why now.** Phase 3 closed with a consolidated deferred-item register. Most items are owned by a later
phase and are not blockers. Three are not phase work at all — they are a flaky test that will make
Phase 4's first CI run unreadable, a two-phase-old undecided governance call, and untracked cache noise
in the tree. The owner asked for the blockers cleared before `/gsd-plan-phase 4`, so they are cleared here.

**Scope rule.** Nothing under `src/` changes except the one test's synchronisation. No application
behaviour changes. Items owned by Phases 4–8 (DI-21..26, DI-30, DI-31, DI-33..35, F-071..F-078) are NOT
touched. Items needing a human or an external account (DI-27, DI-29, password rotation, Renovate app,
branch protection) are NOT touched and are reported back.

## Task 1 — DI-20: make `useEvents.test.ts` deterministic under CI load

**Files:** `src/hooks/useEvents.test.ts`
**Diagnosis:** the failing assertion is `waitFor(() => expect(loading).toBe(false))` in the FIRST test of the
suite. Nothing in the hook can hold `loading` true after the mocked fetch resolves; the only way the
assertion fails is `waitFor` giving up before React flushes, and its default budget is 1000 ms. That budget
is spent on a cold worker: ts-jest compiling the suite plus the first React render, while 33 other suites
compete for CPU. It has never failed in isolation and never failed on a second test — both consistent with
a warm-up cost, not a race.
**Action:** raise the suite's async-utility budget via `configure({ asyncUtilTimeout })` from
`@testing-library/react`, scoped to this file, with a comment citing DI-20. This changes when the test
gives up, not what it asserts, so it cannot mask a real regression — a hook that never clears `loading`
still fails, only later.
**Verify:** `npx jest src/hooks/useEvents.test.ts` green; full `npx jest --ci` green at the Phase 3 floor
(358 passed / 5 skipped) at least twice.
**Done:** the register marks DI-20 closed with the commit hash.

## Task 2 — DI-28: track `.claude/CLAUDE.md` and correct the false zustand claim

**Files:** `.gitignore`, `.claude/CLAUDE.md`
**Action:** narrow the ignore from `.claude` (whole directory) to `.claude/*` plus `!.claude/CLAUDE.md`, so the
agent instruction file is versioned while `settings.local.json` and every other machine-local file under
`.claude/` stay ignored. Replace the parenthetical "no stores directory found; may be used inline" on the
`zustand` line with the truth: `src/store/useAuthStore.ts` is the single auth store.
Also ignore `.planning/research/.cache/` — a content-addressed research cache that has no business in git.
**Verify:** `git check-ignore -v .claude/settings.local.json` still ignored; `git ls-files .claude/CLAUDE.md`
lists the file after the commit; `git status --porcelain` shows no `.planning/research/.cache` entries.
**Done:** the register marks DI-28 closed; STATE.md's blocker line is struck through.

## Task 3 — Record the closures

**Files:** `evidence/deferred-items.md` (Phase 3), `.planning/STATE.md`
**Action:** add a CLOSED banner to DI-20 and DI-28 in the same shape DI-19 and DI-32 use, citing commits.
Strike the resolved `.claude/CLAUDE.md` and `.mcp.json` blocker lines in STATE.md. Do not touch any other
item's owner or status.
