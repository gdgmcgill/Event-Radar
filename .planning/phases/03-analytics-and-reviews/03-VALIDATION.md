---
phase: 3
slug: analytics-and-reviews
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern=<file> --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=<changed_file> --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ANLY-01 | unit | `npx jest --testPathPattern=events/analytics --no-coverage` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | ANLY-02 | unit | `npx jest --testPathPattern=clubs/analytics --no-coverage` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | ANLY-03 | manual | Visual verification | N/A | ⬜ pending |
| 03-02-01 | 02 | 1 | REVW-01 | unit | `npx jest --testPathPattern=events/reviews --no-coverage` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | REVW-02 | unit | `npx jest --testPathPattern=events/reviews --no-coverage` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | REVW-03 | unit | `npx jest --testPathPattern=events/reviews --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/api/events/analytics.test.ts` — stubs for ANLY-01
- [ ] `src/__tests__/api/clubs/analytics.test.ts` — stubs for ANLY-02
- [ ] `src/__tests__/api/events/reviews.test.ts` — stubs for REVW-01, REVW-02, REVW-03
- [ ] Jest + ts-jest installed if not already present

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Charts render correctly with data | ANLY-03 | Recharts SVG rendering requires visual verification | 1. Navigate to club dashboard Analytics tab 2. Verify line chart shows follower growth 3. Verify bar chart shows event metrics 4. Check responsive sizing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
