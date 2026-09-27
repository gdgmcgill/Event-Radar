-- F-011: exercise actual anon/authenticated roles, with visible-row controls.
-- Local transaction only. As in 065/070, remove auth-owned FKs in this test
-- transaction so attendance fixtures require no GoTrue mutations. ROLLBACK
-- restores both constraints and every fixture.
BEGIN;
SELECT plan(27);
ALTER TABLE public.rsvps DROP CONSTRAINT rsvps_user_id_fkey;
ALTER TABLE public.events DROP CONSTRAINT events_created_by_fkey;

INSERT INTO public.users (id, email, name, roles) VALUES
 ('00000000-0000-4000-8000-000000008501', 'rsvp-student-a@example.test', 'Student A', '{user}'),
 ('00000000-0000-4000-8000-000000008502', 'rsvp-student-b@example.test', 'Student B', '{user}'),
 ('00000000-0000-4000-8000-000000008503', 'rsvp-owner-a@example.test', 'Owner A', '{user}'),
 ('00000000-0000-4000-8000-000000008504', 'rsvp-member-a@example.test', 'Organizer A', '{user}'),
 ('00000000-0000-4000-8000-000000008505', 'rsvp-owner-b@example.test', 'Owner B', '{user}'),
 ('00000000-0000-4000-8000-000000008506', 'rsvp-admin@example.test', 'Admin', '{user,admin}');
INSERT INTO public.clubs (id, name, status) VALUES
 ('00000000-0000-4000-8000-0000000085c1', 'RSVP Club A', 'approved'),
 ('00000000-0000-4000-8000-0000000085c2', 'RSVP Club B', 'approved');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
 ('00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008503', 'owner'),
 ('00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008504', 'organizer'),
 ('00000000-0000-4000-8000-0000000085c2', '00000000-0000-4000-8000-000000008505', 'owner');
INSERT INTO public.events (id, title, start_date, end_date, status, club_id, created_by, deleted_at) VALUES
 ('00000000-0000-4000-8000-0000000085e1', 'Public A', now(), now() + interval '1 hour', 'approved', '00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008503', NULL),
 ('00000000-0000-4000-8000-0000000085e2', 'Public B', now(), now() + interval '1 hour', 'approved', '00000000-0000-4000-8000-0000000085c2', '00000000-0000-4000-8000-000000008505', NULL),
 ('00000000-0000-4000-8000-0000000085e3', 'Pending A', now(), now() + interval '1 hour', 'pending', '00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008503', NULL),
 ('00000000-0000-4000-8000-0000000085e4', 'Deleted A', now(), now() + interval '1 hour', 'approved', '00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008503', now()),
 ('00000000-0000-4000-8000-0000000085e5', 'Large public A', now(), now() + interval '1 hour', 'approved', '00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008503', NULL),
 ('00000000-0000-4000-8000-0000000085e6', 'Rejected A', now(), now() + interval '1 hour', 'rejected', '00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008503', NULL),
 ('00000000-0000-4000-8000-0000000085e7', 'Suspended A', now(), now() + interval '1 hour', 'suspended', '00000000-0000-4000-8000-0000000085c1', '00000000-0000-4000-8000-000000008503', NULL);
INSERT INTO public.rsvps (user_id, event_id, status) VALUES
 ('00000000-0000-4000-8000-000000008501', '00000000-0000-4000-8000-0000000085e1', 'going'),
 ('00000000-0000-4000-8000-000000008502', '00000000-0000-4000-8000-0000000085e1', 'interested'),
 ('00000000-0000-4000-8000-000000008507', '00000000-0000-4000-8000-0000000085e1', 'going'),
 ('00000000-0000-4000-8000-000000008508', '00000000-0000-4000-8000-0000000085e1', 'cancelled'),
 ('00000000-0000-4000-8000-000000008501', '00000000-0000-4000-8000-0000000085e2', 'interested'),
 ('00000000-0000-4000-8000-000000008502', '00000000-0000-4000-8000-0000000085e2', 'going'),
 ('00000000-0000-4000-8000-000000008502', '00000000-0000-4000-8000-0000000085e3', 'going'),
 ('00000000-0000-4000-8000-000000008502', '00000000-0000-4000-8000-0000000085e4', 'going'),
 ('00000000-0000-4000-8000-000000008502', '00000000-0000-4000-8000-0000000085e6', 'going'),
 ('00000000-0000-4000-8000-000000008502', '00000000-0000-4000-8000-0000000085e7', 'going');
INSERT INTO public.rsvps (user_id, event_id, status)
 SELECT gen_random_uuid(), '00000000-0000-4000-8000-0000000085e5', 'going' FROM generate_series(1, 1001);

