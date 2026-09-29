-- M3 P1-09: public intake. No client insert grants; the server calls service-role RPCs.
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('event','hackathon','job','program','resource','company_request')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  organization text NOT NULL CHECK (length(trim(organization)) BETWEEN 1 AND 200),
  source_url text CHECK (source_url ~* '^https?://' AND length(source_url) <= 2048),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 16384),
  contact_name text CHECK (length(contact_name) <= 120),
  contact_email text CHECK (contact_email IS NULL OR (length(contact_email) <= 254 AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  submitter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_hash text NOT NULL CHECK (client_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','converted','rejected','spam')),
  review_reason text CHECK (length(review_reason) <= 1000),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  target_opportunity_id uuid UNIQUE REFERENCES public.opportunities(id) ON DELETE SET NULL,
  target_resource_id uuid UNIQUE REFERENCES public.resources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(target_opportunity_id, target_resource_id) <= 1),
  CHECK (kind <> 'company_request' OR contact_email IS NOT NULL),
  CHECK (status = 'pending' OR reviewed_at IS NOT NULL)
);
CREATE INDEX submissions_queue ON public.submissions (status, created_at DESC);
CREATE INDEX submissions_client_recent ON public.submissions (client_hash, created_at DESC);
CREATE INDEX submissions_user_recent ON public.submissions (submitter_user_id, created_at DESC);
CREATE INDEX submissions_reviewed_by ON public.submissions (reviewed_by);

CREATE TABLE public.listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.resources(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('wrong_date','dead_link','scam','duplicate','other')),
  details text CHECK (length(details) <= 1000),
  reporter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_hash text NOT NULL CHECK (client_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution_note text CHECK (length(resolution_note) <= 1000),
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(event_id, opportunity_id, resource_id) = 1)
);
CREATE INDEX listing_reports_queue ON public.listing_reports (status, created_at DESC);
CREATE INDEX listing_reports_event ON public.listing_reports (event_id);
CREATE INDEX listing_reports_opportunity ON public.listing_reports (opportunity_id);
CREATE INDEX listing_reports_resource ON public.listing_reports (resource_id);
CREATE INDEX listing_reports_client_recent ON public.listing_reports (client_hash, created_at DESC);
CREATE INDEX listing_reports_reporter ON public.listing_reports (reporter_user_id);
CREATE INDEX listing_reports_resolved_by ON public.listing_reports (resolved_by);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.submissions, public.listing_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.submissions, public.listing_reports TO authenticated;
GRANT ALL ON public.submissions, public.listing_reports TO service_role;
CREATE POLICY submissions_admin_read ON public.submissions FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY listing_reports_admin_read ON public.listing_reports FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- Public intake. No status parameter exists: every row starts pending.
CREATE FUNCTION public.intake_submission(p_kind text, p_title text, p_organization text, p_source_url text, p_details jsonb,
  p_contact_name text, p_contact_email text, p_user uuid, p_client_hash text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Serializes one client's concurrent intakes so the quota count is exact.
  PERFORM pg_advisory_xact_lock(hashtextextended('intake:' || p_client_hash, 0));
  IF p_user IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user
      AND u.banned_at IS NOT NULL AND (u.ban_expires_at IS NULL OR u.ban_expires_at > now())) THEN
    RAISE EXCEPTION 'Account suspended' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.submissions s WHERE s.client_hash = p_client_hash AND s.created_at > now() - interval '1 hour') >= 5
     OR (p_user IS NOT NULL AND (SELECT count(*) FROM public.submissions s WHERE s.submitter_user_id = p_user AND s.created_at > now() - interval '24 hours') >= 20) THEN
    RAISE EXCEPTION 'Too many submissions' USING ERRCODE = 'UV429';
  END IF;
  INSERT INTO public.submissions (kind, title, organization, source_url, details, contact_name, contact_email, submitter_user_id, client_hash)
  VALUES (p_kind, p_title, p_organization, p_source_url, coalesce(p_details, '{}'::jsonb), p_contact_name, p_contact_email, p_user, p_client_hash);
