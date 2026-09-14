# Three-Way Schema Drift — production vs `supabase/migrations/` vs `types.ts`

**Requirement:** AUDIT-02 &nbsp;·&nbsp; **Plan:** 01-08 &nbsp;·&nbsp; **Phase:** 01-read-only-foundation-audit

> **Generated. Do not hand-edit.** Every number and every row below is rendered from
> [`drift.json`](./drift.json) by `.planning/audit/tools/gen-drift-table.mjs`, so the two
> representations cannot disagree. To add a reviewer's comment, set `human_note` on the row
> in `drift.json` — the generator preserves it across re-runs — and re-run the generator:
>
> ```bash
> node .planning/audit/tools/gen-drift-table.mjs
> ```

## The three sources, and why only one of them is truth

| # | Source | File | What it can prove |
|---|---|---|---|
| 1 | **Production catalog** | [`information-schema-columns.json`](./information-schema-columns.json) — 243 columns over 30 tables | What **exists**. This is the only source of truth in this document. Captured in plan 01-06 through the Management API; the envelope is `raw/prod/information-schema-columns.json`. |
| 2 | **Migration files** | `supabase/migrations/` — 44 files, parsed **statically** | What a migration file **declares**. It deliberately does *not* claim what a rebuilt database would contain, because [no database can be rebuilt from this folder today](./local-reset.txt). |
| 3 | **Generated types** | `src/lib/supabase/types.ts` — 31 tables | Nothing, on its own. This file is the artifact under suspicion; it is the thing being **judged** by columns 1 and 2, not a witness for them. |

### `types.ts` is generator output, not a hand-written file

`codebase/CONCERNS.md` records a worry about "hand-written Supabase types". It is wrong on the
facts. `src/lib/supabase/types.ts` is 1,508 lines and opens with

```ts
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
```

`__InternalSupabase.PostgrestVersion` is emitted by `supabase gen types typescript` and by
nothing else. **This changes REFAC-04's shape.** The remediation is not "replace hand-written
types with generated ones" — they already are generated. It is "the generated file is stale,
and nothing in CI regenerates or verifies it." Accordingly the third column of this table asks
*does it match the live schema*, never *was it written by hand*.

## Summary — counts per drift class

| Drift class | Rows | Meaning |
|---|---:|---|
| `in-sync` | 212 | production, the migrations folder, and types.ts all agree |
| `prod-only` | 39 | exists in production; **no migration file declares it** — it was created out of band |
| `migrations-only` | 22 | a migration file declares it; **production does not have it** |
| `type-mismatch` | 0 | production and the migrations agree, but `types.ts` disagrees or is silent |
| `types-only` | 15 | `types.ts` declares it; neither production nor any migration has it |
| **total** | **288** | 278 column rows, 3 table rows, 7 object rows |

**76 of 288 rows are not in sync**, across 13 tables and objects.
Every row below whose class is not `in-sync` is a finding candidate for plan 01-13.

### How to read the three status columns

- `exists_in_prod` — the column is in the production catalog census.
- `exists_in_migrations` — some file in `supabase/migrations/` declares it, via `CREATE TABLE`
  or `ALTER TABLE ... ADD COLUMN`. Declaration order is filename order, and the first file to
  declare a column is recorded as `introduced_by_migration`.
- `typed_correctly` — `types.ts` has a `Row` property for it **and** that property's type equals
  what `supabase gen types` would emit for the production column's `udt_name` and nullability.
  A column absent from `types.ts` is `false`, with the reason in `notes`.

On `scope: "object"` rows (storage buckets, pg_cron jobs) `typed_correctly` is `false` by
construction — `types.ts` models the `public` schema only and has no obligation to these
objects — so those rows are classified on production-versus-migrations alone.

## Corroborating evidence

| Question | Artifact |
|---|---|
| What is applied where? | [`migration-list.prod.txt`](./migration-list.prod.txt), [`migration-list.local.txt`](./migration-list.local.txt), [`migration-list.staging.txt`](./migration-list.staging.txt) |
| What would a shadow diff say? | [`db-diff.prod.sql`](./db-diff.prod.sql), [`db-diff.staging.sql`](./db-diff.staging.sql) — **both blocked, and the reason is itself the finding** |
| Why can't the folder be replayed? | [`local-reset.txt`](./local-reset.txt) |
| What does production actually look like? | [`prod.schema.sql`](./prod.schema.sql), [`information-schema-columns.json`](./information-schema-columns.json) |

