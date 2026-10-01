-- M0 / F-009, F-010: interaction identity and popularity are server-owned.
-- The handler validates bounded input, checks event visibility with the cookie
-- client, and binds user_id to the session (NULL for anonymous tracking).
-- Its elevated INSERT runs the existing invoker trigger + recompute function
-- as service_role, preserving legitimate aggregate updates without introducing
-- a SECURITY DEFINER function callable by client roles.

REVOKE ALL ON TABLE public.user_interactions,
  public.event_popularity_scores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_interactions,
  public.event_popularity_scores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_interactions,
  public.event_popularity_scores TO service_role;

DROP POLICY IF EXISTS "Anyone can insert interactions" ON public.user_interactions;
DROP POLICY IF EXISTS "Authenticated users can update popularity scores"
  ON public.event_popularity_scores;

REVOKE ALL ON FUNCTION public.recalculate_on_interaction(),
  public.update_event_popularity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_on_interaction(),
  public.update_event_popularity(uuid) TO service_role;
