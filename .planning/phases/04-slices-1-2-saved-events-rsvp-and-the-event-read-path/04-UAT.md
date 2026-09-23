---
status: testing
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
source: [04-VERIFICATION.md]
started: 2026-09-23T23:53:27Z
updated: 2026-09-23T23:53:27Z
---

## Current Test

number: 1
name: Owner decides the two seeded-visible fixes (F-080 club on detail page, F-081 six tag identity mappings)
expected: |
  Read evidence/visual-fix-decision.md and choose one option, then sign it there:
  - option-defer: keep as-is. Criterion 2 and REFAC-10's first clause stay PARTIAL (DI-39, DI-40 remain open).
  - option-ship-club: /api/events/[id] gets the real club embed and the organizer-string fallback goes; "Hosted by" names the club. One commit, body starting INTENTIONAL VISUAL CHANGE.
  - option-ship-both: the above plus identity mappings for tech, food, volunteer, arts, music, networking (badges then agree with filters); also decide the competition tag conflict.
  Then follow the file's "Reversing this decision" steps if shipping, flip F-080/F-081 as appropriate, and set REFAC-10 accordingly.
awaiting: user response

## Tests

### 1. Owner decides the two seeded-visible fixes (F-080 club on detail page, F-081 six tag identity mappings)
expected: A signed choice recorded in evidence/visual-fix-decision.md; if shipping, the follow-up commits land and REFAC-10 moves to Complete; if deferring, REFAC-10 stays PARTIAL with DI-39/DI-40 owned.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
