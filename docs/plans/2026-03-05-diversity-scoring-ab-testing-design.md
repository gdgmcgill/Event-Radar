# Design: Recommendation Diversity Scoring & A/B Testing Framework

**Date:** 2026-03-05
**Tickets:** #141 (Diversity Scoring), #59 (A/B Testing Framework)
**Assignee:** emmag-22

---

## Ticket #141: Recommendation Diversity Scoring

### Problem

Recommendations can create filter bubbles by repeatedly surfacing events from the same tag categories. Users with narrow interaction history get increasingly homogeneous suggestions.

### Solution: MMR Re-ranking

Apply **Maximal Marginal Relevance (MMR)** as a post-processing step on ML service results. MMR iteratively selects items that balance relevance against diversity:

```
MMR(item) = lambda * relevance(item) - (1 - lambda) * max_similarity(item, already_selected)
```

### Architecture

New module: `src/lib/diversity.ts`

Called from `GET /api/recommendations` after receiving ML results, before returning response.

```
ML Service -> raw scored recommendations -> MMR re-ranker -> diversified list -> response
```

### Core Algorithm

```typescript
function rerankWithMMR(
  recommendations: RecommendationItem[],
  lambda: number = 0.7
): { items: RecommendationItem[], metadata: DiversityMetadata }
```

**Steps:**
1. Start with empty `selected` list
2. At each step, pick candidate maximizing: `lambda * normalizedScore - (1 - lambda) * maxSimilarity(candidate, selected)`
3. Similarity: Jaccard on event tags — `|tagsA intersection tagsB| / |tagsA union tagsB|`
4. Each item gets a `diversity_score` field (contribution to diversity)
5. Repeat until all candidates are re-ranked

### Similarity Function

```typescript
function jaccardSimilarity(tagsA: string[], tagsB: string[]): number
```

Returns 0 (no overlap) to 1 (identical tags). Used to compute pairwise distance between events.

### API Response Changes

`GET /api/recommendations` response gains:

```typescript
{
  recommendations: RecommendationItem[],  // MMR-reranked
  source: "personalized" | "popular_fallback",
  diversity_metadata: {
    lambda: number,
    avg_pairwise_distance: number,  // 1 - avg Jaccard similarity
    tag_distribution: Record<string, number>  // count per tag in results
  }
}
```

### Configuration

- `lambda` defaults to 0.7 (favors relevance)
- Optional query param `?diversity=0.7` for testing
- Can be overridden per A/B test variant

### Analytics

Extend `/api/recommendations/analytics` with diversity metrics: avg pairwise distance and tag distribution over time.

---

## Ticket #59: A/B Testing Framework

### Problem

No way to systematically compare recommendation algorithm variants. Need infrastructure for controlled experiments with statistical rigor.

### Solution: Database-Driven Experiments

Supabase tables for experiment config, variant definitions, and user assignments. Deterministic hashing for consistent assignment. Admin UI for management and results.

### Database Schema

**`experiments`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text (UNIQUE) | Human-readable slug |
| description | text | |
| status | text | `draft`, `running`, `paused`, `completed` |
| target_metric | text | `ctr`, `save_rate`, `dismiss_rate` |
| start_date | timestamptz | |
| end_date | timestamptz | nullable |
| created_by | uuid (FK -> users) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`experiment_variants`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| experiment_id | uuid (FK) | |
| name | text | e.g., `control`, `high_diversity` |
| config | jsonb | e.g., `{ "lambda": 0.3 }` |
| weight | integer | Traffic allocation weight |

**`experiment_assignments`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| experiment_id | uuid (FK) | |
| variant_id | uuid (FK) | |
| user_id | uuid (FK -> users) | |
| assigned_at | timestamptz | |
| UNIQUE | | `(experiment_id, user_id)` |

Additional change: `recommendation_feedback` table gains nullable `experiment_variant_id` column.

### User Assignment Logic

```typescript
// src/lib/experiments.ts

function assignVariant(userId: string, experiment: Experiment): Variant
// 1. Check existing assignment -> return if exists
// 2. Deterministic hash: fnv1a(userId + experimentId) mod totalWeight
// 3. Map hash to variant based on cumulative weights
// 4. Insert assignment row
// 5. Return variant

function getActiveExperiments(): Experiment[]
// Cached in-memory with 60s TTL

function getUserVariants(userId: string): Map<string, Variant>
```

### API Endpoints

**`/api/admin/experiments`**
- `GET` — List all experiments with variants and assignment counts
- `POST` — Create experiment with variants

**`/api/admin/experiments/[id]`**
- `GET` — Single experiment with metrics per variant
- `PATCH` — Update status, edit config
- `DELETE` — Only if status is `draft`

**`/api/admin/experiments/[id]/results`**
- `GET` — Per-variant metrics with statistical significance

### Integration with Recommendations

In `GET /api/recommendations`:
1. Get user's variant for active recommendation experiments
2. Extract config (e.g., `{ lambda: 0.3 }`)
3. Pass lambda to MMR re-ranker
4. Include experiment/variant info in feedback logging

### Admin Dashboard

New page: `/admin/experiments`

1. **Experiments List** — Table: name, status, date range, variant count, assignments
2. **Create Experiment Modal** — Name, description, target metric, variants (name + config + weight), dates
3. **Experiment Detail** (`/admin/experiments/[id]`) —
   - Status controls (start/pause/complete)
   - Variant breakdown: name, weight, assignments, CTR, save rate, dismiss rate
   - Statistical significance indicator
   - Bar chart comparing variants

### Statistical Significance

```typescript
function chiSquaredTest(variants: VariantMetrics[]): {
  statistic: number,
  pValue: number,
  significant: boolean  // p < 0.05
}
```

Chi-squared test on conversion counts. Dashboard shows: "Not enough data", "Not significant", or "Significant (p < 0.05)".

### Documentation

`docs/ab-testing.md` covering:
- How to create an experiment
- Available config parameters
- How to read results
- When to stop an experiment
- Architecture overview

---

## Dependencies

Ticket #141 (diversity) should be implemented first, as #59 (A/B testing) uses it as the first experiment target (testing different lambda values).
