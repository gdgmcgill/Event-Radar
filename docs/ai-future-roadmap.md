# AI Future Roadmap

This document describes the planned evolution of the Uni-Verse recommendation system across growth phases, along with near-term feature enablement tasks.

The architecture was designed so that the **API surface and frontend never change** between phases. All scoring phases write to the same `user_event_scores` table. The `GET /api/recommendations` endpoint reads from that table regardless of how scores were computed.

---

## Phase 1: Current (Postgres-Native) — Now

**Target scale**: Up to ~10,000 users

**What exists today:**
- Batch scoring every 6 hours via `pg_cron` calling `compute_user_scores()`
- 5-signal weighted formula: tag affinity, interaction affinity, popularity, recency, social signal (reserved)
- Session boost layer for within-session reactivity (+0.05 per matching tag, capped at +0.15)
- Implicit interest evolution (`inferred_tags` auto-populated after threshold behavior)
- MMR diversity re-ranking with Jaccard tag similarity
- A/B testing framework for algorithm parameter experiments
- Zero external dependencies — fully self-contained in Supabase

**Limitations at this phase:**
- Scoring does not use event description text (only tags)
- No collaborative filtering (no user-user similarity)
- Batch latency means new events take up to 6 hours to appear in personalized feeds

---

## Phase 2: Edge Function ML-Lite — At ~10,000 Users

**Trigger**: When the 6-hour batch cadence is noticeably stale and user feedback indicates the feed feels outdated, or when description-based matching becomes a clear win in A/B tests.

**What changes:**
- The `compute_user_scores()` Postgres function is migrated to a **Supabase Edge Function** (Deno/TypeScript)
- The Edge Function runs on the same schedule (or more frequently) and still writes results to `user_event_scores`
- Scoring logic gains access to Deno-compatible ML utilities

**New capabilities unlocked:**
- **TF-IDF on event descriptions** — surface relevance beyond tags, matching keywords in event titles and descriptions against user interaction history
- **Cosine similarity between user profile vectors** — lightweight text-based user similarity without requiring a separate embedding model

**What stays the same:**
- `user_event_scores` table interface — unchanged
- `GET /api/recommendations` API route — unchanged
- All frontend code — unchanged
- A/B testing, MMR re-ranking, session boost — all unchanged

This phase extends the system's capability without introducing any new hosting costs. Edge Functions are included in the Supabase plan.

---

## Phase 3: Full ML Pipeline — At ~50,000+ Users

**Trigger**: Sufficient revenue or funding to justify dedicated infrastructure, and clear evidence that algorithmic quality is a growth lever.

**What changes:**
- A dedicated recommendation microservice is introduced (language/framework TBD based on team at that time)
- The service still writes final scores to `user_event_scores` — the interface contract is unchanged
- Real-time score updates replace the batch cadence

**New capabilities unlocked:**
- **Collaborative filtering** — user-user similarity, surfacing events popular with users who behave like you
- **Content-based embeddings** — full sentence-transformer or similar model for deep semantic matching
- **Real-time model updates** — scores refresh within minutes of new interactions rather than hours
- **Contextual signals** — time of day, day of week, approximate location on campus, weather (for outdoor events)
- **Sequential modeling** — session-aware models that understand the order of interactions, not just the aggregate

**What stays the same:**
- `user_event_scores` table — unchanged
- `GET /api/recommendations` API route — unchanged
- All frontend code — unchanged
- The clean interface contract means the API and frontend **never need to change** regardless of how sophisticated the backend scoring becomes

---

## Near-Term: Enable Social Signal

The social signal is already budgeted in the scoring formula at weight 0.05, but is currently disabled because the `event_rsvps` table does not exist.

**Steps to enable:**
1. Create the `event_rsvps` table with columns: `user_id`, `event_id`, `status` (going / interested / cancelled), `created_at`
2. Add appropriate RLS policies
3. Uncomment the social signal query in `compute_user_scores()` that counts friends (from `user_follows`) who have RSVP'd going or interested
4. Deploy the migration

No changes to the API route, scoring formula weights, or frontend are required. The signal slot is already reserved.

---

## Near-Term: Enable Push Notifications

**Goal**: Proactively surface new events that match a user's interests rather than waiting for them to open the app.

**How it would work:**
- When a new event is approved and enters the `approved` state, a trigger (Edge Function or Postgres trigger) checks which users have matching `interest_tags` or `inferred_tags`
- A notification is written to the `notifications` table for each matched user
- The notification message is templated: e.g. "New hackathon posted — you might like this"
- Existing notification infrastructure (`/notifications` page and in-app bell) handles display with no new frontend work

**Benefit**: Converts the recommendation system from reactive (user opens app) to proactive (system reaches out).

---

## Near-Term: Continuous Learning (More Frequent Batch)

**Current cadence**: Full recompute every 6 hours.

**Improvement**: Move to incremental score updates instead of full recomputes.

- On each interaction event (save, click), update only the affected user's scores for events sharing that tag — rather than recomputing all (user, event) pairs for that user
- This reduces compute load and brings score freshness closer to real-time
- The session boost layer already provides immediate within-session reactivity; this improvement extends reactivity beyond the session boundary

**Longer term**: Explore running the batch job hourly for active users (those with interactions in the last 24 hours) and keeping the 6-hour cadence for inactive users.
