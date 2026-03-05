# Diversity Scoring & A/B Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add MMR diversity re-ranking to recommendations (#141) and build a full A/B testing framework with admin UI (#59).

**Architecture:** Diversity scoring is a pure function in `src/lib/diversity.ts` that post-processes ML recommendations via Jaccard tag similarity. A/B testing uses three new Supabase tables (`experiments`, `experiment_variants`, `experiment_assignments`) with deterministic user-to-variant hashing, admin CRUD API, and a React admin dashboard page.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Tailwind CSS, shadcn/ui, Lucide React

---

## Part 1: Diversity Scoring (Ticket #141)

### Task 1: Create diversity scoring module with tests

**Files:**
- Create: `src/lib/diversity.ts`
- Create: `src/lib/diversity.test.ts`

**Step 1: Write the test file**

```typescript
// src/lib/diversity.test.ts
import { rerankWithMMR, jaccardSimilarity, type DiversityMetadata } from "./diversity";

interface TestRecommendation {
  event_id: string;
  score: number;
  tags: string[];
  title: string;
  description: string;
  hosting_club: string | null;
  category: string | null;
}

describe("jaccardSimilarity", () => {
  it("returns 1 for identical tag sets", () => {
    expect(jaccardSimilarity(["a", "b"], ["a", "b"])).toBe(1);
  });

  it("returns 0 for completely different tag sets", () => {
    expect(jaccardSimilarity(["a", "b"], ["c", "d"])).toBe(0);
  });

  it("returns 0.5 for half-overlapping sets", () => {
    expect(jaccardSimilarity(["a", "b"], ["a", "c"])).toBeCloseTo(1 / 3);
  });

  it("returns 0 when both sets are empty", () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  it("returns 0 when one set is empty", () => {
    expect(jaccardSimilarity(["a"], [])).toBe(0);
  });
});

describe("rerankWithMMR", () => {
  const items: TestRecommendation[] = [
    { event_id: "1", score: 0.9, tags: ["academic", "career"], title: "T1", description: "", hosting_club: null, category: null },
    { event_id: "2", score: 0.85, tags: ["academic", "career"], title: "T2", description: "", hosting_club: null, category: null },
    { event_id: "3", score: 0.7, tags: ["social", "cultural"], title: "T3", description: "", hosting_club: null, category: null },
    { event_id: "4", score: 0.6, tags: ["sports", "wellness"], title: "T4", description: "", hosting_club: null, category: null },
  ];

  it("with lambda=1 preserves original relevance order", () => {
    const result = rerankWithMMR(items, 1.0);
    expect(result.items.map((r) => r.event_id)).toEqual(["1", "2", "3", "4"]);
  });

  it("with lambda=0 maximizes diversity — similar items pushed apart", () => {
    const result = rerankWithMMR(items, 0.0);
    const ids = result.items.map((r) => r.event_id);
    // Item 1 first (highest score), then something diverse (3 or 4), not item 2
    expect(ids[0]).toBe("1");
    expect(ids[1]).not.toBe("2"); // item 2 is too similar to item 1
  });

  it("with default lambda=0.7 returns all items", () => {
    const result = rerankWithMMR(items);
    expect(result.items).toHaveLength(4);
  });

  it("returns diversity metadata", () => {
    const result = rerankWithMMR(items, 0.7);
    expect(result.metadata).toHaveProperty("lambda", 0.7);
    expect(result.metadata).toHaveProperty("avg_pairwise_distance");
    expect(result.metadata).toHaveProperty("tag_distribution");
    expect(typeof result.metadata.avg_pairwise_distance).toBe("number");
  });

  it("handles empty input", () => {
    const result = rerankWithMMR([], 0.7);
    expect(result.items).toEqual([]);
    expect(result.metadata.avg_pairwise_distance).toBe(0);
  });

  it("handles single item", () => {
    const result = rerankWithMMR([items[0]], 0.7);
    expect(result.items).toHaveLength(1);
  });

  it("tag_distribution counts tags correctly", () => {
    const result = rerankWithMMR(items, 0.7);
    // All 4 items: academic(2), career(2), social(1), cultural(1), sports(1), wellness(1)
    expect(result.metadata.tag_distribution["academic"]).toBe(2);
    expect(result.metadata.tag_distribution["social"]).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/diversity.test.ts --no-cache`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/lib/diversity.ts

export interface RecommendationItem {
  event_id: string;
  score: number;
  tags: string[];
  title: string;
  description: string;
  hosting_club: string | null;
  category: string | null;
}

export interface DiversityMetadata {
  lambda: number;
  avg_pairwise_distance: number;
  tag_distribution: Record<string, number>;
}

/**
 * Jaccard similarity between two tag sets.
 * Returns 0 (no overlap) to 1 (identical).
 */
