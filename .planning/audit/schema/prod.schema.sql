--
-- catalog-derived snapshot via Management API SELECTs, not pg_dump; see raw/prod/MANIFEST.json
--
-- .planning/audit/schema/prod.schema.sql
--
-- Requirement: AUDIT-01 (live schema snapshots: production, staging, local)
-- Plan:        01-06
-- Date:        2026-09-14
--
-- WHAT THIS IS
--   A reconstruction of the production schema from catalog rows that were read with
--   SELECT statements only. Every object below was derived from information_schema or
--   pg_catalog, captured through the Supabase MCP server (Management API) and stored
--   verbatim in .planning/audit/raw/prod/. Each raw envelope carries the exact SQL that
--   produced it in its `query` field; that is the citation for everything here.
--
-- WHAT THIS IS NOT
--   This is NOT a pg_dump. It is not ordered for restore, it omits object attributes
--   that only pg_dump knows, and it must never be replayed against a database. It is a
--   reading and diffing artifact. Treat any attempt to execute it as a defect.
--
-- WHY NOT A DUMP
--   `supabase db dump` requires a Postgres connection string. None was supplied to this
--   phase: the operator resolved the credential checkpoint by authenticating the Supabase
--   MCP server rather than exporting a token or a URI, and MCP can run SELECTs but cannot
--   hand a URI to pg_dump. The container daemon (OrbStack, server 29.4.0) was running, so
--   the daemon was not the blocker — the missing connection string was.
--
-- TO PRODUCE THE CANONICAL DUMP, once a connection string exists (exported into the
-- shell only, never written to a file and never passed as a CLI argument):
--
--     supabase db dump --db-url "$PROD_DB_URL" \
--       --schema public,storage \
--       -f .planning/audit/schema/prod.schema.sql
--
--     bash .planning/audit/tools/readonly-guard.sh
--
--   The `auth` schema is deliberately excluded: an auth dump can carry role grants and
--   inline keys into git history permanently, and .planning/ is committed. Never pass
--   --role-only into a committed path. For the same reason this file contains no auth
--   object: the auth schema was observed only as a table-name list
--   (raw/prod/auth-config-tables.json, 23 names, no columns and no grants).
--
-- REGENERATE THIS FILE (no database access; reads raw/prod/ only):
--     node .planning/audit/tools/gen-prod-schema.mjs
--
-- TRANSPORT IDENTITY (raw/prod/transport-identity.json)
--   project             universe-events (production)
--   project_ref         <PROD-PROJECT-REF>   <- redacted at capture time
--   transport           supabase-mcp (Management API), SELECT-only
--   role                postgres
--   database            postgres
--   server_version      17.6
--   transaction_read_only  off   <- see the caveat below
--   captured            2026-09-14T18:23:47Z .. 2026-09-14T18:33:16Z
--   captures            20, failures 0, redactions 0
--
-- READ-ONLY CAVEAT, recorded rather than glossed
--   `transaction_read_only` is `off` and the role is `postgres`. The MCP transport does
--   NOT enforce read-only server-side, which is what the plan specified and what
--   tools/sql-readonly.mjs implements for the Management API path it was built for. The
--   safeguard actually in force during this capture was SELECT-only discipline: every one
--   of the 20 statements is a SELECT, each is recorded verbatim in its raw envelope, and
--   all 20 succeeded. No DDL and no DML was issued. A reviewer can verify this claim by
--   reading the `query` field of every file in raw/prod/ — that is why they are committed.
--
-- SCOPE
--   public schema: all objects below. storage schema: buckets and policies only.
--   cron schema: the job inventory only. auth schema: excluded entirely.
--

-- ==========================================================================
-- INSTALLED EXTENSIONS (7 installed of 77 available)
-- ==========================================================================

-- Informational. Emitted as comments because extension installation is an operator
-- action, not part of a schema diff. Source: raw/prod/extensions.json (list_extensions).

--   pg_cron                      1.6.4        schema=pg_catalog
--   pg_stat_statements           1.11         schema=extensions
--   pg_trgm                      1.6          schema=public
--   pgcrypto                     1.3          schema=extensions
--   plpgsql                      1.0          schema=pg_catalog
--   supabase_vault               0.3.1        schema=vault
--   uuid-ossp                    1.1          schema=extensions

-- ==========================================================================
-- USER-DEFINED TYPES
-- ==========================================================================

-- NOT CAPTURED: no pg_type/pg_enum query was issued during this capture, so the label
-- lists of these types are unknown. This is a real gap in the snapshot, recorded rather
-- than guessed. Recover with:
--   select t.typname, e.enumlabel, e.enumsortorder from pg_type t
--     join pg_enum e on e.enumtypid = t.oid order by 1, 3;

-- CREATE TYPE public.user_role AS ENUM (...labels not captured...);   -- used by: users.roles

-- ==========================================================================
-- TABLES — public (30 tables, 243 columns)
-- ==========================================================================

-- Source: raw/prod/information-schema-columns.json, ordered by table then ordinal_position.
-- Constraints are emitted separately below so that foreign keys do not depend on table order.

-- admin_audit_log: 7 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- club_followers: 4 columns, RLS ENABLED, ~2 live rows
CREATE TABLE public.club_followers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- club_invitations: 8 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.club_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    inviter_id uuid NOT NULL,
    invitee_email text NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.club_invitations IS "Pending and historical invitations sent by club owners to prospective members. Tokens expire after 7 days.";

-- club_members: 5 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.club_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid NOT NULL,
    role text DEFAULT 'organizer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.club_members IS "Many-to-many linking users to clubs they organize";

-- clubs: 17 columns, RLS ENABLED, ~222 live rows
CREATE TABLE public.clubs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    instagram_handle text,
    logo_url text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'approved'::text NOT NULL,
    category text,
    created_by uuid,
    website_url text,
    discord_url text,
    twitter_url text,
    linkedin_url text,
    banner_url text,
    contact_email text,
    appeal_count integer DEFAULT 0 NOT NULL
);
COMMENT ON TABLE public.clubs IS "Organizations that host campus events";

-- email_reminder_log: 5 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.email_reminder_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_id uuid,
    reminder_type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);

-- event_invites: 5 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.event_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inviter_id uuid NOT NULL,
    invitee_id uuid NOT NULL,
    event_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- event_popularity_scores: 10 columns, RLS ENABLED, ~1 live rows
CREATE TABLE public.event_popularity_scores (
    event_id uuid NOT NULL,
    view_count integer DEFAULT 0,
    click_count integer DEFAULT 0,
    save_count integer DEFAULT 0,
    share_count integer DEFAULT 0,
    calendar_add_count integer DEFAULT 0,
    unique_viewers integer DEFAULT 0,
    popularity_score double precision DEFAULT 0,
    trending_score double precision DEFAULT 0,
    last_calculated_at timestamp with time zone DEFAULT now()
);

-- event_reports: 9 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.event_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    category text NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- events: 25 columns, RLS ENABLED, ~229 live rows
CREATE TABLE public.events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    location text,
    category text,
    tags text[],
    image_url text,
    organizer text,
    rsvp_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text NOT NULL,
    created_by uuid,
    club_id uuid,
    source text DEFAULT 'manual'::text NOT NULL,
    source_url text,
    content_hash text,
    appeal_count integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    is_free boolean DEFAULT true NOT NULL,
    price text,
    rsvp_link text,
    pending_edits jsonb
);

-- experiment_assignments: 5 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.experiment_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);

