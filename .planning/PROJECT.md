# Uni-Verse Beta Launch: Cold Start Fix & Notifications

## What This Is

Uni-Verse is a campus event discovery platform for McGill University. Students discover, filter, and save events happening on campus. This milestone focuses on fixing the broken cold start gate in the recommendation feed and building the in-app notification system needed for beta launch.

## Core Value

New users must see a useful, engaging feed from their first visit — not a broken or empty recommendation section — and existing users must receive timely notifications about events they care about.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ Event discovery with search and tag filtering — existing
- ✓ Cursor-based event pagination — existing
- ✓ Event saving/unsaving with heart button — existing
- ✓ OAuth authentication (McGill-only, Azure/Google) — existing
- ✓ User onboarding with interest tag selection — existing
- ✓ Event detail pages — existing
- ✓ Saved events page (My Events) — existing
- ✓ Admin dashboard (event/club/user CRUD) — existing
- ✓ Personalized recommendations via K-means clustering — existing
- ✓ Popular events section with popularity scoring — existing
- ✓ "Happening Now" events section — existing
- ✓ User interaction tracking (views, clicks, saves, shares) — existing
- ✓ Dark/light mode — existing
- ✓ Calendar view — existing
- ✓ Role-based access control (user, club_organizer, admin) — existing
- ✓ Middleware route protection and session refresh — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Cold start gate requires 3+ saved events before showing personalized recommendations
- [ ] Users below threshold see popular/trending feed with scoring algorithm (popularity boost: >10 saves → +2, recency boost: within 7 days → +1)
- [ ] Recommendations API returns graceful fallback when user has <3 saved events
- [ ] Notifications database table created in Supabase
- [ ] GET /api/notifications returns user's notifications (paginated)
- [ ] PATCH /api/notifications/[id] marks single notification as read
- [ ] POST /api/notifications?action=mark-all-read marks all as read
- [ ] NotificationBell component with unread count badge in Header
- [ ] NotificationList and NotificationItem components
- [ ] /notifications page showing full notification history
- [ ] 4 notification types: event_reminder_24h (blue), event_reminder_1h (orange), event_approved (green), event_rejected (red)
- [ ] Supabase Edge Function (cron) generates reminder notifications for saved events at 24h and 1h before event start
- [ ] Admin approve/reject actions create notifications for event submitters

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Email/push notifications — in-app only for beta launch, external channels deferred
- Notification preferences/settings — all notifications on by default for beta
- Real-time chat or messaging — unrelated to notification system
- Recommendation algorithm changes beyond cold start fix — existing K-means works

## Context

- The current cold start gate in `src/app/page.tsx` uses `canShowRecommendations = hasInterestTags || savedEventIds.size >= 1`, which is too permissive — shows recommendations to users with zero meaningful signal
- The recommendations API at `src/app/api/recommendations/route.ts` needs a fallback path when a user doesn't meet the threshold
- No notifications infrastructure exists yet — table, API routes, and components all need to be built from scratch
- The Header component at `src/components/layout/Header.tsx` is where the NotificationBell needs to be injected
- Supabase Edge Functions will handle cron-based reminder generation
- The existing `event_popularity` table and popularity scoring system can be leveraged for the cold start fallback feed
- Existing `user_interactions` tracking provides the save counts needed for popularity scoring

## Constraints

- **Database**: Notifications table created via Supabase MCP tooling — no raw SQL migrations
- **Auth**: All notification endpoints require authenticated user (existing middleware pattern)
- **Cron**: Supabase Edge Function for reminders (not Vercel Cron)
- **Branding**: McGill color palette (Red #ED1B2F, Burgundy #561c24, Sage #c7c7a3, Cream #e8d8c4) plus notification type colors (blue, orange, green, red)
- **Stack**: Must use existing patterns — Next.js App Router, Supabase client/server split, TypeScript strict mode, shadcn/ui components

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 3+ saved events threshold for recommendations | Users need meaningful signal before personalization works; prevents empty/irrelevant recommendations | — Pending |
| Popularity scoring: >10 saves → +2, within 7 days → +1 | Balances all-time popularity with temporal relevance; prevents showing highly-saved but distant events | — Pending |
| Supabase Edge Function for reminder cron | Keeps scheduled work in Supabase ecosystem rather than splitting between Vercel and Supabase | — Pending |
| Notification creation on admin action (in approval flow or DB trigger) | Either approach works; to be decided during implementation based on cleaner integration | — Pending |
| Polling or Realtime for notification bell updates | To be decided during implementation based on simplicity for beta | — Pending |

---
*Last updated: 2026-02-23 after initialization*
