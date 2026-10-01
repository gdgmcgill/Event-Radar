BEGIN;
SELECT plan(5);
INSERT INTO public.users(id,email,name,roles) VALUES('00000000-0000-4000-8000-000000012501','m2-pagination@example.invalid','M2 pagination','{user,admin}');
INSERT INTO public.opportunities(id,slug,listing_type,title,description,organization,work_mode,relevance_scope,status,published_at,deadline_precision,review_at,created_by,updated_by)
SELECT ('00000000-0000-4000-8000-00000001251'||n)::uuid,'m2-page-'||n,'job','M2 pagination fixture','Details','Pagination org','remote','cross_campus','published','2026-01-01','none','2032-01-01T15:00Z','00000000-0000-4000-8000-000000012501','00000000-0000-4000-8000-000000012501' FROM generate_series(1,3) n;
INSERT INTO public.events(id,title,start_date,end_date,status,created_at,organizer) VALUES
('00000000-0000-4000-8000-000000012521','M2 pagination fixture event1','2032-01-01T10:00Z','2032-01-01T12:00Z','approved','2026-01-01','Pagination org'),
('00000000-0000-4000-8000-000000012522','M2 pagination fixture event2','2032-01-01T10:00Z','2032-01-01T12:00Z','approved','2026-01-01','Pagination org');
-- A listing published after the first page's as_of cannot enter later pages.
INSERT INTO public.opportunities(id,slug,listing_type,title,description,organization,work_mode,relevance_scope,status,published_at,deadline_precision,review_at,created_by,updated_by) VALUES
('00000000-0000-4000-8000-000000012519','m2-page-later','job','M2 pagination fixture later','Details','Pagination org','remote','cross_campus','published','2030-01-02','none','2032-01-01T15:00Z','00000000-0000-4000-8000-000000012501','00000000-0000-4000-8000-000000012501');
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-01','{"q":"M2 pagination fixture"}',NULL,50)),5,'fixed as_of excludes newly published rows');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-02','{"q":"M2 pagination fixture"}',NULL,50)),6,'a new browse session sees new publication');
WITH RECURSIVE pages(n,items) AS (
 SELECT 1,ARRAY(SELECT item FROM public.query_discovery('2030-01-01','{"q":"M2 pagination fixture"}',NULL,2) item)
 UNION ALL
 SELECT n+1,ARRAY(SELECT item FROM public.query_discovery('2030-01-01','{"q":"M2 pagination fixture"}',jsonb_build_object('priority',items[cardinality(items)]->'editorial_priority','actionable_at',items[cardinality(items)]->'actionable_at','published_at',items[cardinality(items)]->'published_at','kind',items[cardinality(items)]->'kind','id',items[cardinality(items)]->'id'),2) item)
 FROM pages WHERE cardinality(items)=2 AND n<4
), flattened AS(SELECT n,unnest(items) item FROM pages)
SELECT is((SELECT count(DISTINCT(item->>'kind',item->>'id'))::int FROM flattened),5,'equal dates and null deadlines paginate all identities without omissions');
WITH first_page AS(SELECT item FROM public.query_discovery('2030-01-01','{"q":"M2 pagination fixture"}',NULL,2) item)
SELECT is((SELECT count(*)::int FROM first_page WHERE item->>'kind'='event'),2,'kind tie-breaker orders legacy events before equal-date opportunity identities');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2032-01-01T15:00Z','{"q":"M2 pagination fixture"}',NULL,50)),2,'review-only opportunities close exactly at review time while ongoing events remain');
SELECT * FROM finish();
ROLLBACK;
