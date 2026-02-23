# Domain Pitfalls

**Domain:** Cold Start Recommendation Fix + In-App Notification System
**Project:** Uni-Verse (McGill campus event discovery platform)
**Researched:** 2026-02-23

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken features at launch.

---

### Pitfall 1: Cron-Generated Duplicate Notifications

**What goes wrong:** The Supabase Edge Function cron job fires on schedule and inserts a 24h or 1h reminder — but if the cron fires twice (overlap, restart, or pg_net retry), two identical notifications land in the table for the same user + event + type combination. Users see duplicate bell entries and lose trust in the system immediately.

**Why it happens:** pg_cron with pg_net HTTP invocations can retry on transient failures. Supabase Edge Functions have at-least-once delivery semantics, not exactly-once. Without a database-level guard, every retry becomes a new row.

**Consequences:** Duplicate rows in the notifications table. Users see the same reminder twice (or more). If the mark-as-read logic operates by ID, one duplicate will stay "unread" permanently, breaking the unread count badge.

**Prevention:**
- Add a composite `UNIQUE` constraint on `(user_id, event_id, type)` in the notifications table at creation time — this is the simplest, most reliable guard. Postgres will reject the second insert with a constraint violation.
- In the Edge Function, use `INSERT ... ON CONFLICT (user_id, event_id, type) DO NOTHING` so duplicates are silently discarded without crashing the function.
- For the 24h and 1h reminders, include the notification type in the key: `event_reminder_24h` and `event_reminder_1h` are distinct types so both reminders can coexist for the same event.

**Detection (warning signs):**
- Users reporting "I got the same reminder twice."
- Unread badge count not going to zero after reading all notifications.
- Notifications table row count growing faster than (users × events × 2).

**Phase:** Notifications DB schema phase — the UNIQUE constraint must be added when the table is created, not retrofitted later when data exists.

---

### Pitfall 2: RLS Not Enabled on the Notifications Table

**What goes wrong:** The `notifications` table is created but RLS is not enabled (Supabase default). Any authenticated user can query or modify any other user's notifications via the Supabase client. Bell count and read status are exposed across users.

**Why it happens:** Supabase tables have RLS disabled by default. The codebase already uses service-role keys in some API routes (e.g., `calculate-popularity`), which bypass RLS entirely — so forgetting to enable RLS on a new table is easy to miss if manual testing uses a service role client.

**Consequences:** Privacy breach — user A can read, mark-read, or delete user B's notifications. This is a launch-blocking security issue.

**Prevention:**
- Enable RLS immediately when creating the notifications table (before any data).
- Add four policies minimum: SELECT (user sees only their rows), INSERT (only service role or Edge Function inserts), UPDATE (user can only update `is_read` on their own rows), DELETE (no user deletion; admin/service role only).
- Never use `auth.uid()` policy checks in the SQL Editor — test via the Supabase client with a real user JWT to verify policies actually fire.
- The CONCERNS.md already flags missing database indexes on `user_id` — ensure `notifications.user_id` is indexed, as the RLS policy `WHERE user_id = auth.uid()` triggers a sequential scan without it.

**Detection (warning signs):**
- Supabase dashboard shows notifications table with RLS disabled (visible in Table Editor).
- A logged-in user can run `SELECT * FROM notifications` in the client and see rows belonging to other users.
- The unread count returns values even when a different test account should have no notifications.

**Phase:** Notifications DB schema phase — before any API routes are built.

---

### Pitfall 3: Showing Expired / Past Events in the Cold Start Fallback Feed

**What goes wrong:** The popularity-based fallback feed for users below the 3-save threshold queries `event_popularity` scored events without filtering for `start_time > NOW()`. New users see a feed full of events that already happened. They cannot attend them, feel the app is broken, and abandon during the exact moment the platform needs to make a first impression.

**Why it happens:** The existing popularity scoring system (`>10 saves → +2`, `within 7 days → +1`) operates on historical save counts. A campus event from two weeks ago may still have a high popularity score. The recommendations API (365 lines, flagged in CONCERNS.md as uncached) will surface whatever scores highest without temporal filtering unless explicitly guarded.

