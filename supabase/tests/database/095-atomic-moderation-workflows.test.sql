-- DI-62/68: atomic failure rollback, duplicate decisions and stale snapshots.
BEGIN;
SELECT plan(27);
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-000000009501','m0-atomic-admin@example.invalid'),
 ('00000000-0000-4000-8000-000000009502','m0-atomic-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000009503','m0-atomic-target@example.invalid'),
 ('00000000-0000-4000-8000-000000009504','m0-atomic-applicant@example.invalid');
INSERT INTO public.users(id,email,name,roles) VALUES
 ('00000000-0000-4000-8000-000000009501','m0-atomic-admin@example.invalid','Admin','{user,admin}'),
 ('00000000-0000-4000-8000-000000009502','m0-atomic-owner@example.invalid','Owner','{user}'),
 ('00000000-0000-4000-8000-000000009503','m0-atomic-target@example.invalid','Target','{user}'),
 ('00000000-0000-4000-8000-000000009504','m0-atomic-applicant@example.invalid','Applicant','{user}');
INSERT INTO public.clubs(id,name,status) VALUES ('00000000-0000-4000-8000-0000000095c1','Atomic club','approved');
INSERT INTO public.club_members(club_id,user_id,role) VALUES
 ('00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009502','owner'),
 ('00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009503','organizer');
INSERT INTO public.organizer_requests(id,club_id,user_id) VALUES
 ('00000000-0000-4000-8000-0000000095a1','00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009503'),
 ('00000000-0000-4000-8000-0000000095a2','00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009504');
INSERT INTO public.events(id,title,start_date,end_date,status,created_by,pending_edits) VALUES
 ('00000000-0000-4000-8000-0000000095e1','Original','2031-01-01T18:00:00Z','2031-01-01T20:00:00Z','approved','00000000-0000-4000-8000-000000009502',
 '{"title":"Reviewed","status":"rejected","created_by":"00000000-0000-4000-8000-000000009504","submitted_at":"v1"}');

SELECT tests.act_as('00000000-0000-4000-8000-000000009501');
SELECT throws_ok($q$SELECT public.transfer_club_ownership_atomic('00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009502','00000000-0000-4000-8000-000000009503')$q$,'42501',NULL,'client cannot invoke transfer even with supplied actor');
SELECT throws_ok($q$SELECT public.review_organizer_request_atomic('00000000-0000-4000-8000-0000000095a1','00000000-0000-4000-8000-000000009501','approved')$q$,'42501',NULL,'admin JWT cannot bypass review server boundary');
SELECT tests.act_as_anon();
SELECT throws_ok($q$SELECT public.review_event_edits_atomic('00000000-0000-4000-8000-0000000095e1','00000000-0000-4000-8000-000000009501','approve','{}')$q$,'42501',NULL,'anonymous cannot invoke edit review');
SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;
SELECT is(public.transfer_club_ownership_atomic('00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009502','00000000-0000-4000-8000-000000009503'),'ok','transfer succeeds atomically');
SELECT is(public.transfer_club_ownership_atomic('00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009502','00000000-0000-4000-8000-000000009504'),'conflict','stale original owner cannot transfer again');
SELECT is((SELECT count(*)::integer FROM public.club_members WHERE club_id='00000000-0000-4000-8000-0000000095c1' AND role='owner'),1,'exactly one owner remains');
SELECT is((SELECT count(*)::integer FROM public.admin_audit_log WHERE target_id='00000000-0000-4000-8000-0000000095c1'),1,'one audit for the successful transfer');
SELECT is(public.review_organizer_request_atomic('00000000-0000-4000-8000-0000000095a1','00000000-0000-4000-8000-000000009501','approved'),'ok','organizer approval commits all effects');
SELECT is((SELECT role FROM public.club_members WHERE club_id='00000000-0000-4000-8000-0000000095c1' AND user_id='00000000-0000-4000-8000-000000009503'),'owner','organizer approval never demotes an existing owner');
SELECT ok((SELECT 'club_organizer'=ANY(roles) FROM public.users WHERE id='00000000-0000-4000-8000-000000009503'),'organizer role added');
SELECT is(public.review_organizer_request_atomic('00000000-0000-4000-8000-0000000095a1','00000000-0000-4000-8000-000000009501','rejected'),'conflict','second review cannot overwrite the decision');
SELECT is((SELECT count(*)::integer FROM public.notifications WHERE user_id='00000000-0000-4000-8000-000000009503' AND type LIKE 'organizer_%'),1,'duplicate review emits no second notification');
SELECT is(public.review_event_edits_atomic('00000000-0000-4000-8000-0000000095e1','00000000-0000-4000-8000-000000009501','approve','{"title":"Old snapshot"}'),'conflict','stale reviewed version is refused');
SELECT is((SELECT title FROM public.events WHERE id='00000000-0000-4000-8000-0000000095e1'),'Original','stale approval does not change live content');
SELECT is(public.review_event_edits_atomic('00000000-0000-4000-8000-0000000095e1','00000000-0000-4000-8000-000000009501','approve','{"title":"Reviewed","status":"rejected","created_by":"00000000-0000-4000-8000-000000009504","submitted_at":"v1"}'),'ok','exact reviewed snapshot is approved');
SELECT results_eq($q$SELECT title,status,created_by::text,pending_edits FROM public.events WHERE id='00000000-0000-4000-8000-0000000095e1'$q$,
 $q$VALUES ('Reviewed'::text,'approved'::text,'00000000-0000-4000-8000-000000009502'::text,NULL::jsonb)$q$,'approval whitelists content and clears only the reviewed queue');
