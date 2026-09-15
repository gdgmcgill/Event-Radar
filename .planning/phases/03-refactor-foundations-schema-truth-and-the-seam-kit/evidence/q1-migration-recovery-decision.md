# Q1 — Are the 18 remote-only migrations recoverable?

**Answer: YES. All 18, with names and full SQL. Measured, not inferred.**

**Plan:** 03-01 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15T21:04:10Z

---

## The question, as 03-RESEARCH.md § Open Questions Q1 posed it

> Whether `statements` is populated for dashboard-editor runs. If it is, the March burst is
> fully explainable and the 18 files can be written back verbatim at their original versions.

Phase 1 could not answer it. It read the history through the Management API's `list_migrations`
endpoint, which returns **only `version`** — a management endpoint, not a read of the table's
full row. This plan read the table itself.

## How it was read

One named query, `migration-history`, added to the registry in
`.planning/audit/tools/sql-readonly.mjs` and run through that tool, whose `read_only: true`
is enforced server-side by the Management API and is outside the client's reach — AR-12
clause 2 **by construction**, the strongest row in 03-RESEARCH.md's mandated transport table.

`supabase migration fetch --linked` was **not** run (Pitfall 10). Neither was `supabase link`:
`supabase/.temp/` contains only `cli-latest` and `start-secrets`, both written by
`supabase start`, and no `project-ref` file. The AR-12 envelope was captured **15 seconds
before** this read, not after it, and reads `txn_read_only: "on"` with
`role: supabase_read_only_user` — see `evidence/transport-identity.03-01.json`.

Raw result: `evidence/migration-history.prod.json`.

## The measurement

**45 rows returned** — exactly the production count 03-RESEARCH.md § Migration State Table
derived independently in Phase 1. The table has three columns: `version`, `name`, `statements`.

### The 18 remote-only versions — every one populated

| Version | `name` | `statements` |
|---|---|---|
| 20260307000001 | `events_query_performance_indexes` | populated — 10 stmts, 3100 chars |
| 20260315041343 | `add_club_social_links_and_featured_clubs` | populated — 1 stmt, 878 chars |
| 20260315045155 | `add_club_banner_url` | populated — 1 stmt, 59 chars |
| 20260315103436 | `add_contact_email_to_clubs` | populated — 1 stmt, 62 chars |
| 20260315231016 | `moderation_reviews` | populated — 1 stmt, 2236 chars |
| 20260316002951 | `soft_delete` | populated — 1 stmt, 171 chars |
| 20260316034955 | `add_banner_url_to_users` | populated — 1 stmt, 52 chars |
| 20260316042746 | `add_event_pricing_and_rsvp_link` | populated — 1 stmt, 394 chars |
| 20260316050743 | `add_pending_edits_to_events` | populated — 1 stmt, 266 chars |
| 20260316051022 | `create_event_reports` | populated — 1 stmt, 1757 chars |
| 20260316061922 | `admin_enforcement_ban_fields` | populated — 1 stmt, 510 chars |
| 20260316090343 | `pre_release_fixes` | populated — 1 stmt, 4775 chars |
| 20260316091121 | `add_experiment_variant_id_to_feedback` | populated — 1 stmt, 322 chars |
| 20260316091643 | `feedback_request_log` | populated — 1 stmt, 1057 chars |
| 20260316093431 | `create_feedback_table` | populated — 1 stmt, 1391 chars |
| 20260316094048 | `send_feedback_requests_function` | populated — 1 stmt, 1928 chars |
| 20260316101601 | `fk_indexes_and_cleanup` | populated — 1 stmt, 1278 chars |
| 20260324061310 | `create_reviews_table` | populated — 1 stmt, 1444 chars |

**18 of 18 found in the history. 18 of 18 with `statements` populated. 0 empty. 0 null.**
And `name` is populated for all 18 — 03-RESEARCH.md § The 18 remote-only versions described
them as "all bare timestamps with **no recorded name**", which was an artifact of
`list_migrations` returning only `version`. The names exist. That correction is worth as much
as the SQL: the burst is now readable as a changelog.

### Where the nulls actually are

Ten rows do have `statements = null` — and they are **not** the remote-only ones. They are
versions `001` through `010`, the earliest legacy migrations, whose `name` is null too. The
`statements` column was introduced after they were applied. So the one population gap in the
whole history sits precisely on the files the repository **does** have, and the rows the
repository lacks are fully recorded. The inverse of what the phase feared.

