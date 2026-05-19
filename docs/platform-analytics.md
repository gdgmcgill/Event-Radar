# UNI-VERSE Platform Analytics

> **Snapshot:** May 19, 2026 · Generated from production Supabase  
> **Regenerate:** `npx tsx scripts/platform-analytics.ts --json`

---

## At a glance

| Metric | Value |
|--------|------:|
| **Registered users** | 34 |
| **Onboarding completed** | 32 (94%) |
| **Active users (30d)** | 5 |
| **Clubs on platform** | 222 (all approved) |
| **Events listed** | 229 (all approved) |
| **Upcoming approved events** | 0 |
| **Total RSVPs** | 9 |
| **Saved events** | 8 |
| **Club follows** | 2 |

---

## Users

| Metric | Count | Notes |
|--------|------:|-------|
| Total registered | **34** | Rows in `users` |
| Onboarding completed | **32** | `onboarding_completed = true` |
| Onboarding rate | **94%** | Completed ÷ total |
| New signups (7d) | **0** | `created_at` in last 7 days |
| New signups (30d) | **5** | `created_at` in last 30 days |
| Active (7d) | **0** | `updated_at` in last 7 days |
| Active (30d) | **5** | `updated_at` in last 30 days |
| With interest tags | **34** | Non-null `interest_tags` |
| Engaged (3+ saves) | **0** | `saved_events_count ≥ 3` |
| Club organizers | **1** | `roles` contains `club_organizer` |
| Admins | **4** | `roles` contains `admin` |
| Banned | **0** | `banned_at` set |

### User growth

Early beta: most accounts predate the last 30-day window. Five new users joined in the past 30 days; none in the past 7 days. Activity (profile updates) tracks the same five users over 30 days.

---

## Clubs

| Metric | Count | Notes |
|--------|------:|-------|
| Total clubs | **222** | All rows in `clubs` |
| Approved | **222** | Visible on platform |
| Pending moderation | **0** | Awaiting review |
| Rejected | **0** | Not visible |
| New clubs (30d) | **0** | Bulk import predates window |
| Club members | **0** | `club_members` rows |
| Club followers | **2** | `club_followers` rows |
| Featured (active now) | **0** | Current `featured_clubs` slot |

Clubs were populated primarily via the Instagram scrape pipeline; the catalog is large relative to organic organizer signups (`club_members` is still empty).

---

## Events

| Metric | Count | Notes |
|--------|------:|-------|
| Total events | **229** | All rows in `events` |
| Approved | **229** | Live on platform |
| Pending moderation | **0** | Awaiting review |
| Rejected | **0** | Not visible |
| New events (30d) | **0** | Bulk import predates window |
| Upcoming (approved) | **0** | `start_date ≥ now`, not deleted |
| With cover image | **228** | Non-null `image_url` |
| Featured (active now) | **0** | Current `featured_events` slot |

### Events by source

| Source | Count |
|--------|------:|
| Instagram (scrape) | **229** |
| Manual / other | **0** |

All listed events currently originate from the Instagram ingestion pipeline.

---

## Engagement & social

| Metric | Count | Notes |
|--------|------:|-------|
| RSVPs (all statuses) | **9** | `rsvps` table |
| RSVPs — going | **6** | `status = going` |
| Saved events | **8** | `saved_events` bookmarks |
| User-to-user follows | **23** | `user_follows` |
| Interaction events (total) | **2** | Views / clicks / saves in `user_interactions` |
| Interactions (7d) | **0** | Last 7 days |
| Event reviews | **0** | `reviews` table |
| In-app notifications | **19** | `notifications` rows |

Recommendation and analytics signals are still sparse relative to catalog size (229 events, 2 tracked interactions). RSVP and save counts indicate early real usage but low volume.

---

## Health indicators

| Signal | Status |
|--------|--------|
| Moderation backlog | Clear (0 pending events/clubs) |
| Catalog coverage | Strong (222 clubs, 229 events, 99.6% with images) |
| Organic organizers | Early (1 organizer, 0 club members) |
| Student engagement | Early (9 RSVPs, 8 saves, 2 club follows) |
| Upcoming events | **Needs attention** — 0 future approved events |

The zero upcoming-events figure likely reflects scrape data with past `start_date` values rather than lack of real campus activity. Re-running the Instagram pipeline or organizer-created events should refresh this.

---

## Metric definitions

| Term | Definition |
|------|------------|
| **Active user** | User row with `updated_at` within the window (proxy for return visits / profile activity) |
| **Engaged user** | `saved_events_count ≥ 3` (matches admin dashboard) |
| **Onboarding completed** | `onboarding_completed = true` after interest-tag setup |
| **Upcoming event** | `status = approved`, `start_date ≥ now`, `deleted_at` null |
| **Club organizer** | User with `club_organizer` in `roles` array |

---

## Data source

Counts use the Supabase **service role** client (same as admin/cron routes) and query live production data. Script: [`scripts/platform-analytics.ts`](../scripts/platform-analytics.ts).

```bash
# JSON export
npx tsx scripts/platform-analytics.ts --json

# Update this document: re-run the script and refresh the tables above
```

---

*Last updated: 2026-05-19*
