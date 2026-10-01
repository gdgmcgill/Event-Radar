-- CERT-07: complete public-table read matrix plus relevant write allow/deny pairs.
-- Owner writes below create fixtures only. Every policy assertion uses anon or
-- authenticated roles; subject, unrelated caller and administrator have distinct JWTs.
BEGIN;
SELECT plan(260);
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000100001','m0-00000000-0000-4000-8000-000000100001@example.invalid'),('00000000-0000-4000-8000-000000100002','m0-00000000-0000-4000-8000-000000100002@example.invalid'),('00000000-0000-4000-8000-000000100003','m0-00000000-0000-4000-8000-000000100003@example.invalid'),('00000000-0000-4000-8000-000000100004','m0-00000000-0000-4000-8000-000000100004@example.invalid');
INSERT INTO public.users (id,email,name,roles) VALUES
 ('00000000-0000-4000-8000-000000100001','m0-00000000-0000-4000-8000-000000100001@example.invalid','M0 matrix','{user}'),
 ('00000000-0000-4000-8000-000000100002','m0-00000000-0000-4000-8000-000000100002@example.invalid','M0 matrix','{user}'),
 ('00000000-0000-4000-8000-000000100003','m0-00000000-0000-4000-8000-000000100003@example.invalid','M0 matrix','{user}'),
 ('00000000-0000-4000-8000-000000100004','m0-00000000-0000-4000-8000-000000100004@example.invalid','M0 matrix','{user,admin}');
INSERT INTO public.clubs (id,name,status,created_by) VALUES
 ('00000000-0000-4000-8000-000000101041','M0 matrix club','approved','00000000-0000-4000-8000-000000100001'),
 ('00000000-0000-4000-8000-000000101042','M0 matrix club','approved','00000000-0000-4000-8000-000000100002');
INSERT INTO public.events (id,title,start_date,end_date,status,created_by,club_id) VALUES
 ('00000000-0000-4000-8000-000000101081','M0 matrix event','2031-01-01T18:00:00Z','2031-01-01T20:00:00Z','approved','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101041'),
 ('00000000-0000-4000-8000-000000101082','M0 matrix event','2031-01-01T18:00:00Z','2031-01-01T20:00:00Z','pending','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101042');
INSERT INTO public.events (id,title,start_date,end_date,status,created_by) VALUES ('00000000-0000-4000-8000-000000109999','M0 additional report event','2031-01-01T18:00:00Z','2031-01-01T20:00:00Z','approved','00000000-0000-4000-8000-000000100001');
INSERT INTO public.experiments (id,name) VALUES
 ('00000000-0000-4000-8000-000000101111','M0 matrix experiment'),
 ('00000000-0000-4000-8000-000000101112','M0 matrix experiment');
INSERT INTO public.experiment_variants (id,experiment_id,name) VALUES
 ('00000000-0000-4000-8000-000000101101','00000000-0000-4000-8000-000000101111','M0 variant'),
 ('00000000-0000-4000-8000-000000101102','00000000-0000-4000-8000-000000101112','M0 variant');
INSERT INTO public.admin_audit_log (id,admin_user_id,action,target_type,target_id) VALUES
 ('00000000-0000-4000-8000-000000101001','00000000-0000-4000-8000-000000100004','updated','club','00000000-0000-4000-8000-000000101041'),
 ('00000000-0000-4000-8000-000000101002','00000000-0000-4000-8000-000000100004','updated','club','00000000-0000-4000-8000-000000101042');
INSERT INTO public.club_followers (id,user_id,club_id) VALUES
 ('00000000-0000-4000-8000-000000101011','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101041'),
 ('00000000-0000-4000-8000-000000101012','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101042');
INSERT INTO public.club_invitations (id,club_id,inviter_id,invitee_email) VALUES
 ('00000000-0000-4000-8000-000000101021','00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000100001','unclaimed0@example.invalid'),
 ('00000000-0000-4000-8000-000000101022','00000000-0000-4000-8000-000000101042','00000000-0000-4000-8000-000000100002','unclaimed1@example.invalid');
INSERT INTO public.club_members (id,user_id,club_id,role) VALUES
 ('00000000-0000-4000-8000-000000101031','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101041','owner'),
 ('00000000-0000-4000-8000-000000101032','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101042','owner');
INSERT INTO public.event_invites (id,inviter_id,invitee_id,event_id) VALUES
 ('00000000-0000-4000-8000-000000101051','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101081'),
 ('00000000-0000-4000-8000-000000101052','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101082');
INSERT INTO public.event_reports (id,reporter_id,event_id,category) VALUES
 ('00000000-0000-4000-8000-000000101071','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081','other'),
 ('00000000-0000-4000-8000-000000101072','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082','other');
INSERT INTO public.experiment_assignments (id,user_id,experiment_id,variant_id) VALUES
 ('00000000-0000-4000-8000-000000101091','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101111','00000000-0000-4000-8000-000000101101'),
 ('00000000-0000-4000-8000-000000101092','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101112','00000000-0000-4000-8000-000000101102');
INSERT INTO public.featured_clubs (id,club_id,created_by,starts_at,ends_at) VALUES
 ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000100004',now()-interval '2 days',now()+interval '2 days'),
 ('00000000-0000-4000-8000-000000101122','00000000-0000-4000-8000-000000101042','00000000-0000-4000-8000-000000100004',now()-interval '3 days',now()-interval '1 day');
INSERT INTO public.featured_events (id,event_id,created_by,starts_at,ends_at) VALUES
 ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000100004',now()-interval '2 days',now()+interval '2 days'),
 ('00000000-0000-4000-8000-000000101132','00000000-0000-4000-8000-000000101082','00000000-0000-4000-8000-000000100004',now()-interval '3 days',now()-interval '1 day');
INSERT INTO public.feedback (id,user_id,message) VALUES
 ('00000000-0000-4000-8000-000000101141','00000000-0000-4000-8000-000000100001','M0 fixture'),
 ('00000000-0000-4000-8000-000000101142','00000000-0000-4000-8000-000000100002','M0 fixture');
INSERT INTO public.feedback_request_log (id,user_id,event_id,request_type) VALUES
 ('00000000-0000-4000-8000-000000101151','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081','post_event'),
 ('00000000-0000-4000-8000-000000101152','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082','post_event');
INSERT INTO public.legacy_reminder_log (id,user_id,event_id,reminder_type) VALUES
 ('00000000-0000-4000-8000-000000101161','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081','reminder_24h'),
 ('00000000-0000-4000-8000-000000101162','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082','reminder_24h');
INSERT INTO public.moderation_reviews (id,target_type,target_id,action,message,author_id) VALUES
 ('00000000-0000-4000-8000-000000101171','event','00000000-0000-4000-8000-000000101081','approval','M0 fixture','00000000-0000-4000-8000-000000100004'),
 ('00000000-0000-4000-8000-000000101172','event','00000000-0000-4000-8000-000000101082','approval','M0 fixture','00000000-0000-4000-8000-000000100004');
INSERT INTO public.notifications (id,user_id,type,title,message) VALUES
 ('00000000-0000-4000-8000-000000101181','00000000-0000-4000-8000-000000100001','m0_fixture','M0 fixture','M0 fixture'),
 ('00000000-0000-4000-8000-000000101182','00000000-0000-4000-8000-000000100002','m0_fixture','M0 fixture','M0 fixture');