-- experiment_variants: 6 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.experiment_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- experiments: 9 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.experiments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    target_metric text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- featured_clubs: 8 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.featured_clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    sponsor_name text,
    priority integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- featured_events: 8 columns, RLS ENABLED, ~1 live rows
CREATE TABLE public.featured_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    sponsor_name text,
    priority integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- feedback: 8 columns, RLS ENABLED, ~1 live rows
CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email text,
    type text DEFAULT 'general'::text NOT NULL,
    subject text,
    message text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- feedback_request_log: 5 columns, RLS ENABLED, ~6 live rows
CREATE TABLE public.feedback_request_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    request_type text DEFAULT 'post_event'::text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);

-- moderation_reviews: 8 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.moderation_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    action text NOT NULL,
    category text,
    message text NOT NULL,
    author_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- notifications: 9 columns, RLS ENABLED, ~19 live rows
CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    event_id uuid,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    club_id uuid
);

-- organizer_requests: 8 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.organizer_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.organizer_requests IS "Self-serve requests for club organizer access";

-- recommendation_explicit_feedback: 5 columns, RLS ENABLED, ~3 live rows
CREATE TABLE public.recommendation_explicit_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    feedback_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- recommendation_feedback: 8 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.recommendation_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    recommendation_rank integer NOT NULL,
    action text NOT NULL,
    session_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    experiment_variant_id uuid
);
COMMENT ON TABLE public.recommendation_feedback IS "Tracks recommendation impressions, clicks, saves, and dismissals for model quality metrics";

-- reviews: 6 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- rsvps: 6 columns, RLS ENABLED, ~10 live rows
CREATE TABLE public.rsvps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    status text DEFAULT 'going'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- saved_events: 4 columns, RLS ENABLED, ~8 live rows
CREATE TABLE public.saved_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    event_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- tag_interaction_counts: 6 columns, RLS ENABLED, ~3 live rows
CREATE TABLE public.tag_interaction_counts (
    user_id uuid NOT NULL,
    tag text NOT NULL,
    save_count integer DEFAULT 0 NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    last_interaction timestamp with time zone
);

-- user_event_scores: 5 columns, RLS ENABLED, ~0 live rows
CREATE TABLE public.user_event_scores (
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    score double precision NOT NULL,
    breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    scored_at timestamp with time zone DEFAULT now() NOT NULL
);

-- user_follows: 4 columns, RLS ENABLED, ~24 live rows
CREATE TABLE public.user_follows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- user_interactions: 8 columns, RLS ENABLED, ~2 live rows
CREATE TABLE public.user_interactions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    event_id uuid NOT NULL,
    interaction_type text NOT NULL,
    source text,
    session_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- users: 22 columns, RLS ENABLED, ~37 live rows
CREATE TABLE public.users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    interest_tags text[] DEFAULT '{}'::text[],
    pinned_contracts text[] DEFAULT '{}'::text[],
    total_habits_completed integer DEFAULT 0,
    roles user_role[] DEFAULT '{user}'::user_role[] NOT NULL,
    saved_events_count integer DEFAULT 0 NOT NULL,
    pronouns text,
    year text,
    faculty text,
    visibility text DEFAULT 'public'::text,
    onboarding_completed boolean DEFAULT false,
    inferred_tags text[] DEFAULT '{}'::text[] NOT NULL,
    banner_url text,
    banned_at timestamp with time zone,
    ban_expires_at timestamp with time zone,
    ban_reason text,
    banned_by uuid
);

-- ==========================================================================
-- CONSTRAINTS — public (123: 30 primary key, 15 unique, 53 foreign key, 25 check)
-- ==========================================================================

-- Source: raw/prod/constraints.json — pg_get_constraintdef(oid, true), emitted verbatim.
-- Foreign keys into auth.users are shown as captured; the auth schema itself is excluded.