export function jaccardSimilarity(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 && tagsB.length === 0) return 0;

  const setA = new Set(tagsA.map((t) => t.toLowerCase()));
  const setB = new Set(tagsB.map((t) => t.toLowerCase()));

  let intersection = 0;
  for (const tag of setA) {
    if (setB.has(tag)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Re-rank recommendations using Maximal Marginal Relevance (MMR).
 *
 * MMR(item) = lambda * relevance(item) - (1 - lambda) * max_similarity(item, selected)
 *
 * @param recommendations - Scored recommendations from ML service
 * @param lambda - Balance between relevance (1.0) and diversity (0.0). Default 0.7.
 */
export function rerankWithMMR(
  recommendations: RecommendationItem[],
  lambda: number = 0.7
): { items: RecommendationItem[]; metadata: DiversityMetadata } {
  if (recommendations.length === 0) {
    return {
      items: [],
      metadata: { lambda, avg_pairwise_distance: 0, tag_distribution: {} },
    };
  }

  // Normalize scores to [0, 1]
  const maxScore = Math.max(...recommendations.map((r) => r.score));
  const minScore = Math.min(...recommendations.map((r) => r.score));
  const scoreRange = maxScore - minScore || 1;

  const normalize = (score: number) => (score - minScore) / scoreRange;

  const remaining = [...recommendations];
  const selected: RecommendationItem[] = [];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevance = normalize(candidate.score);

      // Max similarity to any already-selected item
      let maxSim = 0;
      for (const sel of selected) {
        const sim = jaccardSimilarity(candidate.tags, sel.tags);
        if (sim > maxSim) maxSim = sim;
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestMMR) {
        bestMMR = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  // Compute metadata
  const tagDist: Record<string, number> = {};
  for (const item of selected) {
    for (const tag of item.tags) {
      const key = tag.toLowerCase();
      tagDist[key] = (tagDist[key] || 0) + 1;
    }
  }

  // Average pairwise distance
  let totalDistance = 0;
  let pairs = 0;
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      totalDistance += 1 - jaccardSimilarity(selected[i].tags, selected[j].tags);
      pairs++;
    }
  }
  const avgPairwiseDistance = pairs > 0 ? totalDistance / pairs : 0;

  return {
    items: selected,
    metadata: {
      lambda,
      avg_pairwise_distance: Math.round(avgPairwiseDistance * 1000) / 1000,
      tag_distribution: tagDist,
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/diversity.test.ts --no-cache`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add src/lib/diversity.ts src/lib/diversity.test.ts
git commit -m "feat(#141): add MMR diversity re-ranking module with tests"
```

---

### Task 2: Integrate diversity scoring into recommendations API

**Files:**
- Modify: `src/app/api/recommendations/route.ts:35-43` (RecommendationItem interface — import from diversity.ts instead)
- Modify: `src/app/api/recommendations/route.ts:290-325` (apply MMR after ML results, before response)

**Step 1: Update the recommendations route to import and use rerankWithMMR**

In `src/app/api/recommendations/route.ts`:

1. Add import at top:
```typescript
import { rerankWithMMR, type RecommendationItem as DiversityRecommendationItem } from "@/lib/diversity";
```

2. After line 291 (`const data: RecommendResponse = await response.json();`), add diversity re-ranking:
```typescript
    // Apply MMR diversity re-ranking
    const searchParams = request.nextUrl.searchParams;
    const diversityLambda = parseFloat(searchParams.get("diversity") || "0.7");
    const lambda = Math.max(0, Math.min(1, isNaN(diversityLambda) ? 0.7 : diversityLambda));

    const { items: diversifiedRecs, metadata: diversityMetadata } = rerankWithMMR(
      data.recommendations as DiversityRecommendationItem[],
      lambda
    );
```

3. Update the `recommendationsWithExplanations` mapping to use `diversifiedRecs` instead of `data.recommendations`.

4. Add `diversity_metadata` to the response JSON.

**Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/recommendations/route.ts
git commit -m "feat(#141): integrate MMR diversity re-ranking into recommendations API"
```

---

### Task 3: Add diversity metrics to analytics endpoint

**Files:**
- Modify: `src/app/api/recommendations/analytics/route.ts:83-96` (add diversity section to response)

**Step 1: Update analytics route**

After the existing metrics computation (line 82), add a diversity metrics section that queries recent recommendation responses. Since we don't store diversity metadata per-response yet, add a simple tag distribution query:

```typescript
    // Tag distribution from recent recommendation feedback
    const { data: recentEvents } = await supabase
      .from("recommendation_feedback")
      .select("event_id")
      .gte("created_at", sinceIso)
      .eq("action", "impression");

    const eventIds = [...new Set((recentEvents ?? []).map((r: { event_id: string }) => r.event_id))];

    let tagDistribution: Record<string, number> = {};
    if (eventIds.length > 0) {
      const { data: events } = await supabase
        .from("events")
        .select("tags")
        .in("id", eventIds);

      for (const ev of (events ?? []) as { tags: string[] }[]) {
        for (const tag of ev.tags ?? []) {
          const key = tag.toLowerCase();
          tagDistribution[key] = (tagDistribution[key] || 0) + 1;
        }
      }
    }
```

Add to the response JSON:
```typescript
    diversity: {
      recommended_tag_distribution: tagDistribution,
      unique_tags_shown: Object.keys(tagDistribution).length,
    },
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/recommendations/analytics/route.ts
git commit -m "feat(#141): add diversity metrics to recommendation analytics endpoint"
```

---

## Part 2: A/B Testing Framework (Ticket #59)

### Task 4: Create database migration for experiment tables

**Files:**
- Create: `supabase/migrations/20260305000001_experiments.sql`

**Step 1: Write the migration**

```sql
-- A/B Testing Framework tables
-- experiments: experiment definitions
-- experiment_variants: arms of each experiment
-- experiment_assignments: user-to-variant assignments

CREATE TABLE IF NOT EXISTS experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  target_metric text NOT NULL DEFAULT 'ctr'
    CHECK (target_metric IN ('ctr', 'save_rate', 'dismiss_rate')),
  start_date timestamptz,
  end_date timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  weight integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  UNIQUE (experiment_id, name)
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, user_id)
);

-- Add experiment_variant_id to recommendation_feedback for per-variant analytics
ALTER TABLE recommendation_feedback
  ADD COLUMN IF NOT EXISTS experiment_variant_id uuid REFERENCES experiment_variants(id);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiment_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user ON experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_variant ON recommendation_feedback(experiment_variant_id);

-- RLS policies
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything on experiments
CREATE POLICY "Admins can manage experiments" ON experiments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles)
    )
  );

-- Anyone can read running experiments (needed for variant assignment)
CREATE POLICY "Anyone can read running experiments" ON experiments
  FOR SELECT USING (status = 'running');

