-- F-011: attendance rows are private to the student and the event's organizers.
-- Public discovery needs totals, never a user_id/event_id attendance graph.
BEGIN;

DROP POLICY IF EXISTS "Anyone can view rsvps" ON public.rsvps;
CREATE POLICY "Users can view own rsvps"
  ON public.rsvps FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Event organizers can view attendee rsvps"
  ON public.rsvps FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = rsvps.event_id
        AND (e.created_by = (SELECT auth.uid()) OR public.is_club_member(e.club_id))
    )
  );

-- Deliberate public aggregate: there is no user selector and no identifying
-- output. A single approved, non-deleted event is the only accessible scope.
-- There is no separate event visibility column in the current schema.
-- Missing, pending, rejected, suspended and deleted events all return zeros.
CREATE FUNCTION public.get_public_event_rsvp_counts(target_event_id uuid)
RETURNS TABLE (going bigint, interested bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    count(*) FILTER (WHERE r.status = 'going') AS going,
    count(*) FILTER (WHERE r.status = 'interested') AS interested
  FROM public.rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE e.id = target_event_id
    AND e.status = 'approved'
    AND e.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_public_event_rsvp_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_rsvp_counts(uuid) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_public_event_rsvp_counts(uuid) IS
  'F-011 public declassification: anonymous-safe going/interested counts only, '
  'for one approved, non-deleted event. No identifiers or attendee rows. '
  'Server-side COUNT preserves exact totals beyond PostgREST max_rows (F-079).';

COMMIT;
