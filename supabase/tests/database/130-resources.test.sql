-- M3 P1-08: authored resources. Admin-authored only; public reads published rows.
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-8000-000000013001','m3-resource-admin@example.invalid'),('00000000-0000-4000-8000-000000013002','m3-resource-student@example.invalid');
INSERT INTO public.users(id,email,name,roles,onboarding_completed) VALUES
('00000000-0000-4000-8000-000000013001','m3-resource-admin@example.invalid','M3 resource admin','{user,admin}',true),
('00000000-0000-4000-8000-000000013002','m3-resource-student@example.invalid','M3 resource student','{user}',true);
INSERT INTO public.resources(id,slug,resource_type,title,summary,body_markdown,category,audience,author_name,status,reviewed_at,published_at,created_by,updated_by) VALUES
('00000000-0000-4000-8000-000000013011','m3-published-guide','guide','M3 published guide','A safe published guide','Body content here.','career','Everyone','M3 author','published',now(),now(),'00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013001'),
('00000000-0000-4000-8000-000000013013','m3-archived-guide','guide','M3 archived guide','A previously published guide','Body content here.','career','Everyone','M3 author','archived',now(),now(),'00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013001');
INSERT INTO public.resources(id,slug,resource_type,title,summary,body_markdown,category,audience,author_name,status,created_by,updated_by) VALUES
('00000000-0000-4000-8000-000000013012','m3-draft-guide','guide','M3 draft guide','A confidential draft','Draft body.','career','Everyone','M3 author','draft','00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013001');
INSERT INTO public.resources(id,slug,resource_type,title,summary,body_markdown,category,audience,author_name,status,reviewed_at,published_at,created_by,updated_by,deleted_at) VALUES
('00000000-0000-4000-8000-000000013014','m3-deleted-guide','guide','M3 deleted guide','A published then deleted guide','Body content here.','career','Everyone','M3 author','published',now(),now(),'00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013001',now());
INSERT INTO public.resource_actions(resource_id,action) VALUES('00000000-0000-4000-8000-000000013011','outbound');

SELECT tests.act_as_anon();
SELECT is((SELECT count(*)::int FROM public.resources WHERE id::text LIKE '%0000000130%'),1,'anonymous sees only the published, non-deleted resource in the namespace');
SELECT throws_ok('SELECT created_by FROM public.resources','42501',NULL,'private author identity is inaccessible through raw Data API');
SELECT throws_ok($$INSERT INTO public.resources(slug,resource_type,title,summary,body_markdown,category,audience,author_name) VALUES('m3-anon-forge','guide','x','x','x','career','x','x')$$,'42501',NULL,'anonymous cannot insert a resource');
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013001',NULL,'create')$$,'42501',NULL,'anonymous cannot invoke server authoring RPC');

SELECT tests.act_as('00000000-0000-4000-8000-000000013002');
SELECT is((SELECT count(*)::int FROM public.resource_actions),0,'ordinary student cannot read resource action analytics');

SELECT tests.act_as('00000000-0000-4000-8000-000000013001');
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013001',NULL,'create')$$,'42501',NULL,'admin browser session must use the guarded server door, not the raw RPC');
SELECT is((SELECT count(*)::int FROM public.resource_actions WHERE resource_id='00000000-0000-4000-8000-000000013011'),1,'admin cookie session can read resource action analytics');

SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;
SELECT is(public.curate_resource('00000000-0000-4000-8000-000000013001',NULL,'create','{"slug":"m3-new-guide","resource_type":"guide","title":"New guide","summary":"A fresh guide","body_markdown":"Body.","category":"career","audience":"Everyone","author_name":"M3 author"}')->>'status','draft','a freshly created resource starts as a draft');
SELECT is((public.curate_resource('00000000-0000-4000-8000-000000013001',NULL,'create','{"slug":"m3-new-guide-2","resource_type":"guide","title":"New guide 2","summary":"A fresh guide","body_markdown":"Body.","category":"career","audience":"Everyone","author_name":"M3 author"}')->>'reviewed_at') IS NULL,true,'a freshly created resource has no review timestamp');
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013002',NULL,'create','{"slug":"m3-student-forge","resource_type":"guide","title":"x","summary":"x","body_markdown":"x","category":"career","audience":"x","author_name":"x"}')$$,'42501',NULL,'the RPC rechecks the actor role even at the server door');
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013001',NULL,'create','{"slug":"m3-empty-body","resource_type":"guide","title":"x","summary":"x","body_markdown":"","category":"career","audience":"x","author_name":"x"}')$$,'23514',NULL,'a guide with an empty body violates the shape constraint');
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013012','publish','{}','2000-01-01')$$,'40001',NULL,'a stale expected version cannot publish');
SELECT is(public.curate_resource('00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013012','publish','{}',(SELECT updated_at FROM public.resources WHERE id='00000000-0000-4000-8000-000000013012'))->>'status','published','publishing with the correct expected version succeeds');
SELECT ok((SELECT published_at FROM public.resources WHERE id='00000000-0000-4000-8000-000000013012') IS NOT NULL,'publish sets published_at');
SELECT ok((SELECT reviewed_at FROM public.resources WHERE id='00000000-0000-4000-8000-000000013012') IS NOT NULL,'publish sets reviewed_at');
CREATE TEMP TABLE m3_after_publish AS SELECT reviewed_at FROM public.resources WHERE id='00000000-0000-4000-8000-000000013012';
SELECT ok((public.curate_resource('00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013012','edit','{"summary":"Updated summary"}',(SELECT updated_at FROM public.resources WHERE id='00000000-0000-4000-8000-000000013012'))->>'reviewed_at')::timestamptz > (SELECT reviewed_at FROM m3_after_publish),'editing a published resource re-stamps its review time forward');
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013012','edit','{"slug":"m3-renamed-after-publish"}',(SELECT updated_at FROM public.resources WHERE id='00000000-0000-4000-8000-000000013012'))$$,'22023',NULL,'a published resource cannot change its slug');
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013001','00000000-0000-4000-8000-000000013012','edit','{"status":"published"}',(SELECT updated_at FROM public.resources WHERE id='00000000-0000-4000-8000-000000013012'))$$,'22023',NULL,'an unsupported field key is refused');
SELECT is(public.curate_resource('00000000-0000-4000-8000-000000013001',NULL,'create','{"slug":"m3-new-template","resource_type":"template","title":"New template","summary":"A fresh template","category":"career","audience":"Everyone","author_name":"M3 author"}')->>'status','draft','a template draft can be created without a file');
CREATE TEMP TABLE m3_template_id AS SELECT id FROM public.resources WHERE slug='m3-new-template';
SELECT throws_ok($$SELECT public.curate_resource('00000000-0000-4000-8000-000000013001',(SELECT id FROM m3_template_id),'publish','{}',(SELECT updated_at FROM public.resources WHERE id=(SELECT id FROM m3_template_id)))$$,'23514',NULL,'publishing a template without an attached file violates the published-state constraint');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE action='resource_publish' AND target_id='00000000-0000-4000-8000-000000013012'),1,'a successful publication records exactly one audit row for the target');

SELECT * FROM finish();
ROLLBACK;