INSERT INTO public.organizer_requests (id,user_id,club_id) VALUES
 ('00000000-0000-4000-8000-000000101191','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101041'),
 ('00000000-0000-4000-8000-000000101192','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101042');
INSERT INTO public.recommendation_explicit_feedback (id,user_id,event_id,feedback_type) VALUES
 ('00000000-0000-4000-8000-000000101201','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081','positive'),
 ('00000000-0000-4000-8000-000000101202','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082','positive');
INSERT INTO public.recommendation_feedback (id,user_id,event_id,recommendation_rank,action) VALUES
 ('00000000-0000-4000-8000-000000101211','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081',1,'click'),
 ('00000000-0000-4000-8000-000000101212','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082',1,'click');
INSERT INTO public.reviews (id,user_id,event_id,rating) VALUES
 ('00000000-0000-4000-8000-000000101221','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081',5),
 ('00000000-0000-4000-8000-000000101222','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082',5);
INSERT INTO public.rsvps (id,user_id,event_id) VALUES
 ('00000000-0000-4000-8000-000000101231','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081'),
 ('00000000-0000-4000-8000-000000101232','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082');
INSERT INTO public.saved_events (id,user_id,event_id) VALUES
 ('00000000-0000-4000-8000-000000101241','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081'),
 ('00000000-0000-4000-8000-000000101242','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082');
INSERT INTO public.tag_interaction_counts (user_id,tag) VALUES
 ('00000000-0000-4000-8000-000000100001','m0_rls_matrix'),
 ('00000000-0000-4000-8000-000000100002','m0_rls_matrix');
INSERT INTO public.user_event_scores (user_id,event_id,score) VALUES
 ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081',0.5),
 ('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082',0.5);
INSERT INTO public.user_follows (id,follower_id,following_id) VALUES
 ('00000000-0000-4000-8000-000000101271','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002'),
 ('00000000-0000-4000-8000-000000101272','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000100001');
INSERT INTO public.user_interactions (id,user_id,event_id,interaction_type) VALUES
 ('00000000-0000-4000-8000-000000101281','00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081','view'),
 ('00000000-0000-4000-8000-000000101282','00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101082','view');