ALTER TABLE ONLY public.admin_audit_log ADD CONSTRAINT admin_audit_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.admin_audit_log ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_followers ADD CONSTRAINT club_followers_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_followers ADD CONSTRAINT club_followers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_followers ADD CONSTRAINT club_followers_unique UNIQUE (user_id, club_id);
ALTER TABLE ONLY public.club_followers ADD CONSTRAINT club_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_invitations ADD CONSTRAINT club_invitations_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_invitations ADD CONSTRAINT club_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_invitations ADD CONSTRAINT club_invitations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_invitations ADD CONSTRAINT club_invitations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text]));
ALTER TABLE ONLY public.club_invitations ADD CONSTRAINT club_invitations_token_key UNIQUE (token);
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_role_check CHECK (role = ANY (ARRAY['owner'::text, 'organizer'::text]));
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_user_id_club_id_key UNIQUE (user_id, club_id);
ALTER TABLE ONLY public.club_members ADD CONSTRAINT club_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.clubs ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.email_reminder_log ADD CONSTRAINT email_reminder_log_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.email_reminder_log ADD CONSTRAINT email_reminder_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.email_reminder_log ADD CONSTRAINT email_reminder_log_reminder_type_check CHECK (reminder_type = ANY (ARRAY['reminder_24h'::text, 'reminder_1h'::text]));
ALTER TABLE ONLY public.email_reminder_log ADD CONSTRAINT email_reminder_log_user_id_event_id_reminder_type_key UNIQUE (user_id, event_id, reminder_type);
ALTER TABLE ONLY public.email_reminder_log ADD CONSTRAINT email_reminder_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_invites ADD CONSTRAINT event_invites_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_invites ADD CONSTRAINT event_invites_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_invites ADD CONSTRAINT event_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_invites ADD CONSTRAINT event_invites_inviter_id_invitee_id_event_id_key UNIQUE (inviter_id, invitee_id, event_id);
ALTER TABLE ONLY public.event_invites ADD CONSTRAINT event_invites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_popularity_scores ADD CONSTRAINT event_popularity_scores_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_popularity_scores ADD CONSTRAINT event_popularity_scores_pkey PRIMARY KEY (event_id);
ALTER TABLE ONLY public.event_reports ADD CONSTRAINT event_reports_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_reports ADD CONSTRAINT event_reports_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_reports ADD CONSTRAINT event_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_reports ADD CONSTRAINT event_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.event_reports ADD CONSTRAINT event_reports_status_check CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text]));
ALTER TABLE ONLY public.event_reports ADD CONSTRAINT event_reports_unique_per_user UNIQUE (event_id, reporter_id);
ALTER TABLE ONLY public.events ADD CONSTRAINT events_appeal_count_non_negative CHECK (appeal_count >= 0);
ALTER TABLE ONLY public.events ADD CONSTRAINT events_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.events ADD CONSTRAINT events_source_check CHECK (source = ANY (ARRAY['manual'::text, 'instagram'::text, 'admin'::text]));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text]));
ALTER TABLE ONLY public.experiment_assignments ADD CONSTRAINT experiment_assignments_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.experiment_assignments ADD CONSTRAINT experiment_assignments_experiment_id_user_id_key UNIQUE (experiment_id, user_id);
ALTER TABLE ONLY public.experiment_assignments ADD CONSTRAINT experiment_assignments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.experiment_assignments ADD CONSTRAINT experiment_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.experiment_assignments ADD CONSTRAINT experiment_assignments_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES experiment_variants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.experiment_variants ADD CONSTRAINT experiment_variants_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.experiment_variants ADD CONSTRAINT experiment_variants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.experiments ADD CONSTRAINT experiments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.experiments ADD CONSTRAINT experiments_status_check CHECK (status = ANY (ARRAY['draft'::text, 'running'::text, 'paused'::text, 'completed'::text]));
ALTER TABLE ONLY public.featured_clubs ADD CONSTRAINT featured_clubs_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.featured_clubs ADD CONSTRAINT featured_clubs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.featured_clubs ADD CONSTRAINT featured_clubs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.featured_events ADD CONSTRAINT featured_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.featured_events ADD CONSTRAINT featured_events_date_order CHECK (ends_at > starts_at);
ALTER TABLE ONLY public.featured_events ADD CONSTRAINT featured_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.featured_events ADD CONSTRAINT featured_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.feedback ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.feedback ADD CONSTRAINT feedback_status_check CHECK (status = ANY (ARRAY['new'::text, 'reviewed'::text, 'resolved'::text]));
ALTER TABLE ONLY public.feedback ADD CONSTRAINT feedback_type_check CHECK (type = ANY (ARRAY['bug'::text, 'feature'::text, 'general'::text]));
ALTER TABLE ONLY public.feedback ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.feedback_request_log ADD CONSTRAINT feedback_request_log_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.feedback_request_log ADD CONSTRAINT feedback_request_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.feedback_request_log ADD CONSTRAINT feedback_request_log_request_type_check CHECK (request_type = ANY (ARRAY['post_event'::text, 'post_event_reminder'::text]));
ALTER TABLE ONLY public.feedback_request_log ADD CONSTRAINT feedback_request_log_user_id_event_id_request_type_key UNIQUE (user_id, event_id, request_type);
ALTER TABLE ONLY public.feedback_request_log ADD CONSTRAINT feedback_request_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.moderation_reviews ADD CONSTRAINT category_required_for_rejection CHECK (action = 'rejection'::text AND category IS NOT NULL OR (action = ANY (ARRAY['appeal'::text, 'approval'::text, 'suspension'::text])) AND category IS NULL);
ALTER TABLE ONLY public.moderation_reviews ADD CONSTRAINT moderation_reviews_action_check CHECK (action = ANY (ARRAY['rejection'::text, 'appeal'::text, 'approval'::text, 'suspension'::text]));
ALTER TABLE ONLY public.moderation_reviews ADD CONSTRAINT moderation_reviews_category_check CHECK (category = ANY (ARRAY['inappropriate_content'::text, 'missing_information'::text, 'duplicate'::text, 'policy_violation'::text, 'incorrect_details'::text, 'other'::text]));
ALTER TABLE ONLY public.moderation_reviews ADD CONSTRAINT moderation_reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.moderation_reviews ADD CONSTRAINT moderation_reviews_target_type_check CHECK (target_type = ANY (ARRAY['event'::text, 'club'::text]));
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizer_requests ADD CONSTRAINT organizer_requests_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizer_requests ADD CONSTRAINT organizer_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.organizer_requests ADD CONSTRAINT organizer_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id);
ALTER TABLE ONLY public.organizer_requests ADD CONSTRAINT organizer_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE ONLY public.organizer_requests ADD CONSTRAINT organizer_requests_user_id_club_id_key UNIQUE (user_id, club_id);
ALTER TABLE ONLY public.organizer_requests ADD CONSTRAINT organizer_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recommendation_explicit_feedback ADD CONSTRAINT recommendation_explicit_feedback_feedback_type_check CHECK (feedback_type = ANY (ARRAY['positive'::text, 'negative'::text]));
ALTER TABLE ONLY public.recommendation_explicit_feedback ADD CONSTRAINT recommendation_explicit_feedback_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.recommendation_explicit_feedback ADD CONSTRAINT recommendation_explicit_feedback_user_id_event_id_key UNIQUE (user_id, event_id);
ALTER TABLE ONLY public.recommendation_explicit_feedback ADD CONSTRAINT recommendation_explicit_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recommendation_feedback ADD CONSTRAINT recommendation_feedback_action_check CHECK (action = ANY (ARRAY['impression'::text, 'click'::text, 'save'::text, 'dismiss'::text]));
ALTER TABLE ONLY public.recommendation_feedback ADD CONSTRAINT recommendation_feedback_experiment_variant_id_fkey FOREIGN KEY (experiment_variant_id) REFERENCES experiment_variants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.recommendation_feedback ADD CONSTRAINT recommendation_feedback_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.recommendation_feedback ADD CONSTRAINT recommendation_feedback_recommendation_rank_check CHECK (recommendation_rank >= 1);
ALTER TABLE ONLY public.recommendation_feedback ADD CONSTRAINT recommendation_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_user_id_event_id_key UNIQUE (user_id, event_id);
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.rsvps ADD CONSTRAINT rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.rsvps ADD CONSTRAINT rsvps_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.rsvps ADD CONSTRAINT rsvps_status_check CHECK (status = ANY (ARRAY['going'::text, 'interested'::text, 'cancelled'::text]));
ALTER TABLE ONLY public.rsvps ADD CONSTRAINT rsvps_user_id_event_id_key UNIQUE (user_id, event_id);
ALTER TABLE ONLY public.rsvps ADD CONSTRAINT rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_user_id_event_id_key UNIQUE (user_id, event_id);
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tag_interaction_counts ADD CONSTRAINT tag_interaction_counts_pkey PRIMARY KEY (user_id, tag);
ALTER TABLE ONLY public.tag_interaction_counts ADD CONSTRAINT tag_interaction_counts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_event_scores ADD CONSTRAINT user_event_scores_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_event_scores ADD CONSTRAINT user_event_scores_pkey PRIMARY KEY (user_id, event_id);
ALTER TABLE ONLY public.user_event_scores ADD CONSTRAINT user_event_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_check CHECK (follower_id <> following_id);
ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_follower_id_following_id_key UNIQUE (follower_id, following_id);
ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT user_interactions_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT user_interactions_interaction_type_check CHECK (interaction_type = ANY (ARRAY['view'::text, 'click'::text, 'save'::text, 'unsave'::text, 'share'::text, 'calendar_add'::text]));
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT user_interactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT user_interactions_source_check CHECK (source IS NULL OR (source = ANY (ARRAY['home'::text, 'search'::text, 'recommendation'::text, 'calendar'::text, 'direct'::text, 'modal'::text])));
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT user_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- ==========================================================================
-- INDEXES — public (119 total: 74 standalone, 45 constraint-backed)
-- ==========================================================================

-- Source: raw/prod/indexes.json — pg_indexes.indexdef, emitted verbatim.
-- Constraint-backed indexes are listed as comments: they are created by the ALTER TABLE
-- ADD CONSTRAINT statements above, and repeating them as CREATE INDEX would double-count.

