-- New tables for recommendation engine
-- user_event_scores: precomputed personalized scores per user per event
CREATE TABLE IF NOT EXISTS user_event_scores (
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id    uuid REFERENCES events(id) ON DELETE CASCADE,
  score       float NOT NULL,
  breakdown   jsonb NOT NULL DEFAULT '{}',
  scored_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_scores_user_score
  ON user_event_scores (user_id, score DESC);

-- tag_interaction_counts: precomputed rollup of interactions by tag per user
CREATE TABLE IF NOT EXISTS tag_interaction_counts (
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tag              text NOT NULL,
  save_count       int NOT NULL DEFAULT 0,
  click_count      int NOT NULL DEFAULT 0,
  view_count       int NOT NULL DEFAULT 0,
  last_interaction timestamptz,
  PRIMARY KEY (user_id, tag)
);

-- Add inferred_tags column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS inferred_tags text[] NOT NULL DEFAULT '{}';

-- RLS policies
ALTER TABLE user_event_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_interaction_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own scores"
  ON user_event_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all scores"
  ON user_event_scores FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read their own tag counts"
  ON tag_interaction_counts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tag counts"
  ON tag_interaction_counts FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================
-- compute_user_scores()
-- Batch scoring function. Called by pg_cron every 6 hours.
-- Computes personalized event scores for all active users.
-- =============================================================
CREATE OR REPLACE FUNCTION compute_user_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user RECORD;
  _event RECORD;
  _score float;
  _tag_score float;
  _interaction_score float;
  _popularity_score float;
  _recency_score float;
  _social_score float;
  _max_popularity float;
  _user_tags text[];
  _expanded_tags text[];
  _overlap_count int;
  _partial_count int;
  _total_user_tags int;
  _interaction_weight float;
  _max_interaction float;
  _friend_count int;
  _max_friends int;
  _days_until float;
  _breakdown jsonb;
  _valid_tags text[];
  -- Tag hierarchy: granular tag -> parent broad tag
  _tag_parents jsonb := '{
    "hackathon": "tech",
    "competition": "career",
    "guest_speaker": "academic",
    "free_food": "food",
    "workshop": "tech",
    "party": "social",
    "fitness": "sports",
    "info_session": "career"
  }'::jsonb;
