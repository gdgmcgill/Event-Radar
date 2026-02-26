# Database Migration Versioning Guide

This guide covers how database migrations are managed in the Uni-Verse project.

---

## Naming Convention

All **new** migrations use the Supabase timestamp format:

```
YYYYMMDDHHMMSS_description.sql
```

Legacy files (001 through 013) use a numeric prefix (`NNN_description.sql`). Do **not** rename them — Supabase tracks applied migrations by filename, so renaming would cause them to re-run or be treated as new.

---

## Creating a New Migration

### 1. Generate the file

```bash
touch supabase/migrations/$(date -u +"%Y%m%d%H%M%S")_short_description.sql
```

Replace `short_description` with a lowercase, underscore-separated summary (e.g., `add_rsvp_limits`, `fix_events_rls`).

### 2. Write idempotent SQL

Use guards so the migration can be safely re-run:

```sql
-- Tables
CREATE TABLE IF NOT EXISTS public.example (...);

-- Columns
ALTER TABLE public.example ADD COLUMN IF NOT EXISTS new_col TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_example_col ON public.example(new_col);

-- Constraints (wrap in a DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'example_check'
  ) THEN
    ALTER TABLE public.example ADD CONSTRAINT example_check CHECK (...);
  END IF;
END $$;

-- Policies (drop-then-create for clean re-runs)
DROP POLICY IF EXISTS "Example policy" ON public.example;
CREATE POLICY "Example policy" ON public.example FOR SELECT USING (...);
```

### 3. Include rollback comments

At the bottom of every migration, add commented-out SQL that reverses the change:

```sql
-- == ROLLBACK ==
-- DROP TABLE IF EXISTS public.example;
-- ALTER TABLE public.other DROP COLUMN IF EXISTS new_col;
```

---

## Applying Migrations

### Push to remote (without resetting)

```bash
supabase db push
```

This applies any new migration files that have not yet been recorded in the remote `supabase_migrations.schema_migrations` table.

### Full reset (local development only)

```bash
supabase db reset
```

This drops and recreates the local database, then replays every migration in filename order. Never run this against production.

---

## Existing Migrations

| # | Filename | Description |
|---|----------|-------------|
| 1 | `001_initial_schema.sql` | Core tables (clubs, events, users, saved_events), indexes, and updated_at triggers |
| 2 | `002_rls_policies.sql` | Row Level Security policies for clubs, events, users, and saved_events |
| 3 | `003_user_interactions.sql` | user_interactions table for tracking views, clicks, saves, shares, and calendar adds |
| 4 | `004_event_popularity.sql` | event_popularity_scores table with weighted popularity and trending score functions |
| 5 | `005_user_engagement.sql` | user_engagement_summary table with per-user aggregated metrics and favorite tags/clubs |
| 6 | `006_tracking_rls_policies.sql` | RLS policies and grants for user_interactions, event_popularity_scores, and user_engagement_summary |
| 7 | `007_add_created_by_and_notifications.sql` | Add created_by column to events; create notifications table with indexes |
| 8 | `008_event_source_tracking.sql` | Add source (manual/instagram/admin) and source_url columns to events |
| 9 | `008b_add_is_admin_to_users.sql` | Add is_admin boolean to users (prerequisite for 009 role migration) |
| 10 | `009_user_roles.sql` | Replace is_admin with roles array (user_role enum), create club_members and organizer_requests tables with RLS |
| 11 | `010_feedback_table.sql` | Feedback table for bug reports and feature requests with RLS |
| 12 | `011_event_images_bucket.sql` | Create event-images storage bucket with public read and service-role upload policies |
| 13 | `011_rls_audit.sql` | Full RLS audit fixing 7 security gaps: is_admin() helper, scoped events/users/clubs policies, admin DELETE |
| 14 | `012_add_my_events_to_interaction_source.sql` | Add 'my-events' to the user_interactions source CHECK constraint |
| 15 | `013_users_name_avatar_columns.sql` | Add name (migrated from full_name) and avatar_url columns to users |
| 16 | `20251128053245_remote_schema.sql` | No-op placeholder for legacy remote schema snapshot (covered by 001-011) |
| 17 | `20251128060836_events_add_status_column.sql` | No-op placeholder for legacy status column addition (covered by 001) |
| 18 | `20260223000000_notifications_rls_and_dedup.sql` | Notifications RLS policies, unique dedup index, and performance indexes |
| 19 | `20260223193741_remote_schema.sql` | No-op placeholder for remote schema sync (covered by 001-010) |
| 20 | `20260223_add_clubs_status_category.sql` | Add status, category, and created_by columns to clubs |
| 21 | `20260225000001_club_roles_and_invitations.sql` | Owner/organizer role distinction, is_club_owner() helper, owner-scoped RLS, club_invitations table |
| 22 | `20260226000001_invitee_select_update_policy.sql` | Invitee SELECT/UPDATE policies on club_invitations; owner revocation UPDATE policy |

---

## Rules

1. **Never modify an applied migration.** Once a migration has been pushed to the remote database, treat it as immutable. Create a new migration to alter, fix, or undo the change.

2. **Use IF NOT EXISTS / IF EXISTS guards.** Every CREATE TABLE, CREATE INDEX, ADD COLUMN, and DROP should be idempotent so that `supabase db reset` replays cleanly.

3. **One logical change per file.** A single migration should address one concern (e.g., one new table, one RLS fix, one column addition). This keeps the history reviewable and rollbacks targeted.

4. **Include rollback SQL.** Add commented-out rollback statements at the end of every migration file. If something goes wrong, the team can quickly find the reversal steps.

5. **Test locally first.** Run `supabase db reset` to verify the full migration chain replays without errors before pushing to the remote database.

6. **Keep no-op placeholders.** Some files exist solely to keep the local migration history aligned with the remote `schema_migrations` table. Do not delete them.