**Consequences:** New users see irrelevant past events. The cold start "fix" makes first impressions worse, not better. This is the most visible UX failure possible for the milestone.

**Prevention:**
- Add an explicit `AND start_time > NOW()` (or `AND end_time > NOW()`) filter on every query path that serves the popularity fallback feed.
- Consider a secondary sort: primary by `popularity_score DESC`, secondary by `start_time ASC` so the soonest upcoming event surfaces first among ties.
- The recency boost (`within 7 days → +1`) in the scoring formula should use event `start_time`, not `created_at`, so it boosts upcoming events rather than recently created ones regardless of timing.

**Detection (warning signs):**
- Manual test: create a new account, expect to see the fallback feed, check if any displayed events have `start_time` in the past.
- The `/api/events/popular` route (flagged in CONCERNS.md with `any` types) should be audited to confirm it already filters by time — do not assume it does.

**Phase:** Cold start API fallback implementation — apply the time filter in the same PR that adds the fallback path to `/api/recommendations`.

---

### Pitfall 4: Threshold Visibility — No User-Facing Feedback on Why Recommendations Are Missing

**What goes wrong:** A user with 1 or 2 saved events does not see personalized recommendations. They see a popularity feed but have no idea why. They assume the recommendation system is broken or simply never existed. They don't know that saving one more event would unlock personalization. The threshold gate is invisible.

**Why it happens:** Binary thresholds without UI feedback are a classic cold start UX mistake. The gate logic lives in the API or page.tsx, but nothing surfaces the threshold to the user.

**Consequences:** Users never reach the 3-save threshold. The personalization feature is permanently gated for a large cohort of users who don't understand the model. Engagement and retention drop at exactly the wrong moment (new user onboarding).

**Prevention:**
- Display a progress indicator or contextual banner in the recommendations section: "Save 2 more events to unlock personalized picks" when the user has 1 saved event.
- When the user has 0 saves, show: "Start saving events to get personalized recommendations."
- This UI element should update reactively — the existing `savedEventIds.size` state in `page.tsx` already tracks this count, so the progress display is a minor addition.
- Do not gatekeep silently. Show the fallback feed AND explain the progression.

**Detection (warning signs):**
- Code review: if the threshold check in `page.tsx` or `/api/recommendations` has no corresponding UI indicator, this pitfall is present.
- User testing: ask a new user why they don't see personalized recommendations — if they can't answer, the feedback is missing.

**Phase:** Cold start UI implementation — ship the progress indicator in the same phase as the threshold logic, not as a follow-up.

---

## Moderate Pitfalls

---

### Pitfall 5: Notification Bell Triggers Unread Count Fetch on Every Page Navigation

**What goes wrong:** The NotificationBell component lives in the Header. If it fetches the unread count on every mount (every client-side navigation), it issues a `GET /api/notifications?unread_count=true` call on every page change. With 50 concurrent users navigating normally, this becomes 50+ requests per minute against a route that queries Supabase on every call — adding to the existing "recommendation engine processes all events per user" load flagged in CONCERNS.md.

**Why it happens:** The Header is a client component that re-mounts on route changes. Without memoization or a shared state layer, every mount triggers a fresh fetch.

**Prevention:**
- Use a global state store (Zustand — already present in the codebase at `src/store/useAuthStore.ts`) to cache the unread count client-side and only re-fetch on: page focus, explicit bell open, or after a mark-as-read action.
- Alternatively, co-locate the unread count fetch with the existing auth initialization so the count is loaded once per session and updated on explicit interactions.
- If choosing Supabase Realtime for live updates: each browser tab opens a WebSocket connection. For a beta with a small user base this is fine, but document the per-connection cost and set a conscious threshold for when to revisit.

**Detection (warning signs):**
- Open browser DevTools Network tab and navigate between pages — if `GET /api/notifications` fires on every navigation, the fetch is not cached.
- Supabase dashboard shows notifications API query count disproportionately high relative to user count.

**Phase:** NotificationBell component implementation.

---

### Pitfall 6: Admin Approve/Reject Notifications Created in Application Code Instead of Database Trigger — Race Condition on Concurrent Approvals