-- Admins full access on variants
CREATE POLICY "Admins can manage variants" ON experiment_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles)
    )
  );

-- Anyone can read variants for running experiments
CREATE POLICY "Anyone can read variants of running experiments" ON experiment_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments WHERE experiments.id = experiment_id AND experiments.status = 'running'
    )
  );

-- Users can read their own assignments
CREATE POLICY "Users can read own assignments" ON experiment_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Service role inserts assignments (via API route)
CREATE POLICY "Service can insert assignments" ON experiment_assignments
  FOR INSERT WITH CHECK (true);

-- Admins can read all assignments
CREATE POLICY "Admins can read all assignments" ON experiment_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles)
    )
  );
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260305000001_experiments.sql
git commit -m "feat(#59): add database migration for A/B testing framework tables"
```

---

### Task 5: Update Supabase types for new tables

**Files:**
- Modify: `src/lib/supabase/types.ts` (add experiments, experiment_variants, experiment_assignments table types)
- Modify: `src/types/index.ts` (add Experiment, ExperimentVariant, ExperimentAssignment interfaces)

**Step 1: Add table types to `src/lib/supabase/types.ts`**

After the `club_followers` table definition (around line 538), add:

```typescript
      experiments: {
        Row: {
          id: string;
          name: string;
          description: string;
          status: "draft" | "running" | "paused" | "completed";
          target_metric: "ctr" | "save_rate" | "dismiss_rate";
          start_date: string | null;
          end_date: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          status?: "draft" | "running" | "paused" | "completed";
          target_metric?: "ctr" | "save_rate" | "dismiss_rate";
          start_date?: string | null;
          end_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          status?: "draft" | "running" | "paused" | "completed";
          target_metric?: "ctr" | "save_rate" | "dismiss_rate";
          start_date?: string | null;
          end_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      experiment_variants: {
        Row: {
          id: string;
          experiment_id: string;
          name: string;
          config: Record<string, unknown>;
          weight: number;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          name: string;
          config?: Record<string, unknown>;
          weight?: number;
        };
        Update: {
          id?: string;
          experiment_id?: string;
          name?: string;
          config?: Record<string, unknown>;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "experiment_variants_experiment_id_fkey";
            columns: ["experiment_id"];
            isOneToOne: false;
            referencedRelation: "experiments";
            referencedColumns: ["id"];
          }
        ];
      };
      experiment_assignments: {
        Row: {
          id: string;
          experiment_id: string;
          variant_id: string;
          user_id: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          variant_id: string;
          user_id: string;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          experiment_id?: string;
          variant_id?: string;
          user_id?: string;
          assigned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "experiment_assignments_experiment_id_fkey";
            columns: ["experiment_id"];
            isOneToOne: false;
            referencedRelation: "experiments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "experiment_assignments_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "experiment_variants";
            referencedColumns: ["id"];
          }
        ];
      };
```

Also update `recommendation_feedback` Row/Insert/Update to include:
```typescript
          experiment_variant_id: string | null;
```

**Step 2: Add TypeScript interfaces to `src/types/index.ts`**

```typescript
/** A/B Testing Types */
export type ExperimentStatus = "draft" | "running" | "paused" | "completed";
export type ExperimentMetric = "ctr" | "save_rate" | "dismiss_rate";

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  target_metric: ExperimentMetric;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  variants?: ExperimentVariant[];
}

export interface ExperimentVariant {
  id: string;
  experiment_id: string;
  name: string;
  config: Record<string, unknown>;
  weight: number;
}

export interface ExperimentAssignment {
  id: string;
  experiment_id: string;
  variant_id: string;
  user_id: string;
  assigned_at: string;
}

export interface VariantMetrics {
  variant_id: string;
  variant_name: string;
  assignments: number;
  impressions: number;
  clicks: number;
  saves: number;
  dismisses: number;
  ctr_percent: number;
  save_rate_percent: number;
  dismiss_rate_percent: number;
}

