-- M3 final review (controller ruling): converted opportunity drafts kept only
-- the prose of a submission and dropped its other details. review_submission
-- is replaced with identical behaviour, grants and search_path, except that
-- an opportunity draft's description also carries labelled lines for the
-- non-empty submitted start date, deadline, hours, compensation, start date,
-- employment type and company context (never contact fields), still capped at
-- 15000 characters, and a valid ISO deadline_on becomes a date-precision
-- deadline (source_timezone and timezone_assumed keep their defaults:
-- America/Toronto, assumed). The signature is unchanged, so the generated
-- types do not change.
CREATE OR REPLACE FUNCTION public.review_submission(p_actor uuid, p_id uuid, p_action text, p_reason text, p_expected timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v public.submissions;
  v_target_kind text;
  v_target_id uuid;
  v_slug text;
  v_deadline date;
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
      -- A submitted ISO deadline becomes a date-precision deadline (end of day,
      -- Toronto, timezone assumed: the column defaults). Anything else, or an
      -- impossible calendar date, leaves the draft without a deadline.
      IF coalesce(v.details->>'deadline_on', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
        BEGIN
          v_deadline := (v.details->>'deadline_on')::date;
        EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
          v_deadline := NULL;
        END;
      END IF;
      INSERT INTO public.opportunities (slug, listing_type, title, organization, description, location, work_mode, source_type,
        source_url, action_url, application_mode, status, deadline_precision, deadline_date, created_by, updated_by)
      VALUES (v_slug, CASE WHEN v.kind = 'company_request' THEN 'job' ELSE v.kind END, v.title, v.organization,
        -- The submitted details an editor needs, as labelled lines after the
        -- prose. Contact fields are never read here.
        left(coalesce(nullif(trim(concat_ws(E'\n\n', v.details->>'description', v.details->>'duties',
          'Must have: ' || (v.details->>'must_have_skills'), 'Nice to have: ' || (v.details->>'nice_to_have_skills'),
          v.details->>'why_worth_it',
          nullif(concat_ws(E'\n',
            'Submitted start date: ' || nullif(trim(v.details->>'starts_on'), ''),
            'Submitted deadline: ' || nullif(trim(v.details->>'deadline_on'), ''),
            'Hours: ' || nullif(trim(v.details->>'hours'), ''),
            'Compensation: ' || nullif(trim(v.details->>'compensation'), ''),
            'Start date: ' || nullif(trim(v.details->>'start_date'), ''),
            'Employment type: ' || replace(nullif(trim(v.details->>'employment_type'), ''), '_', ' '),
            'Company context: ' || nullif(trim(v.details->>'company_context'), '')), ''))), ''), v.title), 15000),
        left(coalesce(v.details->>'location', ''), 200), coalesce(v.details->>'work_mode', 'in_person'),
        CASE v.kind WHEN 'company_request' THEN 'partner' ELSE 'manual' END,
        v.source_url, v.source_url, 'external', 'draft',
        CASE WHEN v_deadline IS NULL THEN 'none' ELSE 'date' END, v_deadline, p_actor, p_actor)
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
