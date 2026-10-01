-- M0 DI-62/DI-68. Short, service-only transactions behind existing route guards.
-- INVOKER deliberately: no new RLS-bypassing public SECURITY DEFINER surface.
CREATE FUNCTION public.transfer_club_ownership_atomic(p_club_id uuid, p_actor_id uuid, p_new_owner_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_actor_id = p_new_owner_id THEN RETURN 'already_owner'; END IF;
  -- Serialize transfers for this club; after waiting, recheck the current actor.
  PERFORM 1 FROM public.clubs WHERE id=p_club_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM public.club_members WHERE club_id=p_club_id ORDER BY user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id=p_club_id AND user_id=p_actor_id AND role='owner') THEN RETURN 'conflict'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id=p_club_id AND user_id=p_new_owner_id) THEN RETURN 'not_member'; END IF;
  UPDATE public.club_members SET role='organizer' WHERE club_id=p_club_id AND user_id=p_actor_id;
  UPDATE public.club_members SET role='owner' WHERE club_id=p_club_id AND user_id=p_new_owner_id;
  INSERT INTO public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata)
  VALUES(p_actor_id,'club_ownership_transferred','club',p_club_id::text,
    jsonb_build_object('new_owner_id',p_new_owner_id,'previous_owner_id',p_actor_id));
  RETURN 'ok';
END;
$$;

CREATE FUNCTION public.review_organizer_request_atomic(p_request_id uuid, p_actor_id uuid, p_status text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE req public.organizer_requests%ROWTYPE; club_name text;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor_id AND 'admin'=ANY(roles)) THEN RETURN 'forbidden'; END IF;
  SELECT * INTO req FROM public.organizer_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF req.status <> 'pending' THEN RETURN 'conflict'; END IF;
  IF p_status='approved' THEN
    -- Row-level UPDATE takes the user lock and appends to the current array;
    -- concurrent grants to this user cannot be lost to a stale read/overwrite.
    UPDATE public.users SET roles=CASE WHEN 'club_organizer'=ANY(roles) THEN roles ELSE array_append(roles,'club_organizer'::public.user_role) END,
      updated_at=now() WHERE id=req.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Applicant profile missing' USING ERRCODE='23503'; END IF;
    -- Never demote somebody who is already the club owner.
    INSERT INTO public.club_members(user_id,club_id,role) VALUES(req.user_id,req.club_id,'organizer')
      ON CONFLICT (user_id,club_id) DO NOTHING;
  END IF;
  UPDATE public.organizer_requests SET status=p_status,reviewed_by=p_actor_id,updated_at=now() WHERE id=req.id;
  SELECT name INTO club_name FROM public.clubs WHERE id=req.club_id;
  INSERT INTO public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata)
  VALUES(p_actor_id,p_status,'organizer_request',req.id::text,jsonb_build_object('user_id',req.user_id,'club_id',req.club_id));
  INSERT INTO public.notifications(user_id,type,title,message)
  VALUES(req.user_id,
    CASE WHEN p_status='approved' THEN 'organizer_approved' ELSE 'organizer_rejected' END,
    CASE WHEN p_status='approved' THEN 'Organizer Request Approved!' ELSE 'Organizer Request Not Approved' END,
    CASE WHEN p_status='approved'
      THEN 'Your request to become an organizer for '||COALESCE(club_name,'the club')||' has been approved. You can now create events for this club.'
      ELSE 'Your request to become an organizer for '||COALESCE(club_name,'the club')||' was not approved.' END);
  RETURN 'ok';
END;
$$;

CREATE FUNCTION public.review_event_edits_atomic(p_event_id uuid, p_actor_id uuid, p_action text, p_expected_pending_edits jsonb, p_reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE ev public.events%ROWTYPE; fields jsonb; approved boolean;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('approve','reject') OR p_expected_pending_edits IS NULL OR jsonb_typeof(p_expected_pending_edits)<>'object'
    THEN RAISE EXCEPTION 'Invalid edit decision' USING ERRCODE='22023'; END IF;
  IF p_action='reject' AND COALESCE(p_reason,'')='' THEN RAISE EXCEPTION 'Rejection reason required' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor_id AND 'admin'=ANY(roles)) THEN RETURN 'forbidden'; END IF;
  SELECT * INTO ev FROM public.events WHERE id=p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  -- Compare the exact object displayed to the moderator, not the route's
  -- newer read and not merely whether the queue is still nonempty.
  IF ev.pending_edits IS DISTINCT FROM p_expected_pending_edits THEN RETURN 'conflict'; END IF;
  approved := p_action='approve';
  IF approved THEN
    IF ev.pending_edits ? 'title' AND jsonb_typeof(ev.pending_edits->'title') IS DISTINCT FROM 'string'
      THEN RAISE EXCEPTION 'Invalid pending title' USING ERRCODE='22023'; END IF;
    IF ev.pending_edits ? 'image_url' AND jsonb_typeof(ev.pending_edits->'image_url') NOT IN ('string','null')
      THEN RAISE EXCEPTION 'Invalid pending image' USING ERRCODE='22023'; END IF;
    UPDATE public.events SET
      title=CASE WHEN ev.pending_edits ? 'title' THEN ev.pending_edits->>'title' ELSE title END,
      image_url=CASE WHEN ev.pending_edits ? 'image_url' THEN ev.pending_edits->>'image_url' ELSE image_url END,
      pending_edits=NULL WHERE id=ev.id;
    SELECT COALESCE(jsonb_agg(key ORDER BY key),'[]'::jsonb) INTO fields FROM jsonb_object_keys(ev.pending_edits) AS key WHERE key IN ('title','image_url');
  ELSE
    UPDATE public.events SET pending_edits=NULL WHERE id=ev.id;
    SELECT COALESCE(jsonb_agg(key ORDER BY key),'[]'::jsonb) INTO fields FROM jsonb_object_keys(ev.pending_edits) AS key WHERE key <> 'submitted_at';
  END IF;
  IF ev.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,message,event_id,read,created_at)
    VALUES(ev.created_by,CASE WHEN approved THEN 'edit_approved' ELSE 'edit_rejected' END,
      CASE WHEN approved THEN 'Edits Approved' ELSE 'Edits Rejected' END,
      CASE WHEN approved THEN 'Your edits to "'||ev.title||'" have been approved and are now live.'
        ELSE 'Your edits to "'||ev.title||'" were rejected: '||p_reason END,ev.id,false,now())
    ON CONFLICT (user_id,event_id,type) WHERE event_id IS NOT NULL DO UPDATE SET message=EXCLUDED.message,read=false,created_at=EXCLUDED.created_at;
  END IF;
  INSERT INTO public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata)
  VALUES(p_actor_id,CASE WHEN approved THEN 'approved_edits' ELSE 'rejected_edits' END,'event',ev.id::text,
    CASE WHEN approved THEN jsonb_build_object('approved_fields',fields) ELSE jsonb_build_object('reason',p_reason,'rejected_fields',fields) END);
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_club_ownership_atomic(uuid,uuid,uuid),
  public.review_organizer_request_atomic(uuid,uuid,text),
  public.review_event_edits_atomic(uuid,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_club_ownership_atomic(uuid,uuid,uuid),
  public.review_organizer_request_atomic(uuid,uuid,text),
  public.review_event_edits_atomic(uuid,uuid,text,jsonb,text) TO service_role;