CREATE INDEX idx_audit_log_action ON public.admin_audit_log USING btree (action);
CREATE INDEX idx_audit_log_admin ON public.admin_audit_log USING btree (admin_user_id);
CREATE INDEX idx_audit_log_created_at ON public.admin_audit_log USING btree (created_at DESC);
CREATE INDEX idx_club_followers_club_id ON public.club_followers USING btree (club_id);
CREATE INDEX idx_club_followers_user_id ON public.club_followers USING btree (user_id);
CREATE INDEX idx_club_invitations_club_id ON public.club_invitations USING btree (club_id);
CREATE INDEX idx_club_invitations_email ON public.club_invitations USING btree (invitee_email);
CREATE INDEX idx_club_invitations_inviter_id ON public.club_invitations USING btree (inviter_id);
CREATE INDEX idx_club_invitations_token ON public.club_invitations USING btree (token);
CREATE INDEX idx_club_members_club ON public.club_members USING btree (club_id);
CREATE INDEX idx_club_members_club_role ON public.club_members USING btree (club_id, role);
CREATE INDEX idx_club_members_user ON public.club_members USING btree (user_id);
CREATE INDEX idx_clubs_created_by ON public.clubs USING btree (created_by);
CREATE INDEX idx_clubs_status ON public.clubs USING btree (status);
CREATE INDEX email_reminder_log_type_event_idx ON public.email_reminder_log USING btree (reminder_type, event_id);
CREATE INDEX idx_event_invites_event ON public.event_invites USING btree (event_id);
CREATE INDEX idx_event_invites_invitee ON public.event_invites USING btree (invitee_id);
CREATE INDEX idx_event_reports_reporter_id ON public.event_reports USING btree (reporter_id);
CREATE INDEX idx_event_reports_reviewed_by ON public.event_reports USING btree (reviewed_by);
CREATE INDEX idx_event_reports_status_created ON public.event_reports USING btree (status, created_at DESC);
CREATE INDEX idx_events_category ON public.events USING btree (category);
CREATE INDEX idx_events_club_id ON public.events USING btree (club_id);
CREATE UNIQUE INDEX idx_events_content_hash ON public.events USING btree (content_hash) WHERE (content_hash IS NOT NULL);
CREATE INDEX idx_events_created_by ON public.events USING btree (created_by);
CREATE INDEX idx_events_not_deleted ON public.events USING btree (id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);
CREATE INDEX idx_experiment_assignments_experiment_id ON public.experiment_assignments USING btree (experiment_id);
CREATE INDEX idx_experiment_assignments_variant_id ON public.experiment_assignments USING btree (variant_id);
CREATE INDEX idx_experiment_variants_experiment_id ON public.experiment_variants USING btree (experiment_id);
CREATE INDEX idx_featured_clubs_active ON public.featured_clubs USING btree (starts_at, ends_at, priority DESC);
CREATE INDEX idx_featured_clubs_club_id ON public.featured_clubs USING btree (club_id);
CREATE INDEX idx_featured_clubs_created_by ON public.featured_clubs USING btree (created_by);
CREATE INDEX featured_events_event_id ON public.featured_events USING btree (event_id);
CREATE INDEX idx_featured_events_created_by ON public.featured_events USING btree (created_by);
CREATE INDEX idx_feedback_created_at ON public.feedback USING btree (created_at DESC);
CREATE INDEX idx_feedback_status ON public.feedback USING btree (status);
CREATE INDEX idx_feedback_user_id ON public.feedback USING btree (user_id);
CREATE INDEX feedback_request_log_event_idx ON public.feedback_request_log USING btree (event_id);
CREATE INDEX feedback_request_log_type_event_idx ON public.feedback_request_log USING btree (request_type, event_id);
CREATE INDEX idx_moderation_reviews_target ON public.moderation_reviews USING btree (target_type, target_id, created_at);
CREATE INDEX idx_notifications_club_id ON public.notifications USING btree (club_id);
CREATE INDEX idx_notifications_event_id ON public.notifications USING btree (event_id);
CREATE INDEX idx_notifications_read ON public.notifications USING btree (user_id, read);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read) WHERE (read = false);
CREATE UNIQUE INDEX notifications_dedup_idx ON public.notifications USING btree (user_id, event_id, type) WHERE (event_id IS NOT NULL);
CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);
CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, read) WHERE (read = false);
CREATE INDEX idx_organizer_requests_reviewed_by ON public.organizer_requests USING btree (reviewed_by);
CREATE INDEX idx_organizer_requests_status ON public.organizer_requests USING btree (status);
CREATE INDEX idx_organizer_requests_user ON public.organizer_requests USING btree (user_id);
CREATE INDEX idx_recommendation_explicit_feedback_event_id ON public.recommendation_explicit_feedback USING btree (event_id);
CREATE INDEX idx_recommendation_explicit_feedback_user_id ON public.recommendation_explicit_feedback USING btree (user_id);
CREATE INDEX idx_recommendation_feedback_action ON public.recommendation_feedback USING btree (action);
CREATE INDEX idx_recommendation_feedback_created_at ON public.recommendation_feedback USING btree (created_at);
CREATE INDEX idx_recommendation_feedback_user_created ON public.recommendation_feedback USING btree (user_id, created_at);
CREATE INDEX idx_recommendation_feedback_variant ON public.recommendation_feedback USING btree (experiment_variant_id) WHERE (experiment_variant_id IS NOT NULL);
CREATE INDEX idx_reviews_event_id ON public.reviews USING btree (event_id);
CREATE INDEX idx_reviews_user_event ON public.reviews USING btree (user_id, event_id);
CREATE INDEX idx_rsvps_event_id ON public.rsvps USING btree (event_id);
CREATE INDEX idx_rsvps_status ON public.rsvps USING btree (status) WHERE (status <> 'cancelled'::text);
CREATE INDEX idx_rsvps_user_id ON public.rsvps USING btree (user_id);
CREATE INDEX idx_saved_events_event_id ON public.saved_events USING btree (event_id);
CREATE INDEX idx_saved_events_user_id ON public.saved_events USING btree (user_id);
CREATE INDEX idx_user_event_scores_user_score ON public.user_event_scores USING btree (user_id, score DESC);
CREATE INDEX idx_user_follows_follower ON public.user_follows USING btree (follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows USING btree (following_id);
CREATE INDEX idx_user_interactions_created_at ON public.user_interactions USING btree (created_at DESC);
CREATE INDEX idx_user_interactions_event_id ON public.user_interactions USING btree (event_id);
CREATE INDEX idx_user_interactions_type ON public.user_interactions USING btree (interaction_type);
CREATE INDEX idx_user_interactions_user_id ON public.user_interactions USING btree (user_id);
CREATE INDEX idx_users_banned_at ON public.users USING btree (banned_at) WHERE (banned_at IS NOT NULL);
CREATE INDEX idx_users_banned_by ON public.users USING btree (banned_by);
CREATE INDEX idx_users_roles ON public.users USING gin (roles);

--  (constraint-backed) CREATE UNIQUE INDEX admin_audit_log_pkey ON public.admin_audit_log USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX club_followers_pkey ON public.club_followers USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX club_followers_unique ON public.club_followers USING btree (user_id, club_id);
--  (constraint-backed) CREATE UNIQUE INDEX club_invitations_pkey ON public.club_invitations USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX club_invitations_token_key ON public.club_invitations USING btree (token);
--  (constraint-backed) CREATE UNIQUE INDEX club_members_pkey ON public.club_members USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX club_members_user_id_club_id_key ON public.club_members USING btree (user_id, club_id);
--  (constraint-backed) CREATE UNIQUE INDEX clubs_pkey ON public.clubs USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX email_reminder_log_pkey ON public.email_reminder_log USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX email_reminder_log_user_id_event_id_reminder_type_key ON public.email_reminder_log USING btree (user_id, event_id, reminder_type);
--  (constraint-backed) CREATE UNIQUE INDEX event_invites_inviter_id_invitee_id_event_id_key ON public.event_invites USING btree (inviter_id, invitee_id, event_id);
--  (constraint-backed) CREATE UNIQUE INDEX event_invites_pkey ON public.event_invites USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX event_popularity_scores_pkey ON public.event_popularity_scores USING btree (event_id);
--  (constraint-backed) CREATE UNIQUE INDEX event_reports_pkey ON public.event_reports USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX event_reports_unique_per_user ON public.event_reports USING btree (event_id, reporter_id);
--  (constraint-backed) CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX experiment_assignments_experiment_id_user_id_key ON public.experiment_assignments USING btree (experiment_id, user_id);
--  (constraint-backed) CREATE UNIQUE INDEX experiment_assignments_pkey ON public.experiment_assignments USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX experiment_variants_pkey ON public.experiment_variants USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX experiments_pkey ON public.experiments USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX featured_clubs_pkey ON public.featured_clubs USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX featured_events_pkey ON public.featured_events USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX feedback_pkey ON public.feedback USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX feedback_request_log_pkey ON public.feedback_request_log USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX feedback_request_log_user_id_event_id_request_type_key ON public.feedback_request_log USING btree (user_id, event_id, request_type);
--  (constraint-backed) CREATE UNIQUE INDEX moderation_reviews_pkey ON public.moderation_reviews USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX organizer_requests_pkey ON public.organizer_requests USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX organizer_requests_user_id_club_id_key ON public.organizer_requests USING btree (user_id, club_id);
--  (constraint-backed) CREATE UNIQUE INDEX recommendation_explicit_feedback_pkey ON public.recommendation_explicit_feedback USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX recommendation_explicit_feedback_user_id_event_id_key ON public.recommendation_explicit_feedback USING btree (user_id, event_id);
--  (constraint-backed) CREATE UNIQUE INDEX recommendation_feedback_pkey ON public.recommendation_feedback USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX reviews_user_id_event_id_key ON public.reviews USING btree (user_id, event_id);
--  (constraint-backed) CREATE UNIQUE INDEX rsvps_pkey ON public.rsvps USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX rsvps_user_id_event_id_key ON public.rsvps USING btree (user_id, event_id);
--  (constraint-backed) CREATE UNIQUE INDEX saved_events_pkey ON public.saved_events USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX saved_events_user_id_event_id_key ON public.saved_events USING btree (user_id, event_id);
--  (constraint-backed) CREATE UNIQUE INDEX tag_interaction_counts_pkey ON public.tag_interaction_counts USING btree (user_id, tag);
--  (constraint-backed) CREATE UNIQUE INDEX user_event_scores_pkey ON public.user_event_scores USING btree (user_id, event_id);
--  (constraint-backed) CREATE UNIQUE INDEX user_follows_follower_id_following_id_key ON public.user_follows USING btree (follower_id, following_id);
--  (constraint-backed) CREATE UNIQUE INDEX user_follows_pkey ON public.user_follows USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX user_interactions_pkey ON public.user_interactions USING btree (id);
--  (constraint-backed) CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
--  (constraint-backed) CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

-- ==========================================================================
-- FUNCTIONS — public (45)
-- ==========================================================================

-- Source: raw/prod/functions.json — pg_get_functiondef(oid), emitted verbatim.
-- SECURITY DEFINER functions run with the definer's privileges and bypass the caller's
-- RLS. They are called out per function below; plan 01-09 owns the authorization review.
-- 7 of 45 are SECURITY DEFINER.

-- public.compute_user_scores() — plpgsql, SECURITY DEFINER, volatility=v
CREATE OR REPLACE FUNCTION public.compute_user_scores()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- public.get_event_ids_by_time_filter(time_of_day text, day_type text) — plpgsql, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.get_event_ids_by_time_filter(time_of_day text DEFAULT NULL::text, day_type text DEFAULT NULL::text)
 RETURNS TABLE(event_id uuid)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$;

-- public.get_friends(target_user_id uuid) — sql, SECURITY DEFINER, volatility=s
CREATE OR REPLACE FUNCTION public.get_friends(target_user_id uuid)
 RETURNS TABLE(id uuid, name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT u.id, u.name, u.avatar_url
  FROM users u
  JOIN user_follows f1 ON f1.following_id = u.id AND f1.follower_id = target_user_id
  JOIN user_follows f2 ON f2.follower_id = u.id AND f2.following_id = target_user_id;
$function$;

-- public.get_friends_going_to_event(current_user_id uuid, target_event_id uuid) — sql, SECURITY DEFINER, volatility=s
CREATE OR REPLACE FUNCTION public.get_friends_going_to_event(current_user_id uuid, target_event_id uuid)
 RETURNS TABLE(id uuid, name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT u.id, u.name, u.avatar_url
  FROM users u
  JOIN saved_events se ON se.user_id = u.id AND se.event_id = target_event_id
  JOIN user_follows f1 ON f1.following_id = u.id AND f1.follower_id = current_user_id
  JOIN user_follows f2 ON f2.follower_id = u.id AND f2.following_id = current_user_id;
$function$;

-- public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$;

-- public.gin_extract_value_trgm(text, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$;

-- public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$;

-- public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)
 RETURNS "char"
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$;

-- public.gtrgm_compress(internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_compress$function$;

-- public.gtrgm_consistent(internal, text, smallint, oid, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$;

-- public.gtrgm_decompress(internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$;

-- public.gtrgm_distance(internal, text, smallint, oid, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_distance$function$;

-- public.gtrgm_in(cstring) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_in$function$;

-- public.gtrgm_options(internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)
 RETURNS void
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE
AS '$libdir/pg_trgm', $function$gtrgm_options$function$;

-- public.gtrgm_out(gtrgm) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_out$function$;

-- public.gtrgm_penalty(internal, internal, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$;

-- public.gtrgm_picksplit(internal, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$;

-- public.gtrgm_same(gtrgm, gtrgm, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_same$function$;

-- public.gtrgm_union(internal, internal) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_union$function$;

-- public.is_admin() — sql, SECURITY DEFINER, volatility=s
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  );
$function$;

-- public.is_club_owner(p_club_id uuid) — sql, SECURITY DEFINER, volatility=s
CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$function$;

-- public.recalculate_on_interaction() — plpgsql, SECURITY INVOKER, volatility=v
CREATE OR REPLACE FUNCTION public.recalculate_on_interaction()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM update_event_popularity(NEW.event_id);
  RETURN NEW;
END;
$function$;

-- public.search_events_fuzzy(search_term text, result_limit integer) — plpgsql, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.search_events_fuzzy(search_term text, result_limit integer DEFAULT 50)
 RETURNS TABLE(event_id uuid, rank double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$;

-- public.send_event_reminders() — plpgsql, SECURITY DEFINER, volatility=v
CREATE OR REPLACE FUNCTION public.send_event_reminders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- public.send_feedback_requests() — plpgsql, SECURITY DEFINER, volatility=v
CREATE OR REPLACE FUNCTION public.send_feedback_requests()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- public.set_limit(real) — c, SECURITY INVOKER, volatility=v
CREATE OR REPLACE FUNCTION public.set_limit(real)
 RETURNS real
 LANGUAGE c
 STRICT
AS '$libdir/pg_trgm', $function$set_limit$function$;

-- public.show_limit() — c, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.show_limit()
 RETURNS real
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_limit$function$;

-- public.show_trgm(text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_trgm$function$;

-- public.similarity(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity$function$;

-- public.similarity_dist(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_dist$function$;

-- public.similarity_op(text, text) — c, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_op$function$;

-- public.strict_word_similarity(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$;

-- public.strict_word_similarity_commutator_op(text, text) — c, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$;

-- public.strict_word_similarity_dist_commutator_op(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$;

-- public.strict_word_similarity_dist_op(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$;

-- public.strict_word_similarity_op(text, text) — c, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$;

-- public.update_event_popularity(p_event_id uuid) — plpgsql, SECURITY INVOKER, volatility=v
CREATE OR REPLACE FUNCTION public.update_event_popularity(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$;

-- public.update_rsvps_updated_at() — plpgsql, SECURITY INVOKER, volatility=v
CREATE OR REPLACE FUNCTION public.update_rsvps_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- public.update_saved_events_count() — plpgsql, SECURITY INVOKER, volatility=v
CREATE OR REPLACE FUNCTION public.update_saved_events_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

-- public.update_updated_at_column() — plpgsql, SECURITY INVOKER, volatility=v
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- public.word_similarity(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity$function$;

-- public.word_similarity_commutator_op(text, text) — c, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$;

-- public.word_similarity_dist_commutator_op(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$;

-- public.word_similarity_dist_op(text, text) — c, SECURITY INVOKER, volatility=i
CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$;

-- public.word_similarity_op(text, text) — c, SECURITY INVOKER, volatility=s
CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_op$function$;

-- ==========================================================================
-- TRIGGERS (11)
-- ==========================================================================

-- Source: raw/prod/triggers.json — pg_get_triggerdef(oid, true), internal triggers excluded.

-- public.clubs — enabled=O
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- public.events — enabled=O
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- public.organizer_requests — enabled=O
CREATE TRIGGER update_organizer_requests_updated_at BEFORE UPDATE ON organizer_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- public.rsvps — enabled=O
CREATE TRIGGER trigger_rsvps_updated_at BEFORE UPDATE ON rsvps FOR EACH ROW EXECUTE FUNCTION update_rsvps_updated_at();
-- public.saved_events — enabled=O
CREATE TRIGGER saved_events_count_trigger AFTER INSERT OR DELETE ON saved_events FOR EACH ROW EXECUTE FUNCTION update_saved_events_count();
-- public.user_interactions — enabled=O
CREATE TRIGGER interaction_popularity_trigger AFTER INSERT ON user_interactions FOR EACH ROW EXECUTE FUNCTION recalculate_on_interaction();
-- public.users — enabled=O
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- storage.buckets — enabled=O
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();
-- storage.buckets — enabled=O
CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
-- storage.objects — enabled=O
CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
-- storage.objects — enabled=O
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

-- ==========================================================================
-- VIEWS AND MATERIALIZED VIEWS — public (0)
-- ==========================================================================

-- none. The query in raw/prod/views.json returned 0 rows: production has no view and no
-- materialized view in the public schema. Recorded as a positive observation, because
-- "no views" and "views were never queried" are different facts.

-- ==========================================================================
-- SEQUENCES — public (0)
-- ==========================================================================

-- none. raw/prod/sequences.json returned 0 rows, and no public column is an identity
-- column. Every primary key in this schema is a uuid with a gen_random_uuid() or
-- uuid_generate_v4() default; there is no serial anywhere.

-- ==========================================================================
-- ROW LEVEL SECURITY — public (30 of 30 tables enabled)
-- ==========================================================================

-- Source: raw/prod/tables.json — pg_class.relrowsecurity / relforcerowsecurity.
-- RLS is enabled on every public table. Enablement is necessary but not sufficient:
-- a table with RLS on and a permissive USING (true) policy is open. Plan 01-09 owns
-- the policy-effectiveness review; this file records enablement only.

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_popularity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_request_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_explicit_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_interaction_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_event_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- POLICIES — public (86)
-- ==========================================================================

-- Source: raw/prod/pg-policies.json — pg_policies, emitted verbatim from qual/with_check.
-- Reconstructed as CREATE POLICY for readability; the authoritative rows are the raw JSON.

-- public.admin_audit_log
CREATE POLICY "Admins can insert audit log" ON public.admin_audit_log
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (true);
CREATE POLICY "Admins can read audit log" ON public.admin_audit_log
    AS PERMISSIVE FOR SELECT TO public
    USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND ('admin'::user_role = ANY (u.roles))))));
CREATE POLICY "Service role can insert audit log" ON public.admin_audit_log
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (true);

-- public.club_followers
CREATE POLICY "Anyone can view follower data" ON public.club_followers
    AS PERMISSIVE FOR SELECT TO public
    USING (true);
CREATE POLICY "Authenticated users can follow clubs" ON public.club_followers
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Authenticated users can unfollow clubs" ON public.club_followers
    AS PERMISSIVE FOR DELETE TO authenticated
    USING ((user_id = auth.uid()));

-- public.club_invitations
CREATE POLICY "Club owners can create club invitations" ON public.club_invitations
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (is_club_owner(club_id));
CREATE POLICY "Club owners can view club invitations" ON public.club_invitations
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (is_club_owner(club_id));

-- public.club_members
CREATE POLICY "Admins manage memberships" ON public.club_members
    AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Club owners can remove members" ON public.club_members
    AS PERMISSIVE FOR DELETE TO authenticated
    USING ((is_club_owner(club_id) AND (user_id <> ( SELECT auth.uid() AS uid))));
CREATE POLICY "Club owners can view all club members" ON public.club_members
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (is_club_owner(club_id));
CREATE POLICY "Users see own memberships" ON public.club_members
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ((auth.uid() = user_id));

-- public.clubs
CREATE POLICY "Admins can insert clubs" ON public.clubs
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (is_admin());
CREATE POLICY "Admins can update clubs" ON public.clubs
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
CREATE POLICY "Anyone can read clubs" ON public.clubs
    AS PERMISSIVE FOR SELECT TO public
    USING (true);

-- public.email_reminder_log
CREATE POLICY "Service role can manage reminder log" ON public.email_reminder_log
    AS PERMISSIVE FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
CREATE POLICY "Users can view their own reminder log" ON public.email_reminder_log
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.event_invites
CREATE POLICY "Users can delete invites sent to them" ON public.event_invites
    AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = invitee_id));
CREATE POLICY "Users can delete own sent invites" ON public.event_invites
    AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = inviter_id));
CREATE POLICY "Users can send invites" ON public.event_invites
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = inviter_id));
CREATE POLICY "Users can view own invites" ON public.event_invites
    AS PERMISSIVE FOR SELECT TO public
    USING (((auth.uid() = inviter_id) OR (auth.uid() = invitee_id)));

-- public.event_popularity_scores
CREATE POLICY "Allow public read access to event_popularity_scores" ON public.event_popularity_scores
    AS PERMISSIVE FOR SELECT TO public
    USING (true);
CREATE POLICY "Anyone can view popularity scores" ON public.event_popularity_scores
    AS PERMISSIVE FOR SELECT TO public
    USING (true);
CREATE POLICY "Authenticated users can update popularity scores" ON public.event_popularity_scores
    AS PERMISSIVE FOR ALL TO public
    USING ((auth.role() = 'authenticated'::text))
    WITH CHECK ((auth.role() = 'authenticated'::text));

-- public.event_reports
CREATE POLICY "Admins can read all reports" ON public.event_reports
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Admins can update reports" ON public.event_reports
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Users can insert own reports" ON public.event_reports
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((auth.uid() = reporter_id));
CREATE POLICY "Users can read own reports" ON public.event_reports
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ((auth.uid() = reporter_id));

-- public.events
CREATE POLICY "Admins can delete events" ON public.events
    AS PERMISSIVE FOR DELETE TO authenticated
    USING (is_admin());
CREATE POLICY "Admins can update any event" ON public.events
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
CREATE POLICY "Admins can view all events" ON public.events
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (is_admin());
CREATE POLICY "Approved events are viewable by everyone" ON public.events
    AS PERMISSIVE FOR SELECT TO public
    USING ((status = 'approved'::text));
CREATE POLICY "Authenticated users can insert events" ON public.events
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);
CREATE POLICY "Organizers can update own events" ON public.events
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((auth.uid() = created_by))
    WITH CHECK ((auth.uid() = created_by));
CREATE POLICY "Organizers can view own events" ON public.events
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ((auth.uid() = created_by));

-- public.experiment_assignments
CREATE POLICY "Admins can manage experiment assignments" ON public.experiment_assignments
    AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Users can read own assignments" ON public.experiment_assignments
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.experiment_variants
CREATE POLICY "Admins can manage experiment variants" ON public.experiment_variants
    AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));

-- public.experiments
CREATE POLICY "Admins can manage experiments" ON public.experiments
    AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));

-- public.featured_clubs
CREATE POLICY "Admins can manage featured clubs" ON public.featured_clubs
    AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Anyone can view featured clubs" ON public.featured_clubs
    AS PERMISSIVE FOR SELECT TO public
    USING (true);

-- public.featured_events
CREATE POLICY "Admins can manage featured events" ON public.featured_events
    AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Public can read active featured events" ON public.featured_events
    AS PERMISSIVE FOR SELECT TO public
    USING (((starts_at <= now()) AND (ends_at > now())));

-- public.feedback
CREATE POLICY "Admins can read feedback" ON public.feedback
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Service role full access" ON public.feedback
    AS PERMISSIVE FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
CREATE POLICY "Users can insert feedback" ON public.feedback
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);

-- public.feedback_request_log
CREATE POLICY "Service role can manage feedback request log" ON public.feedback_request_log
    AS PERMISSIVE FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
CREATE POLICY "Users can view their own feedback request log" ON public.feedback_request_log
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.moderation_reviews
CREATE POLICY "Admins full access" ON public.moderation_reviews
    AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Creators can appeal their items" ON public.moderation_reviews
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (((action = 'appeal'::text) AND (author_id = auth.uid()) AND (((target_type = 'event'::text) AND (EXISTS ( SELECT 1
   FROM events
  WHERE ((events.id = moderation_reviews.target_id) AND (events.created_by = auth.uid()))))) OR ((target_type = 'club'::text) AND (EXISTS ( SELECT 1
   FROM clubs
  WHERE ((clubs.id = moderation_reviews.target_id) AND (clubs.created_by = auth.uid()))))))));
CREATE POLICY "Creators can view reviews of their items" ON public.moderation_reviews
    AS PERMISSIVE FOR SELECT TO public
    USING ((((target_type = 'event'::text) AND (EXISTS ( SELECT 1
   FROM events
  WHERE ((events.id = moderation_reviews.target_id) AND (events.created_by = auth.uid()))))) OR ((target_type = 'club'::text) AND (EXISTS ( SELECT 1
   FROM clubs
  WHERE ((clubs.id = moderation_reviews.target_id) AND (clubs.created_by = auth.uid())))))));

-- public.notifications
CREATE POLICY "Service role can insert notifications" ON public.notifications
    AS PERMISSIVE FOR INSERT TO service_role
    WITH CHECK (true);
CREATE POLICY "Users can mark own notifications read" ON public.notifications
    AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = user_id))
    WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own notifications" ON public.notifications
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ((auth.uid() = user_id));

-- public.organizer_requests
CREATE POLICY "Admins manage requests" ON public.organizer_requests
    AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('admin'::user_role = ANY (users.roles))))));
