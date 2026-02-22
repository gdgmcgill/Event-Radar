# Recommendation Engine: Analysis, Decision, and Implementation

## 1. Analysis of Existing Systems

### 1A. Active System -- TypeScript K-Means (in-process)

**Files:** `src/lib/kmeans.ts`, `src/app/api/recommendations/route.ts`

**How it works:**
1. Builds a 6-dimensional tag vector per user from `interest_tags` + saved event tags
2. Runs k-means clustering (k = min(3, numUsers), 50 max iterations, Euclidean distance)
3. Recommends events saved by users in the same cluster that the current user hasn't saved
4. Falls back to Supabase `overlaps()` on `interest_tags` if clustering yields nothing

**Strengths:**
- Zero deployment overhead: runs in the Next.js API route, no external service
- Deterministic: seeded from first-k points, reproducible
- Fast at small scale (<5000 users): O(k * n * d * iterations) per request
- Collaborative signal: leverages what similar users actually saved

**Weaknesses:**
- **No content-based scoring**: events are only candidates if a cluster-mate saved them; new events with no saves are invisible
- **Hard gate**: requires 3+ saved events to even see recommendations (cold-start problem)
- **Pure count ranking**: events ranked by raw save count, not by relevance to the specific user
- **Euclidean distance on sparse 6-dim vectors**: cosine similarity would be more appropriate for high-variance magnitude vectors
- **No popularity signal**: ignores the `event_popularity_scores` table
- **Fetches all users/events/saves every request**: no caching (acceptable at current scale)

### 1B. Inactive System -- Python Two-Tower Neural Recommender

**Files:** `AI/` directory (FastAPI app, sentence-transformers, FAISS)

**How it works:**
1. Event Tower: encodes event text (title + description + tags) through all-MiniLM-L6-v2 (384-dim) then a ProjectionMLP (384 -> 256 -> 128)
2. User Tower: encodes user metadata (major, year, interests, attended events) similarly
3. Scores via dot-product in the 128-dim projection space
4. FAISS IndexFlatIP for approximate nearest neighbor retrieval

**Strengths:**
- Semantic understanding: can find "ML Workshop" similar to "AI Hackathon" without explicit tag overlap
- Rich user representation: uses major, year, clubs, attended event descriptions
- FAISS enables sub-millisecond retrieval at scale

**Weaknesses:**
- **Tower weights are untrained**: Xavier-initialized random projections, never trained on actual data
- **Separate Python service**: requires hosting (extra infra cost, latency, deployment complexity)
- **No training pipeline**: no labeled data, no contrastive loss implementation, no training loop
- **Mismatch with Supabase schema**: expects `major`, `year_of_study`, `clubs_or_interests` -- our `users` table only has `interest_tags`
- **Cold-start still unsolved**: needs `attended_events` text, but we only have event IDs in `saved_events`
- **Overkill at current scale**: <100 events/semester, <5000 users -- a 128-dim embedding space and FAISS are not needed

### 1C. Legacy System -- Flask Cosine Similarity

**Files:** `backend/app.py`, `backend/similarity.py`

**How it works:**
- Same 6-dim tag vector as the active system
- Computes cosine similarity between user vector and each event vector
- Returns similarity scores

**Strengths:**
- Cosine similarity is a better distance metric for tag vectors than Euclidean
- Simple and correct

**Weaknesses:**
- **Abandoned**: not connected to the Next.js app
- **Separate Python service**: same deployment burden as the two-tower system
- **No collaborative signal**: purely content-based
- **Superseded**: the k-means system does everything this does, plus collaborative filtering

## 2. Decision: Improved TypeScript Hybrid Engine

**Chosen path:** Enhance the existing TypeScript k-means system into a hybrid recommendation engine that combines collaborative filtering, content-based scoring, and popularity signals -- all running in-process in the Next.js API route.

**Rationale:**
- **Right-sized for the problem**: <5000 users and <100 events/semester. A 6-dim vector space with cosine similarity + k-means clustering is sufficient and appropriate.
- **Zero deployment overhead**: no Python service to host, monitor, or keep in sync.
- **Addresses all weaknesses**: cold-start (interest_tags alone), content scoring (cosine similarity), popularity tiebreaking, and proper distance metric.
- **Incremental**: builds on working code rather than starting over.
- **The two-tower system is a future investment**: if the app grows to 50K+ users with 1000+ events, the semantic embedding approach becomes valuable. But training it requires interaction data we don't yet have enough of.

**What we keep:**
- K-means clustering for collaborative filtering (unchanged `src/lib/kmeans.ts`)
- 6-dim tag vector representation
- TagMapping normalization

**What we change:**
- Hybrid scoring formula combining three signals
- Cold-start support (no minimum-saves gate)
- Cosine similarity for content matching
- Popularity scores as tiebreaker

## 3. Implementation Details

### 3A. Modified Files

#### `src/app/api/recommendations/route.ts` -- Complete rewrite of scoring logic

**New scoring formula:**
```
totalScore = 0.45 * contentScore + 0.40 * collaborativeScore + 0.15 * popularityScore
```

