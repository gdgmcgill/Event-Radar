# AUDIT-19 — Which date columns does the production `events` table actually have?

**Requirement:** AUDIT-19
**Plan:** 01-06
**Date:** 2026-09-14
**Status:** ANSWERED — negative finding

---

## The question

`.planning/codebase/CONCERNS.md` § Fragile Areas records an "Event data model dual-schema
(`start_date`/`end_date` vs `event_date`/`event_time`)" concern: the repository carries two
competing date schemas for the same table, with fallback logic of the form
`event.start_date ?? event.event_date`, which "suggests a schema migration that was not fully
completed." Its own safe-modification note says the fix begins by **verifying which columns the
production DB actually uses**. That verification is this artifact.

The question has exactly one authority: `information_schema.columns` on the production database.
Nothing in the repository can answer it, because the repository is the artifact under suspicion.

---

## Method and provenance

The answer comes from the live production catalog, not from any file in this repository.

| | |
|---|---|
| Project | `universe-events` (production) — the only project visible to the operator's token; no staging project exists under this account |
| Transport | Supabase MCP server (Management API `execute_sql`), SELECT-only |
| Role | `postgres` |
| Server | PostgreSQL 17.6 |
| Captured | 2026-09-14T18:25:10Z (census) / 2026-09-14T18:33:02Z (targeted date query) |
| Raw envelope | `.planning/audit/raw/prod/events-date-columns.json` |
| Full census | `.planning/audit/raw/prod/information-schema-columns.json` → transformed to `.planning/audit/schema/information-schema-columns.json` |

The targeted query, verbatim from the raw envelope's `query` field:

```sql
select column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name = 'events'
  and (column_name ilike '%date%' or column_name ilike '%time%' or column_name ilike '%_at')
order by ordinal_position
```

The `ilike '%date%' or ilike '%time%'` predicate is deliberately wider than the two candidate
names. A query that asked only for `event_date` and `event_time` and returned nothing could not
distinguish "the columns are absent" from "the query was wrong." This one returns every
date-shaped or time-shaped column on the table, so the absence of `event_date` and `event_time`
from a five-row result set is a positive observation rather than an empty one.

The same absence is independently confirmed against the full 243-row public-schema census in
`.planning/audit/schema/information-schema-columns.json`: **no column named `event_date` or
`event_time` exists on any of the 30 tables in the production `public` schema**, not just on
`events`.

---

## What production actually has

All five date/time columns on `public.events`, as returned:

| # | Column | Data type | Nullable | Default |
|---|---|---|---|---|
| 4 | `start_date` | `timestamp with time zone` (`timestamptz`) | **NO** | — |
| 5 | `end_date` | `timestamp with time zone` (`timestamptz`) | **NO** | — |
| 12 | `created_at` | `timestamp with time zone` (`timestamptz`) | YES | `now()` |
| 13 | `updated_at` | `timestamp with time zone` (`timestamptz`) | YES | `now()` |
| 21 | `deleted_at` | `timestamp with time zone` (`timestamptz`) | YES | — |

`public.events` has 25 columns in total; the other 20 carry no date or time semantics. The full
ordered list is in `.planning/audit/schema/information-schema-columns.json`.

Two properties worth carrying forward into Stage 3:

- `start_date` and `end_date` are both `NOT NULL`. Any write path that omits either one fails at
  the database, not in application validation.
- Every date column is `timestamptz`, not `date` + `time`. There is no column that could hold a
  bare calendar date, which is what a name like `event_date` implies.

---

## Verdict

> **The older `event_date` / `event_time` pair does not exist in production.**
>
> **The authoritative event scheduling columns on `public.events` are `start_date` and
> `end_date`, both `timestamp with time zone`, both `NOT NULL`.** `created_at`, `updated_at`,
> and `deleted_at` are lifecycle timestamps, not scheduling columns, and are not part of the
> answer to this question.

The concern recorded in `CONCERNS.md` is **resolved in the database as well as in the code**.
This is the negative-finding branch of the two verdicts AUDIT-19 could have produced: there is
no dead-column finding to scope, because there is no dead column. The migration that removed the
pair completed; it is the surrounding artifacts that did not keep up.

Corroborating (not evidentiary) observations:

- `supabase/migrations/` — all 44 files — contains **zero** references to `event_date` or
  `event_time`. The pair is not merely unused; it is not created anywhere in the tracked
  migration history.
- `src/app/api/events/[id]/analytics/route.ts:29` and
  `src/app/api/clubs/[id]/analytics/route.ts:89,91` select and order by `start_date`. The
  fallback expression `event.start_date ?? event.event_date` that `CONCERNS.md:107` cites at
  `src/app/api/events/route.ts` lines 11-27 and 224-226 **is no longer present** in that file;
  its `EventRow` type now declares `start_date` / `end_date` only. `CONCERNS.md` is stale on
  this point and should be corrected when the concerns document is next revised.