`supabase db diff` could not run, and would not have run even with a production credential:
it builds a **shadow** Postgres by replaying `supabase/migrations/` before it compares
anything, and that replay aborts at the 12th of 44 files on a duplicate `version` primary key.
This table exists because the diff cannot — production truth comes from the catalog census and
migration truth from static parsing, which is why the `exists_in_migrations` column answers
"is it declared" rather than "would it be built".

## The shape of the drift

Production columns that no migration declares, by table (top 6):

| Table | Undeclared columns |
|---|---:|
| `users` | 9 |
| `events` | 7 |
| `clubs` | 6 |
| `rsvps` | 6 |
| `featured_clubs` | 3 |
| `experiment_variants` | 1 |

### Nothing is mistyped, and that is the finding

There are **zero `type-mismatch` rows**. Every one of the 243 columns in the production
census has a `Row` property in `types.ts`, and every one of those properties is exactly what
`supabase gen types` emits for that column's `udt_name` and nullability — enum arrays and all.

That is not an all-clear. It is evidence about **which** of the three sources is stale.
`types.ts` was regenerated from production *after* the out-of-band changes landed, so it
faithfully describes a schema that no migration file can produce. The drift in this codebase
runs entirely between production and `supabase/migrations/`; the types file is downstream of
production and tracks it. The corollary for Stage 3 is that REFAC-04 (types) is cheap and
REFAC-01 (migrations) is the expensive one — and that regenerating types would *hide* drift
rather than reveal it, because the generator reads production, not the migrations folder.

### Named consequences

- **`users.is_admin` is declared by the one file the CLI silently skips.** `008b_add_is_admin_to_users.sql` does not parse as `<version>_<name>.sql`, so the CLI prints *Skipping* and moves on with a zero exit status. `009_user_roles.sql` then guards its `DROP COLUMN is_admin` behind a `DO $$ ... IF EXISTS` block precisely because the column is absent on a fresh replay. Production does not have the column; the migrations folder says it should. A skip is worse than a failure — it is silent.
- **`events_tests` exists only in `types.ts`.** Production does not have the table and no migration creates it; the only migration that mentions it is a `DROP TABLE IF EXISTS` in `20260316000004_fk_indexes_and_cleanup.sql` — a file whose version was **never applied to production**. So a test-scaffolding table was created out of band, dropped out of band, captured into the types file, and the cleanup migration that would have recorded the drop is still sitting unapplied in the repository.
- **`user_engagement_summary` was never built.** `005_user_engagement.sql` creates it and production has no such table. 11 of the 22 `migrations-only` rows are its columns.
- **`rsvps` is created by no migration at all, yet other migrations write policies for it.** `011_rls_audit.sql` and `20260313000002_recommendation_engine.sql` both reference `rsvps`; neither creates it. `011_rls_audit.sql` is also one half of the duplicate-`011` pair that aborts the replay. A table carrying RSVP state — user-linked rows, a `status` column — exists in production with no schema-as-code anywhere.
- **3 of 4 storage buckets exist only in production** (`avatars`, `banners`, `club-logos`). `supabase/config.toml`'s `[storage.buckets.*]` block is entirely commented out and only `event-images` is created by a migration, so these three were made in the dashboard. All 3 are `public = true`, and 2 of them carry no MIME-type allow-list at all — AUDIT-18's subject, reached from the drift side.
- **All 3 pg_cron jobs exist only in production** (`compute-user-scores`, `send-event-reminders`, `send-feedback-requests`). The only trace of any of them in the repository is a commented-out `cron.schedule(...)` line in `20260313000002_recommendation_engine.sql` — and that file's version was never applied to production either. Three live scheduled jobs mutating production data, none of them schema-as-code.

This is the per-column shadow of the version accounting in
[`migration-list.prod.txt`](./migration-list.prod.txt): **18 migration versions are applied in
production with no file in the repository**, 17 of them in a two-day burst on 2026-03-15/16.
The columns those versions created are exactly the `prod-only` rows below. Conversely **12
files declare a version production never applied**, and their columns are the
`migrations-only` rows.

## Drift by table

Only rows that are **not** `in-sync` are listed. A table with no section is fully in sync.

### `admin_audit_log`

1 of 8 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `admin_email` | `migrations-only` | **no** | yes <sub>20260308000002_admin_audit_log.sql</sub> | **no** | — | — | declared by 20260308000002_admin_audit_log.sql but absent from production |