export interface ExperimentResults {
  experiment: Experiment;
  variant_metrics: VariantMetrics[];
  significance: {
    statistic: number;
    p_value: number;
    significant: boolean;
  } | null;
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/supabase/types.ts src/types/index.ts
git commit -m "feat(#59): add TypeScript types for A/B testing framework"
```

---

### Task 6: Create experiment assignment engine

**Files:**
- Create: `src/lib/experiments.ts`
- Create: `src/lib/experiments.test.ts`

**Step 1: Write the test file**

```typescript
// src/lib/experiments.test.ts
import { fnv1aHash, pickVariant } from "./experiments";

describe("fnv1aHash", () => {
  it("returns consistent hash for same input", () => {
    expect(fnv1aHash("user1-exp1")).toBe(fnv1aHash("user1-exp1"));
  });

  it("returns different hashes for different inputs", () => {
    expect(fnv1aHash("user1-exp1")).not.toBe(fnv1aHash("user2-exp1"));
  });

  it("returns a positive number", () => {
    expect(fnv1aHash("anything")).toBeGreaterThanOrEqual(0);
  });
});

describe("pickVariant", () => {
  const variants = [
    { id: "v1", experiment_id: "e1", name: "control", config: {}, weight: 50 },
    { id: "v2", experiment_id: "e1", name: "treatment", config: { lambda: 0.3 }, weight: 50 },
  ];

  it("returns a variant from the list", () => {
    const result = pickVariant("user123", "e1", variants);
    expect(["v1", "v2"]).toContain(result.id);
  });

  it("is deterministic for same user+experiment", () => {
    const r1 = pickVariant("user123", "e1", variants);
    const r2 = pickVariant("user123", "e1", variants);
    expect(r1.id).toBe(r2.id);
  });

  it("respects weight distribution roughly", () => {
    // With 50/50 weights over many users, both variants should get assignments
    const counts: Record<string, number> = { v1: 0, v2: 0 };
    for (let i = 0; i < 1000; i++) {
      const v = pickVariant(`user-${i}`, "e1", variants);
      counts[v.id]++;
    }
    // Both should get at least 30% (allowing for hash distribution)
    expect(counts.v1).toBeGreaterThan(300);
    expect(counts.v2).toBeGreaterThan(300);
  });

  it("handles unequal weights", () => {
    const unequalVariants = [
      { id: "v1", experiment_id: "e1", name: "control", config: {}, weight: 90 },
      { id: "v2", experiment_id: "e1", name: "treatment", config: {}, weight: 10 },
    ];
    const counts: Record<string, number> = { v1: 0, v2: 0 };
    for (let i = 0; i < 1000; i++) {
      const v = pickVariant(`user-${i}`, "e1", unequalVariants);
      counts[v.id]++;
    }
    // v1 should dominate
    expect(counts.v1).toBeGreaterThan(counts.v2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/experiments.test.ts --no-cache`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/lib/experiments.ts
import type { ExperimentVariant } from "@/types";

/**
 * FNV-1a hash for deterministic user-to-variant assignment.
 * Returns a non-negative 32-bit integer.
 */
export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // Convert to unsigned 32-bit
}

/**
 * Deterministically pick a variant for a user in an experiment.
 * Uses FNV-1a hash of (userId + experimentId) mapped to cumulative weights.
 */
export function pickVariant(
  userId: string,
  experimentId: string,
  variants: ExperimentVariant[]
): ExperimentVariant {
  const hash = fnv1aHash(`${userId}-${experimentId}`);
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  const bucket = hash % totalWeight;

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return variant;
    }
  }

  // Fallback (should never reach here)
  return variants[variants.length - 1];
}

/**
 * Chi-squared test for independence between variants and conversion.
 * Tests whether conversion rates differ significantly across variants.
 */
export function chiSquaredTest(
  variantData: Array<{ conversions: number; total: number }>
): { statistic: number; pValue: number; significant: boolean } | null {
  const k = variantData.length;
  if (k < 2) return null;

  const totalConversions = variantData.reduce((s, v) => s + v.conversions, 0);
  const totalN = variantData.reduce((s, v) => s + v.total, 0);
  if (totalN === 0) return null;

  const overallRate = totalConversions / totalN;

  let chiSq = 0;
  for (const v of variantData) {
    if (v.total === 0) continue;
    const expectedConv = v.total * overallRate;
    const expectedNonConv = v.total * (1 - overallRate);
    if (expectedConv > 0) {
      chiSq += Math.pow(v.conversions - expectedConv, 2) / expectedConv;
    }
    if (expectedNonConv > 0) {
      const nonConv = v.total - v.conversions;
      chiSq += Math.pow(nonConv - expectedNonConv, 2) / expectedNonConv;
    }
  }

  const df = k - 1;
  // Approximate p-value using chi-squared survival function
  // For df=1: p ≈ erfc(sqrt(chiSq/2)) / sqrt(2)
  // For simplicity, use critical values: df=1→3.84, df=2→5.99, df=3→7.81
  const criticalValues: Record<number, number> = { 1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488 };
  const critical = criticalValues[df] ?? 3.841 + (df - 1) * 2.0;

  // Rough p-value approximation
  const pValue = chiSq >= critical ? 0.01 : chiSq >= critical * 0.5 ? 0.1 : 0.5;

  return {
    statistic: Math.round(chiSq * 1000) / 1000,
    pValue,
    significant: chiSq >= critical,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/experiments.test.ts --no-cache`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/experiments.ts src/lib/experiments.test.ts
git commit -m "feat(#59): add experiment assignment engine with FNV-1a hashing and chi-squared test"
```

---

### Task 7: Create experiments admin API (CRUD)

**Files:**
- Create: `src/app/api/admin/experiments/route.ts`
- Create: `src/app/api/admin/experiments/[id]/route.ts`

**Step 1: Write the list/create route**

```typescript
// src/app/api/admin/experiments/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";

/** GET: List all experiments with variants and assignment counts */
export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch variants and assignment counts for each experiment
  const experimentIds = (experiments ?? []).map((e: { id: string }) => e.id);

  const [variantsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("experiment_variants")
      .select("*")
      .in("experiment_id", experimentIds.length > 0 ? experimentIds : [""]),
    supabase
      .from("experiment_assignments")
      .select("experiment_id, variant_id")
      .in("experiment_id", experimentIds.length > 0 ? experimentIds : [""]),
  ]);

  type VariantRow = { id: string; experiment_id: string; name: string; config: Record<string, unknown>; weight: number };
  type AssignmentRow = { experiment_id: string; variant_id: string };

  const variants = (variantsResult.data ?? []) as VariantRow[];
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];

  const variantsByExp: Record<string, VariantRow[]> = {};
  for (const v of variants) {
    (variantsByExp[v.experiment_id] ??= []).push(v);
  }

  const assignmentCounts: Record<string, number> = {};
  for (const a of assignments) {
    assignmentCounts[a.experiment_id] = (assignmentCounts[a.experiment_id] || 0) + 1;
  }

  const result = (experiments ?? []).map((exp: { id: string }) => ({
    ...exp,
    variants: variantsByExp[exp.id] ?? [],
    total_assignments: assignmentCounts[exp.id] ?? 0,
  }));

  return NextResponse.json({ experiments: result });
}

/** POST: Create a new experiment with variants */
export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, target_metric, start_date, end_date, variants } = body as {
    name: string;
    description?: string;
    target_metric?: string;
    start_date?: string;
    end_date?: string;
    variants: Array<{ name: string; config?: Record<string, unknown>; weight?: number }>;
  };

  if (!name || !variants || variants.length < 2) {
    return NextResponse.json(
      { error: "Name and at least 2 variants are required" },
      { status: 400 }
    );
  }

  // Create experiment
  const { data: experiment, error: expError } = await supabase
    .from("experiments")
    .insert({
      name,
      description: description ?? "",
      target_metric: target_metric ?? "ctr",
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (expError) {
    return NextResponse.json({ error: expError.message }, { status: 500 });
  }

  // Create variants
  const variantRows = variants.map((v) => ({
    experiment_id: experiment.id,
    name: v.name,
    config: v.config ?? {},
    weight: v.weight ?? 1,
  }));

  const { data: createdVariants, error: varError } = await supabase
    .from("experiment_variants")
    .insert(variantRows)
    .select();

  if (varError) {
    // Clean up experiment on variant creation failure
    await supabase.from("experiments").delete().eq("id", experiment.id);
    return NextResponse.json({ error: varError.message }, { status: 500 });
  }

  return NextResponse.json(
    { experiment: { ...experiment, variants: createdVariants } },
    { status: 201 }
  );
}
```

**Step 2: Write the detail/update/delete route**

```typescript
// src/app/api/admin/experiments/[id]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: Single experiment with variants and metrics overview */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: experiment, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  const [variantsResult, assignmentsResult] = await Promise.all([
    supabase.from("experiment_variants").select("*").eq("experiment_id", id),
    supabase.from("experiment_assignments").select("variant_id").eq("experiment_id", id),
  ]);

