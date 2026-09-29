-- P1-03 intentional product change: preserve legacy review history without
-- public stars/comments, organizer access, or any new client-authored ratings.
-- No feature switch changes database privileges. Future private feedback is
-- a separate contract/table, not a reopening of this legacy table.
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reviews TO authenticated;

DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can insert own review" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own review" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete own review" ON public.reviews;

CREATE POLICY reviews_private_history ON public.reviews
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users AS viewer
    WHERE viewer.id = (SELECT auth.uid())
      AND 'admin' = ANY(viewer.roles)
      AND (viewer.banned_at IS NULL OR
        (viewer.ban_expires_at IS NOT NULL AND viewer.ban_expires_at <= now()))
  )
);
COMMENT ON TABLE public.reviews IS
  'Read-only legacy review history. Authors and active administrators only; no public or organizer rating aggregates. New private feedback uses a separate future model.';