### `clubs`

6 of 17 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `banner_url` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `contact_email` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `discord_url` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `linkedin_url` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `twitter_url` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `website_url` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |

### `cron.job`

3 of 3 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `compute-user-scores` | `prod-only` | yes | **no** | **no** | `schedule "0 */6 * * *" running SELECT compute_user_scores() (active=true)` | — | the only trace of this job in supabase/migrations/ is a COMMENTED-OUT cron.schedule() line in 20260313000002_recommendation_engine.sql — a commented statement is not a migration, and a rebuilt database would have no such job; types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal |
| `send-event-reminders` | `prod-only` | yes | **no** | **no** | `schedule "*/15 * * * *" running select public.send_event_reminders() (active=true)` | — | no migration mentions this job at all; it exists only in production; types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal |
| `send-feedback-requests` | `prod-only` | yes | **no** | **no** | `schedule "*/30 * * * *" running SELECT public.send_feedback_requests() (active=true)` | — | no migration mentions this job at all; it exists only in production; types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal |

### `events`

9 of 27 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `approved_at` | `migrations-only` | **no** | yes <sub>001_initial_schema.sql</sub> | **no** | — | — | declared by 001_initial_schema.sql but absent from production |
| `approved_by` | `migrations-only` | **no** | yes <sub>001_initial_schema.sql</sub> | **no** | — | — | declared by 001_initial_schema.sql but absent from production |
| `category` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `is_free` | `prod-only` | yes | **no** | yes | `boolean` | `boolean` | exists in production but no migration file declares it — created out of band |
| `organizer` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `pending_edits` | `prod-only` | yes | **no** | yes | `jsonb` | `Json \| null` | exists in production but no migration file declares it — created out of band |
| `price` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `rsvp_count` | `prod-only` | yes | **no** | yes | `integer` | `number \| null` | exists in production but no migration file declares it — created out of band |
| `rsvp_link` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |

### `events_tests`

15 of 15 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `category` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `created_at` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `description` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `end_date` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `id` | `types-only` | **no** | **no** | **no** | — | `string` | present in the generated types file but in neither production nor any migration |
| `image_url` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `location` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `organizer` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `rsvp_count` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `start_date` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `status` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `tags` | `types-only` | **no** | **no** | **no** | — | `Json \| null` | present in the generated types file but in neither production nor any migration |
| `title` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| `updated_at` | `types-only` | **no** | **no** | **no** | — | `string \| null` | present in the generated types file but in neither production nor any migration |
| _(whole table)_ | `types-only` | **no** | **no** | **no** | — | `present in types.ts` | the generated types file declares this table; production does not have it and no migration creates it; a DROP TABLE for it appears in 20260316000004_fk_indexes_and_cleanup.sql |

### `experiment_variants`

1 of 6 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `created_at` | `prod-only` | yes | **no** | yes | `timestamp with time zone` | `string` | exists in production but no migration file declares it — created out of band |

### `experiments`

1 of 10 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `created_by` | `migrations-only` | **no** | yes <sub>20260305000001_experiments.sql</sub> | **no** | — | — | declared by 20260305000001_experiments.sql but absent from production |

### `featured_clubs`

6 of 11 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `end_date` | `migrations-only` | **no** | yes <sub>20260316000003_audit_fixes.sql</sub> | **no** | — | — | declared by 20260316000003_audit_fixes.sql but absent from production |
| `ends_at` | `prod-only` | yes | **no** | yes | `timestamp with time zone` | `string` | exists in production but no migration file declares it — created out of band |
| `is_active` | `migrations-only` | **no** | yes <sub>20260316000003_audit_fixes.sql</sub> | **no** | — | — | declared by 20260316000003_audit_fixes.sql but absent from production |
| `priority` | `prod-only` | yes | **no** | yes | `integer` | `number` | exists in production but no migration file declares it — created out of band |
| `start_date` | `migrations-only` | **no** | yes <sub>20260316000003_audit_fixes.sql</sub> | **no** | — | — | declared by 20260316000003_audit_fixes.sql but absent from production |
| `starts_at` | `prod-only` | yes | **no** | yes | `timestamp with time zone` | `string` | exists in production but no migration file declares it — created out of band |

### `reviews`

1 of 7 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `updated_at` | `migrations-only` | **no** | yes <sub>020_reviews_table.sql</sub> | **no** | — | — | declared by 020_reviews_table.sql but absent from production |

