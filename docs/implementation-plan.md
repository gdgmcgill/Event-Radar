# Uni-Verse Production Implementation Plan

**Date:** 2026-02-22
**Status:** Synthesized from 4-agent team analysis
**Source docs:** `event-classification.md`, `recommendation-engine.md`, `integration-pipeline.md`, `devils-advocate-review.md`

---

## Executive Summary

Four specialist agents analyzed the Uni-Verse codebase and converged on key decisions:

1. **Event classification**: Regex/heuristic classifier (not LLM) with 7 weighted signals and confidence scoring. Already implemented in `src/lib/classifier.ts` with 31 passing tests.
2. **Recommendations**: Enhance existing TypeScript k-means into a hybrid engine (content + collaborative + popularity scoring). Drop the 3-save cold-start gate. Already implemented in `src/app/api/recommendations/route.ts`.
3. **Pipeline**: Vercel Cron -> Apify -> classifier -> existing webhook -> pending -> admin -> events. 12 gaps identified with concrete fixes.
4. **Devil's advocate**: System is over-engineered for MVP scale. Archive Python/Flask services. Consider deferring Instagram scraping to Phase 2 in favor of club self-submission.

---

## Strategic Decision: MVP Scope

The critic raised a fundamental question: **should Instagram scraping be in the MVP?**

### Option A: Scraping-First (Integrator's plan)
- Build full pipeline: cron -> Apify -> classify -> pending -> approve
- More automated content acquisition
- Higher complexity, ~4 weeks to ship
- Risk: Instagram ToS, Apify cost ($49/mo), 24-48h latency from post to visibility

### Option B: Submission-First (Critic's plan)
- Club self-submission forms as primary content source
- Add scraping in Phase 2 after validating user demand
- Simpler, ~2 weeks to ship
- Risk: depends on clubs submitting events manually

### Recommended: Option B first, then Option A

**Phase 1 (2 weeks):** Launch with club submission + improved recommendations. The classifier code is already built and tested — it's ready when scraping is added.

**Phase 2 (2 weeks after launch):** Add scraping pipeline using the classifier and pipeline code that's already written.

This gets the product in students' hands faster while the scraping infrastructure matures.

---

## Phase 1: Launch-Ready MVP (Weeks 1-2)

### 1.1 Promote Tag-Based Recommendations as Primary
**Priority:** P0 | **Effort:** 2-3 hours | **Risk:** Low

The recommender agent already implemented this:
- **File:** `src/app/api/recommendations/route.ts` — hybrid scoring: `0.45 * content + 0.40 * collaborative + 0.15 * popularity`
- **File:** `src/app/page.tsx` — cold-start gate lowered from 3 saves to "has interest_tags OR 1+ saves"
- Parallel Supabase fetches via `Promise.all`
- Cosine similarity for content matching (better than Euclidean for sparse tag vectors)

**Action items:**
- [ ] Verify the recommender's changes compile and pass lint
- [ ] Test with real Supabase data (users with various interest_tags + save counts)
- [ ] Confirm RecommendedEventsSection still renders correctly

### 1.2 Optimize Recommendation Query Performance
**Priority:** P0 | **Effort:** 2 hours | **Risk:** Low

The critic correctly identified that the recommendation endpoint fetches ALL users, ALL saved_events, and ALL events on every request. For MVP this is fine, but we should add basic guardrails:

**Action items:**
- [ ] Add `.limit()` to user and saved_events queries (cap at 1000 users, 5000 saves)
- [ ] Consider a SQL-based fallback for the simple tag-matching case:
  ```sql
  SELECT e.* FROM events e
  WHERE e.tags && $1  -- user's interest tags
  AND e.start_date > NOW() AND e.status = 'approved'
  ORDER BY (SELECT COUNT(*) FROM saved_events se WHERE se.event_id = e.id) DESC
  LIMIT 20;
  ```

### 1.3 Build Club Event Submission Form
**Priority:** P0 | **Effort:** 1-2 days | **Risk:** Low

