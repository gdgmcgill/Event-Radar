-- M3 P1-09: public intake. Anonymous input reaches only service-role RPCs.
-- Browser roles cannot insert or call the intake RPCs; only an admin cookie
-- session can read the queue; quotas, visibility, idempotent conversion and
-- contact privacy are enforced inside the database.
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id,email) VALUES
('00000000-0000-4000-8000-000000014001','m3-intake-admin@example.invalid'),
('00000000-0000-4000-8000-000000014002','m3-intake-student@example.invalid'),
('00000000-0000-4000-8000-000000014003','m3-intake-banned@example.invalid');
INSERT INTO public.users(id,email,name,roles,onboarding_completed,banned_at) VALUES
('00000000-0000-4000-8000-000000014001','m3-intake-admin@example.invalid','M3 intake admin','{user,admin}',true,NULL),
('00000000-0000-4000-8000-000000014002','m3-intake-student@example.invalid','M3 intake student','{user}',true,NULL),
('00000000-0000-4000-8000-000000014003','m3-intake-banned@example.invalid','M3 intake banned','{user}',true,now()-interval '1 day');
INSERT INTO public.opportunities(id,slug,listing_type,title,description,organization,status,created_by,updated_by) VALUES
('00000000-0000-4000-8000-000000014011','m3-intake-draft','job','M3 intake draft','Private draft','M3 org','draft','00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014001');
INSERT INTO public.events(id,title,start_date,end_date,status) VALUES
('00000000-0000-4000-8000-000000014021','M3 intake event','2031-01-01T18:00:00Z','2031-01-01T20:00:00Z','approved');
INSERT INTO public.submissions(id,kind,title,organization,source_url,details,contact_name,contact_email,submitter_user_id,client_hash) VALUES
('00000000-0000-4000-8000-000000014031','job','Research assistant','M3 Lab','https://example.invalid/ra','{"description":"Help with research","location":"Montreal"}',NULL,NULL,'00000000-0000-4000-8000-000000014002',repeat('1',64)),
('00000000-0000-4000-8000-000000014032','company_request','Junior developer','Acme Robotics','https://example.invalid/acme','{"company_context":"Robots","duties":"Write code","must_have_skills":"TypeScript","why_worth_it":"Mentorship","work_mode":"hybrid","location":"Montreal"}','Pat Recruiter','hiring@acme.example',NULL,repeat('2',64)),
('00000000-0000-4000-8000-000000014033','resource','Resume guide','Career centre','https://example.invalid/resume','{"description":"How to write a resume","category":"career"}',NULL,NULL,NULL,repeat('3',64)),
('00000000-0000-4000-8000-000000014034','program','!!!','Program org','https://example.invalid/program','{}',NULL,NULL,NULL,repeat('4',64));

-- Browser roles: no direct writes, no RPC, no reads except an admin cookie session.
SELECT tests.act_as_anon();
SELECT throws_ok($$INSERT INTO public.submissions(kind,title,organization,client_hash) VALUES('job','Forged','Forged',repeat('a',64))$$,'42501',NULL,'anonymous cannot insert a submission directly');
SELECT throws_ok($$INSERT INTO public.listing_reports(event_id,reason,client_hash) VALUES('00000000-0000-4000-8000-000000014021','other',repeat('a',64))$$,'42501',NULL,'anonymous cannot insert a listing report directly');
SELECT throws_ok('SELECT id FROM public.submissions','42501',NULL,'anonymous cannot read submissions');
SELECT throws_ok('SELECT id FROM public.listing_reports','42501',NULL,'anonymous cannot read listing reports');
SELECT throws_ok($$SELECT public.intake_submission('job','Forged','Forged','https://example.invalid/x','{}',NULL,NULL,NULL,repeat('a',64))$$,'42501',NULL,'anonymous cannot invoke the intake RPC');
SELECT throws_ok($$SELECT public.intake_listing_report('event','00000000-0000-4000-8000-000000014021','other',NULL,NULL,repeat('a',64))$$,'42501',NULL,'anonymous cannot invoke the report RPC');

