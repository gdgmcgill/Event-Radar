-- Privileged RPC functional controls are separate from the actual-role RLS matrix.
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-8000-000000012001','m2-admin@example.invalid');
INSERT INTO public.users(id,email,name,roles,onboarding_completed) VALUES
('00000000-0000-4000-8000-000000012001','m2-admin@example.invalid','M2 admin','{user,admin}',true),
('00000000-0000-4000-8000-000000012002','m2-member@example.invalid','M2 member','{user}',true),
('00000000-0000-4000-8000-000000012003','m2-other@example.invalid','M2 other','{user}',true);
INSERT INTO public.opportunities(id,slug,listing_type,title,description,organization,work_mode,source_url,action_url,relevance_scope,deadline_precision,deadline_date,source_timezone,checked_at,status,published_at,created_by,updated_by) VALUES
('00000000-0000-4000-8000-000000012011','m2-visible','job','M2 visible','safe','M2 org','remote','https://example.invalid/m2-visible','https://example.invalid/apply','cross_campus','date','2031-03-09','America/Toronto',now(),'published','2026-01-01','00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012001'),
('00000000-0000-4000-8000-000000012012','m2-draft','job','M2 confidential draft','draft secret','M2 org','remote','https://example.invalid/m2-visible','https://example.invalid/apply','cross_campus','date','2031-03-09','America/Toronto',now(),'draft',NULL,'00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012001'),
('00000000-0000-4000-8000-000000012013','m2-expired','grant','M2 expired','safe','M2 org','remote','https://example.invalid/expired','https://example.invalid/apply','cross_campus','date','2020-01-01','America/Toronto',now(),'published','2020-01-01','00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012001');
INSERT INTO public.events(id,title,start_date,end_date,status,organizer,source_url) VALUES
('00000000-0000-4000-8000-000000012021','M2 legacy DST','2031-03-09T10:00Z','2031-03-09T12:00Z','approved','Legacy club','https://example.invalid/legacy'),
('00000000-0000-4000-8000-000000012022','M2 pending secret','2031-03-09T10:00Z','2031-03-09T12:00Z','pending','Legacy club','https://example.invalid/pending');
SELECT is(public.discovery_deadline('date',NULL,'2031-03-09','America/Toronto'),'2031-03-10T04:00Z'::timestamptz,'date-only deadline expires at next Toronto midnight through spring DST');
SELECT is(public.discovery_deadline('date',NULL,'2031-11-02','America/Toronto'),'2031-11-03T05:00Z'::timestamptz,'date-only deadline expires at next Toronto midnight through fall DST');
SELECT is(public.discovery_deadline('datetime','2031-03-09T18:00Z',NULL,'America/Toronto'),'2031-03-09T18:00Z'::timestamptz,'exact deadline retains exact instant');
SELECT tests.act_as_anon();
SELECT is((SELECT count(*)::int FROM public.discovery_public WHERE id::text LIKE '%0000000120%'),3,'anonymous projection contains published opportunities and approved event only');
SELECT is((SELECT starts_at FROM public.discovery_public WHERE id='00000000-0000-4000-8000-000000012021'),'2031-03-09T14:00Z'::timestamptz,'DEC80 event wall-clock value is converted exactly once');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-01','{"q":"M2"}',NULL,50)),2,'upcoming discovery excludes drafts, pending and expired');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-01','{"q":"M2","type":"job","work_mode":"remote"}',NULL,50)),1,'database applies type and work-mode filters');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-01','{"q":"M2","field":"missing"}',NULL,50)),0,'database applies field filter');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-01','{"q":"%"}',NULL,50)),0,'search treats wildcard input literally');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-01','{"q":"M2"}',NULL,1)),1,'database bounds page size');
SELECT throws_ok('SELECT duplicate_review_note FROM public.opportunities','42501',NULL,'private editorial notes are inaccessible through raw Data API');
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012001',NULL,'create')$$,'42501',NULL,'anonymous cannot invoke server authoring RPC');
SELECT tests.act_as('00000000-0000-4000-8000-000000012002');
SELECT results_eq($$INSERT INTO public.saved_opportunities(user_id,opportunity_id) VALUES('00000000-0000-4000-8000-000000012002','00000000-0000-4000-8000-000000012011') RETURNING opportunity_id$$,ARRAY['00000000-0000-4000-8000-000000012011'::uuid],'active onboarded user can save published opportunity');
WITH inserted AS(INSERT INTO public.saved_opportunities(user_id,opportunity_id) VALUES('00000000-0000-4000-8000-000000012002','00000000-0000-4000-8000-000000012011') ON CONFLICT DO NOTHING RETURNING 1) SELECT is((SELECT count(*)::int FROM inserted),0,'save retry is idempotent');
SELECT throws_ok($$INSERT INTO public.saved_opportunities(user_id,opportunity_id) VALUES('00000000-0000-4000-8000-000000012003','00000000-0000-4000-8000-000000012011')$$,'42501',NULL,'cannot forge another user save');
SELECT throws_ok($$INSERT INTO public.saved_opportunities(user_id,opportunity_id) VALUES('00000000-0000-4000-8000-000000012002','00000000-0000-4000-8000-000000012012')$$,'42501',NULL,'cannot save private draft');
SELECT is((SELECT count(*)::int FROM public.query_saved_discovery('2030-01-01')),1,'unified saved view shows own opportunity');
SELECT tests.act_as('00000000-0000-4000-8000-000000012003');
SELECT is((SELECT count(*)::int FROM public.query_saved_discovery('2030-01-01')),0,'unified saved RPC does not expose another user saves');
SELECT tests.act_as('00000000-0000-4000-8000-000000012001');
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012001',NULL,'create')$$,'42501',NULL,'admin browser must use guarded server door');
SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;
SELECT is(jsonb_array_length(public.discovery_duplicate_candidates('opportunity','00000000-0000-4000-8000-000000012012')),1,'editor sees cross-source candidates before publishing a draft');
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012002','00000000-0000-4000-8000-000000012012','publish','{}',(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012012'))$$,'42501',NULL,'RPC rechecks actor role even at server door');
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012012','publish','{}','2000-01-01')$$,'40001',NULL,'stale editorial snapshot cannot publish');
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012012','publish','{}',(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012012'))$$,'22023',NULL,'unreviewed duplicate cannot publish');
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012012','merge','{"canonical":{"kind":"opportunity","id":"00000000-0000-4000-8000-000000012011"},"reason":"duplicate"}',(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012012'))$$,'22023',NULL,'merging never-published draft cannot expose private text as public alias');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE target_id='00000000-0000-4000-8000-000000012012'),0,'failed decisions create no success audit');
UPDATE public.opportunities SET duplicate_review_note='Reviewed separate recruiting round' WHERE id='00000000-0000-4000-8000-000000012012';
SELECT is(public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012012','publish','{}',(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012012'))->>'status','published','reviewed duplicate can publish');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE target_id='00000000-0000-4000-8000-000000012012'),1,'successful publication records audit in same transaction');
SELECT is(public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012012','merge','{"canonical":{"kind":"opportunity","id":"00000000-0000-4000-8000-000000012011"},"reason":"Confirmed same round"}',(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012012'))->>'canonical_opportunity_id','00000000-0000-4000-8000-000000012011','published duplicate can merge to visible canonical');
SELECT tests.act_as_anon();
SELECT is((SELECT canonical_id FROM public.discovery_public WHERE id='00000000-0000-4000-8000-000000012012'),'00000000-0000-4000-8000-000000012011'::uuid,'published alias retains canonical resolution');
SELECT is((SELECT count(*)::int FROM public.query_discovery('2030-01-01','{"q":"M2"}',NULL,50)),2,'merged alias disappears from feed');
SELECT tests.act_as_owner();
INSERT INTO public.events(id,title,start_date,end_date,status,organizer,source_url) VALUES('00000000-0000-4000-8000-000000012023','Duplicate imported opportunity','2031-03-09T10:00Z','2031-03-09T12:00Z','pending','M2 org','https://example.invalid/m2-visible');
SELECT throws_ok($$UPDATE public.events SET status='approved' WHERE id='00000000-0000-4000-8000-000000012023'$$,'22023',NULL,'legacy approval cannot bypass cross-source duplicate review');
SELECT is((SELECT status FROM public.events WHERE id='00000000-0000-4000-8000-000000012023'),'pending','refused approval rolls event state back');
INSERT INTO public.event_discovery_metadata(event_id,duplicate_review_note,updated_by) VALUES('00000000-0000-4000-8000-000000012023','Reviewed: registration workshop distinct from recruiting role','00000000-0000-4000-8000-000000012001');
SELECT results_eq($$UPDATE public.events SET status='approved' WHERE id='00000000-0000-4000-8000-000000012023' RETURNING status$$,ARRAY['approved'],'explicit review permits legitimate source reuse');
INSERT INTO public.events(id,title,start_date,end_date,status,organizer,source_url) VALUES('00000000-0000-4000-8000-000000012024','M2 legacy DST','2032-03-09T10:00Z','2032-03-09T12:00Z','approved','Legacy club','https://example.invalid/next-edition');
SELECT is((SELECT status FROM public.events WHERE id='00000000-0000-4000-8000-000000012024'),'approved','same-title recurring edition at a different date remains valid');
SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012011','edit',(SELECT to_jsonb(o)||jsonb_build_object('university_ids','[]'::jsonb,'is_pick',true,'pick_reason','Curator recommends') FROM public.opportunities o WHERE id='00000000-0000-4000-8000-000000012011'),(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012011'),false)$$,'42501',NULL,'ordinary admin cannot assign the named curator Pick');
UPDATE public.opportunities SET duplicate_review_note='Reviewed existing event workshop separately' WHERE id='00000000-0000-4000-8000-000000012011';
SELECT is(public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012011','edit',(SELECT to_jsonb(o)||jsonb_build_object('university_ids','[]'::jsonb,'is_pick',true,'pick_reason','Curator recommends') FROM public.opportunities o WHERE id='00000000-0000-4000-8000-000000012011'),(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012011'),true)->>'is_pick','true','configured curator path may assign a reasoned Pick');
SELECT is((SELECT metadata->'after_pick'->>'reason' FROM public.admin_audit_log WHERE target_id='00000000-0000-4000-8000-000000012011' ORDER BY created_at DESC LIMIT 1),'Curator recommends','audit retains Pick reason with actor and timestamp');
SELECT throws_ok($$SELECT public.curate_opportunity('00000000-0000-4000-8000-000000012001','00000000-0000-4000-8000-000000012011','edit',(SELECT to_jsonb(o)||jsonb_build_object('university_ids','[]'::jsonb,'source_timezone','Invalid/Timezone') FROM public.opportunities o WHERE id='00000000-0000-4000-8000-000000012011'),(SELECT updated_at FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012011'),true)$$,'22023',NULL,'server RPC independently rejects invalid timezone');
SELECT is((SELECT source_timezone FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000012011'),'America/Toronto','failed edit leaves listing unchanged');
SELECT throws_ok($$UPDATE public.opportunities SET is_pick=true,pick_reason=NULL WHERE id='00000000-0000-4000-8000-000000012011'$$,'23514',NULL,'database refuses a Pick without a reason even through privileged writer');
SELECT throws_ok($$UPDATE public.event_discovery_metadata SET is_pick=true,pick_reason=NULL WHERE event_id='00000000-0000-4000-8000-000000012023'$$,'23514',NULL,'legacy metadata refuses a Pick without a reason');
SELECT * FROM finish();
ROLLBACK;
