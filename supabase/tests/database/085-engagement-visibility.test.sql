-- M0 / DI-87 and DI-91: live invoker aggregation and strict visibility.
BEGIN;
SELECT plan(15);

INSERT INTO auth.users (id,email) VALUES
 ('00000000-0000-4000-8000-000000008501','m0-engagement-a@example.invalid'),
 ('00000000-0000-4000-8000-000000008502','m0-engagement-b@example.invalid'),
 ('00000000-0000-4000-8000-000000008503','m0-engagement-empty@example.invalid');
INSERT INTO public.users (id,email,visibility) VALUES
 ('00000000-0000-4000-8000-000000008501','m0-engagement-a@example.invalid','public'),
 ('00000000-0000-4000-8000-000000008502','m0-engagement-b@example.invalid','private');
INSERT INTO public.events (id,title,start_date,end_date,status,tags) VALUES
 ('00000000-0000-4000-8000-0000000085e1','Engagement fixture','2036-06-01T16:00:00Z','2036-06-01T18:00:00Z','approved',ARRAY['tech']);
INSERT INTO public.user_interactions (user_id,event_id,interaction_type,created_at) VALUES
 ('00000000-0000-4000-8000-000000008501','00000000-0000-4000-8000-0000000085e1','view','2026-06-01T16:00:00Z'),
 ('00000000-0000-4000-8000-000000008501','00000000-0000-4000-8000-0000000085e1','click','2026-06-01T17:00:00Z'),
 ('00000000-0000-4000-8000-000000008502','00000000-0000-4000-8000-0000000085e1','view','2026-06-01T18:00:00Z');

SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.get_user_engagement()'::regprocedure), 'engagement is SECURITY INVOKER');
SELECT ok(NOT has_function_privilege('anon','public.get_user_engagement()','EXECUTE'), 'anonymous execute is revoked');
SELECT ok(has_function_privilege('authenticated','public.get_user_engagement()','EXECUTE'), 'authenticated can execute');
SELECT tests.act_as('00000000-0000-4000-8000-000000008501');
SELECT is(public.get_user_engagement()->>'user_id','00000000-0000-4000-8000-000000008501','summary subject comes from auth.uid');
SELECT is((public.get_user_engagement()->>'total_views')::integer,1,'other user view is excluded');
SELECT is((public.get_user_engagement()->>'total_clicks')::integer,1,'own click counted');
SELECT is(public.get_user_engagement()->'favorite_tags','[{"tag":"tech","count":1}]'::jsonb,'high-intent tags aggregated');
SELECT throws_ok($q$UPDATE public.users SET visibility='friends' WHERE id='00000000-0000-4000-8000-000000008501'$q$, '23514', NULL, 'unsupported visibility cannot persist');
SELECT throws_ok($q$UPDATE public.users SET visibility=NULL WHERE id='00000000-0000-4000-8000-000000008501'$q$, '23502', NULL, 'NULL visibility cannot persist');
SELECT lives_ok($q$UPDATE public.users SET visibility='private' WHERE id='00000000-0000-4000-8000-000000008501'$q$, 'valid private visibility accepted');
SELECT tests.act_as('00000000-0000-4000-8000-000000008502');
SELECT is((public.get_user_engagement()->>'total_clicks')::integer,0,'second user cannot read first user clicks');
SELECT tests.act_as('00000000-0000-4000-8000-000000008503');
SELECT is((public.get_user_engagement()->>'total_views')::integer,0,'empty subject receives zero views');
SELECT is(public.get_user_engagement()->'favorite_tags','[]'::jsonb,'empty subject receives no favorite tags');
SELECT is(public.get_user_engagement()->'last_active_at','null'::jsonb,'empty subject has no last-active instant');
SELECT tests.act_as_anon();
SELECT throws_ok('SELECT public.get_user_engagement()', '42501', NULL, 'anonymous RPC call refused');
SELECT * FROM finish();
ROLLBACK;