SELECT tests.act_as_anon();
SELECT is(current_user::text, 'anon', 'anonymous impersonation uses the actual database role'); -- 1
SELECT is_empty('SELECT user_id, event_id, status FROM public.rsvps', 'anon cannot read any attendance rows'); -- 2
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085e1')$q$,
 $q$VALUES (2::bigint, 1::bigint)$q$, 'anon sees only exact aggregate counts; cancelled excluded'); -- 3
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085e5')$q$,
 $q$VALUES (1001::bigint, 0::bigint)$q$, 'public totals exceed the API row cap without truncation'); -- 4
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085e3')$q$,
 $q$VALUES (0::bigint, 0::bigint)$q$, 'pending event attendance has no public aggregate'); -- 5
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085e4')$q$,
 $q$VALUES (0::bigint, 0::bigint)$q$, 'deleted event attendance has no public aggregate'); -- 6
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085e6')$q$,
 $q$VALUES (0::bigint, 0::bigint)$q$, 'rejected event attendance has no public aggregate'); -- 7
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085e7')$q$,
 $q$VALUES (0::bigint, 0::bigint)$q$, 'suspended event attendance has no public aggregate'); -- 8
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085ff')$q$,
 $q$VALUES (0::bigint, 0::bigint)$q$, 'missing event aggregate matches hidden events'); -- 9

SELECT tests.act_as('00000000-0000-4000-8000-000000008501');
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000008501'::uuid, 'student JWT subject is bound'); -- 10
SELECT is(current_user::text, 'authenticated', 'student uses the actual authenticated role'); -- 11
SELECT is((SELECT count(*) FROM public.rsvps), 2::bigint, 'student sees both their own attendance rows'); -- 12
SELECT is_empty($q$SELECT * FROM public.rsvps WHERE user_id <> auth.uid()$q$, 'student cannot enumerate other attendees'); -- 13
SELECT results_eq($q$SELECT * FROM public.get_public_event_rsvp_counts('00000000-0000-4000-8000-0000000085e1')$q$,
 $q$VALUES (2::bigint, 1::bigint)$q$, 'authenticated aggregate includes all attendees despite private rows'); -- 14
SELECT results_eq($q$UPDATE public.rsvps SET status = 'interested' WHERE event_id = '00000000-0000-4000-8000-0000000085e1' AND user_id = auth.uid() RETURNING status$q$,
 ARRAY['interested'], 'student can still update own RSVP'); -- 15
SELECT throws_ok($q$INSERT INTO public.rsvps (user_id,event_id,status) VALUES ('00000000-0000-4000-8000-000000008502','00000000-0000-4000-8000-0000000085e5','going')$q$,
 '42501', NULL, 'student cannot forge another attendee'); -- 16

SELECT tests.act_as('00000000-0000-4000-8000-000000008503');
SELECT is((SELECT count(*) FROM public.rsvps WHERE event_id = '00000000-0000-4000-8000-0000000085e1'), 4::bigint, 'club owner sees own event attendee list'); -- 17
SELECT is_empty($q$SELECT * FROM public.rsvps WHERE event_id = '00000000-0000-4000-8000-0000000085e2'$q$, 'club owner cannot see other club attendee list'); -- 18
SELECT tests.act_as('00000000-0000-4000-8000-000000008504');
SELECT is((SELECT count(*) FROM public.rsvps WHERE event_id = '00000000-0000-4000-8000-0000000085e1'), 4::bigint, 'organizer member retains analytics row access'); -- 19
SELECT is_empty($q$UPDATE public.rsvps SET status = 'cancelled' WHERE event_id = '00000000-0000-4000-8000-0000000085e1' RETURNING id$q$, 'organizer row reads do not grant edits to attendee RSVPs'); -- 20
SELECT tests.act_as('00000000-0000-4000-8000-000000008505');
SELECT is((SELECT count(*) FROM public.rsvps WHERE event_id = '00000000-0000-4000-8000-0000000085e2'), 2::bigint, 'other-club owner has a positive own-event control'); -- 21
SELECT is_empty($q$SELECT * FROM public.rsvps WHERE event_id = '00000000-0000-4000-8000-0000000085e1'$q$, 'other-club owner cannot read club A attendance'); -- 22
SELECT tests.act_as('00000000-0000-4000-8000-000000008506');
SELECT is((SELECT count(*) FROM public.rsvps WHERE event_id IN ('00000000-0000-4000-8000-0000000085e1','00000000-0000-4000-8000-0000000085e2')), 6::bigint, 'admin can inspect attendance across clubs'); -- 23
SELECT tests.act_as_owner();
SELECT is((SELECT status FROM public.rsvps WHERE event_id = '00000000-0000-4000-8000-0000000085e1' AND user_id = '00000000-0000-4000-8000-000000008502'), 'interested', 'denied organizer update did not change the attendee row'); -- 24
SELECT ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.get_public_event_rsvp_counts(uuid)'::regprocedure), 'aggregate definer pins empty search_path'); -- 25
SELECT is(pg_get_function_result('public.get_public_event_rsvp_counts(uuid)'::regprocedure), 'TABLE(going bigint, interested bigint)', 'aggregate exposes no user or event identifiers'); -- 26
SELECT ok(has_function_privilege('anon', 'public.get_public_event_rsvp_counts(uuid)', 'EXECUTE') AND has_function_privilege('authenticated', 'public.get_public_event_rsvp_counts(uuid)', 'EXECUTE'), 'aggregate is callable by both permitted public roles'); -- 27
SELECT * FROM finish();
ROLLBACK;