SELECT tests.act_as('00000000-0000-4000-8000-000000014002');
SELECT throws_ok($$INSERT INTO public.submissions(kind,title,organization,client_hash) VALUES('job','Forged','Forged',repeat('a',64))$$,'42501',NULL,'an authenticated student cannot insert a submission directly');
SELECT is((SELECT count(*)::int FROM public.submissions),0,'a student sees no submissions, not even their own');
SELECT is((SELECT count(*)::int FROM public.listing_reports),0,'a student sees no listing reports');

SELECT tests.act_as('00000000-0000-4000-8000-000000014001');
SELECT ok((SELECT count(*)::int FROM public.submissions WHERE id::text LIKE '%0000000140%')>=1,'an admin cookie session can read the submission queue');
SELECT throws_ok($$SELECT public.intake_submission('job','Forged','Forged','https://example.invalid/x','{}',NULL,NULL,NULL,repeat('a',64))$$,'42501',NULL,'an admin cookie session cannot invoke the intake RPC');
SELECT throws_ok($$SELECT public.review_submission('00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014031','spam',NULL,now())$$,'42501',NULL,'an admin cookie session must use the guarded server door to review');

SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;

-- Quotas keyed by the salted client hash; status is server-fixed.
SELECT lives_ok($$SELECT public.intake_submission('event','Quota 1','Org','https://example.invalid/q1','{"description":"x"}',NULL,NULL,NULL,repeat('b',64))$$,'intake 1 of 5 from one client hash succeeds');
SELECT lives_ok($$SELECT public.intake_submission('event','Quota 2','Org','https://example.invalid/q2','{"description":"x"}',NULL,NULL,NULL,repeat('b',64))$$,'intake 2 of 5 from one client hash succeeds');
SELECT lives_ok($$SELECT public.intake_submission('event','Quota 3','Org','https://example.invalid/q3','{"description":"x"}',NULL,NULL,NULL,repeat('b',64))$$,'intake 3 of 5 from one client hash succeeds');
SELECT lives_ok($$SELECT public.intake_submission('event','Quota 4','Org','https://example.invalid/q4','{"description":"x"}',NULL,NULL,NULL,repeat('b',64))$$,'intake 4 of 5 from one client hash succeeds');
SELECT lives_ok($$SELECT public.intake_submission('event','Quota 5','Org','https://example.invalid/q5','{"description":"x"}',NULL,NULL,NULL,repeat('b',64))$$,'intake 5 of 5 from one client hash succeeds');
SELECT throws_ok($$SELECT public.intake_submission('event','Quota 6','Org','https://example.invalid/q6','{"description":"x"}',NULL,NULL,NULL,repeat('b',64))$$,'UV429',NULL,'the sixth intake from one client hash within an hour is refused');
SELECT lives_ok($$SELECT public.intake_submission('event','Other client','Org','https://example.invalid/q7','{"description":"x"}',NULL,NULL,NULL,repeat('c',64))$$,'a different client hash still has its own quota');
SELECT is((SELECT count(*)::int FROM public.submissions WHERE client_hash=repeat('b',64) AND status='pending'),5,'every intake row is pending; no parameter can set status');
SELECT throws_ok($$SELECT public.intake_submission('event','Banned','Org','https://example.invalid/q8','{}',NULL,NULL,'00000000-0000-4000-8000-000000014003',repeat('e',64))$$,'42501',NULL,'a banned submitter is refused inside the database');