-- Verify fixture existence before any denial, so an empty table cannot pass.
SELECT is((SELECT count(*)::integer FROM public.admin_audit_log WHERE id IN ('00000000-0000-4000-8000-000000101001','00000000-0000-4000-8000-000000101002')),2,'fixture admin_audit_log has both subjects');
SELECT is((SELECT count(*)::integer FROM public.club_followers WHERE id IN ('00000000-0000-4000-8000-000000101011','00000000-0000-4000-8000-000000101012')),2,'fixture club_followers has both subjects');
SELECT is((SELECT count(*)::integer FROM public.club_invitations WHERE id IN ('00000000-0000-4000-8000-000000101021','00000000-0000-4000-8000-000000101022')),2,'fixture club_invitations has both subjects');
SELECT is((SELECT count(*)::integer FROM public.club_members WHERE id IN ('00000000-0000-4000-8000-000000101031','00000000-0000-4000-8000-000000101032')),2,'fixture club_members has both subjects');
SELECT is((SELECT count(*)::integer FROM public.clubs WHERE id IN ('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000101042')),2,'fixture clubs has both subjects');
SELECT is((SELECT count(*)::integer FROM public.event_invites WHERE id IN ('00000000-0000-4000-8000-000000101051','00000000-0000-4000-8000-000000101052')),2,'fixture event_invites has both subjects');
SELECT is((SELECT count(*)::integer FROM public.event_popularity_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'fixture event_popularity_scores has both subjects');
SELECT is((SELECT count(*)::integer FROM public.event_reports WHERE id IN ('00000000-0000-4000-8000-000000101071','00000000-0000-4000-8000-000000101072')),2,'fixture event_reports has both subjects');
SELECT is((SELECT count(*)::integer FROM public.events WHERE id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'fixture events has both subjects');
SELECT is((SELECT count(*)::integer FROM public.experiment_assignments WHERE id IN ('00000000-0000-4000-8000-000000101091','00000000-0000-4000-8000-000000101092')),2,'fixture experiment_assignments has both subjects');
SELECT is((SELECT count(*)::integer FROM public.experiment_variants WHERE id IN ('00000000-0000-4000-8000-000000101101','00000000-0000-4000-8000-000000101102')),2,'fixture experiment_variants has both subjects');
SELECT is((SELECT count(*)::integer FROM public.experiments WHERE id IN ('00000000-0000-4000-8000-000000101111','00000000-0000-4000-8000-000000101112')),2,'fixture experiments has both subjects');
SELECT is((SELECT count(*)::integer FROM public.featured_clubs WHERE id IN ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101122')),2,'fixture featured_clubs has both subjects');
SELECT is((SELECT count(*)::integer FROM public.featured_events WHERE id IN ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101132')),2,'fixture featured_events has both subjects');
SELECT is((SELECT count(*)::integer FROM public.feedback WHERE id IN ('00000000-0000-4000-8000-000000101141','00000000-0000-4000-8000-000000101142')),2,'fixture feedback has both subjects');
SELECT is((SELECT count(*)::integer FROM public.feedback_request_log WHERE id IN ('00000000-0000-4000-8000-000000101151','00000000-0000-4000-8000-000000101152')),2,'fixture feedback_request_log has both subjects');
SELECT is((SELECT count(*)::integer FROM public.legacy_reminder_log WHERE id IN ('00000000-0000-4000-8000-000000101161','00000000-0000-4000-8000-000000101162')),2,'fixture legacy_reminder_log has both subjects');
SELECT is((SELECT count(*)::integer FROM public.moderation_reviews WHERE id IN ('00000000-0000-4000-8000-000000101171','00000000-0000-4000-8000-000000101172')),2,'fixture moderation_reviews has both subjects');
SELECT is((SELECT count(*)::integer FROM public.notifications WHERE id IN ('00000000-0000-4000-8000-000000101181','00000000-0000-4000-8000-000000101182')),2,'fixture notifications has both subjects');
SELECT is((SELECT count(*)::integer FROM public.organizer_requests WHERE id IN ('00000000-0000-4000-8000-000000101191','00000000-0000-4000-8000-000000101192')),2,'fixture organizer_requests has both subjects');
SELECT is((SELECT count(*)::integer FROM public.recommendation_explicit_feedback WHERE id IN ('00000000-0000-4000-8000-000000101201','00000000-0000-4000-8000-000000101202')),2,'fixture recommendation_explicit_feedback has both subjects');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback WHERE id IN ('00000000-0000-4000-8000-000000101211','00000000-0000-4000-8000-000000101212')),2,'fixture recommendation_feedback has both subjects');
SELECT is((SELECT count(*)::integer FROM public.reviews WHERE id IN ('00000000-0000-4000-8000-000000101221','00000000-0000-4000-8000-000000101222')),2,'fixture reviews has both subjects');
SELECT is((SELECT count(*)::integer FROM public.rsvps WHERE id IN ('00000000-0000-4000-8000-000000101231','00000000-0000-4000-8000-000000101232')),2,'fixture rsvps has both subjects');
SELECT is((SELECT count(*)::integer FROM public.saved_events WHERE id IN ('00000000-0000-4000-8000-000000101241','00000000-0000-4000-8000-000000101242')),2,'fixture saved_events has both subjects');
SELECT is((SELECT count(*)::integer FROM public.tag_interaction_counts WHERE tag='m0_rls_matrix' AND user_id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),2,'fixture tag_interaction_counts has both subjects');
SELECT is((SELECT count(*)::integer FROM public.user_event_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'fixture user_event_scores has both subjects');
SELECT is((SELECT count(*)::integer FROM public.user_follows WHERE id IN ('00000000-0000-4000-8000-000000101271','00000000-0000-4000-8000-000000101272')),2,'fixture user_follows has both subjects');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE id IN ('00000000-0000-4000-8000-000000101281','00000000-0000-4000-8000-000000101282')),2,'fixture user_interactions has both subjects');
SELECT is((SELECT count(*)::integer FROM public.users WHERE id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),2,'fixture users has both subjects');

SELECT is((SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity),0,'every public table has RLS enabled');

INSERT INTO public.opportunities(id,slug,listing_type,title,description,organization,relevance_scope,status,published_at,created_by,updated_by) VALUES
 ('00000000-0000-4000-8000-000000109991','m2-matrix-public','job','M2 matrix','Public','M2','specific','published',now(),'00000000-0000-4000-8000-000000100004','00000000-0000-4000-8000-000000100004'),
 ('00000000-0000-4000-8000-000000109992','m2-matrix-draft','job','M2 matrix','Private','M2','specific','draft',NULL,'00000000-0000-4000-8000-000000100004','00000000-0000-4000-8000-000000100004');
INSERT INTO public.opportunity_universities VALUES('00000000-0000-4000-8000-000000109991','10000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000109992','10000000-0000-4000-8000-000000000001');
INSERT INTO public.event_discovery_metadata(event_id,updated_by) VALUES('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000100004'),('00000000-0000-4000-8000-000000101082','00000000-0000-4000-8000-000000100004');
INSERT INTO public.event_discovery_universities VALUES('00000000-0000-4000-8000-000000101081','10000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000101082','10000000-0000-4000-8000-000000000001');
INSERT INTO public.saved_opportunities(user_id,opportunity_id) VALUES('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000109991');
INSERT INTO public.resources(id,slug,resource_type,title,summary,body_markdown,category,audience,author_name,status,reviewed_at,published_at,created_by,updated_by) VALUES
 ('00000000-0000-4000-8000-000000109993','m3-matrix-resource','guide','M3 matrix resource','Public','Public body','career','Everyone','M3 matrix author','published',now(),now(),'00000000-0000-4000-8000-000000100004','00000000-0000-4000-8000-000000100004');
INSERT INTO public.resources(id,slug,resource_type,title,summary,body_markdown,category,audience,author_name,status,created_by,updated_by) VALUES
 ('00000000-0000-4000-8000-000000109994','m3-matrix-resource-draft','guide','M3 matrix resource draft','Private','Draft body','career','Everyone','M3 matrix author','draft','00000000-0000-4000-8000-000000100004','00000000-0000-4000-8000-000000100004');
INSERT INTO public.resource_actions(resource_id,action) VALUES('00000000-0000-4000-8000-000000109993','outbound');
INSERT INTO public.submissions(id,kind,title,organization,source_url,submitter_user_id,client_hash) VALUES
 ('00000000-0000-4000-8000-000000109995','job','M3 matrix submission','M3 matrix org','https://example.invalid/m3-matrix','00000000-0000-4000-8000-000000100001',repeat('a',64));
INSERT INTO public.listing_reports(id,event_id,reason,reporter_user_id,client_hash) VALUES
 ('00000000-0000-4000-8000-000000109996','00000000-0000-4000-8000-000000101081','other','00000000-0000-4000-8000-000000100001',repeat('a',64));
INSERT INTO public.ingestion_deliveries(id,producer,outcome,event_count) VALUES
 ('00000000-0000-4000-8000-000000109997','instagram-apify@1','heartbeat',0);

-- CERT-07 assertion region start

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT is((SELECT count(*)::integer FROM public.universities WHERE id='10000000-0000-4000-8000-000000000001'),1,'universities anon read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunities WHERE id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunities anon read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunity_universities WHERE opportunity_id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunity_universities anon read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_metadata WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_metadata anon read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_universities WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_universities anon read allow');
SELECT is((SELECT count(*)::integer FROM public.resources WHERE id IN ('00000000-0000-4000-8000-000000109993','00000000-0000-4000-8000-000000109994')),1,'resources anon read allow');
SELECT throws_ok('SELECT * FROM public.resource_actions','42501',NULL,'resource_actions anon read deny');
SELECT throws_ok('SELECT * FROM public.submissions','42501',NULL,'submissions anon read deny');
SELECT throws_ok('SELECT * FROM public.listing_reports','42501',NULL,'listing_reports anon read deny');
SELECT throws_ok('SELECT * FROM public.ingestion_deliveries','42501',NULL,'ingestion_deliveries anon read deny');
SELECT throws_ok('SELECT * FROM public.saved_opportunities','42501',NULL,'saved_opportunities anon read deny');
SELECT set_config('request.jwt.claims','{}',true);
SELECT is((SELECT count(*)::integer FROM public.admin_audit_log WHERE id IN ('00000000-0000-4000-8000-000000101001','00000000-0000-4000-8000-000000101002')),0,'admin_audit_log anon read deny');
SELECT is((SELECT count(*)::integer FROM public.club_followers WHERE id IN ('00000000-0000-4000-8000-000000101011','00000000-0000-4000-8000-000000101012')),2,'club_followers anon read allow');
SELECT is((SELECT count(*)::integer FROM public.club_invitations WHERE id IN ('00000000-0000-4000-8000-000000101021','00000000-0000-4000-8000-000000101022')),0,'club_invitations anon read deny');
SELECT is((SELECT count(*)::integer FROM public.club_members WHERE id IN ('00000000-0000-4000-8000-000000101031','00000000-0000-4000-8000-000000101032')),0,'club_members anon read deny');
SELECT is((SELECT count(*)::integer FROM public.clubs WHERE id IN ('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000101042')),2,'clubs anon read allow');
SELECT is((SELECT count(*)::integer FROM public.event_invites WHERE id IN ('00000000-0000-4000-8000-000000101051','00000000-0000-4000-8000-000000101052')),0,'event_invites anon read deny');
SELECT is((SELECT count(*)::integer FROM public.event_popularity_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'event_popularity_scores anon read allow');
SELECT is((SELECT count(*)::integer FROM public.event_reports WHERE id IN ('00000000-0000-4000-8000-000000101071','00000000-0000-4000-8000-000000101072')),0,'event_reports anon read deny');
SELECT is((SELECT count(*)::integer FROM public.events WHERE id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'events anon read allow');
SELECT is((SELECT count(*)::integer FROM public.experiment_assignments WHERE id IN ('00000000-0000-4000-8000-000000101091','00000000-0000-4000-8000-000000101092')),0,'experiment_assignments anon read deny');
SELECT is((SELECT count(*)::integer FROM public.experiment_variants WHERE id IN ('00000000-0000-4000-8000-000000101101','00000000-0000-4000-8000-000000101102')),0,'experiment_variants anon read deny');
SELECT is((SELECT count(*)::integer FROM public.experiments WHERE id IN ('00000000-0000-4000-8000-000000101111','00000000-0000-4000-8000-000000101112')),0,'experiments anon read deny');
SELECT is((SELECT count(*)::integer FROM public.featured_clubs WHERE id IN ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101122')),2,'featured_clubs anon read allow');
SELECT is((SELECT count(*)::integer FROM public.featured_events WHERE id IN ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101132')),1,'featured_events anon read allow');
SELECT is((SELECT count(*)::integer FROM public.feedback WHERE id IN ('00000000-0000-4000-8000-000000101141','00000000-0000-4000-8000-000000101142')),0,'feedback anon read deny');
SELECT is((SELECT count(*)::integer FROM public.feedback_request_log WHERE id IN ('00000000-0000-4000-8000-000000101151','00000000-0000-4000-8000-000000101152')),0,'feedback_request_log anon read deny');
SELECT is((SELECT count(*)::integer FROM public.legacy_reminder_log WHERE id IN ('00000000-0000-4000-8000-000000101161','00000000-0000-4000-8000-000000101162')),0,'legacy_reminder_log anon read deny');
SELECT is((SELECT count(*)::integer FROM public.moderation_reviews WHERE id IN ('00000000-0000-4000-8000-000000101171','00000000-0000-4000-8000-000000101172')),0,'moderation_reviews anon read deny');
SELECT is((SELECT count(*)::integer FROM public.notifications WHERE id IN ('00000000-0000-4000-8000-000000101181','00000000-0000-4000-8000-000000101182')),0,'notifications anon read deny');
SELECT is((SELECT count(*)::integer FROM public.organizer_requests WHERE id IN ('00000000-0000-4000-8000-000000101191','00000000-0000-4000-8000-000000101192')),0,'organizer_requests anon read deny');
SELECT is((SELECT count(*)::integer FROM public.recommendation_explicit_feedback WHERE id IN ('00000000-0000-4000-8000-000000101201','00000000-0000-4000-8000-000000101202')),0,'recommendation_explicit_feedback anon read deny');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback WHERE id IN ('00000000-0000-4000-8000-000000101211','00000000-0000-4000-8000-000000101212')),0,'recommendation_feedback anon read deny');
SELECT throws_ok('SELECT * FROM public.reviews','42501',NULL,'reviews anon read deny');
SELECT is((SELECT count(*)::integer FROM public.rsvps WHERE id IN ('00000000-0000-4000-8000-000000101231','00000000-0000-4000-8000-000000101232')),0,'rsvps anon read deny');
SELECT is((SELECT count(*)::integer FROM public.saved_events WHERE id IN ('00000000-0000-4000-8000-000000101241','00000000-0000-4000-8000-000000101242')),0,'saved_events anon read deny');
SELECT is((SELECT count(*)::integer FROM public.tag_interaction_counts WHERE tag='m0_rls_matrix' AND user_id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),0,'tag_interaction_counts anon read deny');
SELECT is((SELECT count(*)::integer FROM public.user_event_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),0,'user_event_scores anon read deny');
SELECT is((SELECT count(*)::integer FROM public.user_follows WHERE id IN ('00000000-0000-4000-8000-000000101271','00000000-0000-4000-8000-000000101272')),2,'user_follows anon read allow');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE id IN ('00000000-0000-4000-8000-000000101281','00000000-0000-4000-8000-000000101282')),0,'user_interactions anon read deny');
SELECT is((SELECT count(*)::integer FROM public.users WHERE id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),0,'users anon read deny');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000100001',true);
SELECT is((SELECT count(*)::integer FROM public.universities WHERE id='10000000-0000-4000-8000-000000000001'),1,'universities subject read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunities WHERE id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunities subject read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunity_universities WHERE opportunity_id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunity_universities subject read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_metadata WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_metadata subject read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_universities WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_universities subject read allow');
SELECT is((SELECT count(*)::integer FROM public.resources WHERE id IN ('00000000-0000-4000-8000-000000109993','00000000-0000-4000-8000-000000109994')),1,'resources subject read allow');
SELECT is((SELECT count(*)::integer FROM public.resource_actions WHERE resource_id='00000000-0000-4000-8000-000000109993'),0,'resource_actions subject read deny');
SELECT is((SELECT count(*)::integer FROM public.submissions WHERE id='00000000-0000-4000-8000-000000109995'),0,'submissions subject read deny');
SELECT is((SELECT count(*)::integer FROM public.listing_reports WHERE id='00000000-0000-4000-8000-000000109996'),0,'listing_reports subject read deny');
SELECT is((SELECT count(*)::integer FROM public.ingestion_deliveries WHERE id='00000000-0000-4000-8000-000000109997'),0,'ingestion_deliveries subject read deny');
SELECT is((SELECT count(*)::integer FROM public.saved_opportunities WHERE user_id='00000000-0000-4000-8000-000000100001'),1,'saved_opportunities subject read allow');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000100001","role":"authenticated"}',true);
SELECT is((SELECT count(*)::integer FROM public.admin_audit_log WHERE id IN ('00000000-0000-4000-8000-000000101001','00000000-0000-4000-8000-000000101002')),0,'admin_audit_log subject read deny');
SELECT is((SELECT count(*)::integer FROM public.club_followers WHERE id IN ('00000000-0000-4000-8000-000000101011','00000000-0000-4000-8000-000000101012')),2,'club_followers subject read allow');
SELECT is((SELECT count(*)::integer FROM public.club_invitations WHERE id IN ('00000000-0000-4000-8000-000000101021','00000000-0000-4000-8000-000000101022')),1,'club_invitations subject read allow');
SELECT is((SELECT count(*)::integer FROM public.club_members WHERE id IN ('00000000-0000-4000-8000-000000101031','00000000-0000-4000-8000-000000101032')),1,'club_members subject read allow');
SELECT is((SELECT count(*)::integer FROM public.clubs WHERE id IN ('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000101042')),2,'clubs subject read allow');
SELECT is((SELECT count(*)::integer FROM public.event_invites WHERE id IN ('00000000-0000-4000-8000-000000101051','00000000-0000-4000-8000-000000101052')),2,'event_invites subject read allow');
SELECT is((SELECT count(*)::integer FROM public.event_popularity_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'event_popularity_scores subject read allow');
SELECT is((SELECT count(*)::integer FROM public.event_reports WHERE id IN ('00000000-0000-4000-8000-000000101071','00000000-0000-4000-8000-000000101072')),1,'event_reports subject read allow');
SELECT is((SELECT count(*)::integer FROM public.events WHERE id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'events subject read allow');
SELECT is((SELECT count(*)::integer FROM public.experiment_assignments WHERE id IN ('00000000-0000-4000-8000-000000101091','00000000-0000-4000-8000-000000101092')),1,'experiment_assignments subject read allow');
SELECT is((SELECT count(*)::integer FROM public.experiment_variants WHERE id IN ('00000000-0000-4000-8000-000000101101','00000000-0000-4000-8000-000000101102')),0,'experiment_variants subject read deny');
SELECT is((SELECT count(*)::integer FROM public.experiments WHERE id IN ('00000000-0000-4000-8000-000000101111','00000000-0000-4000-8000-000000101112')),0,'experiments subject read deny');
SELECT is((SELECT count(*)::integer FROM public.featured_clubs WHERE id IN ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101122')),2,'featured_clubs subject read allow');
SELECT is((SELECT count(*)::integer FROM public.featured_events WHERE id IN ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101132')),1,'featured_events subject read allow');
SELECT is((SELECT count(*)::integer FROM public.feedback WHERE id IN ('00000000-0000-4000-8000-000000101141','00000000-0000-4000-8000-000000101142')),0,'feedback subject read deny');
SELECT is((SELECT count(*)::integer FROM public.feedback_request_log WHERE id IN ('00000000-0000-4000-8000-000000101151','00000000-0000-4000-8000-000000101152')),1,'feedback_request_log subject read allow');
SELECT is((SELECT count(*)::integer FROM public.legacy_reminder_log WHERE id IN ('00000000-0000-4000-8000-000000101161','00000000-0000-4000-8000-000000101162')),1,'legacy_reminder_log subject read allow');
SELECT is((SELECT count(*)::integer FROM public.moderation_reviews WHERE id IN ('00000000-0000-4000-8000-000000101171','00000000-0000-4000-8000-000000101172')),1,'moderation_reviews subject read allow');
SELECT is((SELECT count(*)::integer FROM public.notifications WHERE id IN ('00000000-0000-4000-8000-000000101181','00000000-0000-4000-8000-000000101182')),1,'notifications subject read allow');
SELECT is((SELECT count(*)::integer FROM public.organizer_requests WHERE id IN ('00000000-0000-4000-8000-000000101191','00000000-0000-4000-8000-000000101192')),1,'organizer_requests subject read allow');
SELECT is((SELECT count(*)::integer FROM public.recommendation_explicit_feedback WHERE id IN ('00000000-0000-4000-8000-000000101201','00000000-0000-4000-8000-000000101202')),1,'recommendation_explicit_feedback subject read allow');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback WHERE id IN ('00000000-0000-4000-8000-000000101211','00000000-0000-4000-8000-000000101212')),1,'recommendation_feedback subject read allow');
SELECT is((SELECT count(*)::integer FROM public.reviews WHERE id IN ('00000000-0000-4000-8000-000000101221','00000000-0000-4000-8000-000000101222')),1,'reviews subject read allow');
SELECT is((SELECT count(*)::integer FROM public.rsvps WHERE id IN ('00000000-0000-4000-8000-000000101231','00000000-0000-4000-8000-000000101232')),1,'rsvps subject read allow');
SELECT is((SELECT count(*)::integer FROM public.saved_events WHERE id IN ('00000000-0000-4000-8000-000000101241','00000000-0000-4000-8000-000000101242')),1,'saved_events subject read allow');
SELECT is((SELECT count(*)::integer FROM public.tag_interaction_counts WHERE tag='m0_rls_matrix' AND user_id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),1,'tag_interaction_counts subject read allow');
SELECT is((SELECT count(*)::integer FROM public.user_event_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'user_event_scores subject read allow');
SELECT is((SELECT count(*)::integer FROM public.user_follows WHERE id IN ('00000000-0000-4000-8000-000000101271','00000000-0000-4000-8000-000000101272')),2,'user_follows subject read allow');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE id IN ('00000000-0000-4000-8000-000000101281','00000000-0000-4000-8000-000000101282')),1,'user_interactions subject read allow');
SELECT is((SELECT count(*)::integer FROM public.users WHERE id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),1,'users subject read allow');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000100003',true);
SELECT is((SELECT count(*)::integer FROM public.universities WHERE id='10000000-0000-4000-8000-000000000001'),1,'universities outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunities WHERE id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunities outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunity_universities WHERE opportunity_id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunity_universities outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_metadata WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_metadata outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_universities WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_universities outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.resources WHERE id IN ('00000000-0000-4000-8000-000000109993','00000000-0000-4000-8000-000000109994')),1,'resources outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.resource_actions WHERE resource_id='00000000-0000-4000-8000-000000109993'),0,'resource_actions outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.submissions WHERE id='00000000-0000-4000-8000-000000109995'),0,'submissions outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.listing_reports WHERE id='00000000-0000-4000-8000-000000109996'),0,'listing_reports outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.ingestion_deliveries WHERE id='00000000-0000-4000-8000-000000109997'),0,'ingestion_deliveries outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.saved_opportunities WHERE user_id='00000000-0000-4000-8000-000000100001'),0,'saved_opportunities outsider read deny');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000100003","role":"authenticated"}',true);
SELECT is((SELECT count(*)::integer FROM public.admin_audit_log WHERE id IN ('00000000-0000-4000-8000-000000101001','00000000-0000-4000-8000-000000101002')),0,'admin_audit_log outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.club_followers WHERE id IN ('00000000-0000-4000-8000-000000101011','00000000-0000-4000-8000-000000101012')),2,'club_followers outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.club_invitations WHERE id IN ('00000000-0000-4000-8000-000000101021','00000000-0000-4000-8000-000000101022')),0,'club_invitations outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.club_members WHERE id IN ('00000000-0000-4000-8000-000000101031','00000000-0000-4000-8000-000000101032')),0,'club_members outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.clubs WHERE id IN ('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000101042')),2,'clubs outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.event_invites WHERE id IN ('00000000-0000-4000-8000-000000101051','00000000-0000-4000-8000-000000101052')),0,'event_invites outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.event_popularity_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'event_popularity_scores outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.event_reports WHERE id IN ('00000000-0000-4000-8000-000000101071','00000000-0000-4000-8000-000000101072')),0,'event_reports outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.events WHERE id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'events outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.experiment_assignments WHERE id IN ('00000000-0000-4000-8000-000000101091','00000000-0000-4000-8000-000000101092')),0,'experiment_assignments outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.experiment_variants WHERE id IN ('00000000-0000-4000-8000-000000101101','00000000-0000-4000-8000-000000101102')),0,'experiment_variants outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.experiments WHERE id IN ('00000000-0000-4000-8000-000000101111','00000000-0000-4000-8000-000000101112')),0,'experiments outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.featured_clubs WHERE id IN ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101122')),2,'featured_clubs outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.featured_events WHERE id IN ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101132')),1,'featured_events outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.feedback WHERE id IN ('00000000-0000-4000-8000-000000101141','00000000-0000-4000-8000-000000101142')),0,'feedback outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.feedback_request_log WHERE id IN ('00000000-0000-4000-8000-000000101151','00000000-0000-4000-8000-000000101152')),0,'feedback_request_log outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.legacy_reminder_log WHERE id IN ('00000000-0000-4000-8000-000000101161','00000000-0000-4000-8000-000000101162')),0,'legacy_reminder_log outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.moderation_reviews WHERE id IN ('00000000-0000-4000-8000-000000101171','00000000-0000-4000-8000-000000101172')),0,'moderation_reviews outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.notifications WHERE id IN ('00000000-0000-4000-8000-000000101181','00000000-0000-4000-8000-000000101182')),0,'notifications outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.organizer_requests WHERE id IN ('00000000-0000-4000-8000-000000101191','00000000-0000-4000-8000-000000101192')),0,'organizer_requests outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.recommendation_explicit_feedback WHERE id IN ('00000000-0000-4000-8000-000000101201','00000000-0000-4000-8000-000000101202')),0,'recommendation_explicit_feedback outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback WHERE id IN ('00000000-0000-4000-8000-000000101211','00000000-0000-4000-8000-000000101212')),0,'recommendation_feedback outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.reviews WHERE id IN ('00000000-0000-4000-8000-000000101221','00000000-0000-4000-8000-000000101222')),0,'reviews outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.rsvps WHERE id IN ('00000000-0000-4000-8000-000000101231','00000000-0000-4000-8000-000000101232')),0,'rsvps outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.saved_events WHERE id IN ('00000000-0000-4000-8000-000000101241','00000000-0000-4000-8000-000000101242')),0,'saved_events outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.tag_interaction_counts WHERE tag='m0_rls_matrix' AND user_id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),0,'tag_interaction_counts outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.user_event_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),0,'user_event_scores outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.user_follows WHERE id IN ('00000000-0000-4000-8000-000000101271','00000000-0000-4000-8000-000000101272')),2,'user_follows outsider read allow');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE id IN ('00000000-0000-4000-8000-000000101281','00000000-0000-4000-8000-000000101282')),0,'user_interactions outsider read deny');
SELECT is((SELECT count(*)::integer FROM public.users WHERE id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),0,'users outsider read deny');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000100004',true);
SELECT is((SELECT count(*)::integer FROM public.universities WHERE id='10000000-0000-4000-8000-000000000001'),1,'universities admin read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunities WHERE id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunities admin read allow');
SELECT is((SELECT count(*)::integer FROM public.opportunity_universities WHERE opportunity_id IN ('00000000-0000-4000-8000-000000109991','00000000-0000-4000-8000-000000109992')),1,'opportunity_universities admin read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_metadata WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_metadata admin read allow');
SELECT is((SELECT count(*)::integer FROM public.event_discovery_universities WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),1,'event_discovery_universities admin read allow');
SELECT is((SELECT count(*)::integer FROM public.resources WHERE id IN ('00000000-0000-4000-8000-000000109993','00000000-0000-4000-8000-000000109994')),1,'resources admin read allow');
SELECT is((SELECT count(*)::integer FROM public.resource_actions WHERE resource_id='00000000-0000-4000-8000-000000109993'),1,'resource_actions admin read allow');
SELECT is((SELECT count(*)::integer FROM public.submissions WHERE id='00000000-0000-4000-8000-000000109995'),1,'submissions admin read allow');
SELECT is((SELECT count(*)::integer FROM public.listing_reports WHERE id='00000000-0000-4000-8000-000000109996'),1,'listing_reports admin read allow');
SELECT is((SELECT count(*)::integer FROM public.ingestion_deliveries WHERE id='00000000-0000-4000-8000-000000109997'),1,'ingestion_deliveries admin read allow');
SELECT is((SELECT count(*)::integer FROM public.saved_opportunities WHERE user_id='00000000-0000-4000-8000-000000100001'),0,'saved_opportunities admin read deny');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000100004","role":"authenticated"}',true);
SELECT is((SELECT count(*)::integer FROM public.admin_audit_log WHERE id IN ('00000000-0000-4000-8000-000000101001','00000000-0000-4000-8000-000000101002')),2,'admin_audit_log admin read allow');
SELECT is((SELECT count(*)::integer FROM public.club_followers WHERE id IN ('00000000-0000-4000-8000-000000101011','00000000-0000-4000-8000-000000101012')),2,'club_followers admin read allow');
SELECT is((SELECT count(*)::integer FROM public.club_invitations WHERE id IN ('00000000-0000-4000-8000-000000101021','00000000-0000-4000-8000-000000101022')),0,'club_invitations admin read deny');
SELECT is((SELECT count(*)::integer FROM public.club_members WHERE id IN ('00000000-0000-4000-8000-000000101031','00000000-0000-4000-8000-000000101032')),2,'club_members admin read allow');
SELECT is((SELECT count(*)::integer FROM public.clubs WHERE id IN ('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000101042')),2,'clubs admin read allow');
SELECT is((SELECT count(*)::integer FROM public.event_invites WHERE id IN ('00000000-0000-4000-8000-000000101051','00000000-0000-4000-8000-000000101052')),0,'event_invites admin read deny');
SELECT is((SELECT count(*)::integer FROM public.event_popularity_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'event_popularity_scores admin read allow');
SELECT is((SELECT count(*)::integer FROM public.event_reports WHERE id IN ('00000000-0000-4000-8000-000000101071','00000000-0000-4000-8000-000000101072')),2,'event_reports admin read allow');
SELECT is((SELECT count(*)::integer FROM public.events WHERE id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),2,'events admin read allow');
SELECT is((SELECT count(*)::integer FROM public.experiment_assignments WHERE id IN ('00000000-0000-4000-8000-000000101091','00000000-0000-4000-8000-000000101092')),2,'experiment_assignments admin read allow');
SELECT is((SELECT count(*)::integer FROM public.experiment_variants WHERE id IN ('00000000-0000-4000-8000-000000101101','00000000-0000-4000-8000-000000101102')),2,'experiment_variants admin read allow');
SELECT is((SELECT count(*)::integer FROM public.experiments WHERE id IN ('00000000-0000-4000-8000-000000101111','00000000-0000-4000-8000-000000101112')),2,'experiments admin read allow');
SELECT is((SELECT count(*)::integer FROM public.featured_clubs WHERE id IN ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101122')),2,'featured_clubs admin read allow');
SELECT is((SELECT count(*)::integer FROM public.featured_events WHERE id IN ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101132')),2,'featured_events admin read allow');
SELECT is((SELECT count(*)::integer FROM public.feedback WHERE id IN ('00000000-0000-4000-8000-000000101141','00000000-0000-4000-8000-000000101142')),2,'feedback admin read allow');
SELECT is((SELECT count(*)::integer FROM public.feedback_request_log WHERE id IN ('00000000-0000-4000-8000-000000101151','00000000-0000-4000-8000-000000101152')),0,'feedback_request_log admin read deny');
SELECT is((SELECT count(*)::integer FROM public.legacy_reminder_log WHERE id IN ('00000000-0000-4000-8000-000000101161','00000000-0000-4000-8000-000000101162')),0,'legacy_reminder_log admin read deny');
SELECT is((SELECT count(*)::integer FROM public.moderation_reviews WHERE id IN ('00000000-0000-4000-8000-000000101171','00000000-0000-4000-8000-000000101172')),2,'moderation_reviews admin read allow');
SELECT is((SELECT count(*)::integer FROM public.notifications WHERE id IN ('00000000-0000-4000-8000-000000101181','00000000-0000-4000-8000-000000101182')),0,'notifications admin read deny');
SELECT is((SELECT count(*)::integer FROM public.organizer_requests WHERE id IN ('00000000-0000-4000-8000-000000101191','00000000-0000-4000-8000-000000101192')),2,'organizer_requests admin read allow');
SELECT is((SELECT count(*)::integer FROM public.recommendation_explicit_feedback WHERE id IN ('00000000-0000-4000-8000-000000101201','00000000-0000-4000-8000-000000101202')),0,'recommendation_explicit_feedback admin read deny');
SELECT is((SELECT count(*)::integer FROM public.recommendation_feedback WHERE id IN ('00000000-0000-4000-8000-000000101211','00000000-0000-4000-8000-000000101212')),0,'recommendation_feedback admin read deny');
SELECT is((SELECT count(*)::integer FROM public.reviews WHERE id IN ('00000000-0000-4000-8000-000000101221','00000000-0000-4000-8000-000000101222')),2,'reviews admin read allow');
SELECT is((SELECT count(*)::integer FROM public.rsvps WHERE id IN ('00000000-0000-4000-8000-000000101231','00000000-0000-4000-8000-000000101232')),2,'rsvps admin read allow');
SELECT is((SELECT count(*)::integer FROM public.saved_events WHERE id IN ('00000000-0000-4000-8000-000000101241','00000000-0000-4000-8000-000000101242')),0,'saved_events admin read deny');
SELECT is((SELECT count(*)::integer FROM public.tag_interaction_counts WHERE tag='m0_rls_matrix' AND user_id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),0,'tag_interaction_counts admin read deny');
SELECT is((SELECT count(*)::integer FROM public.user_event_scores WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')),0,'user_event_scores admin read deny');
SELECT is((SELECT count(*)::integer FROM public.user_follows WHERE id IN ('00000000-0000-4000-8000-000000101271','00000000-0000-4000-8000-000000101272')),2,'user_follows admin read allow');
SELECT is((SELECT count(*)::integer FROM public.user_interactions WHERE id IN ('00000000-0000-4000-8000-000000101281','00000000-0000-4000-8000-000000101282')),0,'user_interactions admin read deny');
SELECT is((SELECT count(*)::integer FROM public.users WHERE id IN ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100002')),2,'users admin read allow');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
WITH changed AS (UPDATE public.clubs SET name='forged' WHERE id IN ('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000101042') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'clubs anon write deny');
WITH changed AS (UPDATE public.events SET description='forged' WHERE id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'events anon write deny');
WITH changed AS (UPDATE public.club_followers SET user_id='00000000-0000-4000-8000-000000100001' WHERE id IN ('00000000-0000-4000-8000-000000101011','00000000-0000-4000-8000-000000101012') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'club_followers anon write deny');
WITH changed AS (UPDATE public.featured_clubs SET priority=99 WHERE id IN ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101122') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'featured_clubs anon write deny');
WITH changed AS (UPDATE public.featured_events SET priority=99 WHERE id IN ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101132') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'featured_events anon write deny');
SELECT throws_ok($q$UPDATE public.reviews SET rating=1 WHERE id IN ('00000000-0000-4000-8000-000000101221','00000000-0000-4000-8000-000000101222')$q$,'42501',NULL,'reviews anon write deny');
WITH changed AS (UPDATE public.user_follows SET follower_id='00000000-0000-4000-8000-000000100001' WHERE id IN ('00000000-0000-4000-8000-000000101271','00000000-0000-4000-8000-000000101272') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'user_follows anon write deny');
SELECT throws_ok($q$UPDATE public.event_popularity_scores SET popularity_score=999 WHERE event_id IN ('00000000-0000-4000-8000-000000101081','00000000-0000-4000-8000-000000101082')$q$,'42501',NULL,'event_popularity_scores anon write deny');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000100001',true);
SELECT set_config('request.jwt.claims','{"sub": "00000000-0000-4000-8000-000000100001", "role": "authenticated"}',true);
WITH changed AS (INSERT INTO public.club_followers (user_id,club_id) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101042') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'club_followers subject write allow');
SELECT throws_ok($q$INSERT INTO public.club_followers (user_id,club_id) VALUES ('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101041')$q$,'42501',NULL,'club_followers subject write deny');
WITH changed AS (INSERT INTO public.user_follows (follower_id,following_id) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100003') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'user_follows subject write allow');
SELECT throws_ok($q$INSERT INTO public.user_follows (follower_id,following_id) VALUES ('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000100003')$q$,'42501',NULL,'user_follows subject write deny');
WITH changed AS (INSERT INTO public.organizer_requests (user_id,club_id) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101042') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'organizer_requests subject write allow');
SELECT throws_ok($q$INSERT INTO public.organizer_requests (user_id,club_id) VALUES ('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101041')$q$,'42501',NULL,'organizer_requests subject write deny');
WITH changed AS (INSERT INTO public.event_reports (reporter_id,event_id,category) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000109999','other') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'event_reports subject write allow');
SELECT throws_ok($q$INSERT INTO public.event_reports (reporter_id,event_id,category) VALUES ('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000109999','other')$q$,'42501',NULL,'event_reports subject write deny');
WITH changed AS (INSERT INTO public.moderation_reviews (target_type,target_id,action,message,author_id) VALUES ('event','00000000-0000-4000-8000-000000101081','appeal','Please review','00000000-0000-4000-8000-000000100001') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'moderation_reviews subject write allow');
SELECT throws_ok($q$INSERT INTO public.moderation_reviews (target_type,target_id,action,message,author_id) VALUES ('event','00000000-0000-4000-8000-000000101081','appeal','Forged','00000000-0000-4000-8000-000000100002')$q$,'42501',NULL,'moderation_reviews subject write deny');
WITH changed AS (INSERT INTO public.feedback (user_id,message) VALUES ('00000000-0000-4000-8000-000000100001','M0 valid feedback') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'feedback subject write allow');
WITH changed AS (UPDATE public.users SET name='M0 edited' WHERE id='00000000-0000-4000-8000-000000100001' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'users subject write allow');
WITH changed AS (UPDATE public.users SET name='M0 edited' WHERE id='00000000-0000-4000-8000-000000100002' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'users subject write deny');
WITH changed AS (UPDATE public.events SET description='M0 edited' WHERE id='00000000-0000-4000-8000-000000101081' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'events subject write allow');
WITH changed AS (UPDATE public.events SET description='M0 edited' WHERE id='00000000-0000-4000-8000-000000101082' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'events subject write deny');
SELECT throws_ok($q$UPDATE public.reviews SET rating=4 WHERE id='00000000-0000-4000-8000-000000101221'$q$,'42501',NULL,'reviews subject write deny');
SELECT throws_ok($q$UPDATE public.reviews SET rating=4 WHERE id='00000000-0000-4000-8000-000000101222'$q$,'42501',NULL,'reviews subject write deny');
WITH changed AS (UPDATE public.recommendation_explicit_feedback SET feedback_type='negative' WHERE id='00000000-0000-4000-8000-000000101201' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'recommendation_explicit_feedback subject write allow');
WITH changed AS (UPDATE public.recommendation_explicit_feedback SET feedback_type='negative' WHERE id='00000000-0000-4000-8000-000000101202' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'recommendation_explicit_feedback subject write deny');
WITH changed AS (UPDATE public.notifications SET read=true WHERE id='00000000-0000-4000-8000-000000101181' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'notifications subject write allow');
WITH changed AS (UPDATE public.notifications SET read=true WHERE id='00000000-0000-4000-8000-000000101182' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'notifications subject write deny');
WITH changed AS (UPDATE public.rsvps SET status='interested' WHERE id='00000000-0000-4000-8000-000000101231' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'rsvps subject write allow');
WITH changed AS (UPDATE public.rsvps SET status='interested' WHERE id='00000000-0000-4000-8000-000000101232' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'rsvps subject write deny');
WITH changed AS (UPDATE public.clubs SET name='forged' WHERE id IN ('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000101042') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'clubs subject write deny');
WITH changed AS (UPDATE public.club_members SET role='organizer' WHERE id IN ('00000000-0000-4000-8000-000000101031','00000000-0000-4000-8000-000000101032') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'club_members subject write deny');
WITH changed AS (UPDATE public.featured_clubs SET priority=99 WHERE id IN ('00000000-0000-4000-8000-000000101121','00000000-0000-4000-8000-000000101122') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'featured_clubs subject write deny');
WITH changed AS (UPDATE public.featured_events SET priority=99 WHERE id IN ('00000000-0000-4000-8000-000000101131','00000000-0000-4000-8000-000000101132') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'featured_events subject write deny');
WITH changed AS (UPDATE public.experiments SET description='forged' WHERE id IN ('00000000-0000-4000-8000-000000101111','00000000-0000-4000-8000-000000101112') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'experiments subject write deny');
WITH changed AS (UPDATE public.experiment_variants SET name='forged' WHERE id IN ('00000000-0000-4000-8000-000000101101','00000000-0000-4000-8000-000000101102') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'experiment_variants subject write deny');
WITH changed AS (UPDATE public.experiment_assignments SET assigned_at=now() WHERE id IN ('00000000-0000-4000-8000-000000101091','00000000-0000-4000-8000-000000101092') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'experiment_assignments subject write deny');
WITH changed AS (DELETE FROM public.saved_events WHERE id='00000000-0000-4000-8000-000000101241' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'saved_events subject write allow');
WITH changed AS (DELETE FROM public.saved_events WHERE id='00000000-0000-4000-8000-000000101242' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),0,'saved_events subject write deny');
WITH changed AS (INSERT INTO public.saved_events(user_id,event_id) VALUES('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'saved_events subject write allow');
SELECT throws_ok($q$INSERT INTO public.saved_events(user_id,event_id) VALUES('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000101081')$q$,'42501',NULL,'saved_events subject write deny');
WITH changed AS (INSERT INTO public.event_invites(inviter_id,invitee_id,event_id) VALUES('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000100003','00000000-0000-4000-8000-000000101081') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'event_invites subject write allow');
SELECT throws_ok($q$INSERT INTO public.event_invites(inviter_id,invitee_id,event_id) VALUES('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000100003','00000000-0000-4000-8000-000000101081')$q$,'42501',NULL,'event_invites subject write deny');
WITH changed AS (INSERT INTO public.club_invitations(club_id,inviter_id,invitee_email) VALUES('00000000-0000-4000-8000-000000101041','00000000-0000-4000-8000-000000100001','matrix-invite@example.invalid') RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'club_invitations subject write allow');
SELECT throws_ok($q$INSERT INTO public.club_invitations(club_id,inviter_id,invitee_email) VALUES('00000000-0000-4000-8000-000000101042','00000000-0000-4000-8000-000000100001','matrix-invite@example.invalid')$q$,'42501',NULL,'club_invitations subject write deny');
SELECT throws_ok($q$INSERT INTO public.user_interactions (user_id,event_id,interaction_type) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081','view')$q$,'42501',NULL,'user_interactions subject write deny');
SELECT throws_ok($q$INSERT INTO public.recommendation_feedback (user_id,event_id,recommendation_rank,action) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101081',1,'click')$q$,'42501',NULL,'recommendation_feedback subject write deny');
SELECT throws_ok($q$INSERT INTO public.tag_interaction_counts (user_id,tag) VALUES ('00000000-0000-4000-8000-000000100001','forged-tag')$q$,'42501',NULL,'tag_interaction_counts subject write deny');
SELECT throws_ok($q$INSERT INTO public.user_event_scores (user_id,event_id,score) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101082',999)$q$,'42501',NULL,'user_event_scores subject write deny');
SELECT throws_ok($q$INSERT INTO public.feedback_request_log (user_id,event_id,request_type) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101082','post_event')$q$,'42501',NULL,'feedback_request_log subject write deny');
SELECT throws_ok($q$INSERT INTO public.legacy_reminder_log (user_id,event_id,reminder_type) VALUES ('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000101082','reminder_24h')$q$,'42501',NULL,'legacy_reminder_log subject write deny');
SELECT throws_ok($q$INSERT INTO public.admin_audit_log (admin_user_id,action,target_type,target_id) VALUES ('00000000-0000-4000-8000-000000100001','approved','event','00000000-0000-4000-8000-000000101081')$q$,'42501',NULL,'admin_audit_log subject write deny');
SELECT throws_ok($q$INSERT INTO public.resources (slug,resource_type,title,summary,body_markdown,category,audience,author_name) VALUES ('m3-matrix-forged','guide','Forged','Forged','Forged body','career','Everyone','Forger')$q$,'42501',NULL,'resources authenticated write deny');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000100004',true);
SELECT set_config('request.jwt.claims','{"sub": "00000000-0000-4000-8000-000000100004", "role": "authenticated"}',true);
WITH changed AS (UPDATE public.clubs SET name='Admin edited' WHERE id='00000000-0000-4000-8000-000000101041' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'clubs admin write allow');
WITH changed AS (UPDATE public.featured_clubs SET priority=2 WHERE id='00000000-0000-4000-8000-000000101121' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'featured_clubs admin write allow');
WITH changed AS (UPDATE public.featured_events SET priority=2 WHERE id='00000000-0000-4000-8000-000000101131' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'featured_events admin write allow');
WITH changed AS (UPDATE public.experiments SET description='Admin edited' WHERE id='00000000-0000-4000-8000-000000101111' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'experiments admin write allow');
WITH changed AS (UPDATE public.experiment_variants SET name='Admin edited' WHERE id='00000000-0000-4000-8000-000000101101' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'experiment_variants admin write allow');
WITH changed AS (UPDATE public.experiment_assignments SET assigned_at=now() WHERE id='00000000-0000-4000-8000-000000101091' RETURNING 1) SELECT is((SELECT count(*)::integer FROM changed),1,'experiment_assignments admin write allow');
SELECT throws_ok('DELETE FROM public.universities WHERE false','42501',NULL,'universities admin write deny');
SELECT throws_ok('DELETE FROM public.opportunities WHERE false','42501',NULL,'opportunities admin write deny');
SELECT throws_ok('DELETE FROM public.opportunity_universities WHERE false','42501',NULL,'opportunity_universities admin write deny');
SELECT throws_ok('DELETE FROM public.event_discovery_metadata WHERE false','42501',NULL,'event_discovery_metadata admin write deny');
SELECT throws_ok('DELETE FROM public.event_discovery_universities WHERE false','42501',NULL,'event_discovery_universities admin write deny');
-- CERT-07 assertion region end
SELECT tests.act_as_owner();
SELECT * FROM finish();
ROLLBACK;
