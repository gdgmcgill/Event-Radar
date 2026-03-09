-- =============================================================================
-- BENCHMARK: events table query performance
-- Paste this into the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- HOW TO USE
-- ──────────
--   Round 1 — WITH the new indexes applied:
--     1. Run supabase/migrations/20260307000001_events_query_performance_indexes.sql
--        (or `supabase db push` if using the CLI)
--     2. Run THIS script → copy / screenshot the full output ("WITH indexes")
--
--   Round 2 — WITHOUT the new indexes:
--     3. Run supabase/scripts/drop_events_performance_indexes.sql
--     4. Run THIS script again → copy the output ("WITHOUT indexes")
--
--   Round 3 — restore and confirm:
--     5. Re-apply the migration to restore indexes
--     6. Optionally run once more to confirm you're back to the faster plan
--
-- WHAT TO LOOK FOR
-- ────────────────
--   • "Index Scan" / "Bitmap Index Scan" → index is being used  ✓
--   • "Seq Scan"                          → full table scan      ✗
--   • "actual time=X..Y" at the top node → total execution time (ms)
--   • "Buffers: shared hit=N read=M"     → cache hits vs disk reads
--
-- TIP: Run each EXPLAIN block 2–3 times and compare the second/third run —
--      the first run can be slower if pages aren't in the buffer cache yet.
-- =============================================================================


-- ── STEP 0: confirm which indexes are currently active ───────────────────────
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;


-- ── Q1  Main public events listing (/api/events, no extra filters) ────────────
--  Pattern: WHERE status = 'approved' ORDER BY start_date LIMIT 50
--  Index expected: idx_events_status_start_date  OR  idx_events_approved_start_date
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, start_date, end_date, location,
       club_id, tags, image_url, created_at, updated_at, status
FROM public.events
WHERE status = 'approved'
ORDER BY start_date ASC
LIMIT 50;


-- ── Q2  Public listing with date range filter (/api/events?dateFrom=&dateTo=) ─
--  Pattern: WHERE status = 'approved' AND start_date BETWEEN x AND y
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, start_date, end_date, location,
       club_id, tags, image_url, created_at, updated_at, status
FROM public.events
WHERE status = 'approved'
  AND start_date >= NOW()
  AND start_date <= NOW() + INTERVAL '90 days'
ORDER BY start_date ASC
LIMIT 50;


-- ── Q3  Popular / upcoming events (/api/events/popular) ──────────────────────
--  Pattern: WHERE status = 'approved' AND start_date >= NOW() ORDER BY start_date LIMIT 200
--  Index expected: idx_events_approved_start_date  (partial index, smallest scan)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, start_date, end_date, location,
       club_id, tags, image_url, status, created_at, updated_at
FROM public.events
WHERE status = 'approved'
  AND start_date >= NOW()
ORDER BY start_date ASC
LIMIT 200;


-- ── Q4  Happening-now window (/api/events/happening-now) ─────────────────────
--  Pattern: WHERE status = 'approved' AND start_date BETWEEN now AND now+2h LIMIT 10
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, start_date, end_date, location,
       club_id, tags, image_url, status, created_at, updated_at
FROM public.events
WHERE status = 'approved'
  AND start_date >= NOW()
  AND start_date <= NOW() + INTERVAL '2 hours'
ORDER BY start_date ASC
LIMIT 10;


-- ── Q5  Full-text search on title + description (/api/events?search=mcgill) ──
--  Pattern: ILIKE '%term%' on both columns
--  Index expected: idx_events_title_trgm + idx_events_description_trgm (GIN trigram)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, start_date, end_date, location,
       club_id, tags, image_url, created_at, updated_at, status
FROM public.events
WHERE status = 'approved'
  AND (title ILIKE '%mcgill%' OR description ILIKE '%mcgill%')
ORDER BY start_date ASC
LIMIT 50;


-- ── Q6  Tag filter (/api/events?tags=academic) ───────────────────────────────
--  Pattern: tags && ARRAY[...]  (GIN overlap operator)
--  Index expected: idx_events_tags (GIN, already existed pre-migration)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, start_date, end_date, location,
       club_id, tags, image_url, created_at, updated_at, status
FROM public.events
WHERE status = 'approved'
  AND tags && ARRAY['academic']::text[]
ORDER BY start_date ASC
LIMIT 50;


-- ── Q7  Club event listing (/api/clubs/[id]/events) ──────────────────────────
--  Pattern: WHERE club_id = ? AND status = 'approved' ORDER BY start_date
--  Index expected: idx_events_club_id_status_start_date
--  Uses the first available club_id found in the table as a realistic value.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, start_date, end_date, location,
       club_id, tags, image_url, created_at, updated_at, status
FROM public.events
WHERE club_id = (
    SELECT club_id FROM public.events WHERE club_id IS NOT NULL LIMIT 1
)
  AND status = 'approved'
ORDER BY start_date ASC;


-- ── Q8  Admin moderation queue — pending events (/admin/events?status=pending) 
--  Pattern: WHERE status = 'pending' ORDER BY created_at DESC
--  Index expected: idx_events_status_created_at
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.events
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 50;


-- ── Q9  Admin events list — all statuses (/admin/events, default view) ────────
--  Pattern: no status filter, ORDER BY created_at DESC
--  Index expected: idx_events_created_at
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.events
ORDER BY created_at DESC
LIMIT 50;


-- ── Q10 Admin title search (/admin/events?search=term) ───────────────────────
--  Pattern: title ILIKE '%term%' (no status filter, admin sees all)
--  Index expected: idx_events_title_trgm
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.events
WHERE title ILIKE '%festival%'
ORDER BY created_at DESC
LIMIT 50;


-- ── Q11 Admin analytics — events created in last 30 days ─────────────────────
--  Pattern: WHERE created_at >= now - 30d ORDER BY created_at
--  Index expected: idx_events_created_at
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT created_at, tags, status
FROM public.events
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at ASC;


-- ── Q12 Creator / user profile events ────────────────────────────────────────
--  Pattern: WHERE created_by = ? AND status = 'approved'
--  Index expected: idx_events_created_by_status (partial, created_by IS NOT NULL)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, start_date, status
FROM public.events
WHERE created_by = (
    SELECT created_by FROM public.events WHERE created_by IS NOT NULL LIMIT 1
)
  AND status = 'approved';


-- ── STEP LAST: table + all index sizes ───────────────────────────────────────
--  Compare total index overhead between WITH / WITHOUT runs.
SELECT
    c.relname                                     AS name,
    pg_size_pretty(pg_relation_size(c.oid))       AS size,
    CASE c.relkind WHEN 'r' THEN 'table' ELSE 'index' END AS type
FROM pg_class c
WHERE c.relname = 'events'
   OR c.relname LIKE 'idx_events_%'
ORDER BY c.relkind DESC, c.relname;
