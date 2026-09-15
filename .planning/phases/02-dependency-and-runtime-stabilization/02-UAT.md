---
status: testing
phase: 02-dependency-and-runtime-stabilization
source: [02-VERIFICATION.md]
started: 2026-09-15T16:21:45Z
updated: 2026-09-15T16:21:45Z
---

## Current Test

number: 1
name: Tier 3 preview-deployment check for the middleware.ts to proxy.ts rename
expected: |
  Against an actual Vercel preview deployment of HEAD (not npm run dev), all five steps behave identically to the pre-rename application: (1) McGill sign-in succeeds, (2) non-McGill sign-in is rejected, (3) a mid-onboarding user is redirected to onboarding, (4) a non-banned user is NOT redirected to /banned, (5) save/unsave and RSVP work. Record the preview URL and date in evidence/proxy-migration-note.md section 9. Rollback if any step fails: git revert 0d66a1d.
awaiting: user response

## Tests

### 1. Tier 3 preview-deployment check for the middleware.ts to proxy.ts rename
expected: Against an actual Vercel preview deployment of HEAD, all five steps (McGill sign-in, non-McGill rejection, mid-onboarding redirect, non-banned user not sent to /banned, save/unsave/RSVP) behave identically to the pre-rename application. Next compiles the file convention into a platform function at build time, so the local dev-server smoke (already byte-identical before and after) cannot exercise the CDN/platform path. Record URL and date in evidence/proxy-migration-note.md section 9.
result: [pending]

### 2. CI run observation on a pushed pull request
expected: After pushing the 123 unpushed local commits (or an equivalent branch) and opening a pull request, a real GitHub Actions run of .github/workflows/ci.yml completes with the "Run tests" step and the "Production vulnerability gate" step both green, in the order recorded in the workflow file. This closes the CI halves of STAB-02 (grep the install log for "Unknown .* config") and STAB-14 (record the run in evidence/ci-green-run.md).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