CREATE POLICY "Users create own requests" ON public.organizer_requests
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users see own requests" ON public.organizer_requests
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ((auth.uid() = user_id));

-- public.recommendation_explicit_feedback
CREATE POLICY "Users can insert own explicit feedback" ON public.recommendation_explicit_feedback
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can read own explicit feedback" ON public.recommendation_explicit_feedback
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own explicit feedback" ON public.recommendation_explicit_feedback
    AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = user_id))
    WITH CHECK ((auth.uid() = user_id));

-- public.recommendation_feedback
CREATE POLICY "Users can insert own feedback" ON public.recommendation_feedback
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can read own feedback" ON public.recommendation_feedback
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.reviews
CREATE POLICY "Anyone can read reviews" ON public.reviews
    AS PERMISSIVE FOR SELECT TO public
    USING (true);
CREATE POLICY "Users can delete own review" ON public.reviews
    AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own review" ON public.reviews
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own review" ON public.reviews
    AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = user_id))
    WITH CHECK ((auth.uid() = user_id));

-- public.rsvps
CREATE POLICY "Anyone can view rsvps" ON public.rsvps
    AS PERMISSIVE FOR SELECT TO public
    USING (true);
CREATE POLICY "Users can create own rsvps" ON public.rsvps
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own rsvps" ON public.rsvps
    AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own rsvps" ON public.rsvps
    AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = user_id));

