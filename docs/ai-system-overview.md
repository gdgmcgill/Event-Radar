# AI System Overview

This document is the main reference for the current recommendation system powering the Uni-Verse personalized event feed.

---

## Architecture

The recommendation engine is **Postgres-native** — there are no external ML services, no Python processes, and no third-party APIs involved in scoring. Everything lives inside Supabase.

The system has three layers:

1. **Batch scoring** — A `pg_cron` job runs every 6 hours, executing the `compute_user_scores()` Postgres function. It scores every (user, event) pair and writes results to the `user_event_scores` table.

2. **Real-time session boost** — At request time, the API route reads the user's last 10 interactions within the past 2 hours and applies a lightweight tag-matching boost on top of the precomputed batch scores. This makes the feed reactive within a session without requiring a full recompute.

3. **Implicit interest evolution** — A separate batch job inspects interaction history. If a user has saved or clicked 3 or more events sharing a tag that is not yet in their `interest_tags`, the system auto-adds it to their `inferred_tags`. This lets the model adapt to interests the user never manually declared.

All three layers are self-contained in Supabase (Postgres + Edge Functions). No external hosting is required.

---

## Scoring Formula

```
score = (tag_affinity * 0.35)
      + (interaction_affinity * 0.25)
      + (popularity * 0.20)
      + (recency * 0.15)
      + (social_signal * 0.05)
```

### Signal Breakdown

**Tag affinity (weight: 0.35)**
Measures overlap between an event's tags and the user's declared `interest_tags` plus their `inferred_tags`. A full match scores 1.0 per tag. A partial match is possible via the `TAG_HIERARCHY` map: if the user has a broad category (e.g. `tech`) and the event has a granular sub-tag (e.g. `hackathon`), the system awards 0.5x affinity rather than 0. This prevents over-penalizing events that are clearly relevant but labeled more specifically than the user's declared interest.

**Interaction affinity (weight: 0.25)**
Reflects the user's weighted past behavior with events that share tags. Interaction weights are: save = 5, click = 3, view = 1. Scores are drawn from the precomputed `tag_interaction_counts` table, which is updated incrementally as interactions are tracked. This signal rewards tags the user has actively engaged with, not just declared.

**Popularity (weight: 0.20)**
A normalized score from the `event_popularity_scores` table. Popularity is computed from aggregate interaction counts across all users. This provides a quality floor — well-attended events surface even for users with sparse interaction histories (e.g. new users, or when personalized signals are weak).

**Recency (weight: 0.15)**
Applies exponential decay based on how far in the future the event is:

```
recency = EXP(-0.12 * days_until_event)
```

Events happening soon score higher. Events far in the future decay gradually but remain surfaceable.

**Social signal (weight: 0.05)**
Currently **disabled**. The `event_rsvps` table has not been created yet. Once enabled, this signal will count how many friends (from the `user_follows` table) have RSVP'd going or interested to an event. The weight is reserved at 0.05 in the formula.

---

## Tag Universe & Hierarchy

The system uses a two-tier tag model:

- **12 broad EventTag categories** — defined in the `EventTag` enum in `src/types/index.ts`. These are the primary interest tags users select on their profile (e.g. `tech`, `social`, `academic`, `sports`, `food`).

- **8 granular quick-filter tags** — more specific labels used on events for fine-grained filtering in the UI.

The `TAG_HIERARCHY` map (in `src/lib/recommendations.ts`) bridges these tiers for scoring:

| Granular tag | Maps to broad category |
|---|---|
| `hackathon` | `tech` |
| `competition` | `career` |
| `guest_speaker` | `academic` |
| `free_food` | `food` |
| `workshop` | `tech` |
| `party` | `social` |
| `fitness` | `sports` |
| `info_session` | `career` |

When an event has a granular tag and the user's interests contain the parent broad category (or vice versa), the system awards 0.5x affinity instead of 0.

---

## Implicit Interest Evolution

The system learns interests the user never explicitly declared by watching their behavior.

**How it works:**
1. A batch job inspects each user's interaction history.
2. If a user has saved or clicked 3 or more events tagged with a tag that is not currently in their `interest_tags`, that tag is a candidate for addition.
3. The candidate is validated against the `VALID_INTEREST_TAGS` allowlist to prevent garbage data from entering profiles.
4. If valid, the tag is appended to the user's `inferred_tags` column in the `users` table.

**User experience:**
- The frontend shows a toast notification when a new tag is inferred, with an **Undo** button.
- The profile page includes a **"Learned from your activity"** section listing all inferred tags, each with a remove button.
- Removing an inferred tag calls `DELETE /api/profile/inferred-tags`.

