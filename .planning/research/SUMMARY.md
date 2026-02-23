# Project Research Summary

**Project:** Uni-Verse — Cold Start Fix & Notification System (Milestone)
**Domain:** In-app notification system + recommendation cold start fallback
**Researched:** 2026-02-23
**Confidence:** HIGH

## Executive Summary

This milestone adds two independent capabilities to an already-functional campus event discovery platform: a notifications system that alerts users about event reminders and admin approval decisions, and a cold start fix that prevents new users from seeing an empty recommendations feed. The critical finding from a direct codebase audit is that the majority of both features are already implemented in application code — the NotificationBell, NotificationItem, NotificationList components, all three notification API routes, the cron reminder endpoint, the admin approval notification insertion, and the recommendation gate logic all exist. What is genuinely missing is the `notifications` database table in Supabase, the scheduler wiring for the cron, and one targeted API fix for the recommendation fallback path. This is a wiring and configuration milestone, not a build-from-scratch one.

The recommended approach is to work entirely within the existing stack with no new npm dependencies. Cold start scoring uses a pure SQL query against the already-existing `event_popularity_scores` table. Cron scheduling uses Supabase's `pg_cron` + `pg_net` extensions (enabled via the Supabase Dashboard). Notification polling uses the existing SWR pattern already in the project. Every new component reuses existing shadcn/ui primitives and the existing `@supabase/supabase-js` client. The only genuinely new artifact is the `supabase/functions/send-event-reminders` Edge Function (Deno), if opting for Supabase-native scheduling over the existing Next.js cron route.

The key risks are concentrated at the database layer and must be addressed before any application code work begins. A missing `UNIQUE(user_id, event_id, type)` constraint on the notifications table will produce duplicate reminders that permanently break the unread badge count. A missing RLS configuration exposes all users' notifications to any authenticated user — a launch-blocking privacy issue. On the cold start side, failing to filter `start_time > NOW()` in the fallback query will surface past events to new users at the exact moment the platform needs to make a good first impression. All three of these are database-schema-time concerns that cannot be retrofitted cleanly once data exists.

## Key Findings

### Recommended Stack

No new npm packages are required for this milestone. The entire feature set is achievable with the existing `@supabase/supabase-js`, `swr`, `@radix-ui/react-dropdown-menu`, and Lucide React already in the project. Scheduling relies on Supabase's built-in `pg_cron` and `pg_net` Postgres extensions, which are enabled via SQL in the Supabase Dashboard and require no package installation. If a Supabase Edge Function is used for the cron (the project-preferred path per PROJECT.md), it runs on Deno 2.1+ and imports via `https://esm.sh/@supabase/supabase-js@2` — not npm.

**Core technologies:**
- **Supabase Postgres:** New `notifications` table with RLS — all notification data lives here
- **Supabase pg_cron + pg_net:** Hourly cron trigger for event reminder generation — zero new infrastructure
- **Supabase Edge Functions (Deno):** `send-event-reminders` function — project-preferred over Vercel Cron
- **SWR `refreshInterval`:** 30-60s polling for NotificationBell unread count — simpler than Realtime for beta
- **shadcn/ui DropdownMenu + Badge:** Notification bell UI — already in project, no new installs
- **Pure SQL popularity scoring:** Cold start fallback via `event_popularity_scores` — no ML library needed

### Expected Features

The codebase audit revealed that the features list from FEATURES.md is mostly already built. The distinction between "table stakes" and "present" is important for roadmap sizing.

**Must have (already built — needs wiring):**
- Unread count badge on notification bell — exists in NotificationBell.tsx, needs Header.tsx injection
- Notification persistence in inbox — /notifications page exists, blocked on DB table
- Mark single/all notifications as read with optimistic update — exists in page.tsx
- Event reminder notifications (24h and 1h) — cron route exists, needs DB table + scheduler
- Notification creation on admin approve/reject — exists in admin status route

