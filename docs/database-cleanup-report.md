# Database Dead Code & Cleanup Report

**Date:** 2026-02-24

This document flags redundant, overcomplicated, or broken database-related code in the Uni-Verse/Event-Radar codebase.

---

## Critical Issues (Need Fixing)

### 1. Migration 009: Missing `is_admin` Dependency

**File:** `supabase/migrations/009_user_roles.sql`

**Problem:** Migration 009 references `is_admin` column which is **never added** by any prior migration. On a fresh database, 009 will fail with:
```
ERROR: column "is_admin" does not exist
```

**Root cause:** The `is_admin` column was added per `docs/plans/2026-02-13-admin-interface-plan.md` but the migration was never committed to the migrations folder.

**Fix:** Add migration `008b_add_is_admin_to_users.sql` (runs before 009) that adds `is_admin` if it doesn't exist.

---

### 2. `user_interactions.source` CHECK Constraint Missing `my-events`

**File:** `supabase/migrations/003_user_interactions.sql`

**Problem:** The CHECK constraint allows: `'home', 'search', 'recommendation', 'calendar', 'direct', 'modal'` but `src/types/index.ts` defines `InteractionSource` including `'my-events'`. The API at `src/app/api/interactions/route.ts` validates against `validSources` which also omits `'my-events'`.

**Impact:** Any client sending `source: 'my-events'` will get a DB constraint violation on insert.

**Fix:** Add a migration to alter the CHECK constraint to include `'my-events'`, and update the API validation.

---

### 3. Users Table Schema Drift: `full_name` vs `name`

**File:** `supabase/migrations/001_initial_schema.sql`

**Problem:** Migration 001 creates `users` with `full_name TEXT`, but:
- `src/lib/supabase/types.ts` expects `name`
- `src/app/auth/callback/route.ts` inserts `name`, `avatar_url`
- `src/types/index.ts` User interface has `name`

**Impact:** If the DB was created from 001 only, auth callback upsert would fail (column `name` doesn't exist). Production likely has a different migration history (e.g. `20251128053245_remote_schema` ran first or DB was manually altered).

**Fix:** Add a migration that ensures `name` and `avatar_url` exist on `users`, and migrate `full_name` → `name` if needed. Make 001 and code consistent.

---

## Redundant / Confusing Migrations

### 4. `20251128053245_remote_schema.sql` — Redundant & Conflicting

**File:** `supabase/migrations/20251128053245_remote_schema.sql`

**Problem:** This appears to be a **remote schema dump** (e.g. from `supabase db pull`) from a different Supabase project. It defines:
- `events` with different schema (no `club_id`, `status`; has `category`, `organizer`, `rsvp_count`; `end_date` NOT NULL)
- `users` with `name`, `avatar_url`, `preferences` (no `interest_tags`, no `auth.users` FK)
- `rsvps` table (useful — 001 doesn't create this)
- No `clubs` table

**What actually happens when it runs:**
- `CREATE TABLE IF NOT EXISTS` skips `events`, `users`, `saved_events` (they exist from 001)
- Creates `rsvps` (the only new table)
- Adds extensions, grants, policies — some policies conflict with 002 (e.g. "Events are viewable by everyone" vs 002's "Approved events are viewable by everyone")

**Recommendation:** 
- Extract the `rsvps` table creation into a dedicated migration (e.g. `003b_rsvps.sql`) if not already covered elsewhere
- Move `20251128053245_remote_schema.sql` to `supabase/migrations/_archive/` or delete it
- Document that `rsvps` came from this dump

---

## Overcomplicated / Needs Simplification

### 5. Duplicate Event Policies (002 vs remote_schema)

**Files:** `002_rls_policies.sql`, `20251128053245_remote_schema.sql`

**Problem:** Both define RLS policies for `events`. 002 restricts anon to `status = 'approved'`; remote_schema has "Events are viewable by everyone". When both exist, RLS ORs them, so anon may see all events depending on policy order.

**Fix:** Audit which policies are active in production; remove duplicates from remote_schema.

---

### 6. Club Logos in `event-images` Bucket

**File:** `src/app/api/clubs/logo/route.ts`

**Problem:** Club logos are uploaded to the `event-images` bucket. Semantically, a dedicated `club-logos` bucket would be clearer and easier to manage (different retention, sizing, etc.).

**Recommendation:** Create `club-logos` bucket migration and update the route. Low priority.

---

### 7. Type Assertions `(supabase as any)` in Database Code

**Files:** `src/app/auth/callback/route.ts`, `src/app/api/profile/avatar/route.ts`, `src/app/api/feedback/route.ts`, others

**Problem:** Using `(supabase as any)` bypasses TypeScript checks. Storage API (`supabase.storage.from()`) may not be fully typed in the current Supabase client.

**Recommendation:** Use proper `SupabaseClient` typing; extend types for storage if needed. See `.planning/codebase/CONCERNS.md`.

---

## Dead / Unused (Verify Before Removing)

### 8. `user_engagement_summary.favorite_tags` / `favorite_clubs` Structure

**File:** `supabase/migrations/005_user_engagement.sql`

**Problem:** The function stores `{tag, count}` and `{club_id, count}` but types expect `{tag: string, count: number}[]`. The JSONB structure from `jsonb_build_object('tag', tag, 'count', count)` matches. Verify API consumers expect this shape.

---

### 9. `feedback` Table — `public` Schema

**File:** `supabase/migrations/010_feedback_table.sql`

**Problem:** Uses `CREATE TABLE IF NOT EXISTS feedback` without `public.` prefix. Most other migrations use `public.`. Inconsistent but works if `search_path` includes `public`.

**Recommendation:** Use `public.feedback` for consistency.

---

## Summary of Recommended Actions

| Priority | Action |
|----------|--------|
| **P0** | Add `008b_add_is_admin_to_users.sql` so 009 runs on fresh DB |
| **P0** | Add migration to include `my-events` in `user_interactions.source` CHECK |
| **P1** | Add migration for `users.name` and `avatar_url` (align 001 with code) |
| **P2** | Archive or remove `20251128053245_remote_schema.sql`; extract `rsvps` if needed |
| **P2** | Audit RLS policies for events; remove conflicting duplicates |
| **P3** | Consider `club-logos` bucket; reduce `(supabase as any)` usage |
