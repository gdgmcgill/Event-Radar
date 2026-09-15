


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Extensions. `supabase db dump` filters CREATE EXTENSION out of its output, so the dumped
-- baseline was missing this and the FIRST `db diff --linked` against production reported it as
-- the single remaining difference. The statement below is migra's own emitted DDL, pasted
-- verbatim from that diff — it is generated output, not an authored guess.
--
-- It is a real dependency, not a cosmetic one: `public.search_events_fuzzy` executes
-- `SET pg_trgm.similarity_threshold = 0.1`, which errors without the extension loaded. It is
-- placed here, ahead of every type, table and function, because extension objects must exist
-- before anything that references them.
--
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";



CREATE TYPE "public"."admin_action" AS ENUM (
    'approved',
    'rejected',
    'created',
    'updated',
    'deleted'
);


ALTER TYPE "public"."admin_action" OWNER TO "postgres";


CREATE TYPE "public"."audit_target" AS ENUM (
    'event',
    'user',
    'club'
);


ALTER TYPE "public"."audit_target" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'club_organizer',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_user_scores"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

  _valid_tags := ARRAY[
    'academic','social','sports','career','cultural','wellness',
    'music','tech','food','volunteer','arts','networking',
    'hackathon','competition','guest_speaker','free_food',
    'workshop','party','fitness','info_session'
  ];

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

  SELECT COALESCE(MAX(popularity_score), 1) INTO _max_popularity
  FROM event_popularity_scores;

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

    _max_friends := 1;

    FOR _event IN
      SELECT e.id, e.tags, e.start_date,
             COALESCE(eps.popularity_score, 0) AS pop_score
      FROM events e
      LEFT JOIN event_popularity_scores eps ON eps.event_id = e.id
      WHERE e.status = 'approved'
        AND e.start_date >= CURRENT_DATE
    LOOP
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

      SELECT COALESCE(SUM(save_count * 5 + click_count * 3 + view_count), 0)
      INTO _interaction_weight
      FROM tag_interaction_counts
      WHERE user_id = _user.id
        AND tag = ANY(_event.tags);

      _interaction_score := LEAST(_interaction_weight / _max_interaction, 1.0);
      _popularity_score := _event.pop_score / _max_popularity;

      _days_until := GREATEST(EXTRACT(EPOCH FROM (_event.start_date - CURRENT_DATE)) / 86400, 0);
      _recency_score := EXP(-0.12 * _days_until);

      _friend_count := 0;
      _social_score := 0;

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


ALTER FUNCTION "public"."compute_user_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_ids_by_time_filter"("time_of_day" "text" DEFAULT NULL::"text", "day_type" "text" DEFAULT NULL::"text") RETURNS TABLE("event_id" "uuid")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT e.id AS event_id
  FROM public.events e
  WHERE
    (time_of_day IS NULL OR
      CASE time_of_day
        WHEN 'morning' THEN EXTRACT(HOUR FROM e.start_date) >= 6 AND EXTRACT(HOUR FROM e.start_date) < 12
        WHEN 'afternoon' THEN EXTRACT(HOUR FROM e.start_date) >= 12 AND EXTRACT(HOUR FROM e.start_date) < 17
        WHEN 'evening' THEN EXTRACT(HOUR FROM e.start_date) >= 17 AND EXTRACT(HOUR FROM e.start_date) < 22
        WHEN 'night' THEN EXTRACT(HOUR FROM e.start_date) >= 22 OR EXTRACT(HOUR FROM e.start_date) < 6
        ELSE TRUE
      END)
    AND
    (day_type IS NULL OR
      CASE day_type
        WHEN 'weekday' THEN EXTRACT(DOW FROM e.start_date) BETWEEN 1 AND 5
        WHEN 'weekend' THEN EXTRACT(DOW FROM e.start_date) IN (0, 6)
        ELSE TRUE
      END);
END;
$$;


