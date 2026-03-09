-- =============================================================================
-- Drop only the indexes added by 20260307000001_events_query_performance_indexes
-- =============================================================================
-- Use this to simulate "before indexes" when benchmarking. After running
-- the benchmark, re-apply the migration to restore indexes:
--   supabase db push
-- or run the CREATE INDEX statements from 20260307000001 again.
-- =============================================================================

DROP INDEX IF EXISTS public.idx_events_status_created_at;
DROP INDEX IF EXISTS public.idx_events_description_trgm;
DROP INDEX IF EXISTS public.idx_events_title_trgm;
DROP INDEX IF EXISTS public.idx_events_created_at;
DROP INDEX IF EXISTS public.idx_events_created_by_status;
DROP INDEX IF EXISTS public.idx_events_created_by;
DROP INDEX IF EXISTS public.idx_events_club_id_status_start_date;
DROP INDEX IF EXISTS public.idx_events_approved_start_date;
DROP INDEX IF EXISTS public.idx_events_status_start_date;
