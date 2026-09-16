-- ============================================================================
-- supabase db diff --linked --schema public,storage — AFTER the REFAC-02/03 fixes
--
-- Plan: 03-05 · Phase: 03-refactor-foundations-schema-truth-and-the-seam-kit · Recorded: 2026-09-15
--
-- $ SUPABASE_DB_PASSWORD=<from macOS keychain, at the moment of use> \
--     npx supabase db diff --linked --schema public,storage
-- exit code: 0
--
-- THIS FILE IS NOT EXPECTED TO BE EMPTY, AND THAT IS THE POINT.
--
--   Plan 03-04 left `evidence/db-diff.prod.sql` at zero bytes: the schema built
--   from the repository WAS production's schema. This plan then deliberately
--   added nine objects production does not have. So the criterion here is not
--   emptiness but ACCOUNTABILITY — every statement below must correspond to an
--   addition this plan made, and each is named and attributed in
--   `evidence/schema-fixes-note.md` § 5. If a statement appeared that this plan
--   did not add, the baseline or the migrations would be wrong, and this file
--   would be the evidence.
--
-- READ THE DIRECTION CAREFULLY. `db diff --linked` emits the statements that
-- would transform the LOCAL schema INTO the remote one. The nine `drop`
-- statements below therefore mean "production lacks these nine objects", not
-- "something wants to delete them". They are exactly this plan's six new
-- indexes and three new policies.
--
-- THE DIFF IS A MEASUREMENT, NOT A PROBLEM TO BE CLOSED (T-03-05-04). It is not
-- closed by pushing. The CLI subcommand that pushes local migrations to the
-- linked project, and the one that repairs its remote history, were not run by
-- this plan and are prohibited by name in it. Neither command name is spelled
-- out here: plan 03-05 greps this directory for the push subcommand as a
-- tripwire, and a tripwire that matches its own documentation reports a hit for
-- the wrong reason. Applying these objects
-- to production is a separate, gated decision — D-02, plan 03-08 — and it is
-- blocked until the production migration history is reconciled.
--
-- The `cron.job` row this plan's second migration creates does NOT appear below,
-- and its absence is correct rather than a miss: `cron` is not one of the two
-- schemas diffed, and pg_cron's job catalog is not schema DDL. That job is
-- proven by `evidence/cron-idempotence.txt` and `030-cron-schedule.test.sql`
-- instead.
--
-- No credential, token, key or project reference appears below.
-- ============================================================================


-- ---- verbatim stderr from the command ----
-- WARN: config section [inbucket] is deprecated. Please use [local_smtp] instead.
-- Creating shadow database...
-- Initialising schema...
-- Seeding globals from roles.sql...
-- Applying migration 20260915214553_baseline.sql...
-- Applying migration 20260915230000_fk_indexes_and_policy_gaps.sql...
-- Applying migration 20260915230100_cron_compute_user_scores.sql...
-- Diffing schemas: public,storage
-- Finished supabase db diff on branch main.
-- 
-- Found drop statements in schema diff. Please double check if these are expected:
-- drop policy "Club owners can update club invitations" on "public"."club_invitations"
-- drop policy "Invitees can accept their own invitations" on "public"."club_invitations"
-- drop policy "Invitees can view their own invitations" on "public"."club_invitations"
-- drop index if exists "public"."idx_events_description_trgm"
-- drop index if exists "public"."idx_events_status_start_date"
-- drop index if exists "public"."idx_events_title_trgm"
-- drop index if exists "public"."idx_featured_events_window"
-- drop index if exists "public"."idx_moderation_reviews_author_action"
-- drop index if exists "public"."idx_recommendation_feedback_event_id"


-- ---- the diff payload, verbatim, as emitted in the CLI JSON `diff` field ----

drop policy "Club owners can update club invitations" on "public"."club_invitations";

drop policy "Invitees can accept their own invitations" on "public"."club_invitations";

drop policy "Invitees can view their own invitations" on "public"."club_invitations";

drop index if exists "public"."idx_events_description_trgm";

drop index if exists "public"."idx_events_status_start_date";

drop index if exists "public"."idx_events_title_trgm";

drop index if exists "public"."idx_featured_events_window";

drop index if exists "public"."idx_moderation_reviews_author_action";

drop index if exists "public"."idx_recommendation_feedback_event_id";



-- ---- raw JSON stdout, verbatim, for byte-level provenance ----
-- {"diff":"drop policy \"Club owners can update club invitations\" on \"public\".\"club_invitations\";\n\ndrop policy \"Invitees can accept their own invitations\" on \"public\".\"club_invitations\";\n\ndrop policy \"Invitees can view their own invitations\" on \"public\".\"club_invitations\";\n\ndrop index if exists \"public\".\"idx_events_description_trgm\";\n\ndrop index if exists \"public\".\"idx_events_status_start_date\";\n\ndrop index if exists \"public\".\"idx_events_title_trgm\";\n\ndrop index if exists \"public\".\"idx_featured_events_window\";\n\ndrop index if exists \"public\".\"idx_moderation_reviews_author_action\";\n\ndrop index if exists \"public\".\"idx_recommendation_feedback_event_id\";\n\n\n","file":null,"files":[],"schemas":["public","storage"],"engine":"migra","dropStatements":["drop policy \"Club owners can update club invitations\" on \"public\".\"club_invitations\"","drop policy \"Invitees can accept their own invitations\" on \"public\".\"club_invitations\"","drop policy \"Invitees can view their own invitations\" on \"public\".\"club_invitations\"","drop index if exists \"public\".\"idx_events_description_trgm\"","drop index if exists \"public\".\"idx_events_status_start_date\"","drop index if exists \"public\".\"idx_events_title_trgm\"","drop index if exists \"public\".\"idx_featured_events_window\"","drop index if exists \"public\".\"idx_moderation_reviews_author_action\"","drop index if exists \"public\".\"idx_recommendation_feedback_event_id\""],"message":"Diff complete."}

