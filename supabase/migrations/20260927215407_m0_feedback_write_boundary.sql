-- M0 / Phase 6 WR-07: experiment attribution is a server decision. A direct
-- Data API insert previously bypassed the feedback route and could credit any
-- existing experiment variant. Reads remain subject-bound under existing RLS.
-- Deploy with the feedback route that writes through the registered elevated
-- boundary after authenticating the subject and resolving the assignment.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.recommendation_feedback FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users can insert own feedback"
  ON public.recommendation_feedback;
GRANT SELECT ON public.recommendation_feedback TO authenticated;
GRANT SELECT, INSERT ON public.recommendation_feedback TO service_role;