-- public.saved_events
CREATE POLICY "Users can delete their own saved events" ON public.saved_events
    AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own saved events" ON public.saved_events
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own saved events" ON public.saved_events
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.tag_interaction_counts
CREATE POLICY "Service role can manage all tag counts" ON public.tag_interaction_counts
    AS PERMISSIVE FOR ALL TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can read their own tag counts" ON public.tag_interaction_counts
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.user_event_scores
CREATE POLICY "Service role can manage all scores" ON public.user_event_scores
    AS PERMISSIVE FOR ALL TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can read their own scores" ON public.user_event_scores
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.user_follows
CREATE POLICY "Anyone can view follows" ON public.user_follows
    AS PERMISSIVE FOR SELECT TO public
    USING (true);
CREATE POLICY "Users can follow others" ON public.user_follows
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = follower_id));
CREATE POLICY "Users can unfollow" ON public.user_follows
    AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = follower_id));

-- public.user_interactions
CREATE POLICY "Anyone can insert interactions" ON public.user_interactions
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (true);
CREATE POLICY "Users can view their own interactions" ON public.user_interactions
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

-- public.users
CREATE POLICY "Admins can view all profiles" ON public.users
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (is_admin());
CREATE POLICY "Users can insert own profile" ON public.users
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can read own profile" ON public.users
    AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.users
    AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = id));

