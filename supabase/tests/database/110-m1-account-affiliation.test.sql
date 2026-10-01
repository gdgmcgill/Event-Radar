BEGIN;
SELECT plan(16);
INSERT INTO public.users(id,email,name,roles,onboarding_completed) VALUES
('00000000-0000-4000-8000-000000001101','accounts-a@example.com','Accounts A',ARRAY['user']::public.user_role[],false),
('00000000-0000-4000-8000-000000001102','accounts-b@concordia.ca','Accounts B',ARRAY['user']::public.user_role[],true);
INSERT INTO public.universities(id,slug,name,city,active) VALUES
('00000000-0000-4000-8000-000000001103','inactive-test','Inactive test','Montréal',false);
SELECT tests.act_as_anon();
SELECT is((SELECT count(*)::int FROM public.universities),6,'anonymous sees the six active universities');
SELECT is((SELECT count(*)::int FROM public.universities WHERE slug='inactive-test'),0,'inactive university is not publicly readable');
SELECT throws_ok($$INSERT INTO public.universities(slug,name,city) VALUES('forged','Forged','Here')$$,'42501',NULL,'anonymous cannot create affiliation catalog entries');
SELECT tests.act_as('00000000-0000-4000-8000-000000001101');
SELECT is((SELECT count(*)::int FROM public.universities),6,'student may read active choices');
SELECT throws_ok($$UPDATE public.universities SET active=false WHERE slug='mcgill'$$,'42501',NULL,'student cannot administer universities');
SELECT throws_ok($$UPDATE public.users SET university_id='10000000-0000-4000-8000-000000000001' WHERE id='00000000-0000-4000-8000-000000001101'$$,'42501',NULL,'school/provenance changes use the validated self endpoint');
SELECT throws_ok($$UPDATE public.users SET affiliation_source='verified_email' WHERE id='00000000-0000-4000-8000-000000001101'$$,'42501',NULL,'student cannot forge verified-email provenance');
SELECT results_eq($$UPDATE public.users SET program='Computer Science' WHERE id='00000000-0000-4000-8000-000000001101' RETURNING program$$,ARRAY['Computer Science'],'optional program can be updated for self');
WITH changed AS (UPDATE public.users SET program='Forged' WHERE id='00000000-0000-4000-8000-000000001102' RETURNING id) SELECT is(count(*)::int,0,'program update cannot cross tenants') FROM changed;
SELECT tests.act_as_owner();
SELECT throws_ok($$UPDATE public.users SET university_id='10000000-0000-4000-8000-000000000001',other_university='Other' WHERE id='00000000-0000-4000-8000-000000001101'$$,'23514',NULL,'catalog and Other are mutually exclusive');
SELECT throws_ok($$UPDATE public.users SET program=repeat('a',121) WHERE id='00000000-0000-4000-8000-000000001101'$$,'23514',NULL,'program has a database length bound');
SELECT throws_ok($$UPDATE public.users SET affiliation_source='institution_verified' WHERE id='00000000-0000-4000-8000-000000001101'$$,'23514',NULL,'no invented verification tier can persist');
SET LOCAL ROLE service_role;
SELECT results_eq($$UPDATE public.users SET other_university='Prefer not to specify',affiliation_source='self_declared',onboarding_completed=true WHERE id='00000000-0000-4000-8000-000000001101' RETURNING id$$,ARRAY['00000000-0000-4000-8000-000000001101'::uuid],'validated server path may store an explicit noninstitutional choice');
SELECT is((SELECT roles::text FROM public.users WHERE id='00000000-0000-4000-8000-000000001101'),'{user}','affiliation does not change roles');
SELECT is((SELECT onboarding_completed FROM public.users WHERE id='00000000-0000-4000-8000-000000001102'),true,'legacy completion remains intact');
SELECT is((SELECT count(*)::int FROM public.universities WHERE active),6,'refused mutations preserve the catalog');
SELECT * FROM finish();
ROLLBACK;