ALTER FUNCTION "public"."get_event_ids_by_time_filter"("time_of_day" "text", "day_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friends"("target_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT u.id, u.name, u.avatar_url
  FROM users u
  JOIN user_follows f1 ON f1.following_id = u.id AND f1.follower_id = target_user_id
  JOIN user_follows f2 ON f2.follower_id = u.id AND f2.following_id = target_user_id;
$$;


ALTER FUNCTION "public"."get_friends"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friends_going_to_event"("current_user_id" "uuid", "target_event_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT u.id, u.name, u.avatar_url
  FROM users u
  JOIN saved_events se ON se.user_id = u.id AND se.event_id = target_event_id
  JOIN user_follows f1 ON f1.following_id = u.id AND f1.follower_id = current_user_id
  JOIN user_follows f2 ON f2.follower_id = u.id AND f2.following_id = current_user_id;
$$;


ALTER FUNCTION "public"."get_friends_going_to_event"("current_user_id" "uuid", "target_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_owner"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_club_owner"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_on_interaction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM update_event_popularity(NEW.event_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."recalculate_on_interaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_events_fuzzy"("search_term" "text", "result_limit" integer DEFAULT 50) RETURNS TABLE("event_id" "uuid", "rank" double precision)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  SET pg_trgm.similarity_threshold = 0.1;
  RETURN QUERY
  SELECT
    e.id AS event_id,
    GREATEST(
      similarity(e.title, search_term) * 2.0,
      similarity(e.description, search_term)
    )::FLOAT AS rank
  FROM public.events e
  WHERE
    e.title % search_term
    OR e.description % search_term
    OR e.title ILIKE '%' || search_term || '%'
    OR e.description ILIKE '%' || search_term || '%'
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."search_events_fuzzy"("search_term" "text", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_event_reminders"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  row record;
  cnt int;
  sent_24h int := 0;
  sent_1h int := 0;
begin
  -- 24-hour reminders: events starting between now+23h and now+25h
  for row in
    select se.user_id, e.id as event_id, e.title
    from saved_events se
    join events e on e.id = se.event_id
    where e.start_date between (now() + interval '23 hours') and (now() + interval '25 hours')
  loop
    select count(*) into cnt
    from notifications
    where user_id = row.user_id
      and event_id = row.event_id
      and type = 'reminder_24h';

    if cnt = 0 then
      insert into notifications (user_id, type, title, message, event_id)
      values (
        row.user_id,
        'reminder_24h',
        'Event Tomorrow',
        '"' || row.title || '" starts in about 24 hours.',
        row.event_id
      );
      sent_24h := sent_24h + 1;
    end if;
  end loop;

  -- 1-hour reminders: events starting between now+55min and now+65min
  for row in
    select se.user_id, e.id as event_id, e.title
    from saved_events se
    join events e on e.id = se.event_id
    where e.start_date between (now() + interval '55 minutes') and (now() + interval '65 minutes')
  loop
    select count(*) into cnt
    from notifications
    where user_id = row.user_id
      and event_id = row.event_id
      and type = 'reminder_1h';

    if cnt = 0 then
      insert into notifications (user_id, type, title, message, event_id)
      values (
        row.user_id,
        'reminder_1h',
        'Event Starting Soon',
        '"' || row.title || '" starts in about 1 hour!',
        row.event_id
      );
      sent_1h := sent_1h + 1;
    end if;
  end loop;

  return jsonb_build_object('24h', sent_24h, '1h', sent_1h, 'checked_at', now());
end;
$$;


ALTER FUNCTION "public"."send_event_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_feedback_requests"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  row record;
  cnt int;
  sent int := 0;
  skipped int := 0;
  events_processed int := 0;
begin
  -- Find events that ended 1-25 hours ago, approved and not deleted
  for row in
    select r.user_id, e.id as event_id, e.title
    from rsvps r
    join events e on e.id = r.event_id
    where e.status = 'approved'
      and e.deleted_at is null
      and r.status = 'going'
      and e.end_date between (now() - interval '25 hours') and (now() - interval '1 hour')
  loop
    -- Check if we already sent a feedback request for this user+event
    select count(*) into cnt
    from feedback_request_log
    where user_id = row.user_id
      and event_id = row.event_id
      and request_type = 'post_event';

    if cnt > 0 then
      skipped := skipped + 1;
      continue;
    end if;

    -- Create notification
    insert into notifications (user_id, event_id, type, title, message, read)
    values (
      row.user_id,
      row.event_id,
      'feedback_request',
      'How was ' || row.title || '?',
      'Share your experience — your feedback helps organizers improve future events.',
      false
    )
    on conflict do nothing;

    -- Log to prevent re-sending
    insert into feedback_request_log (user_id, event_id, request_type)
    values (row.user_id, row.event_id, 'post_event')
    on conflict do nothing;

    sent := sent + 1;
  end loop;

  -- Count distinct events processed
  select count(distinct e.id) into events_processed
  from events e
  where e.status = 'approved'
    and e.deleted_at is null
    and e.end_date between (now() - interval '25 hours') and (now() - interval '1 hour');

  return jsonb_build_object(
    'events_processed', events_processed,
    'feedback_requests_sent', sent,
    'feedback_requests_skipped', skipped,
    'checked_at', now()
  );
end;
$$;


ALTER FUNCTION "public"."send_feedback_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_popularity"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_view_count INT;
  v_click_count INT;
  v_save_count INT;
  v_calendar_add_count INT;
  v_unique_viewers INT;
  v_popularity FLOAT;
  v_trending FLOAT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN interaction_type = 'view' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'click' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'save' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'calendar_add' THEN 1 ELSE 0 END), 0),
    COALESCE(COUNT(DISTINCT user_id), 0)
  INTO v_view_count, v_click_count, v_save_count, v_calendar_add_count, v_unique_viewers
  FROM user_interactions
  WHERE event_id = p_event_id;

  v_popularity := (v_view_count * 1.0) + (v_click_count * 2.0) + (v_save_count * 5.0) + (v_calendar_add_count * 3.0);

  SELECT
    COALESCE(SUM(CASE WHEN interaction_type = 'view' THEN 1.0
                      WHEN interaction_type = 'click' THEN 2.0
                      WHEN interaction_type = 'save' THEN 5.0
                      WHEN interaction_type = 'calendar_add' THEN 3.0
                      ELSE 0 END), 0)
  INTO v_trending
  FROM user_interactions
  WHERE event_id = p_event_id
    AND created_at >= NOW() - INTERVAL '7 days';

  INSERT INTO event_popularity_scores (
    event_id, popularity_score, trending_score,
    view_count, click_count, save_count,
    calendar_add_count, unique_viewers, last_calculated_at
  ) VALUES (
    p_event_id, v_popularity, v_trending,
    v_view_count, v_click_count, v_save_count,
    v_calendar_add_count, v_unique_viewers, NOW()
  )
  ON CONFLICT (event_id) DO UPDATE SET
    popularity_score = EXCLUDED.popularity_score,
    trending_score = EXCLUDED.trending_score,
    view_count = EXCLUDED.view_count,
    click_count = EXCLUDED.click_count,
    save_count = EXCLUDED.save_count,
    calendar_add_count = EXCLUDED.calendar_add_count,
    unique_viewers = EXCLUDED.unique_viewers,
    last_calculated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."update_event_popularity"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_rsvps_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_rsvps_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_saved_events_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users
    SET saved_events_count = saved_events_count + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users
    SET saved_events_count = saved_events_count - 1
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_saved_events_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_followers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."club_followers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "inviter_id" "uuid" NOT NULL,
    "invitee_email" "text" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."club_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."club_invitations" IS 'Pending and historical invitations sent by club owners to prospective members. Tokens expire after 7 days.';



COMMENT ON COLUMN "public"."club_invitations"."token" IS 'Unique UUID token included in the invite link. Used for accept/revoke flows.';



CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'organizer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'organizer'::"text"])))
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."club_members" IS 'Many-to-many linking users to clubs they organize';



CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "instagram_handle" "text",
    "logo_url" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "category" "text",
    "created_by" "uuid",
    "website_url" "text",
    "discord_url" "text",
    "twitter_url" "text",
    "linkedin_url" "text",
    "banner_url" "text",
    "contact_email" "text",
    "appeal_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


COMMENT ON TABLE "public"."clubs" IS 'Organizations that host campus events';



CREATE TABLE IF NOT EXISTS "public"."email_reminder_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_id" "uuid",
    "reminder_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_reminder_log_reminder_type_check" CHECK (("reminder_type" = ANY (ARRAY['reminder_24h'::"text", 'reminder_1h'::"text"])))
);


ALTER TABLE "public"."email_reminder_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inviter_id" "uuid" NOT NULL,
    "invitee_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_popularity_scores" (
    "event_id" "uuid" NOT NULL,
    "view_count" integer DEFAULT 0,
    "click_count" integer DEFAULT 0,
    "save_count" integer DEFAULT 0,
    "share_count" integer DEFAULT 0,
    "calendar_add_count" integer DEFAULT 0,
    "unique_viewers" integer DEFAULT 0,
    "popularity_score" double precision DEFAULT 0,
    "trending_score" double precision DEFAULT 0,
    "last_calculated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_popularity_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."event_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "location" "text",
    "category" "text",
    "tags" "text"[],
    "image_url" "text",
    "organizer" "text",
    "rsvp_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_by" "uuid",
    "club_id" "uuid",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_url" "text",
    "content_hash" "text",
    "appeal_count" integer DEFAULT 0 NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_free" boolean DEFAULT true NOT NULL,
    "price" "text",
    "rsvp_link" "text",
    "pending_edits" "jsonb",
    CONSTRAINT "events_appeal_count_non_negative" CHECK (("appeal_count" >= 0)),
    CONSTRAINT "events_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'instagram'::"text", 'admin'::"text"]))),
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."is_free" IS 'Whether the event is free to attend';



COMMENT ON COLUMN "public"."events"."price" IS 'Display price text (e.g. "$5", "$10-20")';



COMMENT ON COLUMN "public"."events"."rsvp_link" IS 'External registration/RSVP URL';



COMMENT ON COLUMN "public"."events"."pending_edits" IS 'Stores proposed title/image_url changes awaiting admin approval. Shape: {title?: string, image_url?: string, submitted_at: string}. NULL = no pending edits.';



CREATE TABLE IF NOT EXISTS "public"."experiment_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_id" "uuid" NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."experiment_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experiment_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "weight" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."experiment_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "target_metric" "text",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "experiments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'running'::"text", 'paused'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."featured_clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "sponsor_name" "text",
    "priority" integer DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."featured_clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."featured_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sponsor_name" "text",
    "priority" integer DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "featured_events_date_order" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."featured_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "subject" "text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewed'::"text", 'resolved'::"text"]))),
    CONSTRAINT "feedback_type_check" CHECK (("type" = ANY (ARRAY['bug'::"text", 'feature'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_request_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "request_type" "text" DEFAULT 'post_event'::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_request_log_request_type_check" CHECK (("request_type" = ANY (ARRAY['post_event'::"text", 'post_event_reminder'::"text"])))
);


ALTER TABLE "public"."feedback_request_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "category" "text",
    "message" "text" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "category_required_for_rejection" CHECK (((("action" = 'rejection'::"text") AND ("category" IS NOT NULL)) OR (("action" = ANY (ARRAY['appeal'::"text", 'approval'::"text", 'suspension'::"text"])) AND ("category" IS NULL)))),
    CONSTRAINT "moderation_reviews_action_check" CHECK (("action" = ANY (ARRAY['rejection'::"text", 'appeal'::"text", 'approval'::"text", 'suspension'::"text"]))),
    CONSTRAINT "moderation_reviews_category_check" CHECK (("category" = ANY (ARRAY['inappropriate_content'::"text", 'missing_information'::"text", 'duplicate'::"text", 'policy_violation'::"text", 'incorrect_details'::"text", 'other'::"text"]))),
    CONSTRAINT "moderation_reviews_target_type_check" CHECK (("target_type" = ANY (ARRAY['event'::"text", 'club'::"text"])))
);


ALTER TABLE "public"."moderation_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "event_id" "uuid",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "club_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organizer_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."organizer_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizer_requests" IS 'Self-serve requests for club organizer access';



CREATE TABLE IF NOT EXISTS "public"."recommendation_explicit_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "feedback_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recommendation_explicit_feedback_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['positive'::"text", 'negative'::"text"])))
);


