# Recovered history — the March 2026 out-of-band burst

**Plan:** 03-04 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

**These 18 files are not migrations and must never become migrations.** They are a transcript of SQL
that production *already ran*, recovered from production's own history table so that the record is
not lost when the baseline replaces it.

## What they are

Production's `supabase_migrations.schema_migrations` holds 45 rows. The 44 files in the parent
directory collapse to 39 distinct versions. The two sets overlap in 27. **Eighteen versions are
applied in production with no file in this repository at all** — schema changes made out of band,
almost all of them in a single burst between 7 and 24 March 2026, applied through the dashboard
rather than through the CLI.

Plan 03-01 asked whether those 18 were recoverable (Open Question Q1) and measured the answer as
**yes**: all 18 rows carry a populated `statements` column, with names and full SQL. `statements` is
null for ten *other* rows — the oldest ones, applied before the column existed — but none of those
ten is remote-only, so the one population gap in the table does not overlap the set that matters.
That measurement is in `.planning/phases/03-…/evidence/q1-migration-recovery-decision.md`.

These files are the contents of that column, written out one file per version.

## How the set was derived

Not transcribed. Each archived filename carries its version as its leading digits; that set was
subtracted from the 45 versions in production's history, leaving 18. The result reproduced plan
03-01's list exactly, version for version, by an independent route:

```
archived_files=44  distinct_local_versions=39
prod_history_rows=45  remote_only=18
written=18  skipped_empty_statements=0
```

Source: `.planning/phases/03-…/evidence/migration-history.prod.json`, captured through
`sql-readonly.mjs` with `read_only: true` enforced server-side.

## Why the `.sql.recovered` suffix

The Supabase CLI reads `*.sql` at the top level of `supabase/migrations/`. These files are two
directories below that and would be invisible to it regardless — but the suffix is belt and braces.
If one of these files were ever moved to the top level by accident, it still would not be read as a
migration. **A name that cannot be mistaken for a migration is worth more than a rule written in a
README that someone has to remember to read.**

Each file also carries a one-line header naming its version and stating what it is.

## The rule, which is the parent directory's rule

**Content that is still needed is RE-ISSUED as a new post-baseline migration. Nothing here is ever
moved to the top level.** See `../README.md`.

There is a specific reason not to reach for these: **the baseline already contains their effects.**
The baseline is a dump of production's live schema, and these 18 versions are applied in production —
so whatever they did is already in the baseline as real DDL. Replaying them would at best be a no-op
and at worst a conflict. `20260316101601_fk_indexes_and_cleanup` is the worked example: plan 03-04
confirmed all nine of its indexes are present in the baseline and that `events_tests` is absent, so
re-issuing it would do nothing at all.

These files exist to answer *"why does production have this column?"* — not to be run.

## What they are not evidence of

They are the statements as production recorded them. They are **not** proof that production's schema
is what they describe — the baseline dump is that, and it is the authority. Where the two disagree,
the dump is right and this directory is stale.
