-- M2 additive discovery. Legacy events remain authoritative (DEC-80 wall-clock dates).
CREATE TABLE public.opportunities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 120 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 listing_type text NOT NULL CHECK(listing_type IN ('event','hackathon','job','program','networking','grant')),
 subtype text CHECK(length(subtype)<=80), title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 15000), organization text NOT NULL CHECK(length(trim(organization)) BETWEEN 1 AND 200),
 location text NOT NULL DEFAULT '' CHECK(length(location)<=200), work_mode text NOT NULL DEFAULT 'in_person' CHECK(work_mode IN ('in_person','remote','hybrid')),
 source_type text NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual','indexed','partner')), source_url text CHECK(source_url ~* '^https?://' AND length(source_url)<=2048),
 application_mode text NOT NULL DEFAULT 'external' CHECK(application_mode IN ('external','none')), action_url text CHECK(action_url ~* '^https?://' AND length(action_url)<=2048), action_note text CHECK(length(action_note)<=1000),
 starts_at timestamptz, ends_at timestamptz, CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at),
 relevance_scope text NOT NULL DEFAULT 'unknown' CHECK(relevance_scope IN ('cross_campus','specific','unknown')),
 organizer_university_id uuid REFERENCES public.universities(id), eligibility_text text CHECK(length(eligibility_text)<=2000), fields text[] NOT NULL DEFAULT '{}',
 deadline_precision text NOT NULL DEFAULT 'none' CHECK(deadline_precision IN ('none','date','datetime')), deadline_at timestamptz, deadline_date date,
 source_timezone text NOT NULL DEFAULT 'America/Toronto', timezone_assumed boolean NOT NULL DEFAULT true,
 checked_at timestamptz, review_at timestamptz, curator_note text CHECK(length(curator_note)<=2000),
 is_pick boolean NOT NULL DEFAULT false, pick_reason text CHECK(length(pick_reason)<=500), editorial_priority integer NOT NULL DEFAULT 0 CHECK(editorial_priority BETWEEN 0 AND 100),
 duplicate_review_note text CHECK(length(duplicate_review_note)<=2000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 canonical_event_id uuid REFERENCES public.events(id), canonical_opportunity_id uuid REFERENCES public.opportunities(id),
 CHECK(num_nonnulls(canonical_event_id,canonical_opportunity_id)<=1), CHECK(canonical_opportunity_id IS DISTINCT FROM id),
 CHECK(NOT is_pick OR nullif(trim(pick_reason),'') IS NOT NULL),
 CHECK((deadline_precision='none' AND deadline_at IS NULL AND deadline_date IS NULL) OR (deadline_precision='date' AND deadline_date IS NOT NULL AND deadline_at IS NULL) OR (deadline_precision='datetime' AND deadline_at IS NOT NULL AND deadline_date IS NULL)),
 created_by uuid NOT NULL REFERENCES public.users(id), updated_by uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz, deleted_at timestamptz
);
CREATE TABLE public.opportunity_universities(opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE, university_id uuid NOT NULL REFERENCES public.universities(id), PRIMARY KEY(opportunity_id,university_id));
CREATE INDEX opportunity_universities_school ON public.opportunity_universities(university_id,opportunity_id);
CREATE INDEX opportunities_organizer_school ON public.opportunities(organizer_university_id);
CREATE INDEX opportunities_creator ON public.opportunities(created_by);
CREATE INDEX opportunities_editor ON public.opportunities(updated_by);
CREATE INDEX opportunities_canonical_event ON public.opportunities(canonical_event_id) WHERE canonical_event_id IS NOT NULL;
CREATE INDEX opportunities_canonical_opportunity ON public.opportunities(canonical_opportunity_id) WHERE canonical_opportunity_id IS NOT NULL;
CREATE INDEX opportunities_discovery ON public.opportunities(editorial_priority DESC,deadline_at,published_at DESC,id) WHERE status='published' AND deleted_at IS NULL;
CREATE INDEX opportunities_fields ON public.opportunities USING gin(fields);
CREATE TABLE public.event_discovery_metadata (
 event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
 duplicate_review_note text CHECK(length(duplicate_review_note)<=2000),
 listing_type text NOT NULL DEFAULT 'event' CHECK(listing_type IN ('event','hackathon','networking')),
 relevance_scope text NOT NULL DEFAULT 'unknown' CHECK(relevance_scope IN ('cross_campus','specific','unknown')),
 organizer_university_id uuid REFERENCES public.universities(id), eligibility_text text CHECK(length(eligibility_text)<=2000), fields text[] NOT NULL DEFAULT '{}',
 deadline_precision text NOT NULL DEFAULT 'none' CHECK(deadline_precision IN ('none','date','datetime')), deadline_at timestamptz, deadline_date date,
 source_timezone text NOT NULL DEFAULT 'America/Toronto', timezone_assumed boolean NOT NULL DEFAULT true,
 checked_at timestamptz, review_at timestamptz, curator_note text CHECK(length(curator_note)<=2000),
 is_pick boolean NOT NULL DEFAULT false, pick_reason text CHECK(length(pick_reason)<=500), editorial_priority integer NOT NULL DEFAULT 0 CHECK(editorial_priority BETWEEN 0 AND 100),
 canonical_event_id uuid REFERENCES public.events(id), canonical_opportunity_id uuid REFERENCES public.opportunities(id),
 CHECK(num_nonnulls(canonical_event_id,canonical_opportunity_id)<=1), CHECK(canonical_event_id IS DISTINCT FROM event_id),
 CHECK(NOT is_pick OR nullif(trim(pick_reason),'') IS NOT NULL),
 CHECK((deadline_precision='none' AND deadline_at IS NULL AND deadline_date IS NULL) OR (deadline_precision='date' AND deadline_date IS NOT NULL AND deadline_at IS NULL) OR (deadline_precision='datetime' AND deadline_at IS NOT NULL AND deadline_date IS NULL)),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL REFERENCES public.users(id)
);
CREATE INDEX event_discovery_organizer_school ON public.event_discovery_metadata(organizer_university_id);
CREATE INDEX event_discovery_editor ON public.event_discovery_metadata(updated_by);
CREATE INDEX event_discovery_canonical_event ON public.event_discovery_metadata(canonical_event_id) WHERE canonical_event_id IS NOT NULL;
CREATE INDEX event_discovery_canonical_opportunity ON public.event_discovery_metadata(canonical_opportunity_id) WHERE canonical_opportunity_id IS NOT NULL;
CREATE TABLE public.event_discovery_universities(event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE, university_id uuid NOT NULL REFERENCES public.universities(id), PRIMARY KEY(event_id,university_id));
CREATE INDEX event_discovery_universities_school ON public.event_discovery_universities(university_id,event_id);
CREATE TABLE public.saved_opportunities(user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,opportunity_id));
CREATE INDEX saved_opportunities_target ON public.saved_opportunities(opportunity_id);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_discovery_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_discovery_universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities,public.opportunity_universities,public.event_discovery_metadata,public.event_discovery_universities,public.saved_opportunities FROM PUBLIC,anon,authenticated;
CREATE POLICY opportunities_public ON public.opportunities FOR SELECT TO anon,authenticated USING(deleted_at IS NULL AND (status='published' OR (status='archived' AND published_at IS NOT NULL AND num_nonnulls(canonical_event_id,canonical_opportunity_id)=1)));
CREATE POLICY opportunity_schools_public ON public.opportunity_universities FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.opportunities o WHERE o.id=opportunity_id));
CREATE POLICY event_metadata_public ON public.event_discovery_metadata FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.events e WHERE e.id=event_id AND e.status='approved' AND e.deleted_at IS NULL));
CREATE POLICY event_schools_public ON public.event_discovery_universities FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.events e WHERE e.id=event_id AND e.status='approved' AND e.deleted_at IS NULL));
CREATE POLICY saved_opportunities_own_read ON public.saved_opportunities FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY saved_opportunities_own_delete ON public.saved_opportunities FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY saved_opportunities_own_insert ON public.saved_opportunities FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.opportunities o WHERE o.id=opportunity_id AND o.status='published') AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=(SELECT auth.uid()) AND u.onboarding_completed AND (u.banned_at IS NULL OR u.ban_expires_at<=now())));
GRANT SELECT ON public.opportunity_universities,public.event_discovery_universities TO anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.saved_opportunities TO authenticated;
GRANT ALL ON public.opportunities,public.opportunity_universities,public.event_discovery_metadata,public.event_discovery_universities,public.saved_opportunities TO service_role;
GRANT SELECT(id,slug,listing_type,subtype,title,description,organization,location,work_mode,source_type,source_url,application_mode,action_url,action_note,starts_at,ends_at,relevance_scope,organizer_university_id,eligibility_text,fields,deadline_precision,deadline_at,deadline_date,source_timezone,timezone_assumed,checked_at,review_at,curator_note,is_pick,pick_reason,editorial_priority,status,canonical_event_id,canonical_opportunity_id,published_at,deleted_at) ON public.opportunities TO anon,authenticated;
GRANT SELECT(event_id,listing_type,relevance_scope,organizer_university_id,eligibility_text,fields,deadline_precision,deadline_at,deadline_date,source_timezone,timezone_assumed,checked_at,review_at,curator_note,is_pick,pick_reason,editorial_priority,canonical_event_id,canonical_opportunity_id,updated_at) ON public.event_discovery_metadata TO anon,authenticated;