-- Reports: only publicly visible targets; a repeated open report is a no-op.
SELECT throws_ok($$SELECT public.intake_listing_report('opportunity','00000000-0000-4000-8000-000000014011','dead_link',NULL,NULL,repeat('d',64))$$,'P0002',NULL,'a draft opportunity cannot be reported (invisible target)');
SELECT lives_ok($$SELECT public.intake_listing_report('event','00000000-0000-4000-8000-000000014021','wrong_date','Starts at 7',NULL,repeat('d',64))$$,'an approved event can be reported');
SELECT lives_ok($$SELECT public.intake_listing_report('event','00000000-0000-4000-8000-000000014021','wrong_date','Starts at 7',NULL,repeat('d',64))$$,'repeating the same open report succeeds silently');
SELECT is((SELECT count(*)::int FROM public.listing_reports WHERE event_id='00000000-0000-4000-8000-000000014021'),1,'a duplicate open report adds no row');

-- Conversion: one draft, unchecked, idempotent on retry, never copying contact data.
CREATE TEMP TABLE m3_opportunity_count AS SELECT count(*) AS n FROM public.opportunities;
CREATE TEMP TABLE m3_roles_before AS SELECT array_agg(id::text || ':' || roles::text ORDER BY id) AS snap FROM public.users;
CREATE TEMP TABLE m3_convert AS SELECT public.review_submission('00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014031','convert',NULL,(SELECT updated_at FROM public.submissions WHERE id='00000000-0000-4000-8000-000000014031')) AS result;
SELECT is((SELECT count(*) FROM public.opportunities)-(SELECT n FROM m3_opportunity_count),1::bigint,'converting a job submission creates exactly one opportunity');
SELECT is((SELECT status FROM public.opportunities WHERE id=(SELECT (result->'target'->>'id')::uuid FROM m3_convert)),'draft','the converted opportunity is a draft');
SELECT ok((SELECT checked_at FROM public.opportunities WHERE id=(SELECT (result->'target'->>'id')::uuid FROM m3_convert)) IS NULL,'the converted draft is unchecked, so publication needs an editor check');
SELECT is((SELECT result->'target'->>'kind' FROM m3_convert),'opportunity','the review result names the opportunity target');
SELECT ok(NOT ((SELECT result->'submission' FROM m3_convert) ?| ARRAY['contact_name','contact_email']),'the review result omits private contact fields');
SELECT is(public.review_submission('00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014031','convert',NULL,'2000-01-01')->'target'->>'id',(SELECT result->'target'->>'id' FROM m3_convert),'a retried convert with a stale version returns the same target');
SELECT is((SELECT count(*) FROM public.opportunities)-(SELECT n FROM m3_opportunity_count),1::bigint,'a retried convert creates no second opportunity');
SELECT is((SELECT status FROM public.submissions WHERE id='00000000-0000-4000-8000-000000014031'),'converted','the submission records its conversion');

CREATE TEMP TABLE m3_company AS SELECT public.review_submission('00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014032','convert',NULL,(SELECT updated_at FROM public.submissions WHERE id='00000000-0000-4000-8000-000000014032')) AS result;
SELECT is((SELECT position('hiring@acme.example' in description) FROM public.opportunities WHERE id=(SELECT (result->'target'->>'id')::uuid FROM m3_company)),0,'a converted company request never copies the contact email into the description');
SELECT is((SELECT position('Pat Recruiter' in description) FROM public.opportunities WHERE id=(SELECT (result->'target'->>'id')::uuid FROM m3_company)),0,'a converted company request never copies the contact name into the description');
SELECT is((SELECT source_type FROM public.opportunities WHERE id=(SELECT (result->'target'->>'id')::uuid FROM m3_company)),'partner','a converted company request is a partner-sourced listing');
SELECT is((SELECT listing_type FROM public.opportunities WHERE id=(SELECT (result->'target'->>'id')::uuid FROM m3_company)),'job','a converted company request becomes a job draft');
SELECT is((SELECT array_agg(id::text || ':' || roles::text ORDER BY id) FROM public.users),(SELECT snap FROM m3_roles_before),'converting a company request changes no user role');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE action='submission_convert' AND target_id='00000000-0000-4000-8000-000000014032' AND metadata::text NOT LIKE '%acme.example%' AND metadata::text NOT LIKE '%Pat Recruiter%'),1,'the conversion audit row carries no private contact data');