**What goes wrong:** If notification creation on admin approve/reject is implemented in the Next.js API route handler (application code path), a rapid double-click or concurrent admin action can trigger two route invocations, creating two "Your event was approved" notifications for the same event submission. The UNIQUE constraint from Pitfall 1 saves you here only if `type` is sufficiently specific.

**Why it happens:** HTTP is stateless — two near-simultaneous POST requests to `/api/admin/events/[id]/approve` both read the event as "pending" and both attempt to create a notification. Without a database-level guard, both succeed.

**Prevention:**
- The PROJECT.md notes this decision is pending: "Notification creation on admin action (in approval flow or DB trigger)." Prefer a Postgres trigger on the `events` table that fires on `status` column transition from `pending` → `approved` or `pending` → `rejected`. Triggers are atomic and execute exactly once per row update, eliminating the race.
- If using application code instead, add a unique constraint on `(user_id, event_id, type)` — the notification types `event_approved` and `event_rejected` are specific enough that a second attempt will hit the constraint and be discarded.
- Ensure the admin action updates `events.status` atomically (single `UPDATE`) and the notification is a side effect of that update, not a separate step.

**Detection (warning signs):**
- A club organizer receives two "approved" emails for the same event submission.
- Notifications table contains rows with identical `user_id`, `event_id`, `type` and nearly identical `created_at` timestamps.

**Phase:** Admin notification integration phase.

---

### Pitfall 7: Supabase Edge Function Cron Timing Drift for Event Reminders

**What goes wrong:** The 24h reminder cron job scans for events starting between `NOW() + 23h` and `NOW() + 25h` (or similar window). If the window is too narrow (e.g., exactly 24h to 24h+1min), a cron that runs at a slightly different wall-clock time due to pg_cron scheduling jitter misses events. If the window is too wide, users get reminders for events they didn't expect to be reminded about.

**Why it happens:** pg_cron does not guarantee sub-minute accuracy. The Supabase documentation recommends jobs run no longer than 10 minutes and no more than 8 concurrently, but does not guarantee exact invocation timing. The Edge Function itself has a cold start median of 400ms, adding additional timing variance.

**Prevention:**
- Use a generous time window in the reminder query: for "24h before event," query `start_time BETWEEN NOW() + INTERVAL '23 hours 30 minutes' AND NOW() + INTERVAL '24 hours 30 minutes'`. This 1-hour window tolerates cron timing drift without double-firing (protected by the UNIQUE constraint from Pitfall 1).
- The UNIQUE constraint `(user_id, event_id, type)` is the backstop — even if the time window overlaps between two cron runs, the second insert is silently dropped via `ON CONFLICT DO NOTHING`.
- Log the cron invocation time inside the Edge Function so timing drift can be observed and adjusted.

**Detection (warning signs):**
- Users report not receiving reminders for events they saved.
- Edge Function logs show invocation timestamps drifting more than 2-3 minutes from the scheduled time.
- The notifications table shows zero rows with `type = 'event_reminder_24h'` despite saved events with upcoming start times.

**Phase:** Edge Function cron implementation.

---

### Pitfall 8: Hydration Mismatch in NotificationBell Due to Unread Count Server/Client Divergence