---

## The types file was treated as the artifact under suspicion, not as evidence

`src/lib/supabase/types.ts` is a generated file whose freshness is exactly what this phase does
not assume. It was therefore never consulted to *derive* this answer — it was compared against
the census *afterwards*, as a drift measurement.

Result of that comparison: the `events` `Row` type declares **25** properties; production has
**25** columns; the two sets are identical, with no property typed that production lacks and no
column in production that the types file omits. `event_date` and `event_time` appear nowhere in
the events section of the types file.

That agreement is a useful signal for AUDIT-02, but it is not what makes the verdict above true.
Had the types file disagreed with the census, the census would still have been the answer. The
ordering matters: catalog first, generated artifact second.

---

## Consequence — five stale references to a schema that does not exist

The columns are gone from the database and from the application source. They survive in test
fixtures and comments, which is worse than harmless: a fixture that describes a nonexistent
schema cannot catch a regression in the real one.

| # | Path | Line(s) | What it says | Why it is stale |
|---|---|---|---|---|
| 1 | `src/hooks/useEvents.test.ts` | 17, 18 | `event_date: date, event_time: "18:00"` inside a `createMockEvent(): Event` factory | `src/types/index.ts` `Event` declares neither property. This is an excess-property assignment to a typed object literal and would be a TypeScript error — it is not caught because `*.test.ts` is excluded from the main `tsconfig.json`. Compounding this, **every test in the file is skipped**: the file's own header records that `@testing-library/react` is not installed and the imports are fakes. The fixture is unreachable *and* wrong. |
| 2 | `src/__tests__/api/clubs/analytics.test.ts` | 166, 167, 168 | three mock events keyed on `event_date` | The route under test selects `"id, title, start_date, tags"` and orders by `start_date` (`src/app/api/clubs/[id]/analytics/route.ts:89,91`). The mock supplies a column the route never reads and omits the one it does, so `start_date` is `undefined` throughout. The test passes only because its assertions are confined to `popular_tags`. |
| 3 | `src/__tests__/api/events/analytics.test.ts` | 95, 112, 140 | mock event rows keyed on `event_date` | The route selects `"id, title, start_date, club_id"` and returns `start_date: event.start_date` (`src/app/api/events/[id]/analytics/route.ts:29,99`). Same defect: the mock's `start_date` is `undefined` and the assertions do not look at it. |
| 4 | `src/lib/tagMapping.ts` | 98 | comment: "Passes through start_date/end_date directly (no more event_date/event_time split)" | Accurate but archaeological. It is now the only in-source description of a schema that the database has never had in its tracked history, and it keeps the dead names searchable. |
| 5 | `supabase/functions/events-webhook/index.ts` | 99 | comment: "Matches the actual schema: start_date, end_date, category, organizer (no club_id, event_date, event_time, status)" | The parenthetical is wrong twice over against this census: production `events` **does** have `club_id` (ordinal 16) and **does** have `status` (ordinal 14, `NOT NULL`, default `'pending'`). Only the `event_date` / `event_time` half of the claim holds. |

Items 2 and 3 are the substantive ones. They are not cosmetic: each is a test that mocks a
database row in a shape the database cannot produce, which is precisely the failure mode
`CONCERNS.md:109` predicted — *"Tests mock the data, so they cannot catch column-name mismatches
with the real DB."* This census is the ground truth those fixtures should be rewritten against.

Item 5 is a second, independent finding candidate: an edge-function comment asserting two
columns are absent that this census proves are present.

**Nothing above is fixed by this plan.** This phase is read-only; these are recorded as finding
candidates for the Stage 3 event-read-path and test-fixture slices, and as inputs to AUDIT-02's
drift table (plan 01-08).

---

## Scope — what this artifact does not settle

- **Staging.** No staging project is reachable (see `.planning/audit/schema/staging.schema.sql`).
  This verdict is production-only. If a staging database exists and still carries the pair, that
  is a separate finding and this file does not contradict it.
- **Local.** The local database could not be built — the migration replay aborts at the 12th of
  44 migrations (`.planning/audit/schema/local-reset.txt`). No local comparison was possible.
- **Column-level drift beyond `events`.** AUDIT-02 (plan 01-08) consumes
  `.planning/audit/schema/information-schema-columns.json` to build the full drift table across
  all 30 tables. This file answers one question about one table.

---

*Evidence: `.planning/audit/schema/information-schema-columns.json` (243 rows, 30 tables),*
*`.planning/audit/raw/prod/events-date-columns.json` (5 rows),*
*`.planning/audit/raw/prod/MANIFEST.json` (capture provenance).*
*Phase: 01-read-only-foundation-audit — Plan: 01-06*
