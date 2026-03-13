# Postgres-Native Recommendation Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the external Python Two-Tower recommendation service with a self-contained Postgres scoring engine that learns from user behavior, runs entirely within Supabase, and delivers a personalized "feed that learns" experience.

**Architecture:** Three-layer system — (1) batch scoring via pg_cron computes per-user event scores every 6 hours, (2) real-time session boost re-ranks results on each page load based on recent interactions, (3) implicit interest evolution auto-adds tags to user profiles based on behavior. All scoring logic lives in Postgres functions; the Next.js API is a thin read layer.

**Tech Stack:** Postgres (scoring functions, pg_cron), Supabase (migrations, RLS), Next.js API routes, TypeScript, SWR (client-side fetching)

**Spec:** `docs/superpowers/specs/2026-03-13-postgres-native-recommendation-engine-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260313000002_recommendation_engine.sql` | Schema: new tables, `inferred_tags` column, scoring function, pg_cron job |
| `src/lib/recommendations.ts` | Tag hierarchy, scoring helpers, session boost logic, explanation generation |
| `src/app/api/profile/inferred-tags/route.ts` | DELETE endpoint for removing inferred tags |
| `src/app/api/recommendations/batch/route.ts` | POST endpoint for manual batch trigger |
| `src/lib/__tests__/recommendations.test.ts` | Unit tests for scoring helpers and session boost |
<!-- Integration tests for the API route are deferred — the route is a thin read layer over Postgres scores, best validated via manual E2E testing (Task 14) rather than mock-heavy unit tests -->

### Modified files
| File | Change |
|------|--------|
| `src/types/index.ts:76` | Add `inferred_tags` to User interface |
| `src/lib/supabase/types.ts:134,146,158` | Add `inferred_tags` to Row/Insert/Update |
| `src/lib/constants.ts:332` | Add `TAG_HIERARCHY` constant |
| `src/store/useAuthStore.ts:60,75` | Fetch and store `inferred_tags` |
| `src/app/api/recommendations/route.ts` | Full rewrite of GET handler |
| `src/components/events/HomeFeed.tsx:559-584` | Wire "Personalized for You" to recommendations API |
| `src/components/profile/InterestsCard.tsx` | Show inferred tags with "Learned" label and remove button |
| `src/app/profile/ProfileClient.tsx` | Display inferred tags in profile view |

---

## Chunk 1: Database Schema & Types

### Task 1: Create the migration

**Files:**
- Create: `supabase/migrations/20260313000002_recommendation_engine.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- New tables for recommendation engine
-- user_event_scores: precomputed personalized scores per user per event
CREATE TABLE IF NOT EXISTS user_event_scores (
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id    uuid REFERENCES events(id) ON DELETE CASCADE,
  score       float NOT NULL,
  breakdown   jsonb NOT NULL DEFAULT '{}',
  scored_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_scores_user_score
  ON user_event_scores (user_id, score DESC);

-- tag_interaction_counts: precomputed rollup of interactions by tag per user
CREATE TABLE IF NOT EXISTS tag_interaction_counts (
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tag              text NOT NULL,
  save_count       int NOT NULL DEFAULT 0,
  click_count      int NOT NULL DEFAULT 0,
  view_count       int NOT NULL DEFAULT 0,
  last_interaction timestamptz,
  PRIMARY KEY (user_id, tag)
);

-- Add inferred_tags column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS inferred_tags text[] NOT NULL DEFAULT '{}';

-- RLS policies
ALTER TABLE user_event_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_interaction_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own scores"
  ON user_event_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all scores"
  ON user_event_scores FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read their own tag counts"
  ON tag_interaction_counts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tag counts"
  ON tag_interaction_counts FOR ALL
  USING (auth.role() = 'service_role');
```

**Note:** Do NOT apply this migration yet. Task 6 will append the scoring function to this file, then we apply once.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260313000002_recommendation_engine.sql
git commit -m "feat(db): add recommendation engine schema — user_event_scores, tag_interaction_counts, inferred_tags"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/types/index.ts:76`
- Modify: `src/lib/supabase/types.ts:134,146,158`

- [ ] **Step 1: Add `inferred_tags` to User interface**

In `src/types/index.ts`, after the `interest_tags: string[];` line (line 76), add:

```typescript
  inferred_tags: string[];
