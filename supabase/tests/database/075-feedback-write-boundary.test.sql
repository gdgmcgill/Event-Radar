-- M0 / WR-07: direct Data API writes cannot forge experiment attribution.
-- Actual SQL role impersonation; the privileged writer is a capability control,
-- never used to claim that an ordinary caller passes an RLS policy.
BEGIN;
SELECT plan(12);

INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-4000-8000-000000007501', 'm0-feedback-a@example.invalid'),
       ('00000000-0000-4000-8000-000000007502', 'm0-feedback-b@example.invalid');
INSERT INTO public.recommendation_feedback
  (id, user_id, event_id, recommendation_rank, action)
VALUES
  ('00000000-0000-4000-8000-0000000075a1', '00000000-0000-4000-8000-000000007501',
   '00000000-0000-4000-8000-0000000075e1', 1, 'click'),
  ('00000000-0000-4000-8000-0000000075a2', '00000000-0000-4000-8000-000000007502',
   '00000000-0000-4000-8000-0000000075e1', 1, 'save');

SELECT tests.act_as('00000000-0000-4000-8000-000000007501');
SELECT throws_ok($q$INSERT INTO public.recommendation_feedback
  (user_id,event_id,recommendation_rank,action)
  VALUES ('00000000-0000-4000-8000-000000007501',
          '00000000-0000-4000-8000-0000000075e1',1,'click')$q$,
  '42501', NULL, 'student cannot bypass server attribution with a direct insert');
SELECT throws_ok($q$UPDATE public.recommendation_feedback SET action='save'
  WHERE id='00000000-0000-4000-8000-0000000075a1'$q$,
  '42501', NULL, 'student cannot rewrite feedback');
SELECT throws_ok($q$DELETE FROM public.recommendation_feedback
  WHERE id='00000000-0000-4000-8000-0000000075a1'$q$,
  '42501', NULL, 'student cannot erase feedback');
SELECT throws_ok('TRUNCATE public.recommendation_feedback', '42501', NULL,
  'student cannot bypass RLS with TRUNCATE');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback
  WHERE id='00000000-0000-4000-8000-0000000075a1'), 1, 'student reads own feedback');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback
  WHERE id='00000000-0000-4000-8000-0000000075a2'), 0, 'student cannot read another subject');

SELECT tests.act_as_anon();
SELECT throws_ok($q$INSERT INTO public.recommendation_feedback
  (user_id,event_id,recommendation_rank,action)
  VALUES ('00000000-0000-4000-8000-000000007501',
          '00000000-0000-4000-8000-0000000075e1',1,'click')$q$,
  '42501', NULL, 'anonymous insert is refused');
SELECT throws_ok('TRUNCATE public.recommendation_feedback', '42501', NULL,
  'anonymous truncate is refused');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback
  WHERE id IN ('00000000-0000-4000-8000-0000000075a1',
               '00000000-0000-4000-8000-0000000075a2')), 0, 'anonymous reads reveal no feedback');

SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;
WITH inserted AS (
  INSERT INTO public.recommendation_feedback (user_id,event_id,recommendation_rank,action)
  VALUES ('00000000-0000-4000-8000-000000007501',
          '00000000-0000-4000-8000-0000000075e1',1,'impression') RETURNING id
) SELECT is((SELECT count(*)::integer FROM inserted), 1,
  'server writer can persist authenticated feedback');
SELECT tests.act_as_owner();
SELECT ok(NOT has_table_privilege('authenticated','public.recommendation_feedback','INSERT'),
  'authenticated insert grant remains revoked');
SELECT ok(NOT has_table_privilege('anon','public.recommendation_feedback','INSERT'),
  'anon insert grant remains revoked');
SELECT * FROM finish();
ROLLBACK;