SELECT is(public.review_event_edits_atomic('00000000-0000-4000-8000-0000000095e1','00000000-0000-4000-8000-000000009501','approve','{"title":"Reviewed","status":"rejected","created_by":"00000000-0000-4000-8000-000000009504","submitted_at":"v1"}'),'conflict','duplicate approval cannot replay');

-- Force the last transactional side effect to fail. Every preceding write
-- must roll back, including roles, memberships, queue clearing and notification.
SELECT tests.act_as_owner();
CREATE FUNCTION tests.fail_atomic_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected audit failure' USING ERRCODE='P0001'; END$$;
CREATE TRIGGER m0_atomic_audit_failure BEFORE INSERT ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION tests.fail_atomic_audit();
UPDATE public.events SET pending_edits='{"title":"Never published","submitted_at":"v2"}' WHERE id='00000000-0000-4000-8000-0000000095e1';
SET LOCAL ROLE service_role;
SELECT throws_ok($q$SELECT public.transfer_club_ownership_atomic('00000000-0000-4000-8000-0000000095c1','00000000-0000-4000-8000-000000009503','00000000-0000-4000-8000-000000009502')$q$,'P0001','injected audit failure','transfer fails if audit cannot persist');
SELECT is((SELECT user_id::text FROM public.club_members WHERE club_id='00000000-0000-4000-8000-0000000095c1' AND role='owner'),'00000000-0000-4000-8000-000000009503','failed transfer restores original membership state');
SELECT throws_ok($q$SELECT public.review_organizer_request_atomic('00000000-0000-4000-8000-0000000095a2','00000000-0000-4000-8000-000000009501','approved')$q$,'P0001','injected audit failure','failed organizer audit aborts the decision');
SELECT is((SELECT status FROM public.organizer_requests WHERE id='00000000-0000-4000-8000-0000000095a2'),'pending','failed organizer review stays retryable');
SELECT ok((SELECT NOT ('club_organizer'=ANY(roles)) FROM public.users WHERE id='00000000-0000-4000-8000-000000009504'),'failed organizer review leaves roles unchanged');
SELECT is((SELECT count(*)::integer FROM public.club_members WHERE club_id='00000000-0000-4000-8000-0000000095c1' AND user_id='00000000-0000-4000-8000-000000009504'),0,'failed organizer review leaves no membership');
SELECT throws_ok($q$SELECT public.review_event_edits_atomic('00000000-0000-4000-8000-0000000095e1','00000000-0000-4000-8000-000000009501','approve','{"title":"Never published","submitted_at":"v2"}')$q$,'P0001','injected audit failure','failed edit audit rolls back publication');
SELECT results_eq($q$SELECT title,pending_edits FROM public.events WHERE id='00000000-0000-4000-8000-0000000095e1'$q$,
 $q$VALUES ('Reviewed'::text,'{"title":"Never published","submitted_at":"v2"}'::jsonb)$q$,'failed edit review preserves live content and pending queue');
SELECT is((SELECT count(*)::integer FROM public.notifications WHERE user_id='00000000-0000-4000-8000-000000009504'),0,'failed organizer review emitted no notification');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.review_event_edits_atomic(uuid,uuid,text,jsonb,text)'::regprocedure),'transaction function remains invoker');
SELECT * FROM finish();
ROLLBACK;
