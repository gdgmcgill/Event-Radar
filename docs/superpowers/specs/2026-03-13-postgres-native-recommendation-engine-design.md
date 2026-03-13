# Postgres-Native Recommendation Engine

**Date:** 2026-03-13
**Status:** Approved
**Replaces:** Python Two-Tower recommendation service (prototype)

## Problem

Users pick interest tags during onboarding and forget about them. The homepage feed doesn't visibly adapt to behavior. The existing Python recommendation service is a prototype that costs extra to host. Users want a feed that learns — the algo is the product.

## Constraints

- **Self-contained in Supabase** — no external services, already paying for Supabase premium
- **No external investors** — cost matters, willing to trade some algo sophistication for savings
- **Scale unknown** — design for growth but don't over-engineer
- **Future migration path** — clean interface so scoring can move to a Supabase Edge Function at 10k users (Approach B)

## Decision

Build a Postgres-native scoring engine with three layers: batch scoring, real-time session boost, and implicit interest evolution. Kill the Python Two-Tower service.

---

## Tag Universe & Hierarchy

The system has two tiers of tags:
- **Broad categories** (12): the `EventTag` enum values — academic, social, sports, career, cultural, wellness, music, tech, food, volunteer, arts, networking
- **Granular quick-filter tags** (8): hackathon, competition, guest_speaker, free_food, workshop, party, fitness, info_session

Events store broad `EventTag` values in their `tags` column. Users can select both tiers as interests.

### Tag hierarchy mapping

To prevent zero-affinity matches when a user selects a granular tag but events only carry broad tags, the scoring function uses a **parent mapping**:

| Granular tag | Parent (EventTag) |
|---|---|
| hackathon | tech |
| competition | career |
| guest_speaker | academic |
| free_food | food |
| workshop | tech |
| party | social |
| fitness | sports |
| info_session | career |

**How it works in scoring:**
- A user with `interest_tags: ["hackathon"]` gets **full affinity** for events tagged `hackathon` (if it appears in `events.tags`) and **partial affinity (0.5x)** for events tagged `tech` (the parent).
- A user with `interest_tags: ["tech"]` gets full affinity for `tech`-tagged events and also partial affinity for events tagged with any child (`hackathon`, `workshop`).
- This mapping is defined as a constant in code (`TAG_HIERARCHY`) and passed to the Postgres function, so it can be updated without a migration.

### Validation
- `inferred_tags` are validated against `VALID_INTEREST_TAGS` (the combined list of both tiers) in the batch function. Any tag from `events.tags` that is not in the allowlist is skipped during inference.
- The existing `tagMapping.ts` (which maps raw strings to EventTag) is kept for the Instagram classifier but is NOT used by the recommendation engine. The recommendation engine uses the `TAG_HIERARCHY` mapping instead.

---

## Scoring Formula

```
score = (tag_affinity * 0.35) + (interaction_affinity * 0.25) + (popularity * 0.20) + (recency * 0.15) + (social_signal * 0.05)
```

### Signals

| Signal | Weight | Computation |
|--------|--------|-------------|
| Tag affinity | 0.35 | Overlap between event's `tags` and user's `interest_tags` + `inferred_tags`. More overlapping tags = higher score. |
| Interaction affinity | 0.25 | User's past interactions with events sharing tags with this event. Weighted: save=5, click=3, view=1. Sourced from precomputed `tag_interaction_counts`. |
| Popularity | 0.20 | From existing `event_popularity_scores` table, normalized 0-1. Quality tiebreaker. |
| Recency | 0.15 | Events happening sooner score higher. Exponential decay — tomorrow >> 2 weeks out. |
| Social signal | 0.05 | Friends going/interested (from `event_rsvps` joined with `user_follows`). |

