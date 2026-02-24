# Feature Landscape

**Domain:** In-app notification system + cold start recommendation fallback feed
**Project:** Uni-Verse — campus event discovery platform (McGill University)
**Researched:** 2026-02-23
**Milestone scope:** Adding cold start fix and notification system to existing platform

---

## Codebase Audit Summary

Before categorizing features, a codebase audit established what already exists and what is genuinely missing:

**Already built (do not rebuild):**
- NotificationBell component with 60s polling and unread count badge — exists at `src/components/notifications/NotificationBell.tsx`
- NotificationItem component with 4 type configs (event_reminder_24h, event_reminder_1h, event_approved, event_rejected) — exists
- NotificationList component with empty state — exists
- GET /api/notifications (returns notifications + unread_count, limit 50) — exists
- PATCH /api/notifications/[id] (mark single as read) — exists
- POST /api/notifications?action=mark-all-read — exists
- /notifications page with optimistic mark-read/mark-all-read — exists
- Cron route POST /api/cron/send-reminders (24h + 1h reminder generation with deduplication) — exists
- canShowRecommendations gate at `savedEventIds.size >= 3` — exists in page.tsx line 128
- Recommendations API with full hybrid scoring (content + collaborative + popularity) — exists
- Interest-tag fallback in recommendations API — exists (interest_tags overlap query)
- Popular events section (PopularEventsSection.tsx, /api/events/popular) — exists

**Genuinely missing (active milestone scope):**
- Notifications database table — not yet created in Supabase
- NotificationBell not yet injected into Header.tsx
- Cron not wired to Vercel or Supabase scheduler
- Cold start fallback: when user has <3 saved events AND zero interest tags, API returns empty array with no fallback to popularity — no graceful degradation to the popular/trending feed
- Recommendations API type mismatch: cron inserts `reminder_24h`/`reminder_1h` but NotificationItem typeConfig expects `event_reminder_24h`/`event_reminder_1h` — type string mismatch
- No notification seeding on admin approve/reject actions
- No `/api/recommendations` fallback path that explicitly returns a popularity-ranked feed for cold-start users

---

## Table Stakes

Features users expect from this domain. Absence makes the experience feel broken or incomplete.

### Notification System — Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unread count badge on bell icon | Every notification system from Gmail to GitHub shows this. Absence means users don't know they have notifications. | Low | Already implemented in NotificationBell.tsx. Needs Header.tsx injection. |
| Bell navigates to notification list/inbox | Users expect tapping the bell to open their notifications. Navigation to /notifications is the simpler, correct pattern for this app scale. | Low | Already implemented via Link in NotificationBell.tsx. |
| Notifications persist in a list (inbox) | Ephemeral-only notifications (toast-only) are not sufficient — users must be able to review past notifications. | Low | /notifications page already built. Depends on DB table existing. |
| Mark single notification as read | Standard interaction — clicking a notification marks it read. Unread items should be visually distinct (bold, indicator dot). | Low | Already implemented with optimistic update in notifications page. |
| Mark all as read | When a user has many unread notifications, one-click clearance is expected. | Low | Already implemented. |
| Read/unread visual distinction | Unread items must be visually distinct from read ones. Bold text + indicator dot is the established pattern. | Low | Already implemented in NotificationItem.tsx (bg-card + shadow vs bg-card/50 + opacity-70). |
| Relative timestamps ("2h ago", "just now") | Absolute timestamps feel heavy in notification inboxes. Relative time is universally expected. | Low | Already implemented in timeAgo() in NotificationItem.tsx. |
| Empty state when no notifications exist | "You have no notifications yet" with icon prevents confusion for new users. | Low | Already implemented in NotificationList.tsx. |
| Auth-gated notification page | Unauthenticated users must not see or access notifications. | Low | Already implemented in /notifications page. |
| Event reminder notifications (24h and 1h) | Core value: users save events to get reminded. Without reminders the save feature loses its primary utility. | Medium | Cron route exists. Needs: DB table, scheduler wiring, type string alignment. |
| Deduplication of reminder notifications | Without deduplication, cron running every hour sends duplicate 24h reminders. | Low | Already implemented in cron route (count check before insert). |
| Notification creation on admin approve/reject | Club organizers submitting events must hear the outcome. This is the core feedback loop of the submission workflow. | Low | Not yet implemented. Needs integration into admin approve/reject actions. |