The existing `/create-event` page allows authenticated users to submit events. Extend this or create a streamlined version for club representatives:

**Action items:**
- [ ] Verify existing `POST /api/events/create` handles all needed fields
- [ ] Add a "Submit as Club" option that associates the event with a `club_id`
- [ ] Ensure submitted events go to `status: 'pending'` (already does this)
- [ ] Add club verification (simple: check if user email matches a known club admin list)

### 1.4 Wire Up Email Reminders
**Priority:** P1 | **Effort:** 1 day | **Risk:** Low

The cron route exists at `src/app/api/cron/send-reminders/route.ts`.

**Action items:**
- [ ] Verify the reminder route works with Supabase SMTP
- [ ] Configure Vercel Cron to trigger daily (this is the one cron job for the Hobby plan)
- [ ] Test with real saved events

### 1.5 Archive Unused Code
**Priority:** P1 | **Effort:** 30 minutes | **Risk:** None

**Action items:**
- [ ] Archive `AI/` directory (move to `_archived/AI/` or delete with git history preserved)
- [ ] Archive `backend/` directory (legacy Flask cosine similarity)
- [ ] Remove or comment the `TODO(AS-6)` in `/api/recommendations/sync/route.ts` — mark as "deferred to Phase 2"
- [ ] Keep sync route stub for future use but add clear documentation

### 1.6 Decide on One Recommendation Approach
**Priority:** P0 | **Effort:** 1 hour | **Risk:** None

**Decision:** The hybrid TypeScript engine is the single recommendation system.

**Action items:**
- [ ] Document this decision in CLAUDE.md or a DECISIONS.md file
- [ ] Ensure the archived Python service is clearly marked as experimental/future

---

## Phase 2: Scraping Pipeline (Weeks 3-4)

### 2.1 Database Migration for Source Tracking
**Priority:** P0 | **Effort:** 0.5 days | **Risk:** Low

**New file:** `supabase/migrations/008_event_source_tracking.sql`

```sql
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS raw_data JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_content_hash ON public.events(content_hash) WHERE content_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.scrape_runs ( ... );  -- see integration-pipeline.md
```

### 2.2 Deploy Classifier (Already Built)
**Priority:** P0 | **Effort:** 0.5 days (integration only) | **Risk:** Low

The classifier is already implemented and tested:
- `src/lib/classifier.ts` — 7-signal heuristic classifier with confidence scoring
- `src/lib/classifier-pipeline.ts` — Apify output normalization + HMAC webhook integration
- `src/lib/classifier.test.ts` — 31 passing tests

**Action items:**
- [ ] Verify classifier tests pass in CI
- [ ] Integrate with the cron route (next item)

### 2.3 Build Scraper Cron Route
**Priority:** P0 | **Effort:** 2 days | **Risk:** Medium (Apify dependency)

**New file:** `src/app/api/cron/scrape-instagram/route.ts`

Flow: Vercel Cron -> query clubs table for Instagram handles -> call Apify actor -> classify posts -> POST to events-webhook -> log to scrape_runs

**Action items:**
- [ ] Implement cron route with CRON_SECRET verification
- [ ] Integrate Apify API client (use Apify MCP or direct API)
- [ ] Wire classifier output to webhook payload format
- [ ] Add deduplication via content_hash
- [ ] Log results to scrape_runs table
- [ ] Set confidence threshold: >= 0.70 auto-pending, 0.40-0.69 flagged, < 0.40 discarded

### 2.4 Configure Vercel Cron
**Priority:** P1 | **Effort:** 0.5 days | **Risk:** Low

**Modify:** `vercel.json`

Note: Hobby plan = 1 daily cron job. May need Pro plan ($20/mo) for multiple crons. Alternative: use Apify's built-in scheduling + webhook callback (no Vercel cron needed).

### 2.5 Add Deduplication to Webhook
**Priority:** P1 | **Effort:** 0.5 days | **Risk:** Low

**Modify:** `supabase/functions/events-webhook/index.ts`

SHA-256 hash of `title + date + organizer`, checked before insert. See integration-pipeline.md section 3.7.

