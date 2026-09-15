---
status: testing
phase: 02-dependency-and-runtime-stabilization
source: [02-VERIFICATION.md]
started: 2026-09-15T16:21:45Z
updated: 2026-09-15T19:25:00Z
---

## Current Test

number: 1
name: Tier 3 preview-deployment check — signed-in steps
expected: |
  Steps 1–5 (McGill sign-in, non-McGill rejection, mid-onboarding redirect, non-banned user not sent to /banned, save/unsave/RSVP) against Vercel preview event-radar-p16f0ng94 or a newer preview. The anonymous ring rows already passed there (evidence/smoke.tier3.preview.txt). Rollback if any step fails: git revert 0d66a1d.
awaiting: user response

## Tests

### 1. Tier 3 preview-deployment check for the middleware.ts to proxy.ts rename
expected: Against an actual Vercel preview deployment of HEAD, all five steps (McGill sign-in, non-McGill rejection, mid-onboarding redirect, non-banned user not sent to /banned, save/unsave/RSVP) behave identically to the pre-rename application. Next compiles the file convention into a platform function at build time, so the local dev-server smoke (already byte-identical before and after) cannot exercise the CDN/platform path. Record URL and date in evidence/proxy-migration-note.md section 9.
result: [pending — partially evidenced 2026-09-15T19:25:00Z] The deployed-path half is done: preview https://event-radar-p16f0ng94-adyan-ullahs-projects.vercel.app (tree d14456b) was smoke-tested with scripts/smoke.sh, ring rows 4/4 PASS through the platform function (evidence/smoke.tier3.preview.txt); URL and date recorded in proxy-migration-note.md § 9. The five signed-in steps need a real McGill account and are still pending.

### 2. CI run observation on a pushed pull request
expected: After pushing the 123 unpushed local commits (or an equivalent branch) and opening a pull request, a real GitHub Actions run of .github/workflows/ci.yml completes with the "Run tests" step and the "Production vulnerability gate" step both green, in the order recorded in the workflow file. This closes the CI halves of STAB-02 (grep the install log for "Unknown .* config") and STAB-14 (record the run in evidence/ci-green-run.md).
result: [passed 2026-09-15T19:02:02Z] main pushed (126 commits, 6f9c3b7..7e797af); run 35011042332 completed success with all six steps green in the declared order, "Run tests" and "Production vulnerability gate" included. Install log grepped: 0 "Unknown .* config" lines → STAB-02 closed; run recorded in evidence/ci-green-run.md §§ 1, 5, 6 → STAB-14 closed.

## Summary

total: 2
passed: 1
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
