# Requirements: Uni-Verse Beta Launch — Cold Start Fix & Notifications

**Defined:** 2026-02-23
**Core Value:** New users see a useful feed from first visit; existing users receive timely notifications about events they care about

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Notification Infrastructure

- [x] **NINF-01**: Notifications table created in Supabase with columns: id, user_id, event_id, type, title, message, read, created_at
- [x] **NINF-02**: RLS enabled on notifications table with policies: SELECT own rows (authenticated), UPDATE own rows (authenticated); INSERT has no policy for authenticated role — service role bypasses RLS by design, blocking any direct browser client INSERT
- [x] **NINF-03**: UNIQUE constraint on (user_id, event_id, type) to prevent duplicate notifications
- [x] **NINF-04**: Notification type strings aligned across codebase — cron route and NotificationItem both use event_reminder_24h, event_reminder_1h, event_approved, event_rejected
- [x] **NINF-05**: TypeScript types updated in src/types/index.ts to reflect notifications table schema

### Notification UI

- [ ] **NUI-01**: NotificationBell injected into Header.tsx next to auth button for authenticated users
- [ ] **NUI-02**: Existing notification API routes (GET, PATCH, POST mark-all-read) validated against real notifications table
- [ ] **NUI-03**: Notification items link to /events/[event_id] when event_id is present

### Notification Generation

- [ ] **NGEN-01**: Admin approve action creates event_approved notification for the event submitter
- [ ] **NGEN-02**: Admin reject action creates event_rejected notification for the event submitter
- [ ] **NGEN-03**: pg_cron job configured in Supabase to call reminder endpoint hourly
- [ ] **NGEN-04**: CRON_SECRET stored securely in Supabase Vault for pg_cron auth
- [ ] **NGEN-05**: Cron generates event_reminder_24h notifications for users with saved events starting in ~24 hours
- [ ] **NGEN-06**: Cron generates event_reminder_1h notifications for users with saved events starting in ~1 hour

### Cold Start

- [x] **COLD-01**: /api/recommendations returns popularity-ranked fallback feed when user has <3 saved events
- [x] **COLD-02**: Fallback query filters start_time > NOW() to exclude past events
- [x] **COLD-03**: Fallback scoring applies popularity boost (>10 saves → +2) and recency boost (within 7 days → +1)
- [x] **COLD-04**: API response includes source field ("personalized" or "popular_fallback") so UI can label appropriately
- [ ] **COLD-05**: RecommendedEventsSection shows "Popular on Campus" label when source is popular_fallback
- [x] **COLD-06**: Already-saved events excluded from fallback feed
- [x] **COLD-07**: RECOMMENDATION_THRESHOLD constant centralized in src/lib/constants.ts and used by both page.tsx and API
- [ ] **COLD-08**: Onboarding nudge displayed in cold-start state ("Save N more events to unlock personalized recommendations")

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: Supabase Realtime subscription replaces SWR polling for instant notification delivery
- **NOTF-02**: Notification type filtering on /notifications page (show only reminders, only approvals)
- **NOTF-03**: Cursor-based pagination on /notifications page
- **NOTF-04**: User can configure notification preferences (mute specific types)
- **NOTF-05**: Toast/snackbar for new notifications received while browsing

### Cold Start

- **COLD2-01**: Progress indicator toward personalization threshold ("2 of 3 saves")
- **COLD2-02**: Interest-tag-aware fallback (hybrid popularity + matching tags for onboarded users)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Email notifications | External channels require SPF/DKIM, unsubscribe compliance, deliverability monitoring — beta is in-app only |
| Push notifications (browser/mobile) | Service worker registration, push API keys, permission prompts — defer to dedicated milestone |
| Notification deletion by user | Read-only history for beta; add auto-expiry at DB level if count becomes a problem |
| Real-time chat/messaging | Unrelated to this milestone; separate channel architecture needed |
| Recommendation algorithm changes | Existing K-means + content-based hybrid works; only fix the entry gate and fallback path |
| Per-notification delivery schedule / quiet hours | Over-engineering for beta with 4 types and low volume |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NINF-01 | Phase 1 | Complete |
| NINF-02 | Phase 1 | Complete |
| NINF-03 | Phase 1 | Complete |
| NINF-04 | Phase 1 | Complete |
| NINF-05 | Phase 1 | Complete |
| NUI-01 | Phase 3 | Pending |
| NUI-02 | Phase 3 | Pending |
| NUI-03 | Phase 3 | Pending |
| NGEN-01 | Phase 3 | Pending |
| NGEN-02 | Phase 3 | Pending |
| NGEN-03 | Phase 4 | Pending |
| NGEN-04 | Phase 4 | Pending |
| NGEN-05 | Phase 4 | Pending |
| NGEN-06 | Phase 4 | Pending |
| COLD-01 | Phase 2 | Complete |
| COLD-02 | Phase 2 | Complete |
| COLD-03 | Phase 2 | Complete |
| COLD-04 | Phase 2 | Complete |
| COLD-05 | Phase 2 | Pending |
| COLD-06 | Phase 2 | Complete |
| COLD-07 | Phase 2 | Complete |
| COLD-08 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after roadmap creation — traceability complete*
