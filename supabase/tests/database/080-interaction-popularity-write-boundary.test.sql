-- M0 F-009/F-010. Each deny uses a real client role. Positive service writes
-- execute the actual invoker trigger and assert the resulting aggregates.
BEGIN;
SELECT plan(33);

INSERT INTO public.users (id, email, name, roles) VALUES
  ('00000000-0000-4000-8000-000000008001', 'm0-interaction-a@example.invalid', 'M0 A', '{user}'),
  ('00000000-0000-4000-8000-000000008002', 'm0-interaction-b@example.invalid', 'M0 B', '{user}');
INSERT INTO public.events (id, title, start_date, end_date, status) VALUES
  ('00000000-0000-4000-8000-0000000080e1', 'M0 tracked event', '2031-01-01T18:00:00Z', '2031-01-01T20:00:00Z', 'approved');

SET LOCAL ROLE service_role;
WITH inserted AS (
  INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES (NULL,'00000000-0000-4000-8000-0000000080e1','view') RETURNING id
) SELECT is((SELECT count(*)::integer FROM inserted), 1, 'server records an anonymous interaction');
WITH inserted AS (
  INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES ('00000000-0000-4000-8000-000000008001','00000000-0000-4000-8000-0000000080e1','click') RETURNING id
) SELECT is((SELECT count(*)::integer FROM inserted), 1, 'server records an authenticated interaction');
WITH inserted AS (
  INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES ('00000000-0000-4000-8000-000000008002','00000000-0000-4000-8000-0000000080e1','save') RETURNING id
) SELECT is((SELECT count(*)::integer FROM inserted), 1, 'server records a second participant');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE event_id='00000000-0000-4000-8000-0000000080e1'), 3, 'all server interactions persisted');
SELECT is((SELECT view_count FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'), 1, 'invoker trigger counted anonymous view');
SELECT is((SELECT click_count FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'), 1, 'invoker trigger counted click');
SELECT is((SELECT save_count FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'), 1, 'invoker trigger counted save');
SELECT is((SELECT unique_viewers FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'), 2, 'invoker sees both authenticated viewers');
SELECT is((SELECT popularity_score FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'), 8::double precision, 'weighted popularity recomputed across all callers');
SELECT is((SELECT trending_score FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'), 8::double precision, 'recent weighted trend recomputed');

SELECT tests.act_as_owner();
SELECT tests.act_as('00000000-0000-4000-8000-000000008001');
SELECT throws_ok($q$INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES ('00000000-0000-4000-8000-000000008001','00000000-0000-4000-8000-0000000080e1','save')$q$,
  '42501',NULL,'client cannot insert even its own interaction directly');
SELECT throws_ok($q$INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES ('00000000-0000-4000-8000-000000008002','00000000-0000-4000-8000-0000000080e1','save')$q$,
  '42501',NULL,'client cannot forge another user interaction');
SELECT throws_ok($q$INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES (NULL,'00000000-0000-4000-8000-0000000080e1','save')$q$,
  '42501',NULL,'client cannot bypass the writer with anonymous identity');
SELECT throws_ok($q$UPDATE public.user_interactions SET interaction_type='save'
  WHERE event_id='00000000-0000-4000-8000-0000000080e1'$q$,'42501',NULL,'client cannot rewrite interactions');
SELECT throws_ok($q$DELETE FROM public.user_interactions WHERE event_id='00000000-0000-4000-8000-0000000080e1'$q$,'42501',NULL,'client cannot delete interactions');
SELECT throws_ok('TRUNCATE public.user_interactions','42501',NULL,'client cannot truncate interactions');
SELECT throws_ok($q$INSERT INTO public.event_popularity_scores (event_id,popularity_score)
  VALUES ('00000000-0000-4000-8000-0000000080e1',999999)$q$,'42501',NULL,'client cannot insert arbitrary scores');
SELECT throws_ok($q$UPDATE public.event_popularity_scores SET popularity_score=999999
  WHERE event_id='00000000-0000-4000-8000-0000000080e1'$q$,'42501',NULL,'client cannot inflate popularity');
SELECT throws_ok($q$DELETE FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'$q$,'42501',NULL,'client cannot delete popularity');
SELECT throws_ok('TRUNCATE public.event_popularity_scores','42501',NULL,'client cannot truncate popularity');
SELECT throws_ok($q$SELECT public.update_event_popularity('00000000-0000-4000-8000-0000000080e1')$q$,'42501',NULL,'client cannot invoke a partial-RLS aggregate recompute');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE event_id='00000000-0000-4000-8000-0000000080e1'),1,'own interaction SELECT retained');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE user_id='00000000-0000-4000-8000-000000008002'),0,'other participant interaction remains private');

SELECT tests.act_as_anon();
SELECT throws_ok($q$INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES ('00000000-0000-4000-8000-000000008001','00000000-0000-4000-8000-0000000080e1','save')$q$,'42501',NULL,'anonymous cannot impersonate a user directly');
SELECT throws_ok($q$INSERT INTO public.user_interactions (user_id,event_id,interaction_type)
  VALUES (NULL,'00000000-0000-4000-8000-0000000080e1','save')$q$,'42501',NULL,'anonymous direct writes use the server boundary too');
SELECT throws_ok($q$UPDATE public.event_popularity_scores SET popularity_score=999999
  WHERE event_id='00000000-0000-4000-8000-0000000080e1'$q$,'42501',NULL,'anonymous cannot alter popularity');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE event_id='00000000-0000-4000-8000-0000000080e1'),0,'anonymous cannot read raw interactions');
SELECT is((SELECT popularity_score FROM public.event_popularity_scores WHERE event_id='00000000-0000-4000-8000-0000000080e1'),8::double precision,'public aggregate reads remain available and unmodified');

SELECT tests.act_as_owner();
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname='public' AND tablename='user_interactions' AND policyname='Anyone can insert interactions'),0,'permissive interaction INSERT policy removed');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname='public' AND tablename='event_popularity_scores' AND policyname='Authenticated users can update popularity scores'),0,'permissive popularity ALL policy removed');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.recalculate_on_interaction()'::regprocedure),'trigger remains security invoker');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.update_event_popularity(uuid)'::regprocedure),'recompute remains security invoker');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE event_id='00000000-0000-4000-8000-0000000080e1'),3,'all denied mutations left source data intact');
SELECT * FROM finish();
ROLLBACK;