CREATE TEMP TABLE m3_resource AS SELECT public.review_submission('00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014033','convert',NULL,(SELECT updated_at FROM public.submissions WHERE id='00000000-0000-4000-8000-000000014033')) AS result;
SELECT is((SELECT r.status FROM public.resources r WHERE r.id=(SELECT (result->'target'->>'id')::uuid FROM m3_resource)),'draft','a resource submission converts to a draft resource');
SELECT is((SELECT r.external_url FROM public.resources r WHERE r.id=(SELECT (result->'target'->>'id')::uuid FROM m3_resource)),'https://example.invalid/resume','the converted resource links to the submitted https source');
CREATE TEMP TABLE m3_symbols AS SELECT public.review_submission('00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014034','convert',NULL,(SELECT updated_at FROM public.submissions WHERE id='00000000-0000-4000-8000-000000014034')) AS result;
SELECT ok((SELECT slug FROM public.opportunities WHERE id=(SELECT (result->'target'->>'id')::uuid FROM m3_symbols)) ~ '^listing-[0-9a-f]{6}$','a title without letters or digits falls back to a listing slug');

-- Review state machine and actor recheck.
SELECT throws_ok($$SELECT public.review_submission('00000000-0000-4000-8000-000000014001','00000000-0000-4000-8000-000000014031','reject','Not a fit',(SELECT updated_at FROM public.submissions WHERE id='00000000-0000-4000-8000-000000014031'))$$,'22023',NULL,'a converted submission cannot be rejected');
SELECT throws_ok($$SELECT public.review_submission('00000000-0000-4000-8000-000000014002','00000000-0000-4000-8000-000000014031','spam',NULL,now())$$,'42501',NULL,'a non-admin actor cannot review, even at the server door');
CREATE TEMP TABLE m3_pending AS SELECT id, updated_at FROM public.submissions WHERE title='Quota 1';
SELECT throws_ok($$SELECT public.review_submission('00000000-0000-4000-8000-000000014001',(SELECT id FROM m3_pending),'reject','  ',(SELECT updated_at FROM m3_pending))$$,'22023',NULL,'a rejection requires a reason');
SELECT throws_ok($$SELECT public.review_submission('00000000-0000-4000-8000-000000014001',(SELECT id FROM m3_pending),'spam',NULL,'2000-01-01')$$,'40001',NULL,'a stale version cannot be reviewed');
SELECT is(public.review_submission('00000000-0000-4000-8000-000000014001',(SELECT id FROM m3_pending),'reject','Duplicate of an existing listing',(SELECT updated_at FROM m3_pending))->'submission'->>'status','rejected','a pending submission can be rejected with a reason');

-- Report resolution.
CREATE TEMP TABLE m3_report AS SELECT id FROM public.listing_reports WHERE event_id='00000000-0000-4000-8000-000000014021';
SELECT throws_ok($$SELECT public.resolve_listing_report('00000000-0000-4000-8000-000000014002',(SELECT id FROM m3_report),'resolve',NULL)$$,'42501',NULL,'a non-admin actor cannot resolve a report');
SELECT is(public.resolve_listing_report('00000000-0000-4000-8000-000000014001',(SELECT id FROM m3_report),'resolve','Date corrected')->>'status','resolved','an open report can be resolved');
SELECT throws_ok($$SELECT public.resolve_listing_report('00000000-0000-4000-8000-000000014001',(SELECT id FROM m3_report),'dismiss',NULL)$$,'22023',NULL,'a resolved report cannot be resolved again');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE action='listing_report_resolve' AND target_id=(SELECT id::text FROM m3_report)),1,'resolution writes one audit row');

SELECT * FROM finish();
ROLLBACK;