**Must have (genuinely missing — needs building):**
- Notifications database table in Supabase — nothing else works without this
- Cron scheduler wiring (pg_cron or external) — cron route exists but has no caller
- Cold start API fallback path — recommendations API currently returns empty array for cold-start users; needs explicit popularity-ranked fallback with `source: "popular_fallback"` flag
- Notification type string alignment — cron inserts `reminder_24h` but NotificationItem expects `event_reminder_24h`; one must be updated

**Should have (high value, low complexity):**
- Clickable notification items linking to /events/[event_id] — event_id already in schema
- Onboarding nudge in cold-start section ("Save 3 events to unlock personalized recommendations")
- RecommendedEventsSection conditional label based on API `source` flag

**Defer post-beta:**
- Supabase Realtime replacing SWR polling
- Notification type filtering on inbox page
- Cursor-based pagination on /notifications
- Progress indicator toward personalization threshold
- Email or push notifications
- Notification preferences / quiet hours

### Architecture Approach

The two subsystems (notifications and cold start fix) are architecturally independent after the shared database step. Both systems follow the existing layered pattern: client components poll Next.js API Route Handlers, which use the Supabase server client (RLS-enforced for user reads, service-role for admin/cron writes). The notification system introduces one new table and one new scheduler. The cold start fix is a single conditional branch in the existing recommendations API route plus a label change in one client component. The architecture diagram is a direct extension of what already exists — no new layers, no new services, no new patterns.

**Major components:**
1. **`notifications` table (Supabase)** — central data store; all other components depend on its existence; must have RLS and UNIQUE constraint at creation
2. **`POST /api/cron/send-reminders`** — already exists; generates 24h and 1h reminder rows; needs a scheduler caller and type string alignment
3. **`NotificationBell` in Header** — already exists; polls /api/notifications every 60s; blocked on Header.tsx injection and DB table
4. **`GET /api/recommendations` fallback branch** — the primary new code; returns popularity-ranked events with `source: "popular_fallback"` when `savedEventIds.size < 3` and no interest tags
5. **`pg_cron` job (Supabase)** — the only genuinely new infrastructure piece; calls /api/cron/send-reminders hourly via pg_net HTTP POST with CRON_SECRET bearer auth

### Critical Pitfalls

1. **Duplicate notifications from cron retries** — Add `UNIQUE(user_id, event_id, type)` constraint at table creation and use `INSERT ... ON CONFLICT DO NOTHING` in the cron route. The UNIQUE constraint is the backstop that makes the entire system idempotent.

2. **RLS not enabled on notifications table** — Enable RLS immediately at table creation with four policies: SELECT (own rows only), INSERT (service role only), UPDATE (own `is_read` only), DELETE (none). Test with a real user JWT, not the service role client, to verify policies actually fire.

3. **Past events in cold start fallback** — Every popularity fallback query must include `AND start_time > NOW()` (ideally `BETWEEN NOW() + INTERVAL '2 hours' AND NOW() + INTERVAL '14 days'`). This filter belongs in the same PR as the fallback path, not as a follow-up.

4. **Silent threshold gate breaks new user onboarding** — The `canShowRecommendations` gate is invisible to users. Without a progress indicator ("Save 2 more events to unlock personalized picks"), users below the threshold never understand why personalization is missing and don't take the action to unlock it.

5. **Notification type string mismatch** — The cron route inserts `reminder_24h` and `reminder_1h` but NotificationItem's `typeConfig` keys are `event_reminder_24h` and `event_reminder_1h`. Reminder notifications will silently render with a generic fallback icon if this is not resolved before the DB table is created.

## Implications for Roadmap

Based on research, the dependency chain is clear: database table must exist before any API or component work can be validated end-to-end. The two subsystems then proceed independently. The suggested phase structure is:

### Phase 1: Database Foundation
**Rationale:** The `notifications` table is the single blocker for all notification work. Both the NotificationBell (which polls the API) and the cron route (which inserts into the table) are already written — they just have no table to operate on. This phase also resolves the type string mismatch before any data is written with the wrong type values.
**Delivers:** A correctly-configured `notifications` table in Supabase with RLS, indexes, and UNIQUE constraint; resolved type string naming; updated TypeScript types in `src/types/index.ts`.
**Addresses:** Notifications table (FEATURES.md must-have #1), type string alignment (FEATURES.md must-have #4)
**Avoids:** RLS misconfiguration (Pitfall 2), duplicate notifications (Pitfall 1), type naming inconsistency (Pitfall 5 / ARCHITECTURE anti-pattern 5)

### Phase 2: Cold Start Recommendation Fix
**Rationale:** Entirely independent of Phase 1. The cold start fix touches only the recommendations API and one client component — no new tables, no scheduler. It can be developed and tested in isolation. Fixing it early means new-user first impressions are repaired before notification work completes.
**Delivers:** Updated `GET /api/recommendations` that returns a popularity-ranked fallback feed with `source: "popular_fallback"` for cold-start users; updated `RecommendedEventsSection` with conditional labeling; onboarding nudge; `RECOMMENDATION_THRESHOLD` constant in `src/lib/constants.ts`.
**Uses:** Existing `event_popularity_scores` table, existing `PopularEventsSection` component pattern
**Avoids:** Past events in fallback (Pitfall 3), stale popularity scores (Pitfall 9), silent threshold gate (Pitfall 4), threshold drift (Pitfall 12)

### Phase 3: Notification System Wiring
**Rationale:** With the database table from Phase 1 in place, all existing notification components and API routes can be activated. This phase is primarily wiring — injecting NotificationBell into Header.tsx, confirming the cron route works end-to-end with the real table, and ensuring the admin approve/reject flow creates notifications.
**Delivers:** NotificationBell active in Header for authenticated users; admin approve/reject notifications flowing to club organizers; all existing notification API routes validated against the real table; Zustand-cached unread count to prevent per-navigation fetches.
**Implements:** Full notification read flow, notification creation flows (both admin and cron paths)
**Avoids:** Unread count on every navigation (Pitfall 5), hydration mismatch (Pitfall 8), UTC timestamp display (Pitfall 10), admin race condition (Pitfall 6)

### Phase 4: Cron Scheduler Configuration
**Rationale:** Scheduling is configuration work (SQL in Supabase Dashboard) rather than application code. It depends on Phase 1 (table must exist) and Phase 3 (cron route validated). Isolating it as its own phase allows end-to-end testing of the cron logic before automation.
**Delivers:** `pg_cron` job configured in Supabase to call `POST /api/cron/send-reminders` hourly; CRON_SECRET stored in Supabase Vault; cron timing windows set generously (`±30 minutes`) to tolerate pg_cron jitter; end-to-end reminder test (create event 24h out, save it, trigger cron manually, verify badge).
**Uses:** Supabase pg_cron + pg_net extensions, existing CRON_SECRET environment variable
**Avoids:** Cron timing drift (Pitfall 7), duplicate delivery on retry (already handled by Phase 1 UNIQUE constraint)

### Phase Ordering Rationale

- Phase 1 is prerequisite for Phases 3 and 4 because the notifications table must exist before any notification API routes can be meaningfully tested against real data.
- Phase 2 is fully independent and can run in parallel with Phases 1 and 3 if multiple contributors are available.
- Phase 3 precedes Phase 4 because manual cron triggering during Phase 3 validation is how the cron route gets tested before scheduling it.
- Both critical database-layer pitfalls (RLS and UNIQUE constraint) are addressed in Phase 1, before any application code writes data to the table.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Cron Scheduler):** The pg_cron → pg_net → Next.js API auth flow has a documented gap (Supabase GitHub issue #4287). If pg_cron auth proves too complex, the fallback is using GitHub Actions or Vercel Cron as the scheduler. This decision should be validated before implementation begins.
- **Phase 3 (Notification Bell caching):** The decision between Zustand global store caching vs. SWR `revalidateOnFocus` needs to be made upfront. Both work; picking inconsistently creates two patterns in the codebase.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Database):** Supabase table creation with RLS is fully documented with official examples. No research needed.
- **Phase 2 (Cold Start Fix):** Pure SQL filtering on an existing table with a conditional branch in an existing API route. Well-documented patterns throughout.
- **Phase 3 (Notification Wiring):** All components already exist. This is validation and injection work, not new architecture.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. All patterns verified against existing codebase and official Supabase/Next.js docs. SWR-over-Realtime is MEDIUM (community preference, not official guidance). |
| Features | HIGH | Codebase audit directly confirmed what exists and what doesn't. Feature gaps are specific and verifiable. |
| Architecture | HIGH | Based on direct code inspection of all relevant files. Component boundaries and data flows confirmed from source. One gap: pg_cron auth path has a documented known issue. |
| Pitfalls | HIGH | RLS and cron idempotency pitfalls are backed by official Supabase documentation. Cold start UX pitfalls backed by peer-reviewed research and codebase-specific context from CONCERNS.md. |