This design gives users full visibility and control over what the system has learned about them.

---

## Session Boost

At request time, before returning recommendations, the API applies a lightweight boost layer on top of batch scores:

1. Fetch the user's last **10 interactions** from within the past **2 hours**.
2. For each event in the candidate set, count how many of those recent interactions involved a matching tag.
3. Add **+0.05** to the event's score per matching tag.
4. Cap the total boost at **+0.15**.
5. Clamp the final score to a maximum of **1.0**.

This ensures the feed reacts quickly to within-session activity (e.g. a user who just clicked three hackathon events will see more hackathon events immediately) without requiring a full batch recompute.

---

## MMR Diversity Re-ranking

After scoring, the candidate list is re-ranked using **Maximal Marginal Relevance (MMR)** to balance relevance with diversity.

MMR works by iteratively selecting the next event that maximizes:

```
MMR = lambda * relevance_score - (1 - lambda) * max_similarity_to_already_selected
```

Similarity between events is computed using **Jaccard similarity** on their tag sets.

- **Default lambda**: `0.7` (70% relevance, 30% diversity)
- Lambda can be overridden per request via A/B experiment variant configuration

MMR is implemented in `src/lib/diversity.ts`.

---

## A/B Testing

The system includes a built-in A/B testing framework to experiment with recommendation algorithm parameters.

**Variant assignment:**
- Users are assigned to variants deterministically using an **FNV-1a hash** of their user ID and the experiment name.
- This ensures consistent assignment across sessions without storing state.

**Statistical analysis:**
- The framework computes **chi-squared tests** to determine if observed differences between variants are statistically significant.

**Current experiments:**
- MMR lambda values — testing whether higher or lower diversity settings improve engagement metrics.

Key files: `src/lib/experiments.ts`, `src/app/api/admin/experiments/`.

---

## Key Files

| File | Description |
|---|---|
| `src/lib/recommendations.ts` | Scoring helpers: tag expansion, affinity computation, session boost, explanation generation |
| `src/lib/diversity.ts` | MMR re-ranking with Jaccard tag similarity |
| `src/lib/experiments.ts` | A/B test variant assignment (FNV-1a) and chi-squared analysis |
| `src/lib/classifier.ts` | Instagram post event classification (separate pipeline, not part of feed scoring) |
| `src/lib/tagMapping.ts` | Tag normalization utilities for the Instagram classifier |
| `src/app/api/recommendations/route.ts` | Main GET endpoint — serves personalized feed |
| `src/app/api/recommendations/batch/route.ts` | Admin endpoint to manually trigger batch scoring |
| `src/app/api/recommendations/feedback/route.ts` | Explicit feedback submission (thumbs up/down) |
| `src/app/api/recommendations/analytics/route.ts` | Admin quality metrics (precision, coverage, diversity) |
| `src/app/api/interactions/route.ts` | Interaction tracking (view, click, save, share) |
| `src/app/api/profile/inferred-tags/route.ts` | Remove an inferred tag from user profile |
| `supabase/migrations/20260313000002_recommendation_engine.sql` | Core schema definitions + `compute_user_scores()` Postgres function |

---

## Database Tables

| Table | Purpose |
|---|---|
| `user_event_scores` | Precomputed scores per (user, event) pair. Columns: `user_id`, `event_id`, `score`, `breakdown` (JSON signal weights), `scored_at` |
| `tag_interaction_counts` | Per-user, per-tag interaction aggregates. Columns: `user_id`, `tag`, `save_count`, `click_count`, `view_count`. Updated incrementally on each interaction. |
| `event_popularity_scores` | Aggregate popularity score per event, normalized across all users |
| `user_interactions` | Raw interaction log: every view, click, save, and share with timestamps |
| `recommendation_feedback` | Impression/click/save/dismiss events tied to A/B experiment variants |
| `recommendation_explicit_feedback` | Thumbs up / thumbs down ratings submitted by users |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/recommendations?limit=N` | Returns personalized event feed for the authenticated user |
| `POST` | `/api/recommendations/batch` | Admin: manually trigger a full batch scoring run |
| `POST` | `/api/recommendations/feedback` | Submit explicit thumbs up/down feedback for an event |
| `GET` | `/api/recommendations/analytics` | Admin: retrieve quality metrics (precision, diversity, coverage) |
| `POST` | `/api/interactions` | Track a user interaction (view, click, save, share) |
| `DELETE` | `/api/profile/inferred-tags` | Remove a specific inferred tag from the user's profile |
