---
phase: 2
slug: event-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via Next.js) |
| **Config file** | Built into Next.js config |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npm run build`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | EVNT-02 | manual + build | `npm run build` | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | EVNT-01 | manual + build | `npm run build` | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | EVNT-04 | manual + build | `npm run build` | N/A | ⬜ pending |
| 02-01-04 | 01 | 1 | EVNT-03 | manual + build | `npm run build` | N/A | ⬜ pending |
| 02-01-05 | 01 | 1 | EVNT-06 | manual + build | `npm run build` | N/A | ⬜ pending |
| 02-02-01 | 02 | 1 | EVNT-05 | manual + build | `npm run build` | N/A | ⬜ pending |
| 02-02-02 | 02 | 1 | EVNT-07 | manual + build | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or stubs needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create event with club pre-selected | EVNT-01 | UI interaction, form pre-fill | Navigate to club dashboard > Events tab > Create Event. Verify club is pre-selected. |
| View events list with status + RSVP | EVNT-02 | Visual layout verification | Navigate to club dashboard > Events tab. Verify events show title, date, status badge, RSVP counts. |
| Edit event details | EVNT-03 | UI interaction, form population | Click edit on an event in list. Verify form pre-fills. Change fields, save, verify changes persist. |
| Auto-approve for organizers | EVNT-04 | Requires auth context | Create event as organizer. Verify status shows "approved" immediately in events list. |
| RSVP counts visible in list | EVNT-05 | Visual verification | Check events list shows going/interested counts per event. |
| Duplicate event pre-fills form | EVNT-06 | UI interaction | Click duplicate on event. Verify form pre-fills with event data minus date. |
| Follower notification on publish | EVNT-07 | Requires multi-user test | Create event as organizer. Check follower's notification inbox for new event notification. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