END $$;
REVOKE ALL ON FUNCTION public.intake_submission(text, text, text, text, jsonb, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_submission(text, text, text, text, jsonb, text, text, uuid, text) TO service_role;

-- Public report of a visible listing. Invisible or unknown targets are P0002.
CREATE FUNCTION public.intake_listing_report(p_kind text, p_id uuid, p_reason text, p_details text, p_user uuid, p_client_hash text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_visible boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('intake:' || p_client_hash, 0));
  v_visible := CASE p_kind
    WHEN 'event' THEN EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_id AND e.status = 'approved' AND e.deleted_at IS NULL)
    WHEN 'opportunity' THEN EXISTS (SELECT 1 FROM public.discovery_public d WHERE d.kind = 'opportunity' AND d.id = p_id)
    WHEN 'resource' THEN EXISTS (SELECT 1 FROM public.resources r WHERE r.id = p_id AND r.status = 'published' AND r.deleted_at IS NULL)
    ELSE false END;
  IF NOT v_visible THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.listing_reports l WHERE l.client_hash = p_client_hash AND l.status = 'open' AND l.reason = p_reason
      AND l.created_at > now() - interval '24 hours'
      AND ((p_kind = 'event' AND l.event_id = p_id) OR (p_kind = 'opportunity' AND l.opportunity_id = p_id) OR (p_kind = 'resource' AND l.resource_id = p_id))) THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.listing_reports l WHERE l.client_hash = p_client_hash AND l.created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Too many reports' USING ERRCODE = 'UV429';
  END IF;
  INSERT INTO public.listing_reports (event_id, opportunity_id, resource_id, reason, details, reporter_user_id, client_hash)
  VALUES (CASE WHEN p_kind = 'event' THEN p_id END, CASE WHEN p_kind = 'opportunity' THEN p_id END,
    CASE WHEN p_kind = 'resource' THEN p_id END, p_reason, p_details, p_user, p_client_hash);