### Cold start handling
- **New users with interest tags**: tag_affinity (0.35) + popularity (0.20) + recency (0.15) = 70% of score works without interaction history.
- **Authenticated users with no tags AND no interactions**: Batch job still computes scores using popularity + recency only (same formula, tag/interaction/social signals are 0). Rows are written to `user_event_scores` so the API path is uniform.
- **Anonymous users**: No batch scores. API route falls back to a direct query: approved upcoming events ordered by `event_popularity_scores.popularity_score DESC, event_date ASC`, returned with `source: "anonymous"`.
- The existing `RECOMMENDATION_THRESHOLD` constant is removed. The new system handles cold start gracefully via the formula itself — no gating needed.

### Weight tuning
- Weights are a starting point. The existing A/B testing framework can experiment with different weight combos via the `config` field on experiment variants.

---

## Three-Layer Architecture

### Layer 1: Batch Scoring (every 6 hours via pg_cron)

A Postgres function `compute_user_scores()` that:
- For each active user, scores all approved upcoming events using the formula above
- Writes results to `user_event_scores` table
- The `breakdown` column (JSONB) stores each signal's contribution for debugging and explanation generation
- Also refreshes `tag_interaction_counts` (rollup of `user_interactions` by tag per user)
- Also runs implicit interest evolution (Layer 3)
- Runs as a `pg_cron` job (Supabase supports this natively on paid plans)

### Layer 2: Real-Time Session Boost (per request)

On homepage load:
- Fetch precomputed scores from `user_event_scores` (fast, indexed)
- Apply session boost: query last 10 interactions from `user_interactions` where `created_at > NOW() - INTERVAL '2 hours'` for the user. Extract tags from those events. For each recommended event that shares a tag with the session interactions, add a boost.
- Boost calculation: `+0.05` per matching tag, capped at `+0.15` total per event. Score is clamped to 1.0 max.
- This is a simple re-rank on already-fetched results, not a full recomputation

### Layer 3: Implicit Interest Evolution (during batch)

During the batch job:
- If a user has saved/clicked 3+ events with a tag NOT in their `interest_tags` or `inferred_tags`, auto-add it to `inferred_tags`
- Tags stored as `inferred` so UI can distinguish from manual picks
- Show a toast on next login: "We added Hackathons to your interests based on your activity. [Undo]"
- Users can remove inferred tags from their profile via `DELETE /api/profile/inferred-tags` (see API Changes)

---

## Database Schema Changes

### New table: `user_event_scores`

```sql
CREATE TABLE user_event_scores (
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  event_id    uuid REFERENCES events(id) ON DELETE CASCADE,
  score       float NOT NULL,
  breakdown   jsonb NOT NULL DEFAULT '{}',
  scored_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_user_event_scores_user_score ON user_event_scores (user_id, score DESC);
```

### New table: `tag_interaction_counts`

```sql
CREATE TABLE tag_interaction_counts (
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  tag              text NOT NULL,
  save_count       int NOT NULL DEFAULT 0,
  click_count      int NOT NULL DEFAULT 0,
  view_count       int NOT NULL DEFAULT 0,
  last_interaction timestamptz,
  PRIMARY KEY (user_id, tag)
);
```

### Modify `users` table

```sql
ALTER TABLE users ADD COLUMN inferred_tags text[] NOT NULL DEFAULT '{}';
```

### TypeScript type changes
- Add `inferred_tags: string[]` to the `User` interface in `src/types/index.ts`
- Add `inferred_tags: string[]` to the Supabase `Database` type in `src/lib/supabase/types.ts`
- Add `TAG_HIERARCHY` constant to `src/lib/constants.ts`

### Unchanged tables
- `user_interactions` — already tracks everything needed
- `event_popularity_scores` — reused as-is for popularity signal
- `saved_events`, `event_rsvps` — read during batch scoring
- `recommendation_explicit_feedback` — read during batch instead of sent to Python

---

## API Changes

### `/api/recommendations` (rewrite)