**Overall confidence:** HIGH

### Gaps to Address

- **Cron auth mechanism:** The pg_cron → pg_net → Next.js API route with CRON_SECRET auth has a documented friction point (Supabase issue #4287). Before starting Phase 4, verify whether pg_cron can reliably call an external URL with a bearer token in this project's Supabase plan tier. If not, pivot to GitHub Actions or Vercel Cron immediately.
- **`event_popularity_scores` scoring formula:** PITFALLS.md flags that the existing `/api/events/popular` route may query pre-computed scores that don't apply the PROJECT.md scoring boosts (`>10 saves → +2`, `recency → +1`) at query time. This must be verified before Phase 2 ships — if scoring is wrong, the cold start fallback will surface irrelevant events even with correct time filtering.
- **NotificationBell already in Header:** ARCHITECTURE.md shows NotificationBell is already injected at Header.tsx line 122, but FEATURES.md lists it as missing. This discrepancy should be verified by inspection before Phase 3 begins — it may already be done.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/components/notifications/`, `src/app/api/notifications/`, `src/app/api/cron/`, `src/app/api/admin/events/[id]/status/`, `src/app/api/recommendations/route.ts`, `src/app/page.tsx`, `src/components/events/RecommendedEventsSection.tsx`
- [Supabase Cron Docs](https://supabase.com/docs/guides/cron) — pg_cron scheduling guide
- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net pattern
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policies
- [Supabase Edge Functions Deno 2.1](https://supabase.com/blog/supabase-edge-functions-deploy-dashboard-deno-2-1) — runtime version
- [Next.js Hydration Error Docs](https://nextjs.org/docs/messages/react-hydration-error) — hydration mismatch prevention
- [Processing Large Jobs with Edge Functions, Cron, and Queues](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — cron idempotency patterns
- `.planning/PROJECT.md` and `.planning/codebase/CONCERNS.md` — first-party project constraints

### Secondary (MEDIUM confidence)
- [makerkit.dev: Real-time Notifications with Supabase + Next.js](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — polling vs realtime analysis, notification schema
- [Smashing Magazine: Design Guidelines for Better Notifications UX](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) — notification UX patterns
- [Ably: WebSockets vs Long Polling](https://ably.com/blog/websockets-vs-long-polling) — polling vs realtime tradeoffs at scale
- [shadcn.io Notification Button Pattern](https://www.shadcn.io/patterns/button-group-badges-1) — Bell + Badge overlay
- [Building Idempotent Cron Jobs](https://traveling-coderman.net/code/node-architecture/idempotent-cron-job/) — deduplication patterns

### Tertiary (LOW confidence)
- [Cold Start Problem 2025 Overview (Shadecoder)](https://www.shadecoder.com/topics/cold-start-problem-a-comprehensive-guide-for-2025) — general cold start patterns (single source)

---
*Research completed: 2026-02-23*
*Ready for roadmap: yes*