### Cold Start Recommendation Feed — Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Non-empty feed for brand-new users | New users who see an empty "Recommended for You" section on first visit interpret it as a broken product. This is the primary issue to fix. | Low-Med | Fix: return popularity-ranked fallback from /api/recommendations when user has <3 saved events. PopularEventsSection already exists and covers the visual side; the API needs the fallback path. |
| Threshold before personalization kicks in | Showing K-means recommendations to a user with 0 saved events produces noise, not signal. A gate (currently 3 saves) prevents bad personalization. | Low | Already implemented (savedEventIds.size >= 3 on page.tsx line 128). Correct. |
| Graceful API fallback, not silent empty | The API returning `{ recommendations: [] }` for cold-start users with no tags causes the RecommendedEventsSection to call `onEmpty()` and disappear. The section vanishes silently. Users see no explanation. | Low-Med | Fix: /api/recommendations should detect the cold-start state and return a popularity-ranked feed with a `source: "popular_fallback"` flag so the UI can label it appropriately. |
| Contextual label for fallback section | When showing the popularity fallback instead of personalized recommendations, the section title should reflect that ("Popular on Campus" not "Recommended For You"). Showing "Recommended For You" for a popularity feed is misleading. | Low | Fix: RecommendedEventsSection reads `source` from API response and conditionally renders a different heading/description. |
| Popularity scoring that favors recent + popular events | A fallback that shows old events with high all-time saves is misleading. Recency must factor into the fallback score. | Low | Already defined: >10 saves → +2, within 7 days → +1. Existing event_popularity_scores table. |
| Saved events excluded from fallback | Showing a saved event in the fallback "Popular" section wastes a slot and confuses the user. | Low | Already excluded in the main recommendations path. Must be carried to the fallback path. |

---

## Differentiators

Features that go beyond expectations and create positive moments. Not required for beta, but add value when time permits.

### Notification System — Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Supabase Realtime instead of polling | Near-instant notification delivery vs. up-to-60s lag from polling. Meaningful for 1h reminder UX — a reminder that arrives 60s late can miss the window. | Medium | Supabase Realtime PostgreSQL changes subscription can replace the 60s poll. Recommended for post-beta. PROJECT.md marks this as "to be decided during implementation." |
| Toast/snackbar for new notifications received while browsing | When Realtime is added, a transient toast can surface new notifications without requiring the user to check the bell. | Medium | Depends on Realtime being in place first. Defer until Realtime is chosen. |
| Notification type filtering on inbox page | "Show only reminders" or "Show only approvals" reduces cognitive load for power users (club organizers who receive many approve/reject notifications). | Medium | Not in current scope. Future enhancement. |
| Clickable notification links to event detail page | Notifications mentioning an event could link directly to /events/[id]. Reduces friction from "you have a reminder" → viewing the event. | Low-Med | Notification schema already includes event_id. Implementation: wrap NotificationItem in conditional Link to /events/[event_id]. Low complexity addition. |
| Pagination on /notifications page | The current implementation fetches 50 notifications max and shows all. For active users over time, the list grows. | Low | Add cursor-based pagination matching the pattern used by useEvents hook. Not blocking for beta. |

### Cold Start Recommendation Feed — Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Onboarding prompt to save events to unlock personalization | Instead of silently showing the popular feed, a subtle inline nudge ("Save 3 events to unlock personalized recommendations") tells users why personalization isn't showing yet and creates a clear action path. | Low | This is a UI-only addition to RecommendedEventsSection or the section below it. High value-to-effort ratio. |
| Progress indicator toward personalization ("2 of 3 saves") | Gamification: showing progress toward the 3-save threshold motivates users to engage more. Seen in Spotify's taste setup flow. | Low-Med | Requires reading savedEventIds.size in the cold-start state and rendering a progress element. Worth exploring if onboarding prompt alone is insufficient. |
| Interest-tag-aware fallback (not pure popularity) | For a new user who completed onboarding tag selection, showing purely popular events ignores known signal. A hybrid "popularity among events matching your interest tags" is more relevant. | Medium | Partially exists: the recommendations API already has an interest-tag fallback query. The cold-start fix can leverage this. |

---

## Anti-Features

Features to explicitly NOT build for this milestone. Each has a reason and an alternative.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Email notifications | Out of scope per PROJECT.md. External channels require SPF/DKIM setup, unsubscribe compliance (CAN-SPAM/CASL), deliverability monitoring, and bounce handling. Beta is not the moment for this. | In-app only. Revisit after beta if retention data shows demand. |
| Push notifications (browser/mobile) | Requires service worker registration, push API keys, permission prompts. Adds infrastructure complexity disproportionate to beta stage. Browser permission prompts also reduce trust if introduced too early. | In-app only. Defer to a dedicated notifications milestone. |
| Notification preferences/settings UI | Per PROJECT.md: "all notifications on by default for beta." Building settings before understanding which notification types users want to mute adds speculative complexity. | Ship all types on. Add preferences after beta usage patterns are clear. |
| Real-time chat or messaging | Unrelated to this milestone. Would require a separate channel architecture (WebSockets, presence). | Nothing. Not in the product vision. |
| Recommendation algorithm changes beyond cold start fix | The existing K-means + content-based + popularity hybrid already works. Changing algorithm weights or adding new signals risks breaking what works for existing users. | Leave the algorithm alone. Only fix the entry-point gate and fallback path. |
| Notification deletion | Adds DB mutation complexity. For beta, retention of all notifications for history is more useful than deletion. | Read-only history. If notification count becomes a problem, add auto-expiry at DB level (e.g., delete after 90 days) rather than user-triggered delete. |
| Per-notification-type delivery schedule (quiet hours, frequency caps) | Over-engineering for a beta platform. With only 4 notification types and low volume (reminder-based only), frequency is naturally limited. | Default-on for all types. Post-beta preference work. |
| Recommendation explanation ("Why am I seeing this?") | Valuable UX pattern (used by Netflix, Spotify) but adds significant UI and API complexity. The fallback section label change ("Popular on Campus") is a simpler form of transparency that suffices for beta. | Use section title/subtitle to communicate feed type. No per-card explanation needed. |

