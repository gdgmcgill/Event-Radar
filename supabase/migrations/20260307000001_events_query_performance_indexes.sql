-- Migration: events_query_performance_indexes
-- Adds composite and partial indexes on the events table to eliminate
-- sequential scans from the most frequent query patterns.
--
-- Existing single-column indexes (from 001_initial_schema):
--   idx_events_start_date  (start_date)
--   idx_events_status      (status)
--   idx_events_club_id     (club_id)
--   idx_events_tags        GIN(tags)

-- ─── 1. Composite: status + start_date ─────────────────────────────────────
-- Covers the dominant access pattern: WHERE status = 'approved' … ORDER BY start_date
-- Used by: /api/events, /api/events/popular, /api/events/happening-now,
--          /api/events/export, /api/clubs/[id]/events, /sitemap, etc.
CREATE INDEX IF NOT EXISTS idx_events_status_start_date
  ON public.events (status, start_date);

-- ─── 2. Partial index: approved events by start_date ────────────────────────
-- Narrower than #1 — skips non-approved rows entirely so the planner can use
-- a smaller, denser index for the most common public-facing queries.
CREATE INDEX IF NOT EXISTS idx_events_approved_start_date
  ON public.events (start_date)
  WHERE status = 'approved';

-- ─── 3. Composite: club_id + status + start_date ───────────────────────────
-- Covers club event listings: WHERE club_id = ? AND status = 'approved'
-- ORDER BY start_date.  Replaces the need to merge idx_events_club_id + idx_events_status.
CREATE INDEX IF NOT EXISTS idx_events_club_id_status_start_date
  ON public.events (club_id, status, start_date);

-- ─── 4. Index on created_by ────────────────────────────────────────────────
-- User profile pages count events: WHERE created_by = ? AND status = 'approved'.
-- No index on created_by existed before this migration.
CREATE INDEX IF NOT EXISTS idx_events_created_by
  ON public.events (created_by)
  WHERE created_by IS NOT NULL;

-- ─── 5. Composite: created_by + status ─────────────────────────────────────
-- Tighter fit for the profile count query.
CREATE INDEX IF NOT EXISTS idx_events_created_by_status
  ON public.events (created_by, status)
  WHERE created_by IS NOT NULL;

-- ─── 6. Index on created_at ────────────────────────────────────────────────
-- Admin analytics filters: WHERE created_at >= ? ORDER BY created_at.
CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON public.events (created_at);

-- ─── 7. Trigram indexes for ILIKE text search ──────────────────────────────
-- Multiple endpoints search: title ILIKE '%term%' / description ILIKE '%term%'.
-- Without trigram indexes these are full sequential scans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_events_title_trgm
  ON public.events USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_description_trgm
  ON public.events USING GIN (description gin_trgm_ops);

-- ─── 8. Composite: status + created_at ─────────────────────────────────────
-- Admin dashboard: WHERE status = ? ORDER BY created_at DESC (pending queue).
-- Moderation page: WHERE status = 'pending' ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_events_status_created_at
  ON public.events (status, created_at);
