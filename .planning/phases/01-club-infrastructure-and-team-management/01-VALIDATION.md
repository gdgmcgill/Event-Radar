---
phase: 1
slug: club-infrastructure-and-team-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.2.0 + ts-jest 29.4.6 |
| **Config file** | `jest.config.js` (exists, configured with path aliases) |
| **Quick run command** | `npx jest --testPathPattern=clubs --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=clubs --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CLUB-01 | unit | `npx jest tests/api/clubs/get-club.test.ts -x` | No -- W0 | pending |
| 01-01-02 | 01 | 1 | CLUB-02 | unit | `npx jest tests/api/clubs/patch-club.test.ts -x` | No -- W0 | pending |
| 01-01-03 | 01 | 1 | CLUB-03 | unit | `npx jest tests/api/my-clubs.test.ts -x` | No -- W0 | pending |
| 01-01-04 | 01 | 1 | CLUB-04 | manual | N/A -- UI component | N/A | pending |
| 01-02-01 | 02 | 1 | TEAM-01 | unit | `npx jest tests/api/clubs/members.test.ts -x` | No -- W0 | pending |
| 01-02-02 | 02 | 1 | TEAM-02 | unit | `npx jest tests/api/clubs/invites.test.ts -x` | No -- W0 | pending |
| 01-02-03 | 02 | 1 | TEAM-03 | unit | `npx jest tests/api/clubs/remove-member.test.ts -x` | No -- W0 | pending |
| 01-02-04 | 02 | 1 | TEAM-04 | unit | `npx jest tests/api/invites/accept.test.ts -x` | No -- W0 | pending |
| 01-03-01 | 03 | 2 | FLLW-01 | unit | `npx jest tests/api/clubs/follow.test.ts -x` | No -- W0 | pending |
| 01-03-02 | 03 | 2 | FLLW-02 | unit | `npx jest tests/api/clubs/follow.test.ts -x` | No -- W0 | pending |
| 01-03-03 | 03 | 2 | FLLW-03 | unit | `npx jest tests/api/clubs/get-club.test.ts -x` | No -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/clubs/get-club.test.ts` -- stubs for CLUB-01, FLLW-03
- [ ] `tests/api/clubs/patch-club.test.ts` -- stubs for CLUB-02
- [ ] `tests/api/my-clubs.test.ts` -- stubs for CLUB-03
- [ ] `tests/api/clubs/members.test.ts` -- stubs for TEAM-01
- [ ] `tests/api/clubs/invites.test.ts` -- stubs for TEAM-02
- [ ] `tests/api/clubs/remove-member.test.ts` -- stubs for TEAM-03
- [ ] `tests/api/invites/accept.test.ts` -- stubs for TEAM-04
- [ ] `tests/api/clubs/follow.test.ts` -- stubs for FLLW-01, FLLW-02
- [ ] `tests/helpers/supabase-mock.ts` -- Supabase client mock helper

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quick-switch dropdown in club management header | CLUB-04 | Pure UI interaction, no backend logic to test | 1. Navigate to /my-clubs/[id] 2. Click dropdown 3. Select different club 4. Verify redirect to new club's Overview tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