## The consequence — stated once, unambiguously

**D-01's baseline-by-archive strategy is UNCHANGED, and would have been unchanged had the
answer been no.** The baseline captures production's *effect* from the catalog; it never
depended on replaying these 18. A positive answer adds documentation value and nothing more.
Nothing on the critical path moves. Plan 03-04 proceeds exactly as written.

### The one optional, additive task this unlocks for 03-04

Because `statements` is populated, 03-04 **may** write the recovered SQL into
`supabase/migrations/_archive_pre_baseline/recovered/` as documentation of the March 2026
out-of-band burst. If taken, it is constrained absolutely:

- It is **documentation, not history.** The files are inert and the CLI must never read them —
  they live under `_archive_pre_baseline/`, below the top level the CLI scans.
- **It must not alter the baseline.** The baseline is generated from the production catalog
  and is not touched by this.
- It must not reintroduce a filename the CLI would try to parse at the top level.
- Skipping it fails nothing. It is a nice-to-have.

## Three things this read settled that Q1 did not ask

Recorded because they are cheap to state now and expensive to rediscover in 03-04/03-05.

**1. Thirteen of the 18 have no local file at all.** Cross-referencing the 12 local-only files
against the 18 remote-only rows by name: only **5** pair up
(`moderation_reviews` → 20260315231016, `soft_delete` → 20260316002951,
`feedback_request_log` → 20260316091643, `event_reports` → 20260316051022,
`fk_indexes_and_cleanup` → 20260316101601). The other **13** — including
`events_query_performance_indexes` (10 statements), `pre_release_fixes` (4775 chars),
`add_pending_edits_to_events`, `admin_enforcement_ban_fields` and the whole club-profile
column family — exist in production and **nowhere in this repository**. This is the strongest
argument yet for baselining from production rather than from the folder: the folder is not a
lossy record of production, it is missing thirteen whole migrations.

**2. REFAC-02's starting point is already live, and the research's recommendation for it is a
no-op.** 03-RESEARCH.md recommends re-issuing local file #44
(`20260316000004_fk_indexes_and_cleanup.sql`) as new post-baseline work. Measured: production
version `20260316101601` and that local file declare the **same 9 index names**
(`idx_club_invitations_inviter_id`, `idx_event_reports_reviewed_by`, `idx_featured_clubs_club_id`,
`idx_featured_clubs_created_by`, `idx_featured_events_created_by`, `idx_feedback_user_id`,
`idx_notifications_club_id`, `idx_organizer_requests_reviewed_by`, `idx_users_banned_by`) and
both carry one `DROP TABLE ... events_tests`. The name sets are identical. **The baseline will
already contain all nine indexes and will already lack `events_tests`**, so re-issuing #44
would add nothing. 03-05 should verify this against the generated baseline and, if confirmed,
record REFAC-02's index work as *already satisfied by the baseline* rather than writing a
migration that does nothing. **This plan changes nothing about it — it only measures it.**

**3. F-042 is confirmed harder than stated: `cron.schedule` appears in 0 of the 45 history
rows.** The three live pg_cron jobs have no trace anywhere in production's migration history.
The repository's only trace remains the commented-out line in local file #38
(`20260313000002_recommendation_engine.sql`). REFAC-03 must author the schedule migration from
the live catalog, not recover it — there is nothing to recover. Consistent with the research;
now measured across the full history rather than assumed.

Also measured, for the baseline review checklist in 03-RESEARCH.md § Pattern 1:
`user_engagement_summary` appears in **0 of 45** history rows, confirming F-048 — it is
declared only by local migration #5, was never applied to production, and the baseline will
correctly not contain it.

## Credential hygiene

`scrub()` ran inside `sql-readonly.mjs` before anything reached disk. The independent
post-write sweep over both new JSON captures for `eyJ…`, `sbp_`, `sb_secret_`,
`postgres(ql)://`, `bearer`, cookie shapes and the literal production project ref returns
**0 for every pattern in every file**. The project ref is `<PROD-PROJECT-REF>` throughout, per
`.planning/audit/REDACTION.md`. No value from `.env.local` was read, printed or written;
`.env.local` was not opened.