### `rsvps`

7 of 7 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `created_at` | `prod-only` | yes | **no** | yes | `timestamp with time zone` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `event_id` | `prod-only` | yes | **no** | yes | `uuid` | `string` | exists in production but no migration file declares it — created out of band |
| `id` | `prod-only` | yes | **no** | yes | `uuid` | `string` | exists in production but no migration file declares it — created out of band |
| `status` | `prod-only` | yes | **no** | yes | `text` | `string` | exists in production but no migration file declares it — created out of band |
| `updated_at` | `prod-only` | yes | **no** | yes | `timestamp with time zone` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `user_id` | `prod-only` | yes | **no** | yes | `uuid` | `string` | exists in production but no migration file declares it — created out of band |
| _(whole table)_ | `prod-only` | yes | **no** | yes | `table (6 columns)` | `present in types.ts` | this table exists in production and NO migration file creates it — every one of its columns is prod-only for the same reason; the generated types file knows about it, which means types.ts was regenerated from production after the table was created out of band |

### `storage.buckets`

3 of 4 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `avatars` | `prod-only` | yes | **no** | **no** | `bucket (public=true, size_limit=5242880, mime_allowlist=none)` | — | exists in production but no migration creates it, and supabase/config.toml's [storage.buckets.*] block is entirely commented out — the bucket exists only because someone made it in the dashboard; types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal |
| `banners` | `prod-only` | yes | **no** | **no** | `bucket (public=true, size_limit=8388608, mime_allowlist=3 types)` | — | exists in production but no migration creates it, and supabase/config.toml's [storage.buckets.*] block is entirely commented out — the bucket exists only because someone made it in the dashboard; types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal |
| `club-logos` | `prod-only` | yes | **no** | **no** | `bucket (public=true, size_limit=none, mime_allowlist=none)` | — | exists in production but no migration creates it, and supabase/config.toml's [storage.buckets.*] block is entirely commented out — the bucket exists only because someone made it in the dashboard; types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal |

### `user_engagement_summary`

12 of 12 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `created_at` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `favorite_clubs` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `favorite_tags` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `last_active_at` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `total_calendar_adds` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `total_clicks` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `total_saves` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `total_shares` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `total_views` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `updated_at` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| `user_id` | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | declared by 005_user_engagement.sql but absent from production |
| _(whole table)_ | `migrations-only` | **no** | yes <sub>005_user_engagement.sql</sub> | **no** | — | — | CREATE TABLE appears in 005_user_engagement.sql but the table is absent from production |

### `users`

11 of 24 rows drift.

| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |
|---|---|:-:|:-:|:-:|---|---|---|
| `ban_expires_at` | `prod-only` | yes | **no** | yes | `timestamp with time zone` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `ban_reason` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `banned_at` | `prod-only` | yes | **no** | yes | `timestamp with time zone` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `banned_by` | `prod-only` | yes | **no** | yes | `uuid` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `banner_url` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `full_name` | `migrations-only` | **no** | yes <sub>001_initial_schema.sql</sub> | **no** | — | — | declared by 001_initial_schema.sql but absent from production |
| `is_admin` | `migrations-only` | **no** | yes <sub>008b_add_is_admin_to_users.sql</sub> | **no** | — | — | declared by 008b_add_is_admin_to_users.sql but absent from production |
| `name` | `prod-only` | yes | **no** | yes | `text` | `string \| null` | exists in production but no migration file declares it — created out of band |
| `pinned_contracts` | `prod-only` | yes | **no** | yes | `ARRAY (_text)` | `string[] \| null` | exists in production but no migration file declares it — created out of band |
| `saved_events_count` | `prod-only` | yes | **no** | yes | `integer` | `number` | exists in production but no migration file declares it — created out of band |
| `total_habits_completed` | `prod-only` | yes | **no** | yes | `integer` | `number \| null` | exists in production but no migration file declares it — created out of band |

## Reproducing this table

```bash
node .planning/audit/tools/gen-drift-table.mjs
node .planning/audit/tools/validate.mjs --check drift
bash .planning/audit/tools/readonly-guard.sh
```

The generator is idempotent: two consecutive runs leave `drift.json` byte-identical. It reads
no environment variable, opens no network connection, and writes only the two files under
`.planning/audit/schema/`.

---

*Phase: 01-read-only-foundation-audit*
*Plan: 01-08*