- Drops Python service call
- Queries `user_event_scores` for the user, applies session boost, returns results
- Same response shape as today — frontend components barely change
- Keeps `source` field: `"personalized"` | `"popular_fallback"` | `"anonymous"`
- Generates `explanation` from `breakdown` JSONB:
  - `breakdown.tag` highest → "Because you're interested in {matching tags}"
  - `breakdown.interaction` highest → "Based on events you've engaged with"
  - `breakdown.social` highest → "Friends are going to this"

### `/api/recommendations` fallback behavior
- If `user_event_scores` has no rows for the requesting user (before first batch run or new user created between cycles), fall back to: approved upcoming events ordered by `event_popularity_scores.popularity_score DESC, event_date ASC`, returned with `source: "popular_fallback"`.
- This is the same fallback used for anonymous users, ensuring the feed is never empty.

### `/api/recommendations` response shape

```typescript
{
  recommendations: Array<{
    event_id: string;
    score: number;
    explanation: string;         // "Because you're interested in hackathons"
    breakdown: Record<string, number>;  // { tag: 0.28, interaction: 0.20, ... }
  }>;
  source: "personalized" | "popular_fallback" | "anonymous";
  diversity_metadata?: {         // Present when MMR is applied
    avg_pairwise_distance: number;
    lambda: number;
  };
  experiment_variant_id?: string; // Present when A/B test active
  total_events: number;
}
```

### `/api/recommendations/batch` (new, internal)

- POST endpoint for manual trigger of batch scoring
- Calls `compute_user_scores()` Postgres function
- Protected by service role key (not user-accessible)
- The scheduled run uses `pg_cron` calling the SQL function directly (not this endpoint). This endpoint exists for manual re-runs and debugging only.

### `/api/profile/inferred-tags` (new)

- `DELETE` with body `{ tag: "hackathon" }` — removes a single tag from the user's `inferred_tags` array
- Authenticated, operates on the calling user's profile
- Used by the "Undo" action on the inferred tags toast and the "remove" button on the profile page

### `/api/interactions` (unchanged)

- Already tracks views, clicks, saves, shares, calendar adds
- Session boost reads from `user_interactions` filtered by recent timestamp

---

## Frontend Changes

### Homepage feed (`page.tsx`)
- "Recommended For You" section wired to new `/api/recommendations`
- Add explanation text under each recommended event card (small, muted text)
- Remove dependency on Python service

### Inferred tags toast
- On homepage load, if `inferred_tags` changed since last visit, show dismissible toast: "We added **Hackathons** to your interests based on your activity. [Undo]"
- Undo removes the tag from `inferred_tags`

### Profile page
- Interest tags section shows two groups: "Your picks" (manual) and "Learned" (inferred, with remove button)

### NOT building (keep it lean)
- No "Follow Category" button — implicit learning replaces this
- No dynamic reordering of homepage category pills
- No push notifications
- No real-time WebSocket feed updates

---

## Migration & Cleanup

### Removed
- Python service dependency — delete `RECOMMENDATION_API_URL` env var and all fetch calls to `localhost:8000`
- Two-Tower model code (external repo) can be archived

### Kept untouched
- A/B testing framework — experiments with scoring weights instead of MMR lambda
- MMR diversity re-ranking (`src/lib/diversity.ts`) — still applied on top of new scores
- Interaction tracking — unchanged
- Instagram classifier — unrelated

### Migration to Approach B (Edge Function at 10k users)
- `compute_user_scores()` has a clean interface: writes to `user_event_scores`
- Move logic to a Supabase Edge Function for more sophisticated scoring (TF-IDF, embeddings, collaborative filtering)
- API route and frontend never change — they read from `user_event_scores` either way
- Edge Function replaces pg_cron as the trigger

---

## Rollout Strategy

1. Build the new scoring function and `user_event_scores` table
2. Run batch scoring alongside current system (shadow mode) to verify results
3. Flip `/api/recommendations` route to read from new scores
4. Remove Python service dependency
5. Ship inferred tags + explanation text as a follow-up