---

## Feature Dependencies

```
notifications DB table
  → GET /api/notifications (can't query what doesn't exist)
    → NotificationBell (fetches from API)
      → Header.tsx injection (renders the bell)
    → /notifications page (fetches from API)
      → mark-as-read (requires notifications rows)
      → mark-all-read (requires notifications rows)

cron route (POST /api/cron/send-reminders)
  → notifications DB table (inserts into it)
  → Vercel/Supabase scheduler trigger (wires the cron to run hourly)

admin approve/reject actions
  → notifications DB table (inserts approval/rejection notifications)
  → notification type string consistency (must match typeConfig keys: event_reminder_24h, event_reminder_1h, event_approved, event_rejected)

cold start fallback feed
  → /api/recommendations fallback path (returns popularity-ranked events when savedEventIds.size < 3)
    → event_popularity_scores table (already exists)
    → saved_events (to exclude already-saved events from fallback)
  → RecommendedEventsSection UI (reads `source` flag, renders appropriate label)
  → canShowRecommendations gate on page.tsx (already exists, controls whether section renders at all)

NOTE: canShowRecommendations currently hides the section entirely when < 3 saves.
The cold start fix changes this: the section should always render but show different content
(fallback feed) instead of hiding. This means canShowRecommendations may need to be
renamed or restructured to canShowPersonalized, with the section always visible.
```

**Critical type mismatch to resolve:**
The cron route (`/api/cron/send-reminders/route.ts`) inserts notifications with types `reminder_24h` and `reminder_1h`. The NotificationItem typeConfig keyed on `event_reminder_24h` and `event_reminder_1h`. These strings do not match, meaning reminder notifications will render with the generic Bell fallback icon, not the Clock/AlertCircle icons. One set of strings must be aligned before shipping.

---

## MVP Recommendation

For this milestone, prioritize in this order:

**Must ship (blocking beta):**
1. Create notifications DB table in Supabase (everything else is blocked on this)
2. Align notification type strings across cron route and NotificationItem typeConfig
3. Inject NotificationBell into Header.tsx
4. Wire cron scheduler (Vercel cron or Supabase pg_cron)
5. Add admin approve/reject → notification creation
6. Fix /api/recommendations to return popularity-ranked fallback when user is cold-start
7. Update RecommendedEventsSection to show appropriate label based on API `source` flag

**Should ship (high value, low complexity):**
8. Clickable notification items linking to /events/[event_id] (event_id already in schema)
9. Onboarding nudge in the cold-start section ("Save 3 events to unlock personalized recommendations")

**Defer post-beta:**
- Supabase Realtime replacing polling
- Notification type filtering on inbox
- Pagination on /notifications
- Progress indicator toward personalization threshold
- Email/push notifications
- Notification preferences

---

## Sources

- Codebase audit: `src/components/notifications/`, `src/app/api/notifications/`, `src/app/api/cron/send-reminders/route.ts`, `src/app/api/recommendations/route.ts`, `src/components/events/RecommendedEventsSection.tsx`, `src/components/events/PopularEventsSection.tsx`, `src/app/page.tsx`
- Project context: `.planning/PROJECT.md`
- [Cold Start Problem — Practitioner's Guide (Medium/Data Scientists Handbook)](https://medium.com/data-scientists-handbook/cracking-the-cold-start-problem-in-recommender-systems-a-practitioners-guide-069bfda2b800) — MEDIUM confidence (WebSearch, not officially verified)
- [Cold Start Problem 2025 Overview (Shadecoder)](https://www.shadecoder.com/topics/cold-start-problem-a-comprehensive-guide-for-2025) — LOW confidence (single source)
- [Warm Recommendations for the AI Cold-Start Problem (Airbyte)](https://airbyte.com/blog/recommendations-for-the-ai-cold-start-problem) — MEDIUM confidence (credible vendor, not primary research)
- [Design Guidelines for Better Notifications UX (Smashing Magazine, 2025)](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) — MEDIUM confidence (authoritative UX publication)
- [In-App Notifications — if and how you should use them (UserGuiding)](https://userguiding.com/blog/in-app-notifications) — MEDIUM confidence
- [Notification System Design: Architecture & Best Practices (MagicBell)](https://www.magicbell.com/blog/notification-system-design) — MEDIUM confidence (vendor source, practical)
- [Using Realtime with Next.js (Supabase Official Docs)](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — HIGH confidence (official documentation)
- [Building a Real-time Notification System with Supabase and Next.js (MakerKit)](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — MEDIUM confidence (credible community source)
- [Notification Center — How to Build (Courier)](https://www.courier.com/blog/how-to-build-a-notification-center-for-web-and-mobile-apps) — MEDIUM confidence (vendor documentation)
- [Long Polling vs WebSockets at scale (Ably)](https://ably.com/blog/websockets-vs-long-polling) — HIGH confidence (official Ably docs, real-time infrastructure vendor)
