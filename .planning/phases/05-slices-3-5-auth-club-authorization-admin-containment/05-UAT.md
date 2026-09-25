---
status: testing
phase: 05-slices-3-5-auth-club-authorization-admin-containment
source: [05-VERIFICATION.md]
started: 2026-09-25T20:57:43Z
updated: 2026-09-25T20:57:43Z
---

## Current Test

number: 1
name: Owner actions before any push to main (see 05-VERIFICATION.md human_verification and evidence/PHASE-5-COMPLETION.md § owner actions)
expected: |
  Countersign the Upstash pins (DEC-59), provision Upstash and set RATE_LIMIT_REQUIRE_DISTRIBUTED=true (DI-42), authorise the read-only production count of un-onboarded/profile-less users, decide the early production apply of the F-006/F-007/F-008 migrations, decide DI-41.
awaiting: user response

## Tests

### 1. Countersign DEC-59's Upstash package-legitimacy verdict ('use 2.0.8', unsigned, resolved by rule with no owner present) or switch to the provenance-attested 2.1.0 as the plan originally proposed
expected: An owner reviews and signs off on the dependency choice before it reaches production, given the blocking-human checkpoint at 05-18 Task 2 went unanswered and was resolved autonomously
result: [pending]

### 2. Provision Upstash (or Vercel KV) in the production environment, set the resulting env vars, then set RATE_LIMIT_REQUIRE_DISTRIBUTED=true
expected: Rate limiting counts requests from a shared store across all serverless instances instead of per-instance from memory
result: [pending]

### 3. Decide DI-41: whether GET /invites/[token] (invitation acceptance) should move behind a CSRF-protected POST, given it is the one residual CSRF exposure outside /api/*
expected: An explicit owner decision, since it is a UX change to a Validated workflow
result: [pending]

### 4. Run an owner-authorized, read-only count of production users with onboarding_completed false/null and auth users with no public.users row, before deploying
expected: A known blast-radius number for who gets redirected to onboarding or signed out once this phase's proxy/callback changes deploy
result: [pending]

### 5. Decide whether to apply the two local-only Critical-severity migrations (F-006 self-escalation/self-unban, F-007 audit-log forgery) to production ahead of the Phase 8 migration-history repair (DI-23), or accept both stay exploitable in production until then
expected: An explicit owner decision, since these are Critical findings closed only on the local stack
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