ALTER TABLE "public"."recommendation_explicit_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendation_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "recommendation_rank" integer NOT NULL,
    "action" "text" NOT NULL,
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "experiment_variant_id" "uuid",
    CONSTRAINT "recommendation_feedback_action_check" CHECK (("action" = ANY (ARRAY['impression'::"text", 'click'::"text", 'save'::"text", 'dismiss'::"text"]))),
    CONSTRAINT "recommendation_feedback_recommendation_rank_check" CHECK (("recommendation_rank" >= 1))
);


ALTER TABLE "public"."recommendation_feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."recommendation_feedback" IS 'Tracks recommendation impressions, clicks, saves, and dismissals for model quality metrics';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'going'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rsvps_status_check" CHECK (("status" = ANY (ARRAY['going'::"text", 'interested'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tag_interaction_counts" (
    "user_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "save_count" integer DEFAULT 0 NOT NULL,
    "click_count" integer DEFAULT 0 NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "last_interaction" timestamp with time zone
);


ALTER TABLE "public"."tag_interaction_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_event_scores" (
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "score" double precision NOT NULL,
    "breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scored_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_event_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."user_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_interactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "event_id" "uuid" NOT NULL,
    "interaction_type" "text" NOT NULL,
    "source" "text",
    "session_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['view'::"text", 'click'::"text", 'save'::"text", 'unsave'::"text", 'share'::"text", 'calendar_add'::"text"]))),
    CONSTRAINT "user_interactions_source_check" CHECK ((("source" IS NULL) OR ("source" = ANY (ARRAY['home'::"text", 'search'::"text", 'recommendation'::"text", 'calendar'::"text", 'direct'::"text", 'modal'::"text"]))))
);


ALTER TABLE "public"."user_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "interest_tags" "text"[] DEFAULT '{}'::"text"[],
    "pinned_contracts" "text"[] DEFAULT '{}'::"text"[],
    "total_habits_completed" integer DEFAULT 0,
    "roles" "public"."user_role"[] DEFAULT '{user}'::"public"."user_role"[] NOT NULL,
    "saved_events_count" integer DEFAULT 0 NOT NULL,
    "pronouns" "text",
    "year" "text",
    "faculty" "text",
    "visibility" "text" DEFAULT 'public'::"text",
    "onboarding_completed" boolean DEFAULT false,
    "inferred_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "banner_url" "text",
    "banned_at" timestamp with time zone,
    "ban_expires_at" timestamp with time zone,
    "ban_reason" "text",
    "banned_by" "uuid"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."roles" IS 'Array of user roles: user, club_organizer, admin';



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_followers"
    ADD CONSTRAINT "club_followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_followers"
    ADD CONSTRAINT "club_followers_unique" UNIQUE ("user_id", "club_id");



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_user_id_club_id_key" UNIQUE ("user_id", "club_id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_reminder_log"
    ADD CONSTRAINT "email_reminder_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_reminder_log"
    ADD CONSTRAINT "email_reminder_log_user_id_event_id_reminder_type_key" UNIQUE ("user_id", "event_id", "reminder_type");



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_inviter_id_invitee_id_event_id_key" UNIQUE ("inviter_id", "invitee_id", "event_id");



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_popularity_scores"
    ADD CONSTRAINT "event_popularity_scores_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."event_reports"
    ADD CONSTRAINT "event_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_reports"
    ADD CONSTRAINT "event_reports_unique_per_user" UNIQUE ("event_id", "reporter_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experiment_assignments"
    ADD CONSTRAINT "experiment_assignments_experiment_id_user_id_key" UNIQUE ("experiment_id", "user_id");



ALTER TABLE ONLY "public"."experiment_assignments"
    ADD CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experiment_variants"
    ADD CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experiments"
    ADD CONSTRAINT "experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."featured_clubs"
    ADD CONSTRAINT "featured_clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."featured_events"
    ADD CONSTRAINT "featured_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_request_log"
    ADD CONSTRAINT "feedback_request_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_request_log"
    ADD CONSTRAINT "feedback_request_log_user_id_event_id_request_type_key" UNIQUE ("user_id", "event_id", "request_type");



ALTER TABLE ONLY "public"."moderation_reviews"
    ADD CONSTRAINT "moderation_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_requests"
    ADD CONSTRAINT "organizer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_requests"
    ADD CONSTRAINT "organizer_requests_user_id_club_id_key" UNIQUE ("user_id", "club_id");



ALTER TABLE ONLY "public"."recommendation_explicit_feedback"
    ADD CONSTRAINT "recommendation_explicit_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendation_explicit_feedback"
    ADD CONSTRAINT "recommendation_explicit_feedback_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."tag_interaction_counts"
    ADD CONSTRAINT "tag_interaction_counts_pkey" PRIMARY KEY ("user_id", "tag");



ALTER TABLE ONLY "public"."user_event_scores"
    ADD CONSTRAINT "user_event_scores_pkey" PRIMARY KEY ("user_id", "event_id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "email_reminder_log_type_event_idx" ON "public"."email_reminder_log" USING "btree" ("reminder_type", "event_id");



CREATE INDEX "featured_events_event_id" ON "public"."featured_events" USING "btree" ("event_id");



CREATE INDEX "feedback_request_log_event_idx" ON "public"."feedback_request_log" USING "btree" ("event_id");



CREATE INDEX "feedback_request_log_type_event_idx" ON "public"."feedback_request_log" USING "btree" ("request_type", "event_id");



CREATE INDEX "idx_audit_log_action" ON "public"."admin_audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_admin" ON "public"."admin_audit_log" USING "btree" ("admin_user_id");



CREATE INDEX "idx_audit_log_created_at" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_club_followers_club_id" ON "public"."club_followers" USING "btree" ("club_id");



CREATE INDEX "idx_club_followers_user_id" ON "public"."club_followers" USING "btree" ("user_id");



CREATE INDEX "idx_club_invitations_club_id" ON "public"."club_invitations" USING "btree" ("club_id");



CREATE INDEX "idx_club_invitations_email" ON "public"."club_invitations" USING "btree" ("invitee_email");



CREATE INDEX "idx_club_invitations_inviter_id" ON "public"."club_invitations" USING "btree" ("inviter_id");



CREATE INDEX "idx_club_invitations_token" ON "public"."club_invitations" USING "btree" ("token");



CREATE INDEX "idx_club_members_club" ON "public"."club_members" USING "btree" ("club_id");



CREATE INDEX "idx_club_members_club_role" ON "public"."club_members" USING "btree" ("club_id", "role");



CREATE INDEX "idx_club_members_user" ON "public"."club_members" USING "btree" ("user_id");



CREATE INDEX "idx_clubs_created_by" ON "public"."clubs" USING "btree" ("created_by");



CREATE INDEX "idx_clubs_status" ON "public"."clubs" USING "btree" ("status");



CREATE INDEX "idx_event_invites_event" ON "public"."event_invites" USING "btree" ("event_id");



CREATE INDEX "idx_event_invites_invitee" ON "public"."event_invites" USING "btree" ("invitee_id");



CREATE INDEX "idx_event_reports_reporter_id" ON "public"."event_reports" USING "btree" ("reporter_id");



CREATE INDEX "idx_event_reports_reviewed_by" ON "public"."event_reports" USING "btree" ("reviewed_by");



CREATE INDEX "idx_event_reports_status_created" ON "public"."event_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_events_category" ON "public"."events" USING "btree" ("category");



CREATE INDEX "idx_events_club_id" ON "public"."events" USING "btree" ("club_id");



CREATE UNIQUE INDEX "idx_events_content_hash" ON "public"."events" USING "btree" ("content_hash") WHERE ("content_hash" IS NOT NULL);



CREATE INDEX "idx_events_created_by" ON "public"."events" USING "btree" ("created_by");



CREATE INDEX "idx_events_not_deleted" ON "public"."events" USING "btree" ("id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_events_start_date" ON "public"."events" USING "btree" ("start_date");



CREATE INDEX "idx_experiment_assignments_experiment_id" ON "public"."experiment_assignments" USING "btree" ("experiment_id");



CREATE INDEX "idx_experiment_assignments_variant_id" ON "public"."experiment_assignments" USING "btree" ("variant_id");



CREATE INDEX "idx_experiment_variants_experiment_id" ON "public"."experiment_variants" USING "btree" ("experiment_id");



CREATE INDEX "idx_featured_clubs_active" ON "public"."featured_clubs" USING "btree" ("starts_at", "ends_at", "priority" DESC);



CREATE INDEX "idx_featured_clubs_club_id" ON "public"."featured_clubs" USING "btree" ("club_id");



CREATE INDEX "idx_featured_clubs_created_by" ON "public"."featured_clubs" USING "btree" ("created_by");



CREATE INDEX "idx_featured_events_created_by" ON "public"."featured_events" USING "btree" ("created_by");



CREATE INDEX "idx_feedback_created_at" ON "public"."feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_status" ON "public"."feedback" USING "btree" ("status");



CREATE INDEX "idx_feedback_user_id" ON "public"."feedback" USING "btree" ("user_id");



CREATE INDEX "idx_moderation_reviews_target" ON "public"."moderation_reviews" USING "btree" ("target_type", "target_id", "created_at");



CREATE INDEX "idx_notifications_club_id" ON "public"."notifications" USING "btree" ("club_id");



CREATE INDEX "idx_notifications_event_id" ON "public"."notifications" USING "btree" ("event_id");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("user_id", "read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_organizer_requests_reviewed_by" ON "public"."organizer_requests" USING "btree" ("reviewed_by");



CREATE INDEX "idx_organizer_requests_status" ON "public"."organizer_requests" USING "btree" ("status");



CREATE INDEX "idx_organizer_requests_user" ON "public"."organizer_requests" USING "btree" ("user_id");



CREATE INDEX "idx_recommendation_explicit_feedback_event_id" ON "public"."recommendation_explicit_feedback" USING "btree" ("event_id");



CREATE INDEX "idx_recommendation_explicit_feedback_user_id" ON "public"."recommendation_explicit_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_recommendation_feedback_action" ON "public"."recommendation_feedback" USING "btree" ("action");



CREATE INDEX "idx_recommendation_feedback_created_at" ON "public"."recommendation_feedback" USING "btree" ("created_at");



CREATE INDEX "idx_recommendation_feedback_user_created" ON "public"."recommendation_feedback" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_recommendation_feedback_variant" ON "public"."recommendation_feedback" USING "btree" ("experiment_variant_id") WHERE ("experiment_variant_id" IS NOT NULL);



CREATE INDEX "idx_reviews_event_id" ON "public"."reviews" USING "btree" ("event_id");



CREATE INDEX "idx_reviews_user_event" ON "public"."reviews" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_rsvps_event_id" ON "public"."rsvps" USING "btree" ("event_id");



CREATE INDEX "idx_rsvps_status" ON "public"."rsvps" USING "btree" ("status") WHERE ("status" <> 'cancelled'::"text");



CREATE INDEX "idx_rsvps_user_id" ON "public"."rsvps" USING "btree" ("user_id");



CREATE INDEX "idx_saved_events_event_id" ON "public"."saved_events" USING "btree" ("event_id");



CREATE INDEX "idx_saved_events_user_id" ON "public"."saved_events" USING "btree" ("user_id");



CREATE INDEX "idx_user_event_scores_user_score" ON "public"."user_event_scores" USING "btree" ("user_id", "score" DESC);



CREATE INDEX "idx_user_follows_follower" ON "public"."user_follows" USING "btree" ("follower_id");



CREATE INDEX "idx_user_follows_following" ON "public"."user_follows" USING "btree" ("following_id");



CREATE INDEX "idx_user_interactions_created_at" ON "public"."user_interactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_interactions_event_id" ON "public"."user_interactions" USING "btree" ("event_id");



CREATE INDEX "idx_user_interactions_type" ON "public"."user_interactions" USING "btree" ("interaction_type");



CREATE INDEX "idx_user_interactions_user_id" ON "public"."user_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_users_banned_at" ON "public"."users" USING "btree" ("banned_at") WHERE ("banned_at" IS NOT NULL);



CREATE INDEX "idx_users_banned_by" ON "public"."users" USING "btree" ("banned_by");



CREATE INDEX "idx_users_roles" ON "public"."users" USING "gin" ("roles");



CREATE UNIQUE INDEX "notifications_dedup_idx" ON "public"."notifications" USING "btree" ("user_id", "event_id", "type") WHERE ("event_id" IS NOT NULL);



CREATE INDEX "notifications_user_id_idx" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "notifications_user_unread_idx" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE OR REPLACE TRIGGER "interaction_popularity_trigger" AFTER INSERT ON "public"."user_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_on_interaction"();



CREATE OR REPLACE TRIGGER "saved_events_count_trigger" AFTER INSERT OR DELETE ON "public"."saved_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_saved_events_count"();



CREATE OR REPLACE TRIGGER "trigger_rsvps_updated_at" BEFORE UPDATE ON "public"."rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."update_rsvps_updated_at"();



CREATE OR REPLACE TRIGGER "update_clubs_updated_at" BEFORE UPDATE ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizer_requests_updated_at" BEFORE UPDATE ON "public"."organizer_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."club_followers"
    ADD CONSTRAINT "club_followers_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_followers"
    ADD CONSTRAINT "club_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_invitations"
    ADD CONSTRAINT "club_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_reminder_log"
    ADD CONSTRAINT "email_reminder_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_reminder_log"
    ADD CONSTRAINT "email_reminder_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_popularity_scores"
    ADD CONSTRAINT "event_popularity_scores_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_reports"
    ADD CONSTRAINT "event_reports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_reports"
    ADD CONSTRAINT "event_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_reports"
    ADD CONSTRAINT "event_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."experiment_assignments"
    ADD CONSTRAINT "experiment_assignments_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experiment_assignments"
    ADD CONSTRAINT "experiment_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experiment_assignments"
    ADD CONSTRAINT "experiment_assignments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."experiment_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experiment_variants"
    ADD CONSTRAINT "experiment_variants_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."featured_clubs"
    ADD CONSTRAINT "featured_clubs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."featured_clubs"
    ADD CONSTRAINT "featured_clubs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."featured_events"
    ADD CONSTRAINT "featured_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."featured_events"
    ADD CONSTRAINT "featured_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_request_log"
    ADD CONSTRAINT "feedback_request_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_request_log"
    ADD CONSTRAINT "feedback_request_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_requests"
    ADD CONSTRAINT "organizer_requests_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_requests"
    ADD CONSTRAINT "organizer_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."organizer_requests"
    ADD CONSTRAINT "organizer_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_explicit_feedback"
    ADD CONSTRAINT "recommendation_explicit_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_experiment_variant_id_fkey" FOREIGN KEY ("experiment_variant_id") REFERENCES "public"."experiment_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tag_interaction_counts"
    ADD CONSTRAINT "tag_interaction_counts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_event_scores"
    ADD CONSTRAINT "user_event_scores_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_event_scores"
    ADD CONSTRAINT "user_event_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins can delete events" ON "public"."events" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can insert audit log" ON "public"."admin_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Admins can insert clubs" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage experiment assignments" ON "public"."experiment_assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can manage experiment variants" ON "public"."experiment_variants" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can manage experiments" ON "public"."experiments" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can manage featured clubs" ON "public"."featured_clubs" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can manage featured events" ON "public"."featured_events" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can read all reports" ON "public"."event_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can read audit log" ON "public"."admin_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("u"."roles"))))));



CREATE POLICY "Admins can read feedback" ON "public"."feedback" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can update any event" ON "public"."events" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update clubs" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update reports" ON "public"."event_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins can view all events" ON "public"."events" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all profiles" ON "public"."users" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins full access" ON "public"."moderation_reviews" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins manage memberships" ON "public"."club_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Admins manage requests" ON "public"."organizer_requests" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ('admin'::"public"."user_role" = ANY ("users"."roles"))))));



CREATE POLICY "Allow public read access to event_popularity_scores" ON "public"."event_popularity_scores" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert interactions" ON "public"."user_interactions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read clubs" ON "public"."clubs" FOR SELECT USING (true);



CREATE POLICY "Anyone can read reviews" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Anyone can view featured clubs" ON "public"."featured_clubs" FOR SELECT USING (true);



CREATE POLICY "Anyone can view follower data" ON "public"."club_followers" FOR SELECT USING (true);



CREATE POLICY "Anyone can view follows" ON "public"."user_follows" FOR SELECT USING (true);



CREATE POLICY "Anyone can view popularity scores" ON "public"."event_popularity_scores" FOR SELECT USING (true);



CREATE POLICY "Anyone can view rsvps" ON "public"."rsvps" FOR SELECT USING (true);



CREATE POLICY "Approved events are viewable by everyone" ON "public"."events" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Authenticated users can follow clubs" ON "public"."club_followers" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can insert events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can unfollow clubs" ON "public"."club_followers" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can update popularity scores" ON "public"."event_popularity_scores" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Club owners can create club invitations" ON "public"."club_invitations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_club_owner"("club_id"));



CREATE POLICY "Club owners can remove members" ON "public"."club_members" FOR DELETE TO "authenticated" USING (("public"."is_club_owner"("club_id") AND ("user_id" <> ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Club owners can view all club members" ON "public"."club_members" FOR SELECT TO "authenticated" USING ("public"."is_club_owner"("club_id"));



CREATE POLICY "Club owners can view club invitations" ON "public"."club_invitations" FOR SELECT TO "authenticated" USING ("public"."is_club_owner"("club_id"));



CREATE POLICY "Creators can appeal their items" ON "public"."moderation_reviews" FOR INSERT WITH CHECK ((("action" = 'appeal'::"text") AND ("author_id" = "auth"."uid"()) AND ((("target_type" = 'event'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "moderation_reviews"."target_id") AND ("events"."created_by" = "auth"."uid"()))))) OR (("target_type" = 'club'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."clubs"
  WHERE (("clubs"."id" = "moderation_reviews"."target_id") AND ("clubs"."created_by" = "auth"."uid"()))))))));



CREATE POLICY "Creators can view reviews of their items" ON "public"."moderation_reviews" FOR SELECT USING (((("target_type" = 'event'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "moderation_reviews"."target_id") AND ("events"."created_by" = "auth"."uid"()))))) OR (("target_type" = 'club'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."clubs"
  WHERE (("clubs"."id" = "moderation_reviews"."target_id") AND ("clubs"."created_by" = "auth"."uid"())))))));