END $$;
REVOKE ALL ON FUNCTION public.intake_listing_report(text, uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_listing_report(text, uuid, text, text, uuid, text) TO service_role;

-- Editor review. Convert creates a DRAFT (never published, never checked) and
-- never copies private contact data. A retried convert returns the same target.
-- The returned submission omits contact fields, the client hash and the
-- submitter id. resources.author_name is capped at 120, organization at 200.
CREATE FUNCTION public.review_submission(p_actor uuid, p_id uuid, p_action text, p_reason text, p_expected timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v public.submissions;
  v_target_kind text;
  v_target_id uuid;
  v_slug text;
BEGIN
  PERFORM public.discovery_require_editor(p_actor);
  IF p_action NOT IN ('convert','reject','spam') THEN RAISE EXCEPTION 'Unsupported action' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v FROM public.submissions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002'; END IF;
  IF p_action = 'convert' AND v.status = 'converted' THEN
    RETURN jsonb_build_object('submission', to_jsonb(v) - 'contact_name' - 'contact_email' - 'client_hash' - 'submitter_user_id',
      'target', CASE WHEN v.target_opportunity_id IS NOT NULL THEN jsonb_build_object('kind', 'opportunity', 'id', v.target_opportunity_id)
        WHEN v.target_resource_id IS NOT NULL THEN jsonb_build_object('kind', 'resource', 'id', v.target_resource_id) END);
  END IF;
  IF v.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Submission changed; reload before reviewing' USING ERRCODE = '40001'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'Submission was already reviewed' USING ERRCODE = '22023'; END IF;
  IF p_action = 'reject' AND nullif(trim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'A rejection needs a reason' USING ERRCODE = '22023'; END IF;
  IF p_action = 'convert' THEN
    v_slug := coalesce(nullif(trim(both '-' from left(trim(both '-' from regexp_replace(lower(v.title), '[^a-z0-9]+', '-', 'g')), 100)), ''), 'listing')
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    IF v.kind = 'resource' THEN
      IF v.source_url IS NULL OR v.source_url !~* '^https://' THEN
        RAISE EXCEPTION 'A resource needs an https source URL' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.resources (slug, resource_type, title, summary, external_url, category, audience, author_name, source_note, created_by, updated_by)
      VALUES (v_slug, 'external', v.title, left(coalesce(nullif(trim(v.details->>'description'), ''), v.title), 500), v.source_url,
        coalesce(v.details->>'category', 'career'), coalesce(nullif(trim(v.details->>'audience'), ''), 'Students'), left(v.organization, 120),
        'Suggested through public submission', p_actor, p_actor)
      RETURNING id INTO v_target_id;
      v_target_kind := 'resource';
    ELSE
      INSERT INTO public.opportunities (slug, listing_type, title, organization, description, location, work_mode, source_type,
        source_url, action_url, application_mode, status, created_by, updated_by)
      VALUES (v_slug, CASE WHEN v.kind = 'company_request' THEN 'job' ELSE v.kind END, v.title, v.organization,
        left(coalesce(nullif(trim(concat_ws(E'\n\n', v.details->>'description', v.details->>'duties',
          'Must have: ' || (v.details->>'must_have_skills'), 'Nice to have: ' || (v.details->>'nice_to_have_skills'),
          v.details->>'why_worth_it')), ''), v.title), 15000),
        left(coalesce(v.details->>'location', ''), 200), coalesce(v.details->>'work_mode', 'in_person'),
        CASE v.kind WHEN 'company_request' THEN 'partner' ELSE 'manual' END,
        v.source_url, v.source_url, 'external', 'draft', p_actor, p_actor)
      RETURNING id INTO v_target_id;
      v_target_kind := 'opportunity';
    END IF;
  END IF;
  UPDATE public.submissions s SET
    status = CASE p_action WHEN 'convert' THEN 'converted' WHEN 'reject' THEN 'rejected' ELSE 'spam' END,
    reviewed_by = p_actor, reviewed_at = clock_timestamp(), review_reason = nullif(trim(p_reason), ''),
    target_opportunity_id = CASE WHEN v_target_kind = 'opportunity' THEN v_target_id END,
    target_resource_id = CASE WHEN v_target_kind = 'resource' THEN v_target_id END,
    updated_at = clock_timestamp()
  WHERE s.id = p_id RETURNING * INTO v;
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, metadata)
  VALUES (p_actor, 'submission_' || p_action, 'submission', v.id::text,
    jsonb_build_object('kind', v.kind, 'target_kind', v_target_kind, 'target_id', v_target_id));
  RETURN jsonb_build_object('submission', to_jsonb(v) - 'contact_name' - 'contact_email' - 'client_hash' - 'submitter_user_id',
    'target', CASE WHEN v_target_id IS NOT NULL THEN jsonb_build_object('kind', v_target_kind, 'id', v_target_id) END);
END $$;
REVOKE ALL ON FUNCTION public.review_submission(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_submission(uuid, uuid, text, text, timestamptz) TO service_role;

CREATE FUNCTION public.resolve_listing_report(p_actor uuid, p_id uuid, p_action text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v public.listing_reports;
BEGIN
  PERFORM public.discovery_require_editor(p_actor);
  IF p_action NOT IN ('resolve','dismiss') THEN RAISE EXCEPTION 'Unsupported action' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v FROM public.listing_reports WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002'; END IF;
  IF v.status <> 'open' THEN RAISE EXCEPTION 'Report was already handled' USING ERRCODE = '22023'; END IF;
  UPDATE public.listing_reports l SET
    status = CASE p_action WHEN 'resolve' THEN 'resolved' ELSE 'dismissed' END,
    resolution_note = nullif(trim(p_note), ''), resolved_by = p_actor, resolved_at = clock_timestamp()
  WHERE l.id = p_id RETURNING * INTO v;
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, metadata)
  VALUES (p_actor, 'listing_report_' || p_action, 'listing_report', v.id::text,
    jsonb_build_object('reason', v.reason,
      'target_kind', CASE WHEN v.event_id IS NOT NULL THEN 'event' WHEN v.opportunity_id IS NOT NULL THEN 'opportunity' ELSE 'resource' END,
      'target_id', coalesce(v.event_id, v.opportunity_id, v.resource_id)));
  RETURN to_jsonb(v) - 'client_hash';
END $$;
REVOKE ALL ON FUNCTION public.resolve_listing_report(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_listing_report(uuid, uuid, text, text) TO service_role;