CREATE FUNCTION public.discovery_deadline(p_precision text,p_at timestamptz,p_date date,p_timezone text) RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT CASE WHEN p_precision='datetime' THEN p_at WHEN p_precision='date' THEN (p_date+1)::timestamp AT TIME ZONE p_timezone END $$;
REVOKE ALL ON FUNCTION public.discovery_deadline(text,timestamptz,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_deadline(text,timestamptz,date,text) TO anon,authenticated,service_role;
CREATE VIEW public.discovery_public WITH(security_invoker=true) AS
SELECT 'opportunity'::text kind,o.id,o.slug,o.title,o.description,o.listing_type,o.subtype,o.organization,o.organizer_university_id,o.location,o.work_mode,o.fields,o.relevance_scope,
 ARRAY(SELECT university_id FROM public.opportunity_universities u WHERE u.opportunity_id=o.id ORDER BY university_id) university_ids,
 o.eligibility_text,o.source_type,o.source_url,o.action_url,o.application_mode,o.action_note,o.starts_at,o.ends_at,o.deadline_at,o.deadline_date,o.deadline_precision,o.source_timezone,o.timezone_assumed,o.review_at,o.checked_at,o.published_at,o.curator_note,o.pick_reason,o.is_pick,o.editorial_priority,
 coalesce(public.discovery_deadline(o.deadline_precision,o.deadline_at,o.deadline_date,o.source_timezone),o.starts_at,o.review_at) actionable_at,
 coalesce(public.discovery_deadline(o.deadline_precision,o.deadline_at,o.deadline_date,o.source_timezone),o.ends_at,o.review_at) expires_at,
 CASE WHEN o.canonical_event_id IS NOT NULL THEN 'event' WHEN o.canonical_opportunity_id IS NOT NULL THEN 'opportunity' END canonical_kind,coalesce(o.canonical_event_id,o.canonical_opportunity_id) canonical_id
FROM public.opportunities o WHERE o.deleted_at IS NULL AND (o.status='published' OR (o.status='archived' AND o.published_at IS NOT NULL AND num_nonnulls(o.canonical_event_id,o.canonical_opportunity_id)=1))
UNION ALL
SELECT 'event',e.id,NULL,e.title,coalesce(e.description,''),coalesce(m.listing_type,'event'),NULL,coalesce(e.organizer,''),m.organizer_university_id,coalesce(e.location,''),'in_person',coalesce(m.fields,'{}'),coalesce(m.relevance_scope,'specific'),
 CASE WHEN m.event_id IS NULL THEN ARRAY['10000000-0000-4000-8000-000000000001'::uuid] ELSE ARRAY(SELECT university_id FROM public.event_discovery_universities u WHERE u.event_id=e.id ORDER BY university_id) END,
 m.eligibility_text,CASE WHEN e.source='instagram' THEN 'indexed' ELSE 'manual' END,e.source_url,e.rsvp_link,CASE WHEN e.rsvp_link IS NULL THEN 'none' ELSE 'external' END,CASE WHEN e.rsvp_link IS NULL THEN 'See the organizer for registration details' END,
 (e.start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Toronto',(e.end_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Toronto',m.deadline_at,m.deadline_date,coalesce(m.deadline_precision,'none'),coalesce(m.source_timezone,'America/Toronto'),coalesce(m.timezone_assumed,true),m.review_at,m.checked_at,coalesce(e.created_at,'1970-01-01'::timestamptz),m.curator_note,m.pick_reason,coalesce(m.is_pick,false),coalesce(m.editorial_priority,0),
 coalesce(public.discovery_deadline(m.deadline_precision,m.deadline_at,m.deadline_date,m.source_timezone),(e.start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Toronto'),
 (e.end_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Toronto',
 CASE WHEN m.canonical_event_id IS NOT NULL THEN 'event' WHEN m.canonical_opportunity_id IS NOT NULL THEN 'opportunity' END,coalesce(m.canonical_event_id,m.canonical_opportunity_id)
FROM public.events e LEFT JOIN public.event_discovery_metadata m ON m.event_id=e.id WHERE e.status='approved' AND e.deleted_at IS NULL;
GRANT SELECT ON public.discovery_public TO anon,authenticated,service_role;
COMMENT ON VIEW public.discovery_public IS 'Explicit safe invoker projection. Legacy events are historically McGill-relevant (not eligibility/affiliation); DEC-80 wall-clock timestamps converted at read time. No private moderation or actor columns.';

CREATE FUNCTION public.query_discovery(p_as_of timestamptz,p_filters jsonb DEFAULT '{}',p_after jsonb DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(d)||jsonb_build_object('closed',d.expires_at<=p_as_of)
 FROM public.discovery_public d
 WHERE d.canonical_id IS NULL AND d.expires_at>p_as_of AND d.published_at<=p_as_of
 AND (NOT p_filters ? 'type' OR d.listing_type=p_filters->>'type')
 AND (d.relevance_scope='cross_campus' OR coalesce((p_filters->>'university')::uuid,'10000000-0000-4000-8000-000000000001'::uuid)=ANY(d.university_ids))
 AND (NOT p_filters ? 'field' OR p_filters->>'field'=ANY(d.fields))
 AND (NOT p_filters ? 'work_mode' OR d.work_mode=p_filters->>'work_mode')
 AND (coalesce(p_filters->>'q','')='' OR (d.title||' '||d.organization||' '||d.description) ILIKE '%'||replace(replace(replace(left(p_filters->>'q',120),'\','\\'),'%','\%'),'_','\_')||'%')
 AND (coalesce(p_filters->>'window','upcoming')<>'this_week' OR (d.actionable_at>=(date_trunc('week',p_as_of AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto') AND d.actionable_at<((date_trunc('week',p_as_of AT TIME ZONE 'America/Toronto')+interval '1 week') AT TIME ZONE 'America/Toronto')))
 AND (p_after IS NULL OR ROW(-d.editorial_priority,coalesce(d.actionable_at,'9999-12-31'::timestamptz),-extract(epoch FROM d.published_at),d.kind,d.id)>ROW(-(p_after->>'priority')::integer,coalesce((p_after->>'actionable_at')::timestamptz,'9999-12-31'::timestamptz),-extract(epoch FROM (p_after->>'published_at')::timestamptz),p_after->>'kind',(p_after->>'id')::uuid))
 ORDER BY d.editorial_priority DESC,d.actionable_at ASC NULLS LAST,d.published_at DESC,d.kind,d.id LIMIT least(greatest(p_limit,1),51)
$$;
REVOKE ALL ON FUNCTION public.query_discovery(timestamptz,jsonb,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.query_discovery(timestamptz,jsonb,jsonb,integer) TO anon,authenticated,service_role;
CREATE FUNCTION public.query_saved_discovery(p_as_of timestamptz,p_after jsonb DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH saved AS(SELECT 'event'::text kind,event_id id,created_at saved_at FROM public.saved_events WHERE user_id=(SELECT auth.uid()) UNION ALL SELECT 'opportunity',opportunity_id,created_at FROM public.saved_opportunities WHERE user_id=(SELECT auth.uid()))
 SELECT to_jsonb(d)||jsonb_build_object('saved_at',s.saved_at,'closed',coalesce(d.expires_at<=p_as_of,true)) FROM saved s JOIN public.discovery_public d USING(kind,id)
 WHERE s.saved_at<=p_as_of AND (p_after IS NULL OR ROW(-extract(epoch FROM s.saved_at),s.kind,s.id)>ROW(-extract(epoch FROM (p_after->>'saved_at')::timestamptz),p_after->>'kind',(p_after->>'id')::uuid))
 ORDER BY s.saved_at DESC,s.kind,s.id LIMIT least(greatest(p_limit,1),51)
$$;
REVOKE ALL ON FUNCTION public.query_saved_discovery(timestamptz,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.query_saved_discovery(timestamptz,jsonb,integer) TO authenticated,service_role;

-- All authoring uses service-only invoker RPCs after session guards. Never callable
-- by browser roles; actor is rechecked under the same transaction as the write.
CREATE FUNCTION public.discovery_require_editor(p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND 'admin'=ANY(roles) AND (banned_at IS NULL OR ban_expires_at<=now())) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.discovery_validate_metadata(p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'source_timezone') THEN RAISE EXCEPTION 'Invalid source timezone' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(coalesce(p_data->'university_ids','[]'))>20 OR jsonb_array_length(coalesce(p_data->'fields','[]'))>12 THEN RAISE EXCEPTION 'Too many filters' USING ERRCODE='22023'; END IF;
 IF (p_data->>'relevance_scope'='specific') IS DISTINCT FROM (jsonb_array_length(coalesce(p_data->'university_ids','[]'))>0) THEN RAISE EXCEPTION 'University relevance must match its scope' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'university_ids') u(id) LEFT JOIN public.universities s ON s.id=u.id::uuid AND s.active WHERE s.id IS NULL) THEN RAISE EXCEPTION 'University unavailable' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION public.discovery_duplicate_candidates(p_kind text,p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH candidate AS(SELECT title,organization,source_url,starts_at FROM public.opportunities WHERE p_kind='opportunity' AND id=p_id UNION ALL SELECT title,coalesce(organizer,''),source_url,(start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Toronto' FROM public.events WHERE p_kind='event' AND id=p_id)
 SELECT coalesce(jsonb_agg(matches.item),'[]') FROM (SELECT jsonb_build_object('kind',d.kind,'id',d.id,'title',d.title,'source_url',d.source_url) item FROM public.discovery_public d CROSS JOIN candidate c
 WHERE NOT(d.kind=p_kind AND d.id=p_id) AND d.canonical_id IS NULL
 AND ((c.source_url IS NOT NULL AND regexp_replace(lower(split_part(c.source_url,'#',1)),'/$','')=regexp_replace(lower(split_part(d.source_url,'#',1)),'/$',''))
 OR (c.starts_at IS NOT NULL AND d.starts_at=c.starts_at AND lower(trim(c.title))=lower(trim(d.title)) AND lower(trim(c.organization))=lower(trim(d.organization)))) ORDER BY d.kind,d.id LIMIT 50) matches
$$;
CREATE FUNCTION public.discovery_validate_publish(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.opportunities;
BEGIN
 SELECT * INTO STRICT o FROM public.opportunities WHERE id=p_id;
 IF o.source_url IS NULL OR o.checked_at IS NULL THEN RAISE EXCEPTION 'Publication requires a checked source' USING ERRCODE='22023'; END IF;
 IF (o.application_mode='external' AND o.action_url IS NULL) OR (o.application_mode='none' AND nullif(trim(o.action_note),'') IS NULL) THEN RAISE EXCEPTION 'Publication requires an action URL or an explicit no-action explanation' USING ERRCODE='22023'; END IF;
 IF o.work_mode<>'remote' AND nullif(trim(o.location),'') IS NULL THEN RAISE EXCEPTION 'Publication requires a location' USING ERRCODE='22023'; END IF;
 IF o.listing_type IN ('event','networking') AND (o.starts_at IS NULL OR o.ends_at IS NULL) THEN RAISE EXCEPTION 'Events require start and end times' USING ERRCODE='22023'; END IF;
 IF coalesce(public.discovery_deadline(o.deadline_precision,o.deadline_at,o.deadline_date,o.source_timezone),o.ends_at,o.review_at)<=now() OR coalesce(public.discovery_deadline(o.deadline_precision,o.deadline_at,o.deadline_date,o.source_timezone),o.ends_at,o.review_at) IS NULL THEN RAISE EXCEPTION 'Publication requires a future deadline, end, or review date' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(public.discovery_duplicate_candidates('opportunity',p_id))>0 AND nullif(trim(o.duplicate_review_note),'') IS NULL THEN RAISE EXCEPTION 'Review possible duplicates before publication' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION public.curate_opportunity(p_actor uuid,p_id uuid,p_action text,p_data jsonb DEFAULT '{}',p_expected timestamptz DEFAULT NULL,p_can_pick boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE oldrow public.opportunities; newrow public.opportunities; result jsonb; target_kind text; target_id uuid;
BEGIN
 PERFORM public.discovery_require_editor(p_actor);
 -- Serializes cross-source duplicate publication and canonical graph changes.
 PERFORM pg_advisory_xact_lock(71404);
 IF p_action='create' THEN
  IF p_id IS NOT NULL THEN RAISE EXCEPTION 'Create cannot set an ID' USING ERRCODE='22023'; END IF;
  newrow:=jsonb_populate_record(NULL::public.opportunities,p_data);
  newrow.id:=gen_random_uuid();
 ELSE
  SELECT * INTO oldrow FROM public.opportunities WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found' USING ERRCODE='P0002'; END IF;
  IF oldrow.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Opportunity changed; reload before saving' USING ERRCODE='40001'; END IF;
  newrow:=CASE WHEN p_action='edit' THEN jsonb_populate_record(oldrow,p_data) ELSE oldrow END;
 END IF;
 IF p_action IN ('create','edit') THEN
  PERFORM public.discovery_validate_metadata(p_data);
  IF NOT p_can_pick AND (coalesce(newrow.is_pick,false) IS DISTINCT FROM coalesce(oldrow.is_pick,false) OR newrow.pick_reason IS DISTINCT FROM oldrow.pick_reason OR coalesce(newrow.editorial_priority,0) IS DISTINCT FROM coalesce(oldrow.editorial_priority,0)) THEN RAISE EXCEPTION 'Only the configured curator may edit Picks or editorial priority' USING ERRCODE='42501'; END IF;
  IF p_action='create' THEN
   INSERT INTO public.opportunities(id,slug,listing_type,subtype,title,description,organization,location,work_mode,source_type,source_url,application_mode,action_url,action_note,starts_at,ends_at,relevance_scope,organizer_university_id,eligibility_text,fields,deadline_precision,deadline_at,deadline_date,source_timezone,timezone_assumed,checked_at,review_at,curator_note,is_pick,pick_reason,editorial_priority,duplicate_review_note,created_by,updated_by) VALUES(newrow.id,newrow.slug,newrow.listing_type,newrow.subtype,newrow.title,newrow.description,newrow.organization,newrow.location,newrow.work_mode,newrow.source_type,newrow.source_url,newrow.application_mode,newrow.action_url,newrow.action_note,newrow.starts_at,newrow.ends_at,newrow.relevance_scope,newrow.organizer_university_id,newrow.eligibility_text,newrow.fields,newrow.deadline_precision,newrow.deadline_at,newrow.deadline_date,newrow.source_timezone,newrow.timezone_assumed,newrow.checked_at,newrow.review_at,newrow.curator_note,newrow.is_pick,newrow.pick_reason,newrow.editorial_priority,newrow.duplicate_review_note,p_actor,p_actor);
  ELSE
   UPDATE public.opportunities SET slug=newrow.slug,listing_type=newrow.listing_type,subtype=newrow.subtype,title=newrow.title,description=newrow.description,organization=newrow.organization,location=newrow.location,work_mode=newrow.work_mode,source_type=newrow.source_type,source_url=newrow.source_url,application_mode=newrow.application_mode,action_url=newrow.action_url,action_note=newrow.action_note,starts_at=newrow.starts_at,ends_at=newrow.ends_at,relevance_scope=newrow.relevance_scope,organizer_university_id=newrow.organizer_university_id,eligibility_text=newrow.eligibility_text,fields=newrow.fields,deadline_precision=newrow.deadline_precision,deadline_at=newrow.deadline_at,deadline_date=newrow.deadline_date,source_timezone=newrow.source_timezone,timezone_assumed=newrow.timezone_assumed,checked_at=newrow.checked_at,review_at=newrow.review_at,curator_note=newrow.curator_note,is_pick=newrow.is_pick,pick_reason=newrow.pick_reason,editorial_priority=newrow.editorial_priority,duplicate_review_note=newrow.duplicate_review_note,updated_by=p_actor,updated_at=clock_timestamp() WHERE id=p_id;
  END IF;
  DELETE FROM public.opportunity_universities WHERE opportunity_id=newrow.id;
  INSERT INTO public.opportunity_universities(opportunity_id,university_id) SELECT newrow.id,value::uuid FROM jsonb_array_elements_text(p_data->'university_ids') ON CONFLICT DO NOTHING;
  IF oldrow.status='published' THEN PERFORM public.discovery_validate_publish(newrow.id); END IF;
 ELSIF p_action='publish' THEN
  IF num_nonnulls(oldrow.canonical_event_id,oldrow.canonical_opportunity_id)>0 THEN RAISE EXCEPTION 'Merged listings cannot be republished' USING ERRCODE='22023'; END IF;
  PERFORM public.discovery_validate_publish(p_id);
  UPDATE public.opportunities SET status='published',published_at=coalesce(published_at,clock_timestamp()),updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_id;
 ELSIF p_action='archive' THEN
  UPDATE public.opportunities SET status='archived',updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_id;
 ELSIF p_action='merge' THEN
  IF oldrow.published_at IS NULL THEN RAISE EXCEPTION 'Unpublished drafts cannot become public aliases; archive the duplicate draft instead' USING ERRCODE='22023'; END IF;
  target_kind:=p_data->'canonical'->>'kind'; target_id:=(p_data->'canonical'->>'id')::uuid;
  IF (target_kind='opportunity' AND target_id=p_id) OR NOT EXISTS(SELECT 1 FROM public.discovery_public WHERE kind=target_kind AND id=target_id AND canonical_id IS NULL) OR nullif(trim(p_data->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Choose a public canonical listing and provide a reason' USING ERRCODE='22023'; END IF;
  -- Flatten inbound aliases atomically, preventing a chain from turning old links into dead ends.
  UPDATE public.opportunities SET canonical_event_id=CASE WHEN target_kind='event' THEN target_id END,canonical_opportunity_id=CASE WHEN target_kind='opportunity' THEN target_id END,updated_at=clock_timestamp(),updated_by=p_actor WHERE canonical_opportunity_id=p_id;
  UPDATE public.event_discovery_metadata SET canonical_event_id=CASE WHEN target_kind='event' THEN target_id END,canonical_opportunity_id=CASE WHEN target_kind='opportunity' THEN target_id END,updated_at=clock_timestamp(),updated_by=p_actor WHERE canonical_opportunity_id=p_id;
  UPDATE public.opportunities SET status='archived',canonical_event_id=CASE WHEN target_kind='event' THEN target_id END,canonical_opportunity_id=CASE WHEN target_kind='opportunity' THEN target_id END,updated_at=clock_timestamp(),updated_by=p_actor WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Unsupported action' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata) VALUES(p_actor,'opportunity_'||p_action,'opportunity',newrow.id::text,jsonb_build_object('previous_status',oldrow.status,'reason',p_data->>'reason','before_pick',jsonb_build_object('is_pick',oldrow.is_pick,'reason',oldrow.pick_reason,'priority',oldrow.editorial_priority),'after_pick',jsonb_build_object('is_pick',newrow.is_pick,'reason',newrow.pick_reason,'priority',newrow.editorial_priority),'before_duplicate_review',oldrow.duplicate_review_note,'after_duplicate_review',newrow.duplicate_review_note,'changed_fields',CASE WHEN p_action IN ('edit','create') THEN (SELECT jsonb_agg(key ORDER BY key) FROM jsonb_each(p_data) WHERE value IS DISTINCT FROM to_jsonb(oldrow)->key) ELSE '[]'::jsonb END));
 SELECT to_jsonb(o)||jsonb_build_object('university_ids',ARRAY(SELECT university_id FROM public.opportunity_universities WHERE opportunity_id=o.id ORDER BY university_id)) INTO result FROM public.opportunities o WHERE id=newrow.id;
 RETURN result;
END $$;
CREATE FUNCTION public.curate_event_discovery(p_actor uuid,p_id uuid,p_data jsonb,p_expected timestamptz DEFAULT NULL,p_can_pick boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE oldrow public.event_discovery_metadata; newrow public.event_discovery_metadata; result jsonb;
BEGIN
 PERFORM public.discovery_require_editor(p_actor);
 PERFORM pg_advisory_xact_lock(71404);
 PERFORM 1 FROM public.events WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO oldrow FROM public.event_discovery_metadata WHERE event_id=p_id FOR UPDATE;
 IF oldrow.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Metadata changed; reload before saving' USING ERRCODE='40001'; END IF;
 PERFORM public.discovery_validate_metadata(p_data);
 newrow:=jsonb_populate_record(NULL::public.event_discovery_metadata,p_data);
 IF NOT p_can_pick AND (coalesce(newrow.is_pick,false) IS DISTINCT FROM coalesce(oldrow.is_pick,false) OR newrow.pick_reason IS DISTINCT FROM oldrow.pick_reason OR coalesce(newrow.editorial_priority,0) IS DISTINCT FROM coalesce(oldrow.editorial_priority,0)) THEN RAISE EXCEPTION 'Only the configured curator may edit Picks or editorial priority' USING ERRCODE='42501'; END IF;
 INSERT INTO public.event_discovery_metadata(event_id,listing_type,duplicate_review_note,relevance_scope,organizer_university_id,eligibility_text,fields,deadline_precision,deadline_at,deadline_date,source_timezone,timezone_assumed,checked_at,review_at,curator_note,is_pick,pick_reason,editorial_priority,updated_by) VALUES(p_id,newrow.listing_type,newrow.duplicate_review_note,newrow.relevance_scope,newrow.organizer_university_id,newrow.eligibility_text,newrow.fields,newrow.deadline_precision,newrow.deadline_at,newrow.deadline_date,newrow.source_timezone,newrow.timezone_assumed,newrow.checked_at,newrow.review_at,newrow.curator_note,newrow.is_pick,newrow.pick_reason,newrow.editorial_priority,p_actor) ON CONFLICT(event_id) DO UPDATE SET listing_type=excluded.listing_type,duplicate_review_note=excluded.duplicate_review_note,relevance_scope=excluded.relevance_scope,organizer_university_id=excluded.organizer_university_id,eligibility_text=excluded.eligibility_text,fields=excluded.fields,deadline_precision=excluded.deadline_precision,deadline_at=excluded.deadline_at,deadline_date=excluded.deadline_date,source_timezone=excluded.source_timezone,timezone_assumed=excluded.timezone_assumed,checked_at=excluded.checked_at,review_at=excluded.review_at,curator_note=excluded.curator_note,is_pick=excluded.is_pick,pick_reason=excluded.pick_reason,editorial_priority=excluded.editorial_priority,updated_by=p_actor,updated_at=clock_timestamp();
 DELETE FROM public.event_discovery_universities WHERE event_id=p_id;
 INSERT INTO public.event_discovery_universities(event_id,university_id) SELECT p_id,value::uuid FROM jsonb_array_elements_text(p_data->'university_ids') ON CONFLICT DO NOTHING;
 INSERT INTO public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata) VALUES(p_actor,'event_discovery_edited','event',p_id::text,jsonb_build_object('before_pick',jsonb_build_object('is_pick',oldrow.is_pick,'reason',oldrow.pick_reason,'priority',oldrow.editorial_priority),'after_pick',jsonb_build_object('is_pick',newrow.is_pick,'reason',newrow.pick_reason,'priority',newrow.editorial_priority),'before_duplicate_review',oldrow.duplicate_review_note,'after_duplicate_review',newrow.duplicate_review_note,'changed_fields',(SELECT jsonb_agg(key ORDER BY key) FROM jsonb_each(p_data) WHERE value IS DISTINCT FROM to_jsonb(oldrow)->key)));
 SELECT to_jsonb(m)||jsonb_build_object('university_ids',ARRAY(SELECT university_id FROM public.event_discovery_universities WHERE event_id=p_id ORDER BY university_id)) INTO result FROM public.event_discovery_metadata m WHERE event_id=p_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.discovery_require_editor(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_require_editor(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.discovery_validate_metadata(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_validate_metadata(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.discovery_duplicate_candidates(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_duplicate_candidates(text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.discovery_validate_publish(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_validate_publish(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.curate_opportunity(uuid,uuid,text,jsonb,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.curate_opportunity(uuid,uuid,text,jsonb,timestamptz,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.curate_event_discovery(uuid,uuid,jsonb,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.curate_event_discovery(uuid,uuid,jsonb,timestamptz,boolean) TO service_role;
CREATE FUNCTION public.merge_event_discovery(p_actor uuid,p_id uuid,p_canonical_kind text,p_canonical_id uuid,p_reason text,p_expected timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE oldrow public.event_discovery_metadata;
BEGIN
 PERFORM public.discovery_require_editor(p_actor);
 PERFORM pg_advisory_xact_lock(71404);
 PERFORM 1 FROM public.events WHERE id=p_id AND status='approved' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only public events can become canonical aliases' USING ERRCODE='22023'; END IF;
 SELECT * INTO oldrow FROM public.event_discovery_metadata WHERE event_id=p_id FOR UPDATE;
 IF oldrow.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Metadata changed; reload before saving' USING ERRCODE='40001'; END IF;
 IF (p_canonical_kind='event' AND p_canonical_id=p_id) OR NOT EXISTS(SELECT 1 FROM public.discovery_public WHERE kind=p_canonical_kind AND id=p_canonical_id AND canonical_id IS NULL) OR nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Choose a public canonical listing and provide a reason' USING ERRCODE='22023'; END IF;
 UPDATE public.opportunities SET canonical_event_id=CASE WHEN p_canonical_kind='event' THEN p_canonical_id END,canonical_opportunity_id=CASE WHEN p_canonical_kind='opportunity' THEN p_canonical_id END,updated_at=clock_timestamp(),updated_by=p_actor WHERE canonical_event_id=p_id;
 UPDATE public.event_discovery_metadata SET canonical_event_id=CASE WHEN p_canonical_kind='event' THEN p_canonical_id END,canonical_opportunity_id=CASE WHEN p_canonical_kind='opportunity' THEN p_canonical_id END,updated_at=clock_timestamp(),updated_by=p_actor WHERE canonical_event_id=p_id;
 INSERT INTO public.event_discovery_metadata(event_id,canonical_event_id,canonical_opportunity_id,updated_by) VALUES(p_id,CASE WHEN p_canonical_kind='event' THEN p_canonical_id END,CASE WHEN p_canonical_kind='opportunity' THEN p_canonical_id END,p_actor)
 ON CONFLICT(event_id) DO UPDATE SET canonical_event_id=excluded.canonical_event_id,canonical_opportunity_id=excluded.canonical_opportunity_id,updated_by=p_actor,updated_at=clock_timestamp();
 INSERT INTO public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata) VALUES(p_actor,'event_discovery_merged','event',p_id::text,jsonb_build_object('canonical_kind',p_canonical_kind,'canonical_id',p_canonical_id,'reason',p_reason));
END $$;
REVOKE ALL ON FUNCTION public.merge_event_discovery(uuid,uuid,text,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merge_event_discovery(uuid,uuid,text,uuid,text,timestamptz) TO service_role;

-- Existing event create/approval paths share the duplicate boundary. A narrowly
-- scoped trigger may read private review notes but cannot write or return them.
-- Its definer context is necessary for authenticated legacy event writers, who
-- must not receive SELECT on private editorial notes or execute the admin RPC.
CREATE FUNCTION public.check_event_discovery_duplicate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status<>'approved' OR NEW.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.status,NEW.title,NEW.organizer,NEW.source_url,NEW.start_date,NEW.deleted_at) IS NOT DISTINCT FROM ROW(OLD.status,OLD.title,OLD.organizer,OLD.source_url,OLD.start_date,OLD.deleted_at) THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(71404);
 IF jsonb_array_length(public.discovery_duplicate_candidates('event',NEW.id))>0 AND NOT EXISTS(SELECT 1 FROM public.event_discovery_metadata WHERE event_id=NEW.id AND nullif(trim(duplicate_review_note),'') IS NOT NULL) THEN
  RAISE EXCEPTION 'Review possible duplicates in discovery metadata before approving this event' USING ERRCODE='22023';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.check_event_discovery_duplicate() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER event_discovery_duplicate_guard AFTER INSERT OR UPDATE OF status,title,organizer,source_url,start_date,deleted_at ON public.events FOR EACH ROW EXECUTE FUNCTION public.check_event_discovery_duplicate();
COMMENT ON FUNCTION public.check_event_discovery_duplicate() IS 'Narrow internal trigger; serializes duplicate review with opportunity authoring, returns no private data, performs no elevated writes.';
COMMENT ON FUNCTION public.curate_opportunity(uuid,uuid,text,jsonb,timestamptz,boolean) IS 'Audit log is authoritative Pick assignment history: actor and created_at plus before/after reason/priority and changed fields. Service-only after server role and configured-curator checks.';

-- All publication paths acquire the same advisory lock before row locks. The
-- BEFORE STATEMENT hook prevents legacy UPDATE/metadata-RPC lock inversion.
CREATE FUNCTION public.lock_event_discovery_publication() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(71404);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.lock_event_discovery_publication() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER event_discovery_publication_lock BEFORE INSERT OR UPDATE OF status,title,organizer,source_url,start_date,deleted_at ON public.events FOR EACH STATEMENT EXECUTE FUNCTION public.lock_event_discovery_publication();