Where:
- `contentScore` = cosine similarity between user's 6-dim tag vector and the event's tag vector (0 to 1)
- `collaborativeScore` = (number of cluster-mates who saved this event) / (max saves by any cluster-mate on any candidate), normalized to 0-1
- `popularityScore` = event's `popularity_score` from `event_popularity_scores` / max across all events, normalized to 0-1

**Weight rationale:**
- Content gets highest weight (0.45) because it works for all users, including cold-start
- Collaborative is strong when available (0.40) but is 0 for users with no cluster-mates' saves
- Popularity is a weak signal (0.15) to break ties and surface trending events

**Key changes:**
1. Parallel Supabase fetches (users, saved_events, events, popularity_scores) via `Promise.all`
2. Saved-event tags weighted 2x in user vectors (behavioral signal > stated preference)
3. All upcoming events the user hasn't saved are candidates (not just cluster-mates' saves)
4. Each candidate scored by the hybrid formula
5. Fallback to interest_tags `overlaps()` if hybrid produces zero results

#### `src/app/page.tsx` -- Lowered recommendation gate

**Before:**
```ts
const hasEnoughSavedEvents = savedEventIds.size >= 3;
// Only shows RecommendedEventsSection if hasEnoughSavedEvents
```

**After:**
```ts
const hasInterestTags = (user?.interest_tags?.length ?? 0) > 0;
const canShowRecommendations = hasInterestTags || savedEventIds.size >= 1;
// Shows RecommendedEventsSection if user has interest_tags OR 1+ saved events
```

This means:
- **New user who completed onboarding** (3-5 interest_tags, 0 saves): sees recommendations
- **User who skipped onboarding but saved 1 event**: sees recommendations
- **User with no interest_tags AND no saves**: sees Popular Events (graceful fallback)

### 3B. Unchanged Files

- `src/lib/kmeans.ts` -- k-means algorithm is solid and unchanged
- `src/lib/tagMapping.ts` -- tag normalization unchanged
- `src/components/events/RecommendedEventsSection.tsx` -- UI component unchanged, still calls `GET /api/recommendations`

### 3C. Files NOT modified (deferred)

- `AI/` directory -- two-tower system left intact for future use
- `backend/` directory -- legacy Flask system left intact
- `src/app/api/recommendations/sync/route.ts` -- sync route left as-is (TODO remains)

## 4. Cold-Start Solution

The previous system had a hard gate: users needed 3+ saved events before seeing any recommendations. This created a chicken-and-egg problem where new users couldn't discover relevant events through recommendations.

**New approach -- three tiers:**

| User state | What happens |
|---|---|
| Has interest_tags, 0 saves | Content-based scoring using interest_tags vector. Collaborative score is 0. Works immediately after onboarding. |
| Has interest_tags, 1-2 saves | Hybrid: content-based + weak collaborative signal from cluster placement. Saved-event tags enrich the user vector (weighted 2x). |
| Has interest_tags, 3+ saves | Full hybrid: strong collaborative signal from cluster-mates + content-based + popularity. |
| No interest_tags, 0 saves | Falls through to Popular Events (unchanged behavior). |
| No interest_tags, 1+ saves | Builds user vector entirely from saved-event tags. Content-based + collaborative scoring. |

The onboarding flow asks users to pick 3-5 interest tags, so the most common cold-start path is "has interest_tags, 0 saves" -- which now works.

## 5. Performance Considerations

**Current request cost (unchanged in magnitude):**
- 5 Supabase queries (now parallelized with `Promise.all`, was 5 sequential)
- K-means: O(k * n * d * iterations) = O(3 * 5000 * 6 * 50) ~ 4.5M operations = ~10ms
- Cosine similarity scoring: O(numCandidates * d) = O(100 * 6) = trivial
- Total expected latency: 100-300ms (dominated by Supabase round-trips)

**Scaling concerns at >5000 users:**
- Fetching all users + all saved_events is the bottleneck
- Mitigation: add server-side caching (Redis or in-memory with TTL) for user vectors
- At >10K users: pre-compute clusters on a schedule rather than per-request

**When to revisit the two-tower approach:**
- When event count exceeds 500+ (semantic similarity becomes valuable for long-tail discovery)
- When you have enough interaction data (>10K saves) to train the projection towers
- When you want cross-modal recommendations (e.g., "students who attend workshops also like...")

## 6. Open Questions

1. **Should saved-event tag weight be tunable?** Currently hardcoded at 2x. Could be a config value or A/B tested.

2. **Scoring weight optimization**: The 0.45/0.40/0.15 split is an informed heuristic. With enough data, these could be learned via a simple logistic regression on click-through data.

3. **Time decay**: Should older saves count less? A user who saved sports events 6 months ago but recently only saves academic events -- should sports be downweighted? Currently no decay is applied.

4. **RSVP signal**: The `rsvps` table (going/interested/cancelled) is a stronger signal than saves. Should "going" events count 3x in the user vector? Not implemented yet.

5. **Two-tower future**: If the team wants to pursue the Python service, the priority should be:
   - Implement a contrastive training loop using `saved_events` as positive pairs
   - Align the `UserPayload` schema with what we actually have in the DB (just `interest_tags`, not major/year)
   - Set up a deployment pipeline (Docker + health checks)

6. **Diversity**: The current system may over-recommend from the user's strongest tag dimension. A diversity constraint (e.g., max 5 events per tag category in top 20) could improve discovery.