**What goes wrong:** If the NotificationBell is rendered in a server component (or the Header renders server-side with a pre-fetched unread count), and the client-side state differs at hydration time (because auth state hasn't initialized yet), React throws a hydration mismatch error that crashes the entire page or silently renders the wrong count.

**Why it happens:** The existing codebase already has a fragile auth state synchronization issue (CONCERNS.md: "3-second fallback timeout arbitrary"). Adding a notification count that depends on auth state to a shared layout component creates another hydration-sensitive dependency.

**Prevention:**
- Render the NotificationBell as a client component with `"use client"`. Initialize unread count to `0` and fetch asynchronously after the component mounts. This is the pattern used in Next.js App Router to avoid hydration mismatches for auth-dependent UI.
- Do not pass the unread count from a server component as a prop to a client component across the server/client boundary without using `Suspense` boundaries — this is a known Next.js App Router footgun.
- The existing auth initialization pattern in `useAuthStore.ts` can be extended to also initialize notification count, keeping both in the same store update.

**Detection (warning signs):**
- Browser console shows "Hydration failed because the initial UI does not match server-rendered HTML."
- The notification badge flickers from a number to 0 on page load.
- The bell renders server-side with a count but the client renders it differently.

**Phase:** NotificationBell component implementation.

---

### Pitfall 9: Popularity Score Stale Data — High-Scored Past Events Poisoning the Fallback Feed

**What goes wrong:** The `event_popularity` table stores cumulative popularity scores. An event from the beginning of the semester with 50 saves has a high score and will perpetually top the fallback feed, even after it ends — unless Pitfall 3's time filter is applied. But even with a future-only filter, events nearing their end date may still rank above genuinely popular upcoming events because their save counts accumulated over weeks.

**Why it happens:** Popularity scoring is additive and unbounded. The recency boost (`within 7 days → +1`) helps but does not overcome 50 accumulated saves. The CONCERNS.md flags "N+1 query pattern in popularity calculation" and "Recommendation engine processes all events per user" — the scoring system is already a known performance and accuracy concern.

**Prevention:**
- When serving the cold start fallback, normalize scores against time-to-event: deprioritize events starting more than 30 days out (unlikely the user can attend), and avoid showing events starting within the next hour (insufficient planning time for a new user).
- A simple window: `start_time BETWEEN NOW() + INTERVAL '2 hours' AND NOW() + INTERVAL '14 days'` combined with popularity sort gives a feed that is both popular and immediately actionable.
- Do not change the underlying scoring formula for this milestone (PROJECT.md explicitly states "recommendation algorithm changes beyond cold start fix" are out of scope), but apply the time window filter at query time.

**Detection (warning signs):**
- The fallback feed is dominated by the same 3-5 events regardless of the current date.
- Events from before the current week appear in the "popular" fallback feed.
- New user test accounts see the same stale events as they did two weeks prior.

**Phase:** Cold start API fallback implementation.

---

## Minor Pitfalls

---

### Pitfall 10: NotificationItem Timestamp Display Shows Wrong Time Zone

**What goes wrong:** Notification `created_at` timestamps are stored in UTC (Supabase default). The NotificationItem component renders them without timezone conversion. A Montreal user sees "Reminder at 5:00 PM" for an event that starts at 1:00 PM EST because the UTC timestamp was rendered directly.

**Prevention:**
- Use `toLocaleString('en-CA', { timeZone: 'America/Toronto' })` for all timestamp display in notification components, consistent with how the existing `formatDate()` and `formatTime()` utilities in `src/lib/utils.ts` handle event times. Check if those utilities already apply timezone conversion — if so, reuse them.

**Phase:** NotificationItem component implementation.

---

### Pitfall 11: Mark-All-Read Endpoint Missing Pagination Guard

**What goes wrong:** `POST /api/notifications?action=mark-all-read` issues a bulk UPDATE against the user's notifications table. If a user somehow accumulates thousands of notifications (e.g., a system bug generates duplicates despite Pitfall 1 prevention), the bulk UPDATE can be slow and block the DB connection. No LIMIT means the query runs to completion regardless of row count.

**Prevention:**
- Add a reasonable per-user notification cap in the cron function (e.g., max 2 active reminders per event per user — enforced by the UNIQUE constraint from Pitfall 1). This bounds the maximum rows a mark-all-read touches.
- In the API route, add `LIMIT 500` on the bulk UPDATE or paginate it, matching the capped maximum.

**Phase:** Notifications API route implementation.

---

### Pitfall 12: `canShowRecommendations` Logic Lives in Multiple Places After Refactor

**What goes wrong:** Currently `canShowRecommendations = hasInterestTags || savedEventIds.size >= 1` exists in `src/app/page.tsx`. When the threshold is changed to `savedEventIds.size >= 3`, if the same check is copy-pasted into the `/api/recommendations` fallback logic, the two values can drift (e.g., page shows personalized UI at 3 saves but API still returns fallback at 1 save, or vice versa).

**Prevention:**
- Define the threshold (`RECOMMENDATION_THRESHOLD = 3`) as a named constant in `src/lib/constants.ts` alongside the existing `EVENT_TAGS` and `EVENT_CATEGORIES` constants. Import this constant everywhere the threshold is checked — page.tsx and the recommendations API route.
- This is consistent with the codebase's existing pattern of centralizing magic values in constants.ts.

**Detection (warning signs):**
- The personalization UI indicator (from Pitfall 4) shows "1 more event to unlock" but the API is already returning personalized results (or vice versa).

**Phase:** Cold start implementation — centralize the constant before writing any threshold-check code.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Notifications DB table creation | RLS disabled by default (Pitfall 2) | Enable RLS + all 4 policies before merging schema |
| Notifications DB table creation | No duplicate guard (Pitfall 1) | Add UNIQUE(user_id, event_id, type) at creation |
| Cold start fallback API | Past events in feed (Pitfall 3) | Add `start_time > NOW()` filter in same PR |
| Cold start UI | Silent threshold gate (Pitfall 4) | Ship progress indicator with threshold logic |
| NotificationBell component | Unread count on every navigation (Pitfall 5) | Cache in Zustand; fetch once per session |
| NotificationBell component | Hydration mismatch (Pitfall 8) | Mark as `"use client"`, initialize count to 0 |
| Edge Function cron | Duplicate delivery on retry (Pitfall 1 + 7) | Use ON CONFLICT DO NOTHING + wide time window |
| Admin approve/reject flow | Race condition on double-click (Pitfall 6) | Prefer DB trigger over application code |
| Cold start fallback API | Stale popular events (Pitfall 9) | Apply time window filter at query time |
| NotificationItem component | UTC timestamp display (Pitfall 10) | Reuse existing formatTime() utility |
| Recommendations constant | Threshold drift between UI and API (Pitfall 12) | Define RECOMMENDATION_THRESHOLD in constants.ts |

---

## Sources

- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence (official docs)
- [Fixing RLS Misconfigurations in Supabase](https://prosperasoft.com/blog/database/supabase/supabase-rls-issues/) — MEDIUM confidence (community, verified against official docs)
- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — HIGH confidence (official docs)
- [Processing Large Jobs with Edge Functions, Cron, and Queues](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — HIGH confidence (official Supabase blog)
- [Supabase Persistent Storage and 97% Faster Cold Starts](https://supabase.com/blog/persistent-storage-for-faster-edge-functions) — HIGH confidence (official Supabase blog, cold start latency figures: 400ms median)
- [Building Idempotent Cron Jobs](https://traveling-coderman.net/code/node-architecture/idempotent-cron-job/) — MEDIUM confidence (community article with verifiable pattern)
- [Idempotent Requests in Notification Infrastructure](https://www.fyno.io/blog/idempotent-requests-in-notification-infrastructure-cm4s7axck002x9jffvml6fx1y) — MEDIUM confidence (vendor blog, pattern is well-established)
- [Top 5 In-App Notification Pitfalls](https://sceyt.com/blog/in-app-notification-mistakes-and-how-to-avoid-them) — MEDIUM confidence (community article)
- [Building a Real-time Notification System with Supabase and Next.js](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — MEDIUM confidence (MakerKit, practical implementation)
- [Next.js Hydration Error Docs](https://nextjs.org/docs/messages/react-hydration-error) — HIGH confidence (official Next.js docs)
- [Cracking the Cold Start Problem: A Practitioner's Guide](https://medium.com/data-scientists-handbook/cracking-the-cold-start-problem-in-recommender-systems-a-practitioners-guide-069bfda2b800) — MEDIUM confidence (community, patterns are standard)
- [Popularity Bias in Recommender Systems](https://link.springer.com/article/10.1007/s11257-024-09406-0) — HIGH confidence (peer-reviewed, Springer)
- [Why Most Mobile Push Notification Architecture Fails](https://www.netguru.com/blog/why-mobile-push-notification-architecture-fails) — MEDIUM confidence (agency blog, patterns are well-established)
- Project-specific context: `.planning/PROJECT.md` and `.planning/codebase/CONCERNS.md` — HIGH confidence (first-party codebase analysis)