```

- [ ] **Step 2: Add `inferred_tags` to Supabase Database type**

In `src/lib/supabase/types.ts`, add `inferred_tags: string[];` to the users table Row type (after `interest_tags` at line 134), `inferred_tags?: string[];` to the Insert type (after line 146), and `inferred_tags?: string[];` to the Update type (after line 158).

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | grep -E "error|Error" | head -5`
Expected: No errors (existing code doesn't reference `inferred_tags` yet, so no breakage).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/supabase/types.ts
git commit -m "feat(types): add inferred_tags to User and Database types"
```

---

### Task 3: Add TAG_HIERARCHY constant

**Files:**
- Modify: `src/lib/constants.ts:332`

- [ ] **Step 1: Add TAG_HIERARCHY after VALID_INTEREST_TAGS**

In `src/lib/constants.ts`, after the `VALID_INTEREST_TAGS` definition, add:

```typescript
/**
 * Maps granular quick-filter tags to their parent EventTag.
 * Used by the recommendation scoring engine for partial affinity matching.
 * A user interested in "hackathon" gets partial affinity (0.5x) for "tech" events.
 */
export const TAG_HIERARCHY: Record<string, string> = {
  hackathon: EventTag.TECH,
  competition: EventTag.CAREER,
  guest_speaker: EventTag.ACADEMIC,
  free_food: EventTag.FOOD,
  workshop: EventTag.TECH,
  party: EventTag.SOCIAL,
  fitness: EventTag.SPORTS,
  info_session: EventTag.CAREER,
};

/**
 * Reverse mapping: parent EventTag → child granular tags.
 * Auto-computed from TAG_HIERARCHY.
 */
export const TAG_CHILDREN: Record<string, string[]> = Object.entries(TAG_HIERARCHY).reduce(
  (acc, [child, parent]) => {
    if (!acc[parent]) acc[parent] = [];
    acc[parent].push(child);
    return acc;
  },
  {} as Record<string, string[]>
);
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | grep -E "error|Error" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(constants): add TAG_HIERARCHY and TAG_CHILDREN for recommendation scoring"
```

---

### Task 4: Update auth store to fetch inferred_tags

**Files:**
- Modify: `src/store/useAuthStore.ts:60,75`

- [ ] **Step 1: Add inferred_tags to the select query**

In `src/store/useAuthStore.ts`, find the `.select("roles, interest_tags")` call (around line 60) and change it to:

```typescript
.select("roles, interest_tags, inferred_tags")
```

- [ ] **Step 2: Add inferred_tags to state update**

Find where `interest_tags` is set in the state update (around line 75) and add `inferred_tags`:

```typescript
inferred_tags: (profile.inferred_tags as string[]) ?? [],
```

- [ ] **Step 3: Add inferred_tags to initial state**

Find the initial state (around line 46 where `interest_tags: []` is) and add:

```typescript
inferred_tags: [],
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build 2>&1 | grep -E "error|Error" | head -5`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/useAuthStore.ts
git commit -m "feat(auth): fetch and store inferred_tags in auth store"
```

---

## Chunk 2: Scoring Logic & Helpers

### Task 5: Write the recommendation helpers with tests (TDD)

**Files:**
- Create: `src/lib/recommendations.ts`
- Create: `src/lib/__tests__/recommendations.test.ts`

- [ ] **Step 1: Write failing tests for tag affinity calculation**

Create `src/lib/__tests__/recommendations.test.ts`:

```typescript
import {
  computeTagAffinity,
  computeSessionBoost,
  generateExplanation,
  expandTagsWithHierarchy,
} from "../recommendations";

describe("expandTagsWithHierarchy", () => {
  it("returns direct tags plus parent tags with reduced weight", () => {
    const result = expandTagsWithHierarchy(["hackathon", "academic"]);
    expect(result).toEqual([
      { tag: "hackathon", weight: 1.0 },
      { tag: "tech", weight: 0.5 },       // parent of hackathon
      { tag: "academic", weight: 1.0 },
    ]);
  });

  it("deduplicates when a direct tag is also a parent", () => {
    const result = expandTagsWithHierarchy(["hackathon", "tech"]);
    // "tech" appears directly (1.0) AND as parent of hackathon (0.5) — keep the higher weight
    expect(result).toEqual([
      { tag: "hackathon", weight: 1.0 },
      { tag: "tech", weight: 1.0 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(expandTagsWithHierarchy([])).toEqual([]);
  });
});

describe("computeTagAffinity", () => {
  it("returns 1.0 for perfect overlap", () => {
    const userTags = [{ tag: "tech", weight: 1.0 }, { tag: "academic", weight: 1.0 }];
    const eventTags = ["tech", "academic"];
    expect(computeTagAffinity(userTags, eventTags)).toBe(1.0);
  });

  it("returns 0.0 for no overlap", () => {
    const userTags = [{ tag: "tech", weight: 1.0 }];
    const eventTags = ["social", "sports"];
    expect(computeTagAffinity(userTags, eventTags)).toBe(0.0);
  });

  it("accounts for partial weight from hierarchy", () => {
    const userTags = [{ tag: "hackathon", weight: 1.0 }, { tag: "tech", weight: 0.5 }];
    const eventTags = ["tech"];
    const score = computeTagAffinity(userTags, eventTags);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1.0);
  });
});

describe("computeSessionBoost", () => {
  it("returns 0 when no session tags match", () => {
    const sessionTags = ["music", "arts"];
    const eventTags = ["tech", "career"];
    expect(computeSessionBoost(sessionTags, eventTags)).toBe(0);
  });

  it("returns 0.05 per matching tag", () => {
    const sessionTags = ["tech", "career", "music"];
    const eventTags = ["tech", "career"];
    expect(computeSessionBoost(sessionTags, eventTags)).toBe(0.10);
  });

  it("caps at 0.15", () => {
    const sessionTags = ["tech", "career", "music", "arts"];
    const eventTags = ["tech", "career", "music", "arts"];
    expect(computeSessionBoost(sessionTags, eventTags)).toBe(0.15);
  });
});

describe("generateExplanation", () => {
  it("explains tag affinity when it is the top signal", () => {
    const breakdown = { tag: 0.30, interaction: 0.10, popularity: 0.15, recency: 0.10, social: 0.02 };
    const matchingTags = ["tech", "hackathon"];
    expect(generateExplanation(breakdown, matchingTags)).toBe("Because you're interested in tech, hackathon");
  });

  it("explains interaction affinity when it is the top signal", () => {
    const breakdown = { tag: 0.05, interaction: 0.25, popularity: 0.15, recency: 0.10, social: 0.02 };
    expect(generateExplanation(breakdown, [])).toBe("Based on events you've engaged with");
  });

  it("explains social signal when it is the top signal", () => {
    const breakdown = { tag: 0.02, interaction: 0.02, popularity: 0.05, recency: 0.05, social: 0.05 };
    expect(generateExplanation(breakdown, [])).toBe("Friends are going to this");
  });

  it("falls back to trending for popularity-dominated scores", () => {
    const breakdown = { tag: 0.0, interaction: 0.0, popularity: 0.20, recency: 0.15, social: 0.0 };
    expect(generateExplanation(breakdown, [])).toBe("Trending on campus");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/__tests__/recommendations.test.ts --no-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the recommendation helpers**

Create `src/lib/recommendations.ts`:

```typescript
import { TAG_HIERARCHY, TAG_CHILDREN } from "@/lib/constants";

export type WeightedTag = { tag: string; weight: number };

export type ScoreBreakdown = {
  tag: number;
  interaction: number;
  popularity: number;
  recency: number;
  social: number;
};

/**
 * Expand user interest tags using the tag hierarchy.
 * Direct tags get weight 1.0, inferred parent/child tags get 0.5.
 * Deduplicates, keeping the higher weight.
 */
export function expandTagsWithHierarchy(tags: string[]): WeightedTag[] {
  const tagMap = new Map<string, number>();

  for (const tag of tags) {
    // Direct tag: full weight
    tagMap.set(tag, Math.max(tagMap.get(tag) ?? 0, 1.0));

    // If this tag has a parent, add the parent at half weight
    const parent = TAG_HIERARCHY[tag];
    if (parent) {
      tagMap.set(parent, Math.max(tagMap.get(parent) ?? 0, 0.5));
    }

    // If this tag IS a parent, add children at half weight
    const children = TAG_CHILDREN[tag];
    if (children) {
      for (const child of children) {
        tagMap.set(child, Math.max(tagMap.get(child) ?? 0, 0.5));
      }
    }
  }

  return Array.from(tagMap.entries()).map(([tag, weight]) => ({ tag, weight }));
}

/**
 * Compute tag affinity between a user's weighted tags and an event's tags.
 * Returns 0.0-1.0 normalized score.
 */
export function computeTagAffinity(userTags: WeightedTag[], eventTags: string[]): number {
  if (userTags.length === 0 || eventTags.length === 0) return 0;

  const eventTagSet = new Set(eventTags);
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const { tag, weight } of userTags) {
    totalWeight += weight;
    if (eventTagSet.has(tag)) {
      matchedWeight += weight;
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

/**
 * Compute session boost based on recent interaction tags.
 * +0.05 per matching tag, capped at +0.15.
 */
export function computeSessionBoost(sessionTags: string[], eventTags: string[]): number {
  const sessionSet = new Set(sessionTags);
  let matchCount = 0;

  for (const tag of eventTags) {
    if (sessionSet.has(tag)) matchCount++;
  }

  return Math.min(matchCount * 0.05, 0.15);
}

/**
 * Generate a human-readable explanation from the score breakdown.
 */
export function generateExplanation(
  breakdown: ScoreBreakdown,
  matchingTags: string[]
): string {
  const { tag, interaction, popularity, recency, social } = breakdown;

  // Find the dominant signal (excluding recency — it's not explanatory)
  const signals = [
    { key: "tag", value: tag },
    { key: "interaction", value: interaction },
    { key: "social", value: social },
    { key: "popularity", value: popularity },
  ];

  const top = signals.reduce((a, b) => (b.value > a.value ? b : a));

  switch (top.key) {
    case "tag":
      return matchingTags.length > 0
        ? `Because you're interested in ${matchingTags.join(", ")}`
        : "Based on your interests";
    case "interaction":
      return "Based on events you've engaged with";
    case "social":
      return "Friends are going to this";
    case "popularity":
    default:
      return "Trending on campus";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/recommendations.test.ts --no-cache`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommendations.ts src/lib/__tests__/recommendations.test.ts
git commit -m "feat(recommendations): add scoring helpers with tag hierarchy, session boost, and explanations"
```

---

## Chunk 3: Postgres Scoring Function

### Task 6: Write the batch scoring function

**Files:**
- Modify: `supabase/migrations/20260313000002_recommendation_engine.sql`

- [ ] **Step 1: Add the scoring function to the migration**

Append the following to `supabase/migrations/20260313000002_recommendation_engine.sql`:

```sql
-- =============================================================
-- compute_user_scores()
-- Batch scoring function. Called by pg_cron every 6 hours.
-- Computes personalized event scores for all active users.
-- =============================================================
CREATE OR REPLACE FUNCTION compute_user_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user RECORD;
  _event RECORD;
  _score float;
  _tag_score float;
  _interaction_score float;
  _popularity_score float;
  _recency_score float;
  _social_score float;
  _max_popularity float;
  _user_tags text[];
  _expanded_tags text[];
  _overlap_count int;
  _partial_count int;
  _total_user_tags int;
  _interaction_weight float;
  _max_interaction float;
  _friend_count int;
  _max_friends int;
  _days_until float;
  _breakdown jsonb;
  _valid_tags text[];
  -- Tag hierarchy: granular tag -> parent broad tag
  -- Used for partial affinity (0.5x) matching
  _tag_parents jsonb := '{
    "hackathon": "tech",
    "competition": "career",
    "guest_speaker": "academic",
    "free_food": "food",
    "workshop": "tech",
    "party": "social",
    "fitness": "sports",
    "info_session": "career"
  }'::jsonb;
BEGIN
  -- Step 1: Refresh tag_interaction_counts
  DELETE FROM tag_interaction_counts;

  INSERT INTO tag_interaction_counts (user_id, tag, save_count, click_count, view_count, last_interaction)
  SELECT
    ui.user_id,
    unnest(e.tags) AS tag,
    COUNT(*) FILTER (WHERE ui.interaction_type = 'save') AS save_count,
    COUNT(*) FILTER (WHERE ui.interaction_type = 'click') AS click_count,
    COUNT(*) FILTER (WHERE ui.interaction_type = 'view') AS view_count,
    MAX(ui.created_at) AS last_interaction
  FROM user_interactions ui
  JOIN events e ON e.id = ui.event_id
  WHERE ui.user_id IS NOT NULL
    AND ui.interaction_type IN ('save', 'click', 'view')
  GROUP BY ui.user_id, unnest(e.tags)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET
    save_count = EXCLUDED.save_count,
    click_count = EXCLUDED.click_count,
    view_count = EXCLUDED.view_count,
    last_interaction = EXCLUDED.last_interaction;

  -- Valid interest tags allowlist (must match VALID_INTEREST_TAGS in constants.ts)
  -- Granular quick-filter tags + broad EventTag values
  _valid_tags := ARRAY[
    'academic','social','sports','career','cultural','wellness',
    'music','tech','food','volunteer','arts','networking',
    'hackathon','competition','guest_speaker','free_food',
    'workshop','party','fitness','info_session'
  ];

  -- Step 2: Implicit interest evolution (inferred_tags)
  -- Add tags where user has saved/clicked 3+ events with that tag
  -- Only infer tags that are in the valid allowlist
  UPDATE users u
  SET inferred_tags = (
    SELECT COALESCE(array_agg(DISTINCT tic.tag), '{}')
    FROM tag_interaction_counts tic
    WHERE tic.user_id = u.id
      AND (tic.save_count + tic.click_count) >= 3
      AND tic.tag = ANY(_valid_tags)
      AND tic.tag != ALL(u.interest_tags)
      AND tic.tag != ALL(u.inferred_tags)
  ) || u.inferred_tags
  WHERE EXISTS (
    SELECT 1 FROM tag_interaction_counts tic
    WHERE tic.user_id = u.id
      AND (tic.save_count + tic.click_count) >= 3
      AND tic.tag = ANY(_valid_tags)
      AND tic.tag != ALL(u.interest_tags)
      AND tic.tag != ALL(u.inferred_tags)
  );

  -- Get max popularity for normalization
  SELECT COALESCE(MAX(popularity_score), 1) INTO _max_popularity
  FROM event_popularity_scores;

  -- Step 3: Clear stale scores and compute new ones
  DELETE FROM user_event_scores;

  -- For each active user, score all upcoming approved events
  FOR _user IN
    SELECT id, interest_tags, inferred_tags
    FROM users
    WHERE id IN (
      SELECT DISTINCT user_id FROM user_interactions
      WHERE created_at > NOW() - INTERVAL '90 days'
      UNION
      SELECT id FROM users WHERE array_length(interest_tags, 1) > 0
    )
  LOOP
    -- Combine interest_tags + inferred_tags, then expand with hierarchy
    _user_tags := _user.interest_tags || _user.inferred_tags;
    -- Expand: for each granular tag, also include its parent at half weight
    -- We track expanded tags separately for partial matching
    _expanded_tags := _user_tags;
    -- Add parent tags for any granular tags the user has
    FOR i IN 1..COALESCE(array_length(_user_tags, 1), 0) LOOP
      IF _tag_parents ? _user_tags[i] THEN
        _expanded_tags := array_append(_expanded_tags, _tag_parents->>_user_tags[i]);
      END IF;
    END LOOP;
    _total_user_tags := COALESCE(array_length(_user_tags, 1), 0);

    -- Get max interaction weight for this user (for normalization)
    SELECT COALESCE(MAX(save_count * 5 + click_count * 3 + view_count), 1)
    INTO _max_interaction
    FROM tag_interaction_counts WHERE user_id = _user.id;

    -- Get max friend RSVP count for normalization
    SELECT COALESCE(MAX(cnt), 1) INTO _max_friends
    FROM (
      SELECT er.event_id, COUNT(*) AS cnt
      FROM event_rsvps er
      JOIN user_follows uf ON uf.following_id = er.user_id
      WHERE uf.follower_id = _user.id
        AND er.status IN ('going', 'interested')
      GROUP BY er.event_id
    ) sub;

    FOR _event IN
      SELECT e.id, e.tags, e.event_date,
             COALESCE(eps.popularity_score, 0) AS pop_score
      FROM events e
      LEFT JOIN event_popularity_scores eps ON eps.event_id = e.id
      WHERE e.status = 'approved'
        AND e.event_date >= CURRENT_DATE
    LOOP
      -- Tag affinity (0.35) with hierarchy support
      -- Direct matches (user tag = event tag) count as 1.0
      -- Parent/child matches via hierarchy count as 0.5
      IF _total_user_tags > 0 THEN
        -- Direct overlap: user's actual tags matching event tags
        SELECT COUNT(*) INTO _overlap_count
        FROM unnest(_user_tags) ut
        WHERE ut = ANY(_event.tags);

        -- Partial overlap: user's expanded parent tags matching event tags
        -- (only count parents that weren't already direct matches)
        SELECT COUNT(*) INTO _partial_count
        FROM unnest(_expanded_tags) et
        WHERE et = ANY(_event.tags)
          AND et != ALL(_user_tags);

        _tag_score := LEAST(
          ((_overlap_count::float + _partial_count::float * 0.5) / _total_user_tags),
          1.0
        );
      ELSE
        _tag_score := 0;
      END IF;

      -- Interaction affinity (0.25)
      SELECT COALESCE(SUM(save_count * 5 + click_count * 3 + view_count), 0)
      INTO _interaction_weight
      FROM tag_interaction_counts
      WHERE user_id = _user.id
        AND tag = ANY(_event.tags);

      _interaction_score := LEAST(_interaction_weight / _max_interaction, 1.0);

      -- Popularity (0.20)
      _popularity_score := _event.pop_score / _max_popularity;

      -- Recency (0.15) — exponential decay, events tomorrow = ~1.0, 14 days = ~0.2
      _days_until := GREATEST(EXTRACT(EPOCH FROM (_event.event_date - CURRENT_DATE)) / 86400, 0);
      _recency_score := EXP(-0.12 * _days_until);

      -- Social signal (0.05)
      SELECT COUNT(*) INTO _friend_count
      FROM event_rsvps er
      JOIN user_follows uf ON uf.following_id = er.user_id
      WHERE uf.follower_id = _user.id
        AND er.event_id = _event.id
        AND er.status IN ('going', 'interested');

      _social_score := LEAST(_friend_count::float / _max_friends, 1.0);

      -- Combined score
      _score := (_tag_score * 0.35)
              + (_interaction_score * 0.25)
              + (_popularity_score * 0.20)
              + (_recency_score * 0.15)
              + (_social_score * 0.05);

      _breakdown := jsonb_build_object(
        'tag', ROUND(_tag_score * 0.35, 4),
        'interaction', ROUND(_interaction_score * 0.25, 4),
        'popularity', ROUND(_popularity_score * 0.20, 4),
        'recency', ROUND(_recency_score * 0.15, 4),
        'social', ROUND(_social_score * 0.05, 4)
      );

      INSERT INTO user_event_scores (user_id, event_id, score, breakdown, scored_at)
      VALUES (_user.id, _event.id, ROUND(_score::numeric, 4)::float, _breakdown, NOW());
    END LOOP;
  END LOOP;
END;
$$;

-- Schedule pg_cron to run every 6 hours
-- NOTE: pg_cron must be enabled in Supabase dashboard (Database > Extensions)
-- Run this manually in SQL editor after enabling pg_cron:
-- SELECT cron.schedule('compute-user-scores', '0 */6 * * *', 'SELECT compute_user_scores()');
```

- [ ] **Step 2: Apply the full migration** (tables from Task 1 + scoring function)

Run: `npx supabase db push` (or apply via Supabase dashboard)
Expected: Tables created, column added, RLS policies active, function created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260313000002_recommendation_engine.sql
git commit -m "feat(db): add compute_user_scores() scoring function with tag hierarchy, interaction, popularity, recency, and social signals"
```

---

## Chunk 4: API Routes

### Task 7: Rewrite the recommendations GET handler

**Files:**
- Modify: `src/app/api/recommendations/route.ts`

- [ ] **Step 1: Rewrite the GET handler**

Replace the existing GET handler in `src/app/api/recommendations/route.ts`. The new handler:
1. Authenticates the user (or returns anonymous fallback)
2. Queries `user_event_scores` for precomputed scores
3. Falls back to popularity-ordered events if no scores exist
4. Applies session boost from recent interactions
5. Applies MMR diversity re-ranking
6. Generates explanations from breakdown
7. Returns the same response shape

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rerankWithMMR, type RecommendationItem } from "@/lib/diversity";
import {
  computeSessionBoost,
  generateExplanation,
  expandTagsWithHierarchy,
  type ScoreBreakdown,
} from "@/lib/recommendations";
import { getActiveExperimentVariant } from "@/lib/experiments";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Authenticate
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Anonymous fallback: popularity + recency
      return await getPopularFallback(supabase, limit, "anonymous");
    }

    // Fetch user profile for interest tags (needed for explanations)
    const { data: userProfile } = await supabase
      .from("users")
      .select("interest_tags, inferred_tags")
      .eq("id", user.id)
      .single();

    const allUserTags = [
      ...(userProfile?.interest_tags ?? []),
      ...(userProfile?.inferred_tags ?? []),
    ];
    const expandedUserTags = expandTagsWithHierarchy(allUserTags);
    const userTagStrings = expandedUserTags.map((t) => t.tag);

    // Fetch precomputed scores
    const { data: scores, error: scoresError } = await supabase
      .from("user_event_scores")
      .select(`
        event_id,
        score,
        breakdown,
        events!inner (
          id, title, description, event_date, event_time, location,
          club_id, tags, image_url, source_url, status,
          clubs (id, name, logo_url)
        )
      `)
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(limit * 2); // Fetch extra for MMR re-ranking

    if (scoresError || !scores || scores.length === 0) {
      // No precomputed scores — fallback
      return await getPopularFallback(supabase, limit, "popular_fallback");
    }

    // Session boost: check recent interactions (last 2 hours)
    const { data: recentInteractions } = await supabase
      .from("user_interactions")
      .select("event_id, events!inner(tags)")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    const sessionTags: string[] = [];
    if (recentInteractions) {
      for (const interaction of recentInteractions) {
        const event = interaction.events as any;
        if (event?.tags) {
          sessionTags.push(...event.tags);
        }
      }
    }

    // Apply session boost and build recommendations
    const boostedScores = scores.map((row) => {
      const event = row.events as any;
      const boost = computeSessionBoost(sessionTags, event.tags || []);
      const finalScore = Math.min((row.score || 0) + boost, 1.0);
      const breakdown = row.breakdown as ScoreBreakdown;

      // Find matching tags between user interests and event tags for explanation
      const matchingTags = (event.tags || []).filter((t: string) =>
        userTagStrings.includes(t)
      );

      return {
        event_id: event.id,
        score: finalScore,
        explanation: generateExplanation(breakdown, matchingTags),
        breakdown,
        event,
      };
    });

    // Sort by boosted score
    boostedScores.sort((a, b) => b.score - a.score);

    // Check for active A/B experiment (preserve existing framework)
    let experimentVariantId: string | undefined;
    let lambda = parseFloat(searchParams.get("diversity") || "0.7");
    try {
      const variant = await getActiveExperimentVariant(supabase, user.id);
      if (variant) {
        experimentVariantId = variant.id;
        if (variant.config?.lambda != null) {
          lambda = variant.config.lambda;
        }
      }
    } catch { /* A/B testing failure is non-fatal */ }

    // Apply MMR diversity re-ranking
    // Build RecommendationItem objects matching the required interface
    const forMMR: RecommendationItem[] = boostedScores.map((s) => ({
      event_id: s.event_id,
      title: s.event.title,
      description: s.event.description || "",
      hosting_club: s.event.clubs?.name ?? null,
      category: (s.event.tags || [])[0] ?? null,
      score: s.score,
      tags: s.event.tags || [],
    }));

    const { items: diverseItems, metadata: diversityMetadata } =
      rerankWithMMR(forMMR, lambda);

    // Take top N after MMR
    const finalItems = diverseItems.slice(0, limit);

    // Map back to full event data
    const recommendations = finalItems.map((item) => {
      const original = boostedScores.find((s) => s.event_id === item.event_id)!;
      return {
        event_id: item.event_id,
        score: item.score,
        explanation: original.explanation,
        breakdown: original.breakdown,
        event: original.event,
      };
    });

    return NextResponse.json({
      recommendations,
      source: "personalized",
      diversity_metadata: diversityMetadata,
      experiment_variant_id: experimentVariantId,
      total_events: scores.length,
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json(
      { error: "Failed to get recommendations" },
      { status: 500 }
    );
  }
}

async function getPopularFallback(
  supabase: any,
  limit: number,
  source: "popular_fallback" | "anonymous"
) {
  const { data: events } = await supabase
    .from("events")
    .select(`
      id, title, description, event_date, event_time, location,
      club_id, tags, image_url, source_url, status,
      clubs (id, name, logo_url),
      event_popularity_scores (popularity_score)
    `)
    .eq("status", "approved")
    .gte("event_date", new Date().toISOString().split("T")[0])
    .order("event_date", { ascending: true })
    .limit(limit);

  const recommendations = (events || [])
    .sort((a: any, b: any) => {
      const popA = a.event_popularity_scores?.[0]?.popularity_score ?? 0;
      const popB = b.event_popularity_scores?.[0]?.popularity_score ?? 0;
      return popB - popA;
    })
    .map((event: any) => ({
      event_id: event.id,
      score: 0,
      explanation: "Trending on campus",
      breakdown: { tag: 0, interaction: 0, popularity: 0.20, recency: 0.15, social: 0 },
      event,
    }));

  return NextResponse.json({
    recommendations,
    source,
    total_events: recommendations.length,
  });
}
```

**Note on `getActiveExperimentVariant`:** This function should already exist in `src/lib/experiments.ts` from the existing A/B testing framework. Read that file to find the exact function name and signature — it may be named differently (e.g., `assignVariant` or similar). Adapt the import accordingly. If no such helper exists, extract the experiment assignment logic from the old GET handler into a reusable function.

- [ ] **Step 2: Remove the POST handler** (or keep as-is if it serves other purposes)

Check if anything in the frontend calls POST `/api/recommendations`. If not, remove the POST handler. If it is used, keep it but remove the Python service call from it.

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | grep -E "error|Error" | head -5`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/recommendations/route.ts
git commit -m "feat(api): rewrite recommendations GET to use Postgres scores instead of Python service"
```

---

### Task 8: Create the batch trigger endpoint

**Files:**
- Create: `src/app/api/recommendations/batch/route.ts`

- [ ] **Step 1: Write the batch endpoint**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyAdmin } from "@/lib/admin";

export async function POST() {
  try {
    // Protected: only admins can manually trigger batch scoring
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { error } = await supabase.rpc("compute_user_scores");

    if (error) {
      console.error("Batch scoring error:", error);
      return NextResponse.json(
        { error: "Batch scoring failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Batch scoring completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Batch trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/recommendations/batch/route.ts
git commit -m "feat(api): add manual batch scoring trigger endpoint"
```

---

### Task 9: Create the inferred-tags removal endpoint

**Files:**
- Create: `src/app/api/profile/inferred-tags/route.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VALID_INTEREST_TAGS } from "@/lib/constants";
import type { NextRequest } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tag } = await request.json();

    if (!tag || typeof tag !== "string") {
      return NextResponse.json(
        { error: "tag is required and must be a string" },
        { status: 400 }
      );
    }

    // Fetch current inferred_tags
    const { data: profile } = await supabase
      .from("users")
      .select("inferred_tags")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currentTags: string[] = profile.inferred_tags ?? [];
    const updatedTags = currentTags.filter((t) => t !== tag);

    const { error: updateError } = await (supabase as any)
      .from("users")
      .update({ inferred_tags: updatedTags, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to remove inferred tag:", updateError);
      return NextResponse.json(
        { error: "Failed to remove tag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, inferred_tags: updatedTags });
  } catch (error) {
    console.error("Error removing inferred tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/profile/inferred-tags/route.ts
git commit -m "feat(api): add DELETE endpoint for removing inferred interest tags"
```

---

## Chunk 5: Frontend Integration

### Task 10: Wire "Personalized for You" section to recommendations API

**Files:**
- Modify: `src/components/events/HomeFeed.tsx:559-584`

- [ ] **Step 1: Read the current HomeFeed.tsx**

Read the full file to understand the current "Personalized for You" implementation (around lines 465-584). Note the current heuristic filtering approach.

- [ ] **Step 2: Replace with recommendations API call**

Replace the current heuristic-based personalization logic with an SWR fetch to `/api/recommendations`. The section should:
- Fetch from `/api/recommendations?limit=10` using SWR
- Render event cards with the `explanation` text shown below each card title (small, muted text)
- Show a "Popular on Campus" header instead when `source` is not `"personalized"`
- Handle loading and error states

Key changes:
- Add SWR hook at the component level for recommendations
- Replace the static filtering with the API response
- Add explanation text to the event card rendering

- [ ] **Step 3: Verify the section renders correctly**

Run: `npm run dev`
Visit homepage. Verify:
- Section appears with "Personalized for You" header (or "Popular on Campus" if no scores yet)
- Event cards display
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/components/events/HomeFeed.tsx
git commit -m "feat(feed): wire Personalized for You section to recommendations API"
```

---

### Task 11: Show inferred tags on profile page

**Files:**
- Modify: `src/components/profile/InterestsCard.tsx`
- Modify: `src/app/profile/ProfileClient.tsx`

- [ ] **Step 1: Update InterestsCard to show inferred tags**

Add a second group to InterestsCard for inferred tags. In the display (non-editing) view, after the manual tags, render inferred tags with a distinct visual treatment:
- Slightly different badge style (e.g., dashed border or a small "auto" indicator)
- An "X" button on each inferred tag that calls `DELETE /api/profile/inferred-tags`
- Group label: "Learned from your activity"

- [ ] **Step 2: Update ProfileClient to pass inferred_tags**

In `src/app/profile/ProfileClient.tsx`:
- Add `inferred_tags` to the `ProfileData` interface
- Pass `inferred_tags` to `InterestsCard` as a new prop
- Display inferred tags in the view mode alongside manual tags

- [ ] **Step 3: Update profile page server component**

In `src/app/profile/page.tsx`, ensure `inferred_tags` is fetched in the profile query and passed to `ProfileClient`.

- [ ] **Step 4: Verify visually**

Run: `npm run dev`
Visit `/profile`. Verify:
- Manual interest tags show as before
- If any inferred tags exist, they show in a "Learned" group with remove buttons
- Removing an inferred tag calls the API and updates the UI

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/InterestsCard.tsx src/app/profile/ProfileClient.tsx src/app/profile/page.tsx
git commit -m "feat(profile): display inferred tags with remove button"
```

---

### Task 12: Add inferred tags toast on homepage

**Files:**
- Modify: `src/app/page.tsx` (or `src/components/events/HomeFeed.tsx`)

- [ ] **Step 1: Track previously seen inferred tags**

Use `localStorage` to store the last-seen `inferred_tags` array. On homepage load, compare with current `inferred_tags` from the auth store. If there are new tags, show a toast.

- [ ] **Step 2: Implement the toast**

Use the existing toast/notification pattern in the project (check for a toast component or use a simple dismissible banner). The toast should:
- Show: "We added **{tag label}** to your interests based on your activity"
- Have an "Undo" button that calls `DELETE /api/profile/inferred-tags` with the tag
- Auto-dismiss after 8 seconds
- Update localStorage after showing

- [ ] **Step 3: Verify**

Run: `npm run dev`
Manually add an inferred tag via SQL, reload homepage. Verify toast appears and Undo works.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ux): add toast notification for newly inferred interest tags"
```

---

## Chunk 6: Cleanup & Rollout

### Task 13: Remove Python service dependency

**Files:**
- Modify: `src/app/api/recommendations/route.ts` (already done in Task 7)
- Search and remove: any references to `RECOMMENDATION_API_URL` or `localhost:8000`

- [ ] **Step 1: Search for Python service references**

Run: `grep -r "RECOMMENDATION_API_URL\|localhost:8000\|recommendation.*service\|two.tower" src/ --include="*.ts" --include="*.tsx" -l`

Remove any remaining references to the external Python service.

- [ ] **Step 2: Remove RECOMMENDATION_THRESHOLD and update RecommendedEventsSection**

The spec says this constant is no longer needed. It is used in:
- `src/lib/constants.ts` (definition)
- `src/components/events/RecommendedEventsSection.tsx` (imported and used at line 126)

Remove the constant from `src/lib/constants.ts`. In `RecommendedEventsSection.tsx`, remove the import and the threshold gating logic — the new recommendation engine handles cold start internally, so the frontend should not gate on saved event count.

- [ ] **Step 3: Verify full build**

Run: `npm run build`
Expected: Clean build with no errors.

Run: `npx jest --passWithNoTests`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Python recommendation service dependency and unused constants"
```

---

### Task 14: Enable pg_cron and run initial batch

- [ ] **Step 1: Enable pg_cron extension**

In Supabase dashboard: Database > Extensions > Search "pg_cron" > Enable

- [ ] **Step 2: Schedule the job**

In Supabase SQL Editor, run:

```sql
SELECT cron.schedule(
  'compute-user-scores',
  '0 */6 * * *',
  'SELECT compute_user_scores()'
);
```

- [ ] **Step 3: Run the first batch manually**

In Supabase SQL Editor:

```sql
SELECT compute_user_scores();
```

Verify rows appear in `user_event_scores`:

```sql
SELECT COUNT(*) FROM user_event_scores;
SELECT * FROM user_event_scores LIMIT 5;
```

- [ ] **Step 4: Verify the API returns personalized results**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/recommendations
```

Expected: Response with `source: "personalized"` and scored events.
