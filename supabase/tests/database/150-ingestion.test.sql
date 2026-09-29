-- M3 P1-07: the webhook delivery log. Only the service-role edge function
-- writes it; only an admin cookie session reads it; its checks keep payload
-- text out (a short snake_case error code and counts only).
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id,email) VALUES
('00000000-0000-4000-8000-000000015001','m3-ingest-admin@example.invalid'),
('00000000-0000-4000-8000-000000015002','m3-ingest-student@example.invalid');
INSERT INTO public.users(id,email,name,roles,onboarding_completed) VALUES
('00000000-0000-4000-8000-000000015001','m3-ingest-admin@example.invalid','M3 ingest admin','{user,admin}',true),
('00000000-0000-4000-8000-000000015002','m3-ingest-student@example.invalid','M3 ingest student','{user}',true);
INSERT INTO public.ingestion_deliveries(id,producer,outcome,event_count,inserted) VALUES
('00000000-0000-4000-8000-000000015011','instagram-apify@1','succeeded',1,1);
INSERT INTO public.events(id,title,start_date,end_date,status,source,image_url) VALUES
('00000000-0000-4000-8000-000000015021','M3 ingest event','2031-01-01T18:00:00Z','2031-01-01T20:00:00Z','approved','instagram','https://scontent.cdninstagram.com/v/a.jpg');

SELECT has_index('public','ingestion_deliveries','ingestion_deliveries_received','deliveries are indexed by received_at');
SELECT is((SELECT public FROM storage.buckets WHERE id='event-images'),true,'the event-images bucket exists and is public');

SELECT tests.act_as_anon();
SELECT throws_ok('SELECT id FROM public.ingestion_deliveries','42501',NULL,'anonymous cannot read the delivery log');
SELECT throws_ok($$INSERT INTO public.ingestion_deliveries(producer,outcome,event_count) VALUES('forged','succeeded',0)$$,'42501',NULL,'anonymous cannot insert a delivery');

SELECT tests.act_as('00000000-0000-4000-8000-000000015002');
SELECT is((SELECT count(*)::int FROM public.ingestion_deliveries),0,'a student sees no deliveries');
SELECT throws_ok($$INSERT INTO public.ingestion_deliveries(producer,outcome,event_count) VALUES('forged','succeeded',0)$$,'42501',NULL,'a student cannot insert a delivery');

SELECT tests.act_as('00000000-0000-4000-8000-000000015001');
SELECT ok((SELECT count(*)::int FROM public.ingestion_deliveries)>=1,'an admin cookie session reads the delivery log');
SELECT throws_ok($$INSERT INTO public.ingestion_deliveries(producer,outcome,event_count) VALUES('forged','succeeded',0)$$,'42501',NULL,'an admin cookie session cannot insert a delivery');

SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;
SELECT lives_ok($$INSERT INTO public.ingestion_deliveries(producer,run_id,outcome,event_count,items_seen,error_code) VALUES('instagram-apify@1',gen_random_uuid(),'failed',0,0,'apify_http_401')$$,'the service role records a failed run with a code');
SELECT throws_ok($$INSERT INTO public.ingestion_deliveries(producer,outcome,event_count,error_code) VALUES('instagram-apify@1','failed',0,'Bad Code')$$,'23514',NULL,'an error code outside the snake_case pattern is refused');
SELECT throws_ok($$INSERT INTO public.ingestion_deliveries(producer,outcome,event_count) VALUES('Not A Producer!','failed',0)$$,'23514',NULL,'a producer outside the pattern is refused');
SELECT throws_ok($$INSERT INTO public.ingestion_deliveries(producer,outcome,event_count) VALUES('instagram-apify@1','exploded',0)$$,'23514',NULL,'an unknown outcome is refused');
SELECT throws_ok($$INSERT INTO public.ingestion_deliveries(producer,outcome,event_count) VALUES('instagram-apify@1','succeeded',-1)$$,'23514',NULL,'a negative event count is refused');
-- Task 14: image persistence rewrites image_url with the service role; the
-- moderated-update guard applies only to anon/authenticated.
SELECT lives_ok($$UPDATE public.events SET image_url=NULL WHERE id='00000000-0000-4000-8000-000000015021'$$,'the service role may clear an expired ingested image on an approved event');
SELECT is((SELECT image_url FROM public.events WHERE id='00000000-0000-4000-8000-000000015021'),NULL,'the cleared image_url is stored');

SELECT * FROM finish();
ROLLBACK;
