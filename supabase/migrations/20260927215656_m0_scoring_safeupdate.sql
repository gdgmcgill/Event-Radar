-- M0 / DI-82: make the existing global rebuild explicit for pg_safeupdate.
-- Scoring weights, inputs, and output math are unchanged. Preserve the function
-- owner, SECURITY DEFINER, pinned search_path and grants from Phase 6.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.compute_user_scores()'::regprocedure);
BEGIN
  IF position('DELETE FROM tag_interaction_counts;' IN definition) = 0
     OR position('DELETE FROM user_event_scores;' IN definition) = 0 THEN
    RAISE EXCEPTION 'DI-82 expected scoring rebuild statements are missing';
  END IF;
  definition := replace(definition, 'DELETE FROM tag_interaction_counts;',
                        'DELETE FROM tag_interaction_counts WHERE true;');
  definition := replace(definition, 'DELETE FROM user_event_scores;',
                        'DELETE FROM user_event_scores WHERE true;');
  EXECUTE definition;
END
$migration$;