BEGIN
  -- Step 1: Refresh tag_interaction_counts
  DELETE FROM tag_interaction_counts;

  INSERT INTO tag_interaction_counts (user_id, tag, save_count, click_count, view_count, last_interaction)
  SELECT
    ui.user_id,
    unnest(e.tags) AS tag,
    COUNT(*) FILTER (WHERE ui.interaction_type = 'save') AS save_count,
    COUNT(*) FILTER (WHERE ui.interaction_type = 'click') AS click_count,
    COUNT(*) FILTER (WHERE ui.interaction_type = 'view') AS view_count,
    MAX(ui.created_at) AS last_interaction
  FROM user_interactions ui
  JOIN events e ON e.id = ui.event_id
  WHERE ui.user_id IS NOT NULL
    AND ui.interaction_type IN ('save', 'click', 'view')
  GROUP BY ui.user_id, unnest(e.tags)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET
    save_count = EXCLUDED.save_count,
    click_count = EXCLUDED.click_count,
    view_count = EXCLUDED.view_count,
    last_interaction = EXCLUDED.last_interaction;

  -- Valid interest tags allowlist
  _valid_tags := ARRAY[
    'academic','social','sports','career','cultural','wellness',
    'music','tech','food','volunteer','arts','networking',
    'hackathon','competition','guest_speaker','free_food',
    'workshop','party','fitness','info_session'
  ];

  -- Step 2: Implicit interest evolution (inferred_tags)
  UPDATE users u
  SET inferred_tags = (
    SELECT COALESCE(array_agg(DISTINCT tic.tag), '{}')
    FROM tag_interaction_counts tic
    WHERE tic.user_id = u.id
      AND (tic.save_count + tic.click_count) >= 3
      AND tic.tag = ANY(_valid_tags)
      AND tic.tag != ALL(u.interest_tags)
      AND tic.tag != ALL(u.inferred_tags)
  ) || u.inferred_tags
  WHERE EXISTS (
    SELECT 1 FROM tag_interaction_counts tic
    WHERE tic.user_id = u.id
      AND (tic.save_count + tic.click_count) >= 3
      AND tic.tag = ANY(_valid_tags)
      AND tic.tag != ALL(u.interest_tags)
      AND tic.tag != ALL(u.inferred_tags)
  );

  -- Get max popularity for normalization
  SELECT COALESCE(MAX(popularity_score), 1) INTO _max_popularity
  FROM event_popularity_scores;

  -- Step 3: Clear stale scores and compute new ones
  DELETE FROM user_event_scores;

  FOR _user IN
    SELECT id, interest_tags, inferred_tags
    FROM users
    WHERE id IN (
      SELECT DISTINCT user_id FROM user_interactions
      WHERE created_at > NOW() - INTERVAL '90 days'
      UNION
      SELECT id FROM users WHERE array_length(interest_tags, 1) > 0
    )
  LOOP
    _user_tags := _user.interest_tags || _user.inferred_tags;
    -- Expand: add parent tags for any granular tags
    _expanded_tags := _user_tags;
    FOR i IN 1..COALESCE(array_length(_user_tags, 1), 0) LOOP
      IF _tag_parents ? _user_tags[i] THEN
        _expanded_tags := array_append(_expanded_tags, _tag_parents->>_user_tags[i]);
      END IF;
    END LOOP;
    _total_user_tags := COALESCE(array_length(_user_tags, 1), 0);

    SELECT COALESCE(MAX(save_count * 5 + click_count * 3 + view_count), 1)
    INTO _max_interaction
    FROM tag_interaction_counts WHERE user_id = _user.id;

    -- Social signal normalization
    -- NOTE: event_rsvps table does not exist yet. When it is created,
    -- uncomment the query below and remove the hardcoded fallback.
    _max_friends := 1;

    FOR _event IN
      SELECT e.id, e.tags, e.start_date,
             COALESCE(eps.popularity_score, 0) AS pop_score
      FROM events e
      LEFT JOIN event_popularity_scores eps ON eps.event_id = e.id
      WHERE e.status = 'approved'
        AND e.start_date >= CURRENT_DATE
    LOOP
      -- Tag affinity (0.35) with hierarchy
      IF _total_user_tags > 0 THEN
        SELECT COUNT(*) INTO _overlap_count
        FROM unnest(_user_tags) ut
        WHERE ut = ANY(_event.tags);

        SELECT COUNT(*) INTO _partial_count
        FROM unnest(_expanded_tags) et
        WHERE et = ANY(_event.tags)
          AND et != ALL(_user_tags);

        _tag_score := LEAST(
          ((_overlap_count::float + _partial_count::float * 0.5) / _total_user_tags),
          1.0
        );
      ELSE
        _tag_score := 0;
      END IF;

      -- Interaction affinity (0.25)
      SELECT COALESCE(SUM(save_count * 5 + click_count * 3 + view_count), 0)
      INTO _interaction_weight
      FROM tag_interaction_counts
      WHERE user_id = _user.id
        AND tag = ANY(_event.tags);

      _interaction_score := LEAST(_interaction_weight / _max_interaction, 1.0);

      -- Popularity (0.20)
      _popularity_score := _event.pop_score / _max_popularity;

      -- Recency (0.15)
      _days_until := GREATEST(EXTRACT(EPOCH FROM (_event.event_date - CURRENT_DATE)) / 86400, 0);
      _recency_score := EXP(-0.12 * _days_until);

      -- Social signal (0.05)
      -- NOTE: event_rsvps table does not exist yet. Set to 0 until created.
      _friend_count := 0;
      _social_score := 0;

      -- Combined score
      _score := (_tag_score * 0.35)
              + (_interaction_score * 0.25)
              + (_popularity_score * 0.20)
              + (_recency_score * 0.15)
              + (_social_score * 0.05);

      _breakdown := jsonb_build_object(
        'tag', ROUND((_tag_score * 0.35)::numeric, 4),
        'interaction', ROUND((_interaction_score * 0.25)::numeric, 4),
        'popularity', ROUND((_popularity_score * 0.20)::numeric, 4),
        'recency', ROUND((_recency_score * 0.15)::numeric, 4),
        'social', ROUND((_social_score * 0.05)::numeric, 4)
      );

      INSERT INTO user_event_scores (user_id, event_id, score, breakdown, scored_at)
      VALUES (_user.id, _event.id, ROUND(_score::numeric, 4)::float, _breakdown, NOW());
    END LOOP;
  END LOOP;
END;
$$;

-- Schedule pg_cron to run every 6 hours
-- NOTE: pg_cron must be enabled in Supabase dashboard (Database > Extensions)
-- Run this manually in SQL editor after enabling pg_cron:
-- SELECT cron.schedule('compute-user-scores', '0 */6 * * *', 'SELECT compute_user_scores()');
