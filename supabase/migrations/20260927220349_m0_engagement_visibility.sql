-- M0 / DI-91: invalid historic visibility fails closed to private. A default
-- alone does not protect explicit NULL writes, hence CHECK plus NOT NULL.
UPDATE public.users SET visibility = 'private'
WHERE visibility IS NULL OR visibility NOT IN ('public', 'private');
ALTER TABLE public.users ADD CONSTRAINT users_visibility_check
  CHECK (visibility IN ('public', 'private'));
ALTER TABLE public.users ALTER COLUMN visibility SET NOT NULL;

-- M0 / DI-87: derive engagement from the canonical interaction table instead
-- of recreating the retired summary table. No caller-selected subject and no
-- privileged execution: auth.uid() AND ordinary table RLS scope every read.
CREATE FUNCTION public.get_user_engagement()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $function$
  WITH own AS MATERIALIZED (
    SELECT interaction_type, event_id, created_at
    FROM public.user_interactions
    WHERE user_id = (SELECT auth.uid()) AND interaction_type <> 'unsave'
  ), tag_counts AS (
    SELECT tag, count(*) AS count
    FROM own JOIN public.events e ON e.id = own.event_id
    CROSS JOIN LATERAL unnest(e.tags) AS tag
    WHERE own.interaction_type IN ('save', 'click', 'calendar_add')
    GROUP BY tag ORDER BY count DESC, tag LIMIT 10
  ), club_counts AS (
    SELECT e.club_id, count(*) AS count
    FROM own JOIN public.events e ON e.id = own.event_id
    WHERE own.interaction_type IN ('save', 'click', 'calendar_add')
      AND e.club_id IS NOT NULL
    GROUP BY e.club_id ORDER BY count DESC, e.club_id LIMIT 10
  )
  SELECT jsonb_build_object(
    'user_id', (SELECT auth.uid()),
    'total_views', count(*) FILTER (WHERE interaction_type = 'view'),
    'total_clicks', count(*) FILTER (WHERE interaction_type = 'click'),
    'total_saves', count(*) FILTER (WHERE interaction_type = 'save'),
    'total_shares', count(*) FILTER (WHERE interaction_type = 'share'),
    'total_calendar_adds', count(*) FILTER (WHERE interaction_type = 'calendar_add'),
    'favorite_tags', (SELECT coalesce(jsonb_agg(jsonb_build_object('tag', tag, 'count', count) ORDER BY count DESC, tag), '[]'::jsonb) FROM tag_counts),
    'favorite_clubs', (SELECT coalesce(jsonb_agg(jsonb_build_object('club_id', club_id, 'count', count) ORDER BY count DESC, club_id), '[]'::jsonb) FROM club_counts),
    'last_active_at', max(created_at), 'created_at', min(created_at), 'updated_at', max(created_at)
  ) FROM own;
$function$;
REVOKE ALL ON FUNCTION public.get_user_engagement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_engagement() TO authenticated;
COMMENT ON FUNCTION public.get_user_engagement() IS
  'DI-87: current caller engagement, computed under caller RLS; no subject parameter or persisted summary.';