CREATE POLICY "Organizers can update own events" ON "public"."events" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Organizers can view own events" ON "public"."events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Public can read active featured events" ON "public"."featured_events" FOR SELECT USING ((("starts_at" <= "now"()) AND ("ends_at" > "now"())));



CREATE POLICY "Service role can insert audit log" ON "public"."admin_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert notifications" ON "public"."notifications" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage all scores" ON "public"."user_event_scores" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all tag counts" ON "public"."tag_interaction_counts" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage feedback request log" ON "public"."feedback_request_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage reminder log" ON "public"."email_reminder_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."feedback" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create own rsvps" ON "public"."rsvps" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete invites sent to them" ON "public"."event_invites" FOR DELETE USING (("auth"."uid"() = "invitee_id"));



CREATE POLICY "Users can delete own review" ON "public"."reviews" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own rsvps" ON "public"."rsvps" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own sent invites" ON "public"."event_invites" FOR DELETE USING (("auth"."uid"() = "inviter_id"));



CREATE POLICY "Users can delete their own saved events" ON "public"."saved_events" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow others" ON "public"."user_follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert feedback" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert own explicit feedback" ON "public"."recommendation_explicit_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own feedback" ON "public"."recommendation_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own reports" ON "public"."event_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can insert own review" ON "public"."reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own saved events" ON "public"."saved_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark own notifications read" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own assignments" ON "public"."experiment_assignments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own explicit feedback" ON "public"."recommendation_explicit_feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own feedback" ON "public"."recommendation_feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own reports" ON "public"."event_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can read their own scores" ON "public"."user_event_scores" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own tag counts" ON "public"."tag_interaction_counts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can send invites" ON "public"."event_invites" FOR INSERT WITH CHECK (("auth"."uid"() = "inviter_id"));



