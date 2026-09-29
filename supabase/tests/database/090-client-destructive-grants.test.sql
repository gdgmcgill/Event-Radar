BEGIN;
SELECT plan(10);
INSERT INTO public.users(id, email, name) VALUES
 ('00000000-0000-4000-8000-000000009001', 'm0-grants@example.invalid', 'M0 grants');
SELECT tests.act_as('00000000-0000-4000-8000-000000009001');
SELECT throws_ok($$UPDATE public.users SET onboarding_completed=true
 WHERE id='00000000-0000-4000-8000-000000009001'$$, '42501', NULL,
 'client cannot bypass onboarding via Data API');
SELECT throws_ok($$DELETE FROM public.users WHERE id='00000000-0000-4000-8000-000000009001'$$,
 '42501', NULL, 'client cannot delete its profile and bypass its ban state');
SELECT throws_ok('TRUNCATE public.notifications', '42501', NULL, 'authenticated cannot bypass RLS with TRUNCATE');
SELECT results_eq($$UPDATE public.users SET name='M0 edited' WHERE id='00000000-0000-4000-8000-000000009001' RETURNING name$$,
 ARRAY['M0 edited'], 'ordinary self-profile update still affects exactly its row');
SELECT tests.act_as_anon();
SELECT throws_ok('TRUNCATE public.events CASCADE', '42501', NULL, 'anonymous cannot destroy public data');
SELECT tests.act_as_owner();
SELECT is((SELECT count(*)::int FROM information_schema.role_table_grants
 WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated')
 AND privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER')), 0,
 'all current public tables withhold destructive client privileges');
SELECT is((SELECT string_agg(column_name::text, ',' ORDER BY column_name)::text
 FROM information_schema.column_privileges
 WHERE table_schema='public' AND table_name='users' AND grantee='authenticated' AND privilege_type='UPDATE'),
 'avatar_url,banner_url,faculty,inferred_tags,interest_tags,name,program,pronouns,updated_at,visibility,year'::text,
 'the complete client UPDATE column set is pinned, P1-02 optional program included; onboarding and affiliation remain absent');
SET LOCAL ROLE service_role;
SELECT results_eq($$UPDATE public.users SET onboarding_completed=true
 WHERE id='00000000-0000-4000-8000-000000009001' RETURNING id$$,
 ARRAY['00000000-0000-4000-8000-000000009001'::uuid], 'authorized server transition changes exactly one profile');
SELECT is((SELECT onboarding_completed FROM public.users WHERE id='00000000-0000-4000-8000-000000009001'), true,
 'server transition persisted');
SELECT tests.act_as_owner();
SELECT is((SELECT count(*)::int FROM public.users WHERE id='00000000-0000-4000-8000-000000009001'),1,'refused deletion preserved the profile');
SELECT * FROM finish();
ROLLBACK;