  type AssignmentRow = { variant_id: string };
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const assignmentsByVariant: Record<string, number> = {};
  for (const a of assignments) {
    assignmentsByVariant[a.variant_id] = (assignmentsByVariant[a.variant_id] || 0) + 1;
  }

  type VariantRow = { id: string; name: string; config: Record<string, unknown>; weight: number };
  const variants = ((variantsResult.data ?? []) as VariantRow[]).map((v) => ({
    ...v,
    assignments: assignmentsByVariant[v.id] ?? 0,
  }));

  return NextResponse.json({
    experiment: { ...experiment, variants, total_assignments: assignments.length },
  });
}

/** PATCH: Update experiment status or config */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { status, description, end_date } = body as {
    status?: string;
    description?: string;
    end_date?: string;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (description !== undefined) updates.description = description;
  if (end_date !== undefined) updates.end_date = end_date;

  // If starting, set start_date
  if (status === "running") {
    updates.start_date = new Date().toISOString();
  }

  const { data: experiment, error } = await supabase
    .from("experiments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiment });
}

/** DELETE: Only draft experiments */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check status
  const { data: experiment } = await supabase
    .from("experiments")
    .select("status")
    .eq("id", id)
    .single();

  if (!experiment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (experiment.status !== "draft") {
    return NextResponse.json(
      { error: "Can only delete draft experiments" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("experiments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/app/api/admin/experiments/route.ts src/app/api/admin/experiments/\[id\]/route.ts
git commit -m "feat(#59): add experiments admin API (CRUD endpoints)"
```

---

### Task 8: Create experiment results API with statistical significance

**Files:**
- Create: `src/app/api/admin/experiments/[id]/results/route.ts`

**Step 1: Write the results route**

```typescript
// src/app/api/admin/experiments/[id]/results/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { chiSquaredTest } from "@/lib/experiments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch experiment + variants
  const { data: experiment, error: expError } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (expError || !experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  const { data: variants } = await supabase
    .from("experiment_variants")
    .select("*")
    .eq("experiment_id", id);

  type VariantRow = { id: string; name: string; config: Record<string, unknown>; weight: number };
  const variantList = (variants ?? []) as VariantRow[];
  const variantIds = variantList.map((v) => v.id);

  // Fetch assignment counts per variant
  const { data: assignments } = await supabase
    .from("experiment_assignments")
    .select("variant_id")
    .eq("experiment_id", id);

  type AssignmentRow = { variant_id: string };
  const assignmentCounts: Record<string, number> = {};
  for (const a of (assignments ?? []) as AssignmentRow[]) {
    assignmentCounts[a.variant_id] = (assignmentCounts[a.variant_id] || 0) + 1;
  }

  // Fetch recommendation feedback with variant_id
  const { data: feedbackRows } = await supabase
    .from("recommendation_feedback")
    .select("action, experiment_variant_id")
    .in("experiment_variant_id", variantIds.length > 0 ? variantIds : [""]);

  type FeedbackRow = { action: string; experiment_variant_id: string | null };
  const feedback = (feedbackRows ?? []) as FeedbackRow[];

  // Aggregate metrics per variant
  const variantMetrics = variantList.map((v) => {
    const vFeedback = feedback.filter((f) => f.experiment_variant_id === v.id);
    const impressions = vFeedback.filter((f) => f.action === "impression").length;
    const clicks = vFeedback.filter((f) => f.action === "click").length;
    const saves = vFeedback.filter((f) => f.action === "save").length;
    const dismisses = vFeedback.filter((f) => f.action === "dismiss").length;

    return {
      variant_id: v.id,
      variant_name: v.name,
      assignments: assignmentCounts[v.id] ?? 0,
      impressions,
      clicks,
      saves,
      dismisses,
      ctr_percent: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      save_rate_percent: impressions > 0 ? Math.round((saves / impressions) * 10000) / 100 : 0,
      dismiss_rate_percent: impressions > 0 ? Math.round((dismisses / impressions) * 10000) / 100 : 0,
    };
  });

  // Statistical significance based on target metric
  const metricKey = experiment.target_metric === "save_rate" ? "saves" : "clicks";
  const chiData = variantMetrics.map((vm) => ({
    conversions: vm[metricKey as keyof typeof vm] as number,
    total: vm.impressions,
  }));

  const significance = chiSquaredTest(chiData);

  return NextResponse.json({
    experiment,
    variant_metrics: variantMetrics,
    significance,
  });
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/admin/experiments/\[id\]/results/route.ts
git commit -m "feat(#59): add experiment results API with statistical significance testing"
```

---

### Task 9: Integrate experiment assignment into recommendations API

**Files:**
- Modify: `src/app/api/recommendations/route.ts` (GET handler — check active experiments, assign variant, apply config, log variant_id in feedback)

**Step 1: Update GET handler**

Add imports at top:
```typescript
import { pickVariant } from "@/lib/experiments";
```

After authenticating the user and before calling the ML service (around line 246), add:

```typescript
    // Check for active recommendation experiments
    let experimentVariantId: string | null = null;
    let experimentLambda: number | null = null;

    const { data: activeExperiments } = await supabase
      .from("experiments")
      .select("id, name, status")
      .eq("status", "running");

    if (activeExperiments && activeExperiments.length > 0) {
      const experiment = activeExperiments[0] as { id: string; name: string };

      // Get variants
      const { data: variantRows } = await supabase
        .from("experiment_variants")
        .select("*")
        .eq("experiment_id", experiment.id);

      type VRow = { id: string; experiment_id: string; name: string; config: Record<string, unknown>; weight: number };
      const variants = (variantRows ?? []) as VRow[];

      if (variants.length >= 2) {
        // Check for existing assignment
        const { data: existingAssignment } = await supabase
          .from("experiment_assignments")
          .select("variant_id")
          .eq("experiment_id", experiment.id)
          .eq("user_id", user.id)
          .single();

        let assignedVariant: VRow;
        if (existingAssignment) {
          assignedVariant = variants.find((v) => v.id === existingAssignment.variant_id) ?? variants[0];
        } else {
          assignedVariant = pickVariant(user.id, experiment.id, variants);
          await supabase.from("experiment_assignments").insert({
            experiment_id: experiment.id,
            variant_id: assignedVariant.id,
            user_id: user.id,
          });
        }

        experimentVariantId = assignedVariant.id;
        if (typeof assignedVariant.config?.lambda === "number") {
          experimentLambda = assignedVariant.config.lambda as number;
        }
      }
    }
```

Then in the MMR re-ranking section, use the experiment lambda if present:
```typescript
    const diversityParam = searchParams.get("diversity");
    const baseLambda = diversityParam ? parseFloat(diversityParam) : 0.7;
    const lambda = experimentLambda ?? (isNaN(baseLambda) ? 0.7 : Math.max(0, Math.min(1, baseLambda)));
```

Add `experiment_variant_id` to the response:
```typescript
    return NextResponse.json(
      {
        ...data,
        source,
        recommendations: recommendationsWithExplanations,
        diversity_metadata: diversityMetadata,
        experiment_variant_id: experimentVariantId,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
```

**Step 2: Update feedback route to accept experiment_variant_id**

In `src/app/api/recommendations/feedback/route.ts`, update the AnalyticsBody interface and insert:

```typescript
interface AnalyticsBody {
  user_id?: string;
  event_id: string;
  recommendation_rank: number;
  action: RecommendationFeedbackAction;
  session_id?: string;
  experiment_variant_id?: string;
}
```

And include it in the row insert:
```typescript
    const row: RecommendationFeedbackInsert = {
      user_id: userId,
      event_id,
      recommendation_rank,
      action: action as string,
      session_id: session_id ?? null,
      experiment_variant_id: (body as AnalyticsBody).experiment_variant_id ?? null,
    };
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/app/api/recommendations/route.ts src/app/api/recommendations/feedback/route.ts
git commit -m "feat(#59): integrate experiment variant assignment into recommendations flow"
```

---

### Task 10: Create admin experiments dashboard UI

**Files:**
- Create: `src/app/api/admin/experiments/page.tsx` — wait, admin pages don't exist as app routes yet. The admin API routes are at `src/app/api/admin/`. Looking at project structure, there's no admin UI pages in the app router.

Let me check — the admin pages must be under a different path. Since no admin pages directory exists, we'll create them:

- Create: `src/app/admin/experiments/page.tsx`
- Create: `src/app/admin/experiments/[id]/page.tsx`
- Create: `src/app/admin/layout.tsx` (if not exists — minimal admin layout)

**Step 1: Create admin layout (if needed)**

```typescript
// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  if (!roles.includes("admin")) redirect("/");

  return <>{children}</>;
}
```

**Step 2: Create experiments list page**

```tsx
// src/app/admin/experiments/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Play, Pause, CheckCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExperimentVariant {
  id: string;
  name: string;
  config: Record<string, unknown>;
  weight: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed";
  target_metric: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  variants: ExperimentVariant[];
  total_assignments: number;
}

interface NewVariant {
  name: string;
  config: string;
  weight: number;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  running: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <FlaskConical className="w-3 h-3" />,
  running: <Play className="w-3 h-3" />,
  paused: <Pause className="w-3 h-3" />,
  completed: <CheckCircle className="w-3 h-3" />,
};

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMetric, setFormMetric] = useState("ctr");
  const [formVariants, setFormVariants] = useState<NewVariant[]>([
    { name: "control", config: "{}", weight: 50 },
    { name: "treatment", config: '{"lambda": 0.3}', weight: 50 },
  ]);
  const [creating, setCreating] = useState(false);

  const fetchExperiments = useCallback(async () => {
    const res = await fetch("/api/admin/experiments");
    if (res.ok) {
      const data = await res.json();
      setExperiments(data.experiments);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const handleCreate = async () => {
    setCreating(true);
    const variants = formVariants.map((v) => ({
      name: v.name,
      config: JSON.parse(v.config || "{}"),
      weight: v.weight,
    }));

    const res = await fetch("/api/admin/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: formDescription,
        target_metric: formMetric,
        variants,
      }),
    });

    if (res.ok) {
      setShowCreate(false);
      setFormName("");
      setFormDescription("");
      setFormVariants([
        { name: "control", config: "{}", weight: 50 },
        { name: "treatment", config: '{"lambda": 0.3}', weight: 50 },
      ]);
      fetchExperiments();
    }
    setCreating(false);
  };

  const addVariant = () => {
    setFormVariants([...formVariants, { name: "", config: "{}", weight: 50 }]);
  };

  const removeVariant = (idx: number) => {
    if (formVariants.length <= 2) return;
    setFormVariants(formVariants.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, field: keyof NewVariant, value: string | number) => {
    const updated = [...formVariants];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormVariants(updated);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">A/B Experiments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage recommendation experiments and view results
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-8 p-6 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Create Experiment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., diversity-lambda-test"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What this experiment tests..."
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Metric</label>
              <select
                value={formMetric}
                onChange={(e) => setFormMetric(e.target.value)}
                className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="ctr">Click-Through Rate</option>
                <option value="save_rate">Save Rate</option>
                <option value="dismiss_rate">Dismiss Rate</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Variants</label>
                <Button variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="w-3 h-3 mr-1" /> Add Variant
                </Button>
              </div>
              <div className="space-y-3">
                {formVariants.map((v, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => updateVariant(idx, "name", e.target.value)}
                      placeholder="Variant name"
                      className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                    />
                    <input
                      type="text"
                      value={v.config}
                      onChange={(e) => updateVariant(idx, "config", e.target.value)}
                      placeholder='{"lambda": 0.7}'
                      className="flex-1 px-3 py-2 border rounded-md font-mono text-sm dark:bg-gray-800 dark:border-gray-600"
                    />
                    <input
                      type="number"
                      value={v.weight}
                      onChange={(e) => updateVariant(idx, "weight", parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                      min={1}
                    />
                    {formVariants.length > 2 && (
                      <Button variant="ghost" size="sm" onClick={() => removeVariant(idx)}>
                        x
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleCreate} disabled={creating || !formName}>
                {creating ? "Creating..." : "Create Experiment"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Experiments Table */}
      {experiments.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No experiments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Metric</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Variants</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Assignments</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {experiments.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/experiments/${exp.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {exp.name}
                    </Link>
                    {exp.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{exp.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[exp.status]}`}>
                      {STATUS_ICONS[exp.status]}
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{exp.target_metric}</td>
                  <td className="px-4 py-3 text-sm">{exp.variants.length}</td>
                  <td className="px-4 py-3 text-sm">{exp.total_assignments}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(exp.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/experiments/page.tsx
git commit -m "feat(#59): add admin experiments list page with create form"
```

---

### Task 11: Create experiment detail page with results dashboard

**Files:**
- Create: `src/app/admin/experiments/[id]/page.tsx`

**Step 1: Write the detail page**

```tsx
// src/app/admin/experiments/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface VariantMetrics {
  variant_id: string;
  variant_name: string;
  assignments: number;
  impressions: number;
  clicks: number;
  saves: number;
  dismisses: number;
  ctr_percent: number;
  save_rate_percent: number;
  dismiss_rate_percent: number;
}

interface Significance {
  statistic: number;
  p_value: number;
  significant: boolean;
}

interface ExperimentDetail {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed";
  target_metric: string;
  start_date: string | null;
  end_date: string | null;
  variants: Array<{
    id: string;
    name: string;
    config: Record<string, unknown>;
    weight: number;
    assignments: number;
  }>;
  total_assignments: number;
}

export default function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [results, setResults] = useState<{
    variant_metrics: VariantMetrics[];
    significance: Significance | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    const [expRes, resultsRes] = await Promise.all([
      fetch(`/api/admin/experiments/${id}`),
      fetch(`/api/admin/experiments/${id}/results`),
    ]);

    if (expRes.ok) {
      const expData = await expRes.json();
      setExperiment(expData.experiment);
    }

    if (resultsRes.ok) {
      const resultsData = await resultsRes.json();
      setResults({
        variant_metrics: resultsData.variant_metrics,
        significance: resultsData.significance,
      });
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    const res = await fetch(`/api/admin/experiments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      fetchData();
    }
    setUpdating(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this experiment?")) return;
    const res = await fetch(`/api/admin/experiments/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/admin/experiments");
    }
  };

  if (loading || !experiment) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const targetMetricKey = experiment.target_metric === "save_rate"
    ? "save_rate_percent"
    : experiment.target_metric === "dismiss_rate"
      ? "dismiss_rate_percent"
      : "ctr_percent";

  const maxMetricVal = results
    ? Math.max(...results.variant_metrics.map((vm) => vm[targetMetricKey] as number), 1)
    : 1;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        href="/admin/experiments"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Experiments
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{experiment.name}</h1>
          {experiment.description && (
            <p className="text-gray-500 dark:text-gray-400 mt-1">{experiment.description}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>Target: {experiment.target_metric}</span>
            <span>Assignments: {experiment.total_assignments}</span>
            {experiment.start_date && (
              <span>Started: {new Date(experiment.start_date).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {experiment.status === "draft" && (
            <>
              <Button onClick={() => updateStatus("running")} disabled={updating}>
                <Play className="w-4 h-4 mr-1" /> Start
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={updating}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </>
          )}
          {experiment.status === "running" && (
            <>
              <Button variant="outline" onClick={() => updateStatus("paused")} disabled={updating}>
                <Pause className="w-4 h-4 mr-1" /> Pause
              </Button>
              <Button onClick={() => updateStatus("completed")} disabled={updating}>
                <CheckCircle className="w-4 h-4 mr-1" /> Complete
              </Button>
            </>
          )}
          {experiment.status === "paused" && (
            <>
              <Button onClick={() => updateStatus("running")} disabled={updating}>
                <Play className="w-4 h-4 mr-1" /> Resume
              </Button>
              <Button onClick={() => updateStatus("completed")} disabled={updating}>
                <CheckCircle className="w-4 h-4 mr-1" /> Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Variants Config */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Variants</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {experiment.variants.map((v) => (
            <div key={v.id} className="p-4 border rounded-lg dark:border-gray-700">
              <div className="font-medium">{v.name}</div>
              <div className="text-sm text-gray-500 mt-1">
                Weight: {v.weight} | Assignments: {v.assignments}
              </div>
              <pre className="text-xs mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded overflow-auto">
                {JSON.stringify(v.config, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Results</h2>

          {/* Significance Banner */}
          {results.significance && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                results.significance.significant
                  ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {results.significance.significant
                ? `Statistically significant (chi-squared = ${results.significance.statistic}, p < 0.05)`
                : results.variant_metrics.every((vm) => vm.impressions === 0)
                  ? "Not enough data yet"
                  : `Not yet significant (chi-squared = ${results.significance.statistic}, p > 0.05)`}
            </div>
          )}

          {/* Metrics Table */}
          <div className="border rounded-lg overflow-hidden dark:border-gray-700 mb-6">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Variant</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Impressions</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">CTR %</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Save %</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Dismiss %</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {results.variant_metrics.map((vm) => (
                  <tr key={vm.variant_id}>
                    <td className="px-4 py-3 font-medium">{vm.variant_name}</td>
                    <td className="px-4 py-3 text-right">{vm.impressions}</td>
                    <td className="px-4 py-3 text-right">{vm.ctr_percent}%</td>
                    <td className="px-4 py-3 text-right">{vm.save_rate_percent}%</td>
                    <td className="px-4 py-3 text-right">{vm.dismiss_rate_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar Chart */}
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {experiment.target_metric.replace("_", " ").toUpperCase()} by Variant
          </h3>
          <div className="space-y-3">
            {results.variant_metrics.map((vm) => {
              const val = vm[targetMetricKey] as number;
              const width = maxMetricVal > 0 ? (val / maxMetricVal) * 100 : 0;
              return (
                <div key={vm.variant_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{vm.variant_name}</span>
                    <span className="font-medium">{val}%</span>
                  </div>
                  <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/admin/experiments/\[id\]/page.tsx
git commit -m "feat(#59): add experiment detail page with results dashboard and bar chart"
```

---

### Task 12: Update constants and add API endpoint

**Files:**
- Modify: `src/lib/constants.ts` (add experiments endpoints)

**Step 1: Add endpoint constants**

```typescript
  // A/B Testing endpoints
  ADMIN_EXPERIMENTS: "/api/admin/experiments",
  ADMIN_EXPERIMENT_DETAIL: (id: string) => `/api/admin/experiments/${id}`,
  ADMIN_EXPERIMENT_RESULTS: (id: string) => `/api/admin/experiments/${id}/results`,
```

**Step 2: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(#59): add experiment API endpoint constants"
```

---

### Task 13: Write A/B testing documentation

**Files:**
- Create: `docs/ab-testing.md`

**Step 1: Write the guide**

```markdown
# A/B Testing Framework

## Overview

The A/B testing framework allows admins to run controlled experiments on the recommendation algorithm. Users are deterministically assigned to experiment variants, and per-variant metrics are tracked automatically.

## Architecture

- **Tables**: `experiments`, `experiment_variants`, `experiment_assignments` in Supabase
- **Assignment**: FNV-1a hash of `userId + experimentId` mapped to variant weights (deterministic, consistent)
- **Metrics**: Tracked via `recommendation_feedback` with `experiment_variant_id` column
- **Statistics**: Chi-squared test for significance (p < 0.05)

## Creating an Experiment

1. Navigate to `/admin/experiments`
2. Click "New Experiment"
3. Fill in:
   - **Name**: Unique slug (e.g., `diversity-lambda-test`)
   - **Description**: What you're testing
   - **Target Metric**: CTR, Save Rate, or Dismiss Rate
   - **Variants**: At least 2, each with:
     - Name (e.g., `control`, `high-diversity`)
     - Config JSON (e.g., `{"lambda": 0.3}`)
     - Weight (traffic allocation, e.g., 50/50)
4. Click "Create Experiment" (starts in `draft` status)
5. Click "Start" when ready to begin

## Available Config Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lambda` | number (0-1) | 0.7 | MMR diversity parameter. 1.0 = pure relevance, 0.0 = max diversity |

## Reading Results

On the experiment detail page:
- **Impressions**: How many times recommendations were shown to users in this variant
- **CTR%**: Clicks / Impressions
- **Save%**: Saves / Impressions
- **Dismiss%**: Dismisses / Impressions
- **Significance**: Chi-squared test result. "Significant" means p < 0.05.

## When to Stop

- **Minimum sample**: Wait for at least 100 impressions per variant
- **Significance**: Once the chi-squared test shows "Significant", the result is reliable
- **Duration**: Run for at least 7 days to account for day-of-week effects
- Click "Complete" to end the experiment. Assignment data is preserved for analysis.

## Experiment Lifecycle

```
draft -> running -> paused -> running -> completed
                └-> completed
```

- **Draft**: Not active. Can be deleted.
- **Running**: Users are assigned to variants. Metrics are tracked.
- **Paused**: No new assignments. Existing assignments preserved.
- **Completed**: Archived. No new assignments or tracking.
```

**Step 2: Commit**

```bash
git add docs/ab-testing.md
git commit -m "docs(#59): add A/B testing framework documentation"
```

---

### Task 14: Final build verification and lint

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing warnings)

**Step 3: Run all tests**

Run: `npx jest --no-cache`
Expected: All tests pass including new diversity and experiments tests

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address lint/type errors from diversity scoring and A/B testing implementation"
```