CREATE POLICY "Users can unfollow" ON "public"."user_follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can update own explicit feedback" ON "public"."recommendation_explicit_feedback" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own review" ON "public"."reviews" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own rsvps" ON "public"."rsvps" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own invites" ON "public"."event_invites" FOR SELECT USING ((("auth"."uid"() = "inviter_id") OR ("auth"."uid"() = "invitee_id")));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own feedback request log" ON "public"."feedback_request_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own interactions" ON "public"."user_interactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own reminder log" ON "public"."email_reminder_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own saved events" ON "public"."saved_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users create own requests" ON "public"."organizer_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users see own memberships" ON "public"."club_members" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users see own requests" ON "public"."organizer_requests" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_reminder_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_popularity_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experiment_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experiment_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experiments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."featured_clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."featured_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_request_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_explicit_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tag_interaction_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_event_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_user_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."compute_user_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_user_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_ids_by_time_filter"("time_of_day" "text", "day_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_ids_by_time_filter"("time_of_day" "text", "day_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_ids_by_time_filter"("time_of_day" "text", "day_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friends"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friends"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friends"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friends_going_to_event"("current_user_id" "uuid", "target_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friends_going_to_event"("current_user_id" "uuid", "target_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friends_going_to_event"("current_user_id" "uuid", "target_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_owner"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_owner"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_owner"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_on_interaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_on_interaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_on_interaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_events_fuzzy"("search_term" "text", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_events_fuzzy"("search_term" "text", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_events_fuzzy"("search_term" "text", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_event_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_event_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_event_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_feedback_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_feedback_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_feedback_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_popularity"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_popularity"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_popularity"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_rsvps_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_rsvps_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rsvps_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_saved_events_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_saved_events_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_saved_events_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."club_followers" TO "anon";
GRANT ALL ON TABLE "public"."club_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."club_followers" TO "service_role";



GRANT ALL ON TABLE "public"."club_invitations" TO "anon";
GRANT ALL ON TABLE "public"."club_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."club_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "anon";
GRANT ALL ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."email_reminder_log" TO "anon";
GRANT ALL ON TABLE "public"."email_reminder_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_reminder_log" TO "service_role";



GRANT ALL ON TABLE "public"."event_invites" TO "anon";
GRANT ALL ON TABLE "public"."event_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."event_invites" TO "service_role";



GRANT ALL ON TABLE "public"."event_popularity_scores" TO "anon";
GRANT ALL ON TABLE "public"."event_popularity_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."event_popularity_scores" TO "service_role";



GRANT ALL ON TABLE "public"."event_reports" TO "anon";
GRANT ALL ON TABLE "public"."event_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."event_reports" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."experiment_assignments" TO "anon";
GRANT ALL ON TABLE "public"."experiment_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."experiment_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."experiment_variants" TO "anon";
GRANT ALL ON TABLE "public"."experiment_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."experiment_variants" TO "service_role";



GRANT ALL ON TABLE "public"."experiments" TO "anon";
GRANT ALL ON TABLE "public"."experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."experiments" TO "service_role";



GRANT ALL ON TABLE "public"."featured_clubs" TO "anon";
GRANT ALL ON TABLE "public"."featured_clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."featured_clubs" TO "service_role";



GRANT ALL ON TABLE "public"."featured_events" TO "anon";
GRANT ALL ON TABLE "public"."featured_events" TO "authenticated";
GRANT ALL ON TABLE "public"."featured_events" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_request_log" TO "anon";
GRANT ALL ON TABLE "public"."feedback_request_log" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_request_log" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_reviews" TO "anon";
GRANT ALL ON TABLE "public"."moderation_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_requests" TO "anon";
GRANT ALL ON TABLE "public"."organizer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_explicit_feedback" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_explicit_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_explicit_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_feedback" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."rsvps" TO "anon";
GRANT ALL ON TABLE "public"."rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."saved_events" TO "anon";
GRANT ALL ON TABLE "public"."saved_events" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_events" TO "service_role";



GRANT ALL ON TABLE "public"."tag_interaction_counts" TO "anon";
GRANT ALL ON TABLE "public"."tag_interaction_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."tag_interaction_counts" TO "service_role";



GRANT ALL ON TABLE "public"."user_event_scores" TO "anon";
GRANT ALL ON TABLE "public"."user_event_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."user_event_scores" TO "service_role";



GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";



GRANT ALL ON TABLE "public"."user_interactions" TO "anon";
GRANT ALL ON TABLE "public"."user_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









--
-- storage schema — POLICIES ONLY, and this is deliberate.
--
-- The storage schema's STRUCTURE (10 tables, the "buckettype" enum, its functions and
-- indexes) is created by the storage-api container in local and by the storage service in
-- production — identically, from the same image version. It is service-owned, not
-- application-owned, and it is not replayable from a migration: the migration role is
-- `postgres`, `has_schema_privilege('postgres','storage','CREATE')` is FALSE, and
-- storage.objects is owned by supabase_storage_admin. Measured, not assumed — a baseline
-- carrying the full storage dump aborted `db reset` at statement 21 with
-- "permission denied for schema storage" on CREATE TYPE storage.buckettype.
--
-- The RLS POLICIES on storage.objects are the opposite: application-owned access control,
-- authored through the dashboard, and creatable by the migration role (probed directly).
-- They are the only part of the storage schema this repository should govern, so they are
-- the only part carried here. All 15 are on storage.objects; no other storage table has one.
--
-- ALTER TABLE storage.<t> ENABLE ROW LEVEL SECURITY is deliberately NOT carried: it fails
-- with "must be owner of table", and the service has already enabled RLS in both
-- environments (pg_class.relrowsecurity is true locally before any migration runs).
--
-- Generated, never authored. Reproduce with:
--   supabase db dump --linked --schema public  -f <this file>
--   supabase db dump --linked --schema storage -f <scratch>
--   grep -E '^CREATE POLICY .* ON "storage"\."objects"' <scratch> >> <this file>
--
-- `supabase db diff --linked --schema public,storage` is what TESTS this split: if the
-- service-managed structure differed between local and production, the diff would not be empty.
--

CREATE POLICY "Allow authenticated delete from own folder" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]));
CREATE POLICY "Allow authenticated update in own folder" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])) WITH CHECK ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]));
CREATE POLICY "Allow authenticated upload to own folder" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]));
CREATE POLICY "Allow public read access 1oj01fe_0" ON "storage"."objects" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Anyone can view banners" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'banners'::"text"));
CREATE POLICY "Anyone can view club logos" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'club-logos'::"text"));
CREATE POLICY "Anyone can view event images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'event-images'::"text"));
CREATE POLICY "Authenticated users can update club logos" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'club-logos'::"text") AND ("auth"."role"() = 'authenticated'::"text")));
CREATE POLICY "Authenticated users can upload banners" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'banners'::"text"));
CREATE POLICY "Authenticated users can upload club logos" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'club-logos'::"text") AND ("auth"."role"() = 'authenticated'::"text")));
CREATE POLICY "Authenticated users can upload event images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'event-images'::"text"));
CREATE POLICY "Public read access for event images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'event-images'::"text"));
CREATE POLICY "Service role upload for event images" ON "storage"."objects" FOR INSERT TO "service_role" WITH CHECK (("bucket_id" = 'event-images'::"text"));
CREATE POLICY "Users can delete their own banners" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'banners'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));
CREATE POLICY "Users can update their own banners" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'banners'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));