-- ==========================================================================
-- POLICIES — storage (15)
-- ==========================================================================

-- Source: raw/prod/pg-policies.json — pg_policies, emitted verbatim from qual/with_check.
-- Reconstructed as CREATE POLICY for readability; the authoritative rows are the raw JSON.

-- storage.objects
CREATE POLICY "Allow authenticated delete from own folder" ON storage.objects
    AS PERMISSIVE FOR DELETE TO authenticated
    USING (((auth.uid())::text = (storage.foldername(name))[1]));
CREATE POLICY "Allow authenticated update in own folder" ON storage.objects
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING (((auth.uid())::text = (storage.foldername(name))[1]))
    WITH CHECK (((auth.uid())::text = (storage.foldername(name))[1]));
CREATE POLICY "Allow authenticated upload to own folder" ON storage.objects
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (((auth.uid())::text = (storage.foldername(name))[1]));
CREATE POLICY "Allow public read access 1oj01fe_0" ON storage.objects
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);
CREATE POLICY "Anyone can view banners" ON storage.objects
    AS PERMISSIVE FOR SELECT TO public
    USING ((bucket_id = 'banners'::text));
CREATE POLICY "Anyone can view club logos" ON storage.objects
    AS PERMISSIVE FOR SELECT TO public
    USING ((bucket_id = 'club-logos'::text));