### 2.6 Post-Approval Hooks
**Priority:** P1 | **Effort:** 0.5 days | **Risk:** Low

**Modify:** `src/app/api/admin/events/[id]/status/route.ts`

When status -> 'approved': initialize popularity score via `update_event_popularity` RPC. Recommendations auto-include new approved events (k-means queries at request time).

### 2.7 Populate Club Instagram Handles
**Priority:** P1 | **Effort:** 0.5 days | **Risk:** Low

The `clubs` table already has `instagram_handle`. Populate with the 20-30 target accounts from the PRD.

---

## Phase 3: Observability (Week 5)

| Task | Effort | Priority |
|------|--------|----------|
| Admin dashboard: scrape run monitoring panel | 1 day | P2 |
| Admin dashboard: confidence score display in pending queue | 0.5 day | P2 |
| `GET /api/admin/scrape-runs` endpoint | 0.5 day | P2 |
| Alert if pending events > 24h old | 0.5 day | P2 |
| Sentry integration for cron route errors | 0.5 day | P3 |

---

## Phase 4: Optimization (Week 6+, data-dependent)

| Task | Trigger | Effort |
|------|---------|--------|
| Pre-compute recommendations to `user_recommendations` table | >500 users | 2 days |
| Collaborative filtering: "users who saved X also saved Y" | >1000 saves | 2 days |
| LLM fallback for manual_review tier (0.40-0.69 confidence) | Budget approval | 1 day |
| Semantic search with Supabase pgvector | >500 events | 3 days |
| Auto-approve high-confidence scraped events (>0.90) | Classifier accuracy data | 1 day |
| Scoring weight optimization via logistic regression | Click-through data | 2 days |
| Two-tower model training | >10K interactions | 2 weeks |

---

## What Was Built by the Agents

| File | Agent | Status |
|------|-------|--------|
| `src/lib/classifier.ts` | classifier | New — 7-signal event classifier |
| `src/lib/classifier-pipeline.ts` | classifier | New — Apify->webhook pipeline integration |
| `src/lib/classifier.test.ts` | classifier | New — 31 unit tests |
| `src/app/api/recommendations/route.ts` | recommender | Modified — hybrid scoring engine |
| `src/app/page.tsx` | recommender | Modified — cold-start gate lowered |
| `docs/event-classification.md` | classifier | Design document |
| `docs/recommendation-engine.md` | recommender | Decision + analysis document |
| `docs/integration-pipeline.md` | integrator | Architecture + gap analysis |
| `docs/devils-advocate-review.md` | critic | Critique + simplification proposal |

---

## Open Questions (Require Team Input)

1. **Vercel plan tier?** Hobby (1 daily cron) vs Pro ($20/mo, 40 crons). Determines scheduling strategy.
2. **Apify budget?** $49/mo Starter plan sufficient for 20-30 accounts. Currently configured?
3. **How many events in the DB right now?** If <50, focus on content acquisition before recommendation tuning.
4. **Who are the admins?** How many people will review the pending queue during orientation week?
5. **Has club self-submission been validated?** PRD assumes clubs will submit if <2 minutes. Tested?
6. **Instagram image URL expiration?** CDN-signed URLs expire. Re-host to Supabase Storage?
7. **Flask backend used anywhere?** If not, safe to delete entirely.
8. **`organizer` and `category` columns in live schema?** Webhook code writes to them but they're not in the initial migration. Need to verify.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Instagram scraping blocked/ToS violation | Medium | High | Phase 2 only; club submission as primary source |
| Over-engineering delays launch | High | High | Phase 1 cuts scope to essentials |
| Admin approval bottleneck (orientation week) | Medium | Medium | Auto-approve from verified clubs; confidence sorting |
| k-means statistically weak at <100 users | High | Low | Hybrid scoring with content-based fallback |
| Python ML service hosting cost | Low | Low | Deferred; everything runs in TypeScript |
| Apify cost exceeds budget | Low | Medium | Start with 10 accounts, scale up |