CREATE POLICY "Anyone can view event images" ON storage.objects
    AS PERMISSIVE FOR SELECT TO public
    USING ((bucket_id = 'event-images'::text));
CREATE POLICY "Authenticated users can update club logos" ON storage.objects
    AS PERMISSIVE FOR UPDATE TO public
    USING (((bucket_id = 'club-logos'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Authenticated users can upload banners" ON storage.objects
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((bucket_id = 'banners'::text));
CREATE POLICY "Authenticated users can upload club logos" ON storage.objects
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (((bucket_id = 'club-logos'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Authenticated users can upload event images" ON storage.objects
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((bucket_id = 'event-images'::text));
CREATE POLICY "Public read access for event images" ON storage.objects
    AS PERMISSIVE FOR SELECT TO public
    USING ((bucket_id = 'event-images'::text));
CREATE POLICY "Service role upload for event images" ON storage.objects
    AS PERMISSIVE FOR INSERT TO service_role
    WITH CHECK ((bucket_id = 'event-images'::text));
CREATE POLICY "Users can delete their own banners" ON storage.objects
    AS PERMISSIVE FOR DELETE TO authenticated
    USING (((bucket_id = 'banners'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can update their own banners" ON storage.objects
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING (((bucket_id = 'banners'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- ==========================================================================
-- TABLE GRANTS — public and storage (143 grantee/table pairs)
-- ==========================================================================

-- Source: raw/prod/grants.json — information_schema.role_table_grants, privileges aggregated.
-- Grantees restricted to anon, authenticated, service_role, postgres, public. No
-- supabase_auth_admin grant is captured here: the auth schema is out of scope by design.
--
-- Read these against the RLS section above. A broad table grant to `anon` is only as
-- restrictive as the policies on that table; AUDIT-09/AUDIT-10 (plan 01-09) reconcile them.

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.admin_audit_log TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.admin_audit_log TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.admin_audit_log TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.admin_audit_log TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_followers TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_followers TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_followers TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_followers TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_invitations TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_invitations TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_invitations TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_invitations TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_members TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_members TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_members TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.club_members TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.clubs TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.clubs TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.clubs TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.clubs TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.email_reminder_log TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.email_reminder_log TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.email_reminder_log TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.email_reminder_log TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_invites TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_invites TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_invites TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_invites TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_popularity_scores TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_popularity_scores TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_popularity_scores TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_popularity_scores TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_reports TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_reports TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_reports TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.event_reports TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.events TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.events TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.events TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.events TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_assignments TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_assignments TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_assignments TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_assignments TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_variants TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_variants TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_variants TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiment_variants TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiments TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiments TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiments TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.experiments TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_clubs TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_clubs TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_clubs TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_clubs TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_events TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_events TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_events TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.featured_events TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback_request_log TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback_request_log TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback_request_log TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.feedback_request_log TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.moderation_reviews TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.moderation_reviews TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.moderation_reviews TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.moderation_reviews TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.notifications TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.notifications TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.notifications TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.notifications TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.organizer_requests TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.organizer_requests TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.organizer_requests TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.organizer_requests TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_explicit_feedback TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_explicit_feedback TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_explicit_feedback TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_explicit_feedback TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_feedback TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_feedback TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_feedback TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.recommendation_feedback TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.reviews TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.reviews TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.reviews TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.reviews TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.rsvps TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.rsvps TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.rsvps TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.rsvps TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.saved_events TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.saved_events TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.saved_events TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.saved_events TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.tag_interaction_counts TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.tag_interaction_counts TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.tag_interaction_counts TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.tag_interaction_counts TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_event_scores TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_event_scores TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_event_scores TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_event_scores TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_follows TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_follows TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_follows TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_follows TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_interactions TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_interactions TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_interactions TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.user_interactions TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.users TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.users TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.users TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public.users TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.buckets TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.buckets TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.buckets TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.buckets TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.buckets_analytics TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.buckets_analytics TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.buckets_analytics TO service_role;
GRANT SELECT ON storage.buckets_vectors TO anon;
GRANT SELECT ON storage.buckets_vectors TO authenticated;
GRANT SELECT ON storage.buckets_vectors TO service_role;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.objects TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.objects TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.objects TO postgres;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.objects TO service_role;
GRANT SELECT ON storage.s3_multipart_uploads TO anon;
GRANT SELECT ON storage.s3_multipart_uploads TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON storage.s3_multipart_uploads_parts TO anon;
GRANT SELECT ON storage.s3_multipart_uploads_parts TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON storage.vector_indexes TO anon;
GRANT SELECT ON storage.vector_indexes TO authenticated;
GRANT SELECT ON storage.vector_indexes TO service_role;

-- ==========================================================================
-- STORAGE BUCKETS (4)
-- ==========================================================================

-- Source: raw/prod/storage-buckets.json — rows of storage.buckets. These are configuration
-- rows, not DDL, so they are emitted as an inventory. `public: true` means objects are
-- readable without a signed URL; plan 01-10 owns the storage exposure review.

--   avatars              public=true   size_limit=5242880  mime=any
--   banners              public=true   size_limit=8388608  mime=image/jpeg,image/png,image/webp
--   club-logos           public=true   size_limit=none  mime=any
--   event-images         public=true   size_limit=5242880  mime=image/jpeg,image/png,image/webp,image/gif

-- ==========================================================================
-- SCHEDULED JOBS — cron.job (3)
-- ==========================================================================

-- Source: raw/prod/cron-job.json. Emitted as an inventory; pg_cron jobs are rows, not DDL.
-- Every command below is plain SQL calling a public function — none of them issues an HTTP
-- request, so no cron job in production invokes an application endpoint. Plan 01-10 owns
-- the cron review and raw/prod/cron-job-run-details.json holds the last 100 run outcomes.

--   [1] send-event-reminders     */15 * * * *   active=true  select public.send_event_reminders()
--   [2] compute-user-scores      0 */6 * * *    active=true  SELECT compute_user_scores()
--   [4] send-feedback-requests   */30 * * * *   active=true  SELECT public.send_feedback_requests()

-- ==========================================================================
-- APPLIED MIGRATIONS (45 applied on production)
-- ==========================================================================

-- Source: raw/prod/migrations-applied.json (list_migrations).
-- The repository tracks 44 files under supabase/migrations/; production reports
-- 45 applied versions. The counts do not agree. That discrepancy is a
-- finding candidate for AUDIT-02 (plan 01-08), not something this file resolves.

--   001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 020, 20250210000000, 20250210100000, 20251128053245, 20251128060836, 20260223, 20260223000000, 20260223193741, 20260225000001, 20260226000001, 20260227000001, 20260305000001, 20260305000002, 20260306, 20260307000001, 20260315041343, 20260315045155, 20260315103436, 20260315231016, 20260316002951, 20260316034955, 20260316042746, 20260316050743, 20260316051022, 20260316061922, 20260316090343, 20260316091121, 20260316091643, 20260316093431, 20260316094048, 20260316101601, 20260324061310

-- ==========================================================================
-- END OF SNAPSHOT
-- ==========================================================================

-- 30 tables, 243 columns, 123 constraints, 119 indexes,
-- 45 functions, 11 triggers, 0 views, 0 sequences,
-- 101 policies, 143 grants, 4 storage buckets, 3 cron jobs.
--
-- Generated by .planning/audit/tools/gen-prod-schema.mjs from .planning/audit/raw/prod/.
-- No database connection was opened by the generator.
