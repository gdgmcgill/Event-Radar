# AUDIT-05 — Row-Level Security Review

**Phase:** 01-read-only-foundation-audit · **Plan:** 01-09 · **Written:** 2026-09-14
**Requirement:** AUDIT-05 — *review every policy on every table for every command and role, from live `pg_policies`, not from migration files*

**Source of every claim below:** `.planning/audit/rls/pg_policies.json` (101 policies),
`.planning/audit/rls/rls-enabled.json` (38 relations), `.planning/audit/rls/policy-column-indexes.json`
(80 columns), `.planning/audit/rls/rls-flags.json` (94 flags). Those four files are derived from the
committed production capture envelopes under `.planning/audit/raw/prod/`, which record the executed
SQL in their `query` field.

> **Nothing in this review was read from `supabase/migrations/`.** Section 6 is the only place
> migration files appear, and there they are the *subject* of the comparison, not the evidence.

---

## 0. How to read this, and what it is not

**The finding of this review is not any single policy. It is the structure the policies sit in.**

Three facts, established from the capture, have to be held together before any individual policy
means anything:

1. **Every one of the 30 public tables, and `storage.objects` and `storage.buckets`, grants
   `SELECT, INSERT, UPDATE, DELETE` to both `anon` and `authenticated`**
   (`raw/prod/grants.json`, 143 rows; summarised per table in `rls-enabled.json` →
   `grants_dml`). This is the Supabase default and it is not, by itself, a defect — but it means
   **row-level security is the only thing standing between the publishable key and every row in the
   database.** There is no second control at the table-privilege layer. A policy that is too wide is
   not "wide within a fence"; there is no fence.
2. **Row security is enabled on all 38 relations** — see § 1. The wide-open failure mode is absent.
3. **`service_role` carries `BYPASSRLS`.** Every policy in this review is irrelevant to the 25
   registered service-role callsites (`.planning/audit/authz/service-role-register.json`). Where a
   handler uses the service client, RLS is *not* the control — the handler's own `verifyAdmin()` /
   `requireClubRole()` check is. This review therefore says, per table, **which handlers rely on RLS
   and which bypass it**, because a gap that only service-role handlers touch is a latent risk, and
   a gap on a table that cookie-client handlers read is a live one.

**This is a static review.** No policy was *evaluated*: no query was issued as `anon` or as
`authenticated`, because that would have required a session token this phase deliberately does not
hold. Every `allow` / `deny` conclusion here and in `rls-heatmap.csv` is derived from the catalog —
from which policy exists, for which command, naming which roles — not from an observed response.
Stage 4's pgTAP matrix is what converts these conclusions into executed assertions. Where a
conclusion depends on a runtime value (`auth.uid()` being `NULL` for `anon`, `auth.role()`
returning a literal), that dependence is stated rather than hidden.

**Nothing here is a fix.** Every item carries a *recommendation* and a *proposed severity*. Fixing
is Stage 3 (REFAC-01 and the authorization slice); changing a policy in this phase would violate the
read-only invariant.

### Derivation and provenance

The plan specified four live captures through `tools/sql-readonly.mjs`. That transport was replaced
before this plan ran — see `01-06-SUMMARY.md`: production was read **once**, SELECT-only, through
the Supabase MCP server (Management API) as role `postgres`, and every read was committed as an
envelope under `raw/prod/`. This plan issued no SQL and opened no socket; it reshaped those
envelopes. The reshaping is recorded here so the artifacts are reproducible from the committed raw
capture without a credential:

| Artifact | Built from | Transform |
|---|---|---|
| `rls/pg_policies.json` | `raw/prod/pg-policies.json` (101 rows) | `roles` parsed from the Postgres array literal into a JSON array; `has_to_clause` = *not* (`roles` is exactly `{public}`); `commands` = `[cmd]`, or the four DML commands when `cmd = ALL`; `qual_is_unconditional_true` / `with_check_is_unconditional_true` = the expression matches `/^\(*\s*true\s*\)*$/i`; `applies_to_anon` / `applies_to_authenticated` = the role list names the role **or** names `public`. Re-sorted by schema, table, command, policy name. Each row carries `captured_at`, `transport`, `source`, `source_query`. |
| `rls/rls-enabled.json` | `raw/prod/tables.json`, joined to `pg-policies.json`, `grants.json`, `row-counts.json` | One row per `public` / `storage` relation (`cron` excluded — see `redaction/01-09.md` § 5). `rls_enabled` = `pg_class.relrowsecurity`, `rls_forced` = `relforcerowsecurity`, `policy_count` = policies on that `schema.table`, `grants_dml` = the DML subset of `role_table_grants` per grantee. |
| `rls/policy-column-indexes.json` | `pg-policies.json`, `indexes.json`, `information-schema-columns.json` | Candidate columns = the five identity columns (`id`, `user_id`, `club_id`, `event_id`, `owner_id`) present on the table, **plus** any declared column whose bare name matches inside that table's own `qual` / `with_check`, **plus** any `<table>.<column>` reference reaching another table from inside an `EXISTS` subquery. `indexed` = some `pg_indexes` entry for the table names the column in its key list. `null` where the index census does not cover the schema (`storage`). The heuristic and its limits are recorded per row in the `detection` field. |
| `rls/rls-flags.json` | all of the above | Mechanical detection per flag class; `severity_proposed` and `rationale` are hand-assigned per item and are the judgement this review defends. |

---

## 1. Tables with row-level security disabled

**Count: zero. There is no RLS-disabled table in production.**

`rls-enabled.json` has 38 rows and `rls_enabled` is `true` on every one of them —
all 30 `public` tables and all 8 `storage` tables. `rls-flags.json` contains **no flag of class
`rls-disabled`**. The class is reported empty deliberately rather than omitted: an absent section
reads as an unasked question, and this is the one flag class whose emptiness is load-bearing.

This matters more than it first appears. Given § 0 fact 1 — `anon` holds all four DML privileges on
every public table — **a single RLS-disabled table would have been an unauthenticated read/write of
that table's entire contents through the publishable key.** `011_rls_audit.sql` records that this
was once true of `notifications` ("Gap: RLS was never enabled; zero policies existed. Any
authenticated user could read all users' notifications directly via the PostgREST endpoint"). That
gap is closed in production: `notifications` reports `rls_enabled: true` with 3 policies.

**A caveat that keeps this from being a clean pass.** `relforcerowsecurity` is `false` on all 38
relations (`rls-enabled.json` → `rls_forced`). Without `FORCE ROW LEVEL SECURITY`, policies are not
applied to the **table's owner**. The owner of these tables is `postgres`, which also carries
`BYPASSRLS`, so this changes nothing today — but it means any future database function or job that
runs as the table owner silently sees every row, and it is why a `SECURITY DEFINER` function owned by
`postgres` is a policy bypass by construction. Two such functions are called from inside policy
predicates; see § 4.

**Severity: Informational (no finding).** **Recommendation:** none required. Add
`ALTER TABLE … FORCE ROW LEVEL SECURITY` to the Stage 3 hardening list for the tables whose
maintenance runs through owner-executed functions, and make "row security is enabled and forced"
a pgTAP assertion in Stage 4 so a future `ALTER TABLE … DISABLE ROW LEVEL SECURITY` from the
dashboard fails the suite rather than shipping.

---

## 2. Tables with row-level security enabled and no policy

**Count: 7 relations, all in the `storage` schema. Zero in `public`.**

Row security enabled with `policy_count: 0` is deny-all: **every access is denied for every role
that does not bypass RLS**, which in practice surfaces as an unexplained empty list in the UI rather
than as an error. Evidence: `rls-enabled.json`, rows where `rls_enabled: true` and
`policy_count: 0`; flags of class `rls-enabled-no-policy` in `rls-flags.json`.

| Relation | `policy_count` | `anon` DML grant | Handlers relying on RLS | Handlers bypassing RLS | Proposed severity |
|---|---|---|---|---|---|
| `storage.buckets` | 0 | `DELETE,INSERT,SELECT,UPDATE` | none | Storage API (as `service_role`) | Informational |
| `storage.migrations` | 0 | `DELETE,INSERT,SELECT,UPDATE` | none | Storage API | Informational |
| `storage.s3_multipart_uploads` | 0 | `SELECT` | none | Storage API | Informational |
| `storage.s3_multipart_uploads_parts` | 0 | `SELECT` | none | Storage API | Informational |
| `storage.buckets_analytics` | 0 | `SELECT` | none | Storage API | Informational |
| `storage.buckets_vectors` | 0 | `SELECT` | none | Storage API | Informational |
| `storage.vector_indexes` | 0 | `SELECT` | none | Storage API | Informational |

**All seven are Supabase-managed internal tables, and deny-all is the intended posture for them.**
The Storage REST API reaches them as `service_role`, which bypasses RLS, so the zero policy count
masks nothing: no application handler reads any of the seven directly (cross-referenced against
`inventory/endpoints.json` → `signals.tables_referenced`, whose 32 distinct table names include no
`storage.*` relation; the two storage-shaped entries, `avatars` and `banners`, are **bucket** names
appearing in `.from()`-adjacent string positions, not tables).

`storage.buckets` deserves one sentence more than the others. It grants `anon` all four DML
privileges and has no policy, so it is deny-all to the publishable key — correct — but it is
*only* the absence of a policy holding that line. A single permissive policy added to
`storage.buckets` from the dashboard would expose the bucket inventory, and `protect_buckets_delete`
(a `BEFORE DELETE … FOR EACH STATEMENT` trigger) is the only other guard on it.

**No `public` table is in this class.** Every one of the 30 has at least one policy; the minimum is
1 (`experiments`, `experiment_variants`). That a table has a policy is not evidence it has the
*right* policies — `experiments` has exactly one policy, an admin-only `ALL`, which means the
`/api/recommendations` handler reading `experiments` on the cookie client (`[rls]`, per
`inventory/endpoints.json`) sees **zero rows for every non-admin caller**. That is a deny-by-omission
of the same family as this section, differing only in that it applies per command rather than per
table; § 4 and the heatmap are where it is enumerated.

**Severity: Informational** for all seven. **Recommendation:** assert the deny-all in Stage 4 rather
than changing it — a pgTAP test that `anon` and `authenticated` get zero rows from
`storage.buckets` converts an implicit posture into a defended one.

---

## 3. Policies whose USING expression is the unconditional true literal

**Count: 12 policies with `USING (true)`, plus 9 with `WITH CHECK (true)` — 21 unconditional
expressions across 101 policies.**

`USING (true)` is the read-side flag the requirement names. Its write-side twin, `WITH CHECK (true)`,
is captured in the same pass as flag class `with-check-true` and reviewed here alongside it,
because **the write-side instances are where the serious findings are** and a review that reported
only the read side would have missed all three Criticals below.

Evidence for every row: `rls-flags.json`, classes `using-true` and `with-check-true`, each quoting
the expression verbatim from `pg_policies.json`.

### 3a. Accidental wide grants — write side

| Table | Policy | Cmd | Roles | Expression | Severity |
|---|---|---|---|---|---|
| `admin_audit_log` | `Admins can insert audit log` | INSERT | `{public}` | `WITH CHECK (true)` | **Critical** |
| `admin_audit_log` | `Service role can insert audit log` | INSERT | `{public}` | `WITH CHECK (true)` | **Critical** |
| `events` | `Authenticated users can insert events` | INSERT | `{authenticated}` | `WITH CHECK (true)` | **High** |
| `user_interactions` | `Anyone can insert interactions` | INSERT | `{public}` | `WITH CHECK (true)` | **High** |
| `feedback` | `Users can insert feedback` | INSERT | `{authenticated}` | `WITH CHECK (true)` | Low |

**`admin_audit_log` — both INSERT policies are unconditional, and both name `{public}`.** The policy
named *"Admins can insert audit log"* performs no admin check of any kind; the name asserts a control
the expression does not implement. Because the role list is the catch-all, this reaches `anon`, and
`anon` holds `INSERT` on the table. **An unauthenticated caller holding only the publishable key can
write arbitrary rows into the moderation audit log** — forging an approval attributed to a real
admin, or flooding the table to bury a real entry. The table is the project's only record of who
moderated what; `/api/admin/audit-log` reads it on the **cookie client** (`[rls]`), so reads are
correctly admin-gated by the third policy (`Admins can read audit log`, an `EXISTS` over
`users.roles`) while writes are not gated at all. Two service-role writers exist
(`/api/clubs/[id]`, `/api/clubs/[id]/transfer`) and they bypass RLS, so **neither policy is needed
for the application to work** — they grant only what an attacker wants. Current volume is 0 rows
(`rls-enabled.json` → `approx_rows`), which bounds the *damage done*, not the *exposure*.
**Recommendation:** drop both; the legitimate writers already bypass RLS. If a policy is wanted for
defence in depth, `TO authenticated … WITH CHECK (public.is_admin())`.

**`events` — `WITH CHECK (true)` on INSERT means the moderation pipeline is client-bypassable.**
The plan-level flow is `pending → approved | rejected`. `events.status` has no default constraint
and no `CHECK` (`raw/prod/constraints.json` lists only the primary key and foreign keys for
`events`), and this policy imposes no predicate at all — so any signed-in McGill user can `POST` a
row directly to PostgREST with `status: 'approved'` **and** `created_by` set to another user's id.
The complementary read policy `Approved events are viewable by everyone` then publishes it to
anonymous visitors. 229 rows today, 32 RLS-reliant handlers and 7 service-role handlers touch this
table — the widest surface in the schema. **Recommendation:** `WITH CHECK ((select auth.uid()) =
created_by AND status = 'pending')`, and move the status transition behind the admin policy that
already exists for UPDATE.

**`user_interactions` — `WITH CHECK (true)` with `{public}`, on a table with an `AFTER INSERT`
trigger.** `interaction_popularity_trigger` fires `recalculate_on_interaction()` →
`update_event_popularity()` on every inserted row. An anonymous caller can therefore both (a) attribute
an interaction to **any** `user_id`, poisoning that user's `inferred_tags` and recommendation feed
via `compute_user_scores()`, and (b) drive unbounded recomputation of `event_popularity_scores`.
This is also the clearest case of § 6's drift: migration `006_tracking_rls_policies.sql` declares
**two** policies here — `Users can insert their own interactions` (`TO authenticated`,
`WITH CHECK (auth.uid() = user_id OR user_id IS NULL)`) and `Anonymous users can insert
interactions` (`TO anon`, `WITH CHECK (user_id IS NULL)`) — and **neither exists in production**.
They were replaced out of band by one strictly weaker policy. The repository says this table is
safe; the database says it is not. **Recommendation:** restore the two migration-declared policies.

**`feedback`** — `WITH CHECK (true)` but `TO authenticated`, so a signed-in user may file feedback
attributed to another user. Bounded by the authenticated ring and by the table's low value.
**Low. Recommendation:** `WITH CHECK ((select auth.uid()) = user_id)`.

### 3b. Accidental wide grants — read side

| Table | Policy | Cmd | Roles | Rows | Severity |
|---|---|---|---|---|---|
| `rsvps` | `Anyone can view rsvps` | SELECT | `{public}` | 10 | **High** |
| `user_follows` | `Anyone can view follows` | SELECT | `{public}` | 24 | Medium |
| `club_followers` | `Anyone can view follower data` | SELECT | `{public}` | 2 | Medium |
| `reviews` | `Anyone can read reviews` | SELECT | `{public}` | 0 | Medium |

All four are `USING (true)` with the catch-all role, on tables where `anon` holds `SELECT`. All four
are therefore **bulk-enumerable by an unauthenticated caller through PostgREST**, not merely visible
through the UI that renders them.

**`rsvps` is the most consequential table in this review**, for three compounding reasons. (i)
`USING (true)` publishes the full attendance graph — every `(user_id, event_id, status)` triple —
to anonymous callers; RSVP status is `going | interested | cancelled`, so "who is interested in
which event" is world-readable. (ii) Six handlers read it on the cookie client and rely on this
policy, including `/api/events/[id]/analytics` and `/api/clubs/[id]/analytics`; only two bypass RLS.
(iii) **`rsvps` is declared by no migration.** Plan 01-08 recorded it as `prod-only` drift, and
`011_rls_audit.sql` confirms the author knew — its closing block reads
`-- rsvps (remote) — own CRUD ✓`, classifying a table it could not see as correct. All four of its
policies exist only in production (§ 6). A table that no migration declares, whose policies no
migration declares, that publishes attendance to anonymous callers, and that a review comment in
the repository certifies as fine, is the sharpest instance of the failure mode this whole phase
exists to surface. **Recommendation:** scope the read to the event owner, the club, and the RSVP'ing
user, then declare table and policies in a migration.

**`user_follows` and `club_followers`** expose the complete social graph and the complete
club-interest graph to `anon`. Both are Medium rather than High because the data is
semi-public by product intent and the volumes are small — but "semi-public through the UI" and
"bulk-downloadable by an unauthenticated script" are different exposures, and only the second is
what `USING (true)` grants. **Recommendation:** `TO authenticated` at minimum; ideally scope by the
`visibility` column that already exists on `users`.

**`reviews`** exposes `user_id` alongside review text, linking an opinion to an account for
anonymous readers. **Recommendation:** `TO authenticated`, or project the author through a view.

### 3c. Intentional public content — accepted, with one qualification each

| Table | Policy | Verdict |
|---|---|---|
| `clubs` | `Anyone can read clubs` | **Informational.** A public directory of campus clubs; `USING (true)` is the intent. **But** `clubs` carries a `status` column with the same `pending → approved` flow as `events`, and this policy ignores it — a pending or rejected club is publicly readable before approval. Qualify to `status = 'approved'`. |
| `featured_clubs` | `Anyone can view featured clubs` | **Informational.** Curated public content. Note the asymmetry with `featured_events`, whose read policy is correctly time-scoped (`starts_at <= now() AND ends_at > now()`) — `featured_clubs` publishes unpublished curation. |
| `event_popularity_scores` | `Allow public read access to event_popularity_scores` | **Low.** Derived aggregates; public read is defensible. |
| `event_popularity_scores` | `Anyone can view popularity scores` | **Low — this is an exact duplicate of the policy above.** Two `PERMISSIVE` `SELECT` policies with identical `USING (true)` on one table. Permissive policies are OR-ed, so the second grants nothing; both are still evaluated per row. Dead weight and a maintenance trap: dropping one appears to change nothing, which is exactly how the other survives a cleanup. |
| `storage.objects` | `Allow public read access 1oj01fe_0` | **Low**, and the name is wrong in the other direction — it is `TO authenticated`, not public. But it is `USING (true)` with no `bucket_id` and no folder predicate, so **any signed-in user can read every object in every bucket**, which makes the four bucket-scoped read policies beside it redundant. The generated suffix (`1oj01fe_0`) is the dashboard's naming convention and is itself evidence the policy was created out of band. Plan 01-10 owns the storage verdict; flagged here because `storage.objects` appears in the heatmap. |

### 3d. Inert by role — no action

Four `ALL` policies with `USING (true) WITH CHECK (true)` are scoped `TO service_role`:
`email_reminder_log :: Service role can manage reminder log`, `feedback :: Service role full
access`, `feedback_request_log :: Service role can manage feedback request log`, and
`notifications :: Service role can insert notifications` (INSERT). **`service_role` carries
`BYPASSRLS`, so these policies grant nothing that role does not already have.** They are
**Informational**: harmless, but they encode a misunderstanding of what `service_role` is, and that
misunderstanding has a non-harmless twin in § 4 — `tag_interaction_counts` and `user_event_scores`
attempt the same thing through a **predicate** (`auth.role() = 'service_role'`) attached to
`{public}`, which is a real role check in a place where a role clause belonged.

---

## 4. Policies with no `TO` clause

**Count: 61 of 101 policies — 60% of the policy set — have `roles = {public}`.**

A policy written without a `TO` clause is stored with `roles = {public}`. `public` is not a role a
caller can be; it is the pseudo-role every role inherits. **A `{public}` policy is therefore
evaluated for `anon`, for `authenticated`, for `service_role` and for `postgres` alike.** Evidence:
`rls-flags.json`, class `no-to-clause`, each row carrying `concrete_roles_reached` and
`predicate_gates_on_auth_uid`; the underlying `roles_raw` field is in `pg_policies.json`.

The remaining 40 policies do carry a `TO` clause: 35 `TO authenticated`, 5 `TO service_role`. **There
is not one `TO anon` policy in the database** — anonymous access is granted exclusively as a side
effect of a missing role clause, never deliberately.

### 4a. The 53 that are not in § 4b, and what actually holds them shut

Excluding the eight in § 4b, the remaining 53 `{public}` policies span 25 `public` tables plus
`storage.objects`. They divide into three groups, and the split matters because only the third is
anonymous-reachable:

| Group | Count | What excludes `anon` |
|---|---|---|
| Predicate compares against `auth.uid()` | **32** | `auth.uid()` is `NULL` for the anonymous role, so `auth.uid() = user_id` yields `NULL` → not true → **no row is returned and no row may be written**. The shape on `saved_events`, `rsvps` (writes), `reviews` (writes), `user_follows` (writes), `event_invites`, `recommendation_feedback`, `recommendation_explicit_feedback`, `email_reminder_log`, `feedback_request_log`, `notifications` (UPDATE), `users`, `moderation_reviews` and `experiment_assignments`. |
| Predicate is the inline admin `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin'::user_role = ANY(users.roles))` | **7** | Same mechanism one level down — the subquery matches no row when `auth.uid()` is `NULL`. On `experiments`, `experiment_variants`, `experiment_assignments`, `featured_clubs`, `featured_events`, `moderation_reviews` and `admin_audit_log` (the read policy). |
| Predicate does **not** depend on the caller at all | **14** | **Nothing.** These genuinely reach `anon`. Eight are the intentional-or-accidental public reads already judged in § 3b and § 3c (`clubs`, `reviews`, `club_followers`, `event_popularity_scores` ×2, `featured_clubs`, `events` via `status = 'approved'`, `featured_events` via its time window); six are the bucket-scoped `storage.objects` policies (`Anyone can view banners` / `club logos` / `event images`, `Public read access for event images`, and the two `club-logos` write policies that put `auth.role() = 'authenticated'` in the predicate). |

So **39 of the 53 are shut by their expression and not by their role clause**, and 14 are open by
design or by accident, already individually judged above.

**Proposed severity for the 39: Low, collectively — but it is a real finding, not a style note.** The guard is
the expression, not the role clause. Three concrete consequences:

- **Every anonymous request pays for the check.** A `{public}` policy is evaluated for `anon`
  before it fails. On the admin policies that is a correlated `EXISTS` subquery against `users`
  per candidate row.
- **A future edit silently widens to `anon`.** The day someone rewrites `auth.uid() = user_id` as
  `user_id = current_setting(…)` or adds an `OR` branch that does not depend on `auth.uid()`, the
  policy becomes anonymous-reachable with no diff to the role clause and no signal in review.
- **`TO` is also the performance control.** The Supabase guidance in
  `.claude/skills/supabase-postgres-best-practices/SKILL.md` is explicit: always specify `TO`, and
  wrap `auth.uid()` as `(select auth.uid())` so the planner evaluates it once per statement rather
  than once per row. **Of the 101 captured policies, exactly one wraps it** — `club_members ::
  Club owners can remove members`, whose predicate reads `user_id <> (SELECT auth.uid() AS uid)`.
  Counted across the whole policy set: **68 unwrapped `auth.uid()` occurrences in 59 policies**, each
  re-evaluated per candidate row.

**Recommendation:** add `TO authenticated` to the 39, and wrap every `auth.uid()` as
`(select auth.uid())`. Both are mechanical, neither changes behaviour, and together they close the
widening path and remove the per-row function call.

### 4b. The eight where the missing role clause is the finding

These are `{public}` policies whose predicate does **not** reduce to a deny for `anon`, or where the
role targeting was attempted in the wrong place. Listed worst first.

| # | Table · Policy | Cmd | Why the missing `TO` clause matters | Severity |
|---|---|---|---|---|
| 1 | `admin_audit_log :: Admins can insert audit log` | INSERT | `WITH CHECK (true)` — no `auth.uid()` anywhere. `{public}` reaches `anon`, `anon` holds `INSERT`. Full analysis in § 3a. | **Critical** |
| 2 | `admin_audit_log :: Service role can insert audit log` | INSERT | Same. The name says `service_role`; the role list says everyone. | **Critical** |
| 3 | `user_interactions :: Anyone can insert interactions` | INSERT | `WITH CHECK (true)` with `{public}`. § 3a. | **High** |
| 4 | `event_popularity_scores :: Authenticated users can update popularity scores` | **ALL** | The role targeting is in the **predicate** (`auth.role() = 'authenticated'`) instead of a `TO` clause — and `cmd` is `ALL`, so it covers INSERT, UPDATE **and DELETE**. Any signed-in user may rewrite or delete any popularity score. Ranking is attacker-controlled, and the five handlers reading this table all use the cookie client. | **High** |
| 5 | `rsvps :: Anyone can view rsvps` | SELECT | `USING (true)` with `{public}`. § 3b. | **High** |
| 6 | `user_follows :: Anyone can view follows` | SELECT | `USING (true)` with `{public}`. § 3b. | Medium |
| 7 | `tag_interaction_counts :: Service role can manage all tag counts` | ALL | Role targeting in the predicate (`auth.role() = 'service_role'`) rather than `TO service_role`. Inert today because `service_role` bypasses RLS, but it is a role comparison against a client-influenced GUC standing where a role clause belongs. | Low |
| 8 | `user_event_scores :: Service role can manage all scores` | ALL | Identical shape to #7, on the recommendation score table. | Low |

**Recommendation for #4, #7 and #8 specifically:** role checks belong in `TO`, not in `USING`.
`auth.role()` reads a request-scoped GUC; `TO` is enforced by the executor against the authenticated
role. They are not equivalent controls even when they agree.

### 4c. The privilege-escalation path this section exposes

`users :: Users can update own profile` is `{public}`, `USING (auth.uid() = id)`, **with no
`WITH CHECK`** (so Postgres reuses `USING` as the check) and **no column restriction**.
`authenticated` holds a table-level `UPDATE` grant on `users`, which covers every column
(`raw/prod/grants.json`). `users.roles` is `user_role[] NOT NULL DEFAULT '{user}'`, and
`raw/prod/constraints.json` lists only `users_pkey`, `users_email_key` and `users_banned_by_fkey` —
**no `CHECK` constraint on `roles`** — while `raw/prod/triggers.json` shows the table's only trigger
is `update_users_updated_at`, which touches `updated_at` alone.

**Therefore any signed-in user can `PATCH` their own row to set `roles = '{admin}'`, and
`public.is_admin()` — the `SECURITY DEFINER` helper that eleven policies and 27 `verifyAdmin()`
callsites depend on — will return `true` for them from that moment on.** The same policy permits
clearing `banned_at`, `ban_expires_at` and `ban_reason` on one's own row, so a banned user can
self-unban. Neither is gated by a `TO` clause, a column grant, a constraint, or a trigger.

**Severity: Critical.** This is the single highest-impact finding in the review, and it is reachable
by any user who completes McGill sign-in. **Recommendation:** restrict the grant to the
profile columns (`GRANT UPDATE (name, avatar_url, pronouns, year, faculty, visibility,
interest_tags, banner_url, onboarding_completed) ON public.users TO authenticated`, after revoking
the table-level grant), and add `WITH CHECK` asserting `roles` and the ban columns are unchanged.
A column grant is the control here; a policy predicate cannot express "this column may not change"
without a trigger.

Two further gaps on the same table, both deny-by-omission rather than over-permission:
`users` has **no `DELETE` policy** (account deletion cannot work on the cookie client), and **no
admin `UPDATE` policy** — so `/api/admin/users/[id] PATCH`, which `inventory/endpoints.json` records
as RLS-reliant (`uses_service_client: false`), can only ever update the calling admin's own row.
Likewise `users :: Users can read own profile` is the only non-admin `SELECT` policy, so
`/api/users/search` and `/api/events/[id]/friends`, both RLS-reliant, can return no user but the
caller. These belong to the coverage grid (`rls-heatmap.csv`) and to AUDIT-03's `expected_status`
work, and are noted here because they are the same root cause seen from the other side.

### 4d. The two `SECURITY DEFINER` helpers policies call

`is_admin()` and `is_club_owner(uuid)` are called from policy predicates on `clubs`, `events`,
`users`, `club_members` and `club_invitations` (`raw/prod/functions.json`). Both are
`STABLE SECURITY DEFINER` with `SET search_path TO 'public'`, which is the correct hygiene — the
`search_path` pin is what stops a caller-controlled schema from shadowing `public.users`, and
`011_rls_audit.sql` records the reason `is_admin()` must be `SECURITY DEFINER` at all: without it,
a policy on `users` that reads `users` recurses. **Both are sound as written.**

The finding is the **inconsistency**: **12 policies across 11 tables** inline
`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin'::user_role = ANY(users.roles))`
instead of calling `is_admin()` — on `admin_audit_log`, `club_members`, `event_reports`,
`experiments`, `experiment_variants`, `experiment_assignments`, `featured_clubs`, `featured_events`,
`moderation_reviews`, `organizer_requests` and `feedback` — while only **6 policies across 3 tables**
(`clubs`, `events`, `users`) call the helper. `is_club_owner(uuid)` is better observed: 4 policies on
`club_invitations` and `club_members`, with no inlined equivalent anywhere.

Two implementations of one rule means a fix applied to the helper reaches a quarter of the tables
that need it, and — because the inlined form is not `SECURITY DEFINER` — the inlined `EXISTS` reads
`public.users` **through `users`' own RLS policies**, whose only non-admin `SELECT` policy is
`auth.uid() = id`. The subquery therefore sees exactly one row (the caller's own), which is why it
still works; it is correct by coincidence of the predicate, not by design, and it would break the
moment a `users` read policy narrowed further.
**Severity: Low. Recommendation:** collapse all 12 onto `public.is_admin()`.

---

## 5. Unindexed policy columns

**Count: 5 columns referenced by a policy predicate with no index covering them.** Evidence:
`policy-column-indexes.json` (80 columns examined, `indexed` field), and `rls-flags.json` class
`unindexed-policy-column`.

A policy predicate runs **per candidate row**. A predicate on a column the planner cannot index
turns every row-level check into a sequential scan, which is why this is an AUDIT-06 input and a
denial-of-service surface rather than a performance aside — the cost is paid by the *database*, on
behalf of an unauthenticated caller, before any row is returned.

| Table · column | Referenced by | Consequence | Severity |
|---|---|---|---|
| `events.status` | `Approved events are viewable by everyone` — `USING (status = 'approved')` | **The single policy that governs the entire anonymous event feed.** `events` is the largest table (229 rows) and the most-read (32 RLS-reliant handlers). Every anonymous feed request sequentially scans `events` to apply this predicate. `events` has 7 indexes — on `id`, `category`, `club_id`, `content_hash`, `created_by`, `start_date`, and a partial on `id WHERE deleted_at IS NULL` — and **none of them covers `status`.** | **Medium** |
| `featured_events.starts_at` | `Public can read active featured events` — `USING (starts_at <= now() AND ends_at > now())` | Both halves of the time window are unindexed; a public read scans the table. Small today (1 row). | Low |
| `featured_events.ends_at` | same policy | same | Low |
| `moderation_reviews.author_id` | `Creators can appeal their items` — `WITH CHECK (… author_id = auth.uid() …)` | Write-path check on an unindexed column. The table's only non-primary index is `(target_type, target_id, created_at)`. | Low |
| `moderation_reviews.action` | same policy | same | Low |

**`events.status` is the one that matters.** The recommended index is a composite that serves the
policy and the feed's ordering together —
`CREATE INDEX ON public.events (status, start_date) WHERE deleted_at IS NULL` — rather than a bare
single-column index. This is a direct **REFAC-01** input.

**Two adjacent observations from the same capture, recorded so they are not lost:**

- **`recommendation_feedback.event_id` is not indexed** and is not referenced by any policy — so it
  is not a policy-performance finding, but it is an unindexed foreign-key-shaped column on a table
  that already carries four other indexes. REFAC-01 input, Informational.
- **Every other policy-referenced column is indexed**, including `users.roles` (`idx_users_roles`,
  GIN) and `users.id`, which together carry the eleven inlined admin `EXISTS` subqueries from § 4d;
  and `moderation_reviews.target_type` / `target_id`, covered by `idx_moderation_reviews_target`.
  The `storage.objects` columns reached by policy predicates (`bucket_id`, `name`) are reported as
  `indexed: null` rather than `false` — `raw/prod/indexes.json` was captured with
  `schemaname = 'public'`, so the storage index census does not exist and **no claim is made**. That
  gap belongs to plan 01-10.

The **detection heuristic is stated in the artifact itself** (`policy-column-indexes.json` →
`detection`): a column is "referenced" if its bare name matches inside the table's own policy
expressions, or if a qualified `<table>.<column>` reference reaches it from an `EXISTS` subquery on
another table. It can over-report a column whose name coincides with one used in a subquery, and it
would under-report a column reached only through a function body. Neither limit affects the five
rows above, each of which was read by eye against `pg_policies.json`.

---

## 6. Live policies reconciled against `supabase/migrations/`

**This section is the reason AUDIT-05 insists on reading the live catalog.** Everything above was
derived from production. Here, and only here, the migration files are opened — as the *subject* of a
comparison, not as a source of truth.

The numbers, matching `CREATE POLICY "<name>"` and `DROP POLICY [IF EXISTS] "<name>"` across all 44
files in `supabase/migrations/` and taking each policy's last event in filename order:

| | Count |
|---|---|
| Policies live in production (`pg_policies.json`) | **101** |
| Live policies declared by **no** migration — created out of band | **41 (41%)** |
| Distinct `CREATE POLICY` declarations across all migrations | 90 |
| Migration-declared policies whose last event is `CREATE` (expected live) | 84 |
| …of those, **absent from production** | **24 (29%)** |
| Migration-declared policies explicitly dropped and not recreated | 12 |
| Policies a migration dropped that are nonetheless still live | 0 |

**A replay of `supabase/migrations/` from zero onto an empty database would produce a database with
41 of production's policies missing and 24 policies production does not have.** That is not drift at
the margin; the migration history and the running database describe two different security postures.
Plan 01-08 already found that the migrations do not replay from zero at all, and that production
reports 45 applied migrations against 44 tracked files — this is the policy-layer expression of the
same problem, and a direct **REFAC-01** input.

### 6a. The 41 policies that exist only in production

Whole tables whose **entire** policy set is dashboard-created: **`rsvps`** (4), **`reviews`** (4),
**`event_reports`** (4), **`event_popularity_scores`** (3), **`users`** (3 of 4),
**`experiment_variants`** (1), **`experiment_assignments`** (2 of 2), **`featured_clubs`** (1 of 2),
plus **13 of the 15 `storage.objects` policies** and scattered singles on `admin_audit_log`,
`clubs`, `event_invites`, `saved_events` and `user_interactions`.

Three of these carry findings from the sections above, which is what makes this section a security
finding rather than a hygiene note:

- **`rsvps`** — the table itself is `prod-only` in `schema/drift.json` (plan 01-08: *"exists in
  production but no migration file declares it — created out of band"*), and so are all four of its
  policies, including the `USING (true)` anonymous read from § 3b. `011_rls_audit.sql` line 245
  certifies it: `-- rsvps (remote) — own CRUD ✓`. **A reviewer reading only the repository would
  conclude `rsvps` is correctly scoped to the owning user.** It is not.
- **`users :: Users can update own profile`** — the § 4c privilege-escalation path is a
  dashboard-created policy. `002_rls_policies.sql` declares `Users can update their own profile`
  with the same intent and a different name; production has the dashboard one and not the migration
  one, so a diff of the migrations shows nothing.
- **`storage.objects :: Allow public read access 1oj01fe_0`** — the generated name is the dashboard's
  own convention and is prima facie evidence of out-of-band creation.

### 6b. The 24 migration-declared policies that are absent from production

These are the more alarming half, because a reviewer reading the repository believes the control
exists. The functionally significant ones:

| Policy (migration) | Consequence in production |
|---|---|
| `Invitees can view their own invitations`, `Invitees can accept their own invitations`, `Club owners can update club invitations` — `20260226000001_invitee_select_update_policy.sql` | **`club_invitations` has exactly two live policies, both `is_club_owner(club_id)`.** An invitee can neither see nor accept their invitation. `/api/clubs/[id]/invites` is RLS-reliant (`uses_service_client: false`), so **nothing masks this — the club-invitation acceptance flow is broken in production**, and the migration that fixes it is in the repository, unapplied. |
| `Users can insert their own interactions`, `Anonymous users can insert interactions` — `006_tracking_rls_policies.sql` | Replaced out of band by the strictly weaker `Anyone can insert interactions` (§ 3a). |
| `Users can view their own profile`, `Users can insert their own profile` — `002_rls_policies.sql` | Superseded by same-intent dashboard policies; no functional gap, but the names in the repository do not exist. |
| `Users can insert own membership` — `20260305000002_phase1_club_rls_and_schema.sql` | `club_members` has no live INSERT policy for a user joining a club. Masked: 7 service-role handlers write this table. |
| `Club owners can update own club` — same migration | `clubs` UPDATE is admin-only in production; a club owner cannot edit their own club through RLS. Masked: 6 service-role handlers. |
| `Anyone can read running experiments`, `Anyone can read variants of running experiments`, `Service can insert assignments`, `Admins can read all assignments`, `Admins can manage variants` — `20260305000001_experiments.sql` | `experiments` and `experiment_variants` have **one** live policy each, admin-only `ALL`. `/api/recommendations` reads all three experiment tables on the cookie client, so **for every non-admin caller the experiment lookup returns zero rows** and A/B assignment silently degrades to the control path. Not masked. |
| `Users can insert their own reports`, `Users can view their own reports`, `Service role has full access to event_reports` — `20260316000002_event_reports.sql` | Four differently-named live policies cover the same ground. Equivalent in effect; a rename applied in the dashboard and never back-ported. |
| `Users can view their own engagement summary` — `006_tracking_rls_policies.sql` | **The table does not exist in production.** `schema/drift.json` classes `user_engagement_summary` as `migrations-only`, and `/api/user/engagement` queries it through `.from("user_engagement_summary" as never)` — the `as never` cast is the type system being told to stop objecting. A live handler queries a relation that is not there. |
| `Users can delete own invites`, `Public can read active featured clubs` — `20260316000003_audit_fixes.sql`; `Clubs are viewable by everyone`, `Users can save events`, `Users can unsave their own events`, `Popularity scores are viewable by everyone` — `002`/`006` | Superseded by same-intent dashboard policies under different names. No functional gap; pure naming drift. |

**Severity: High, as a single finding, on the reconciliation itself** — not on any one row. The
exposure rationale is that this defeats every compensating control that depends on reading the
repository: code review, the migration diff, and the "confirmed correct" audit comments in
`011_rls_audit.sql`, which certify `user_interactions` and `rsvps` as safe on the strength of
migrations that production does not run. Two of the three Criticals in this review sit on policies
that appear in no migration.

**Recommendations, in order:**

1. **Do not replay.** A `supabase db reset` against any environment from this migration set would
   drop 41 live policies. Freeze replay until reconciled — this is a **blocking input to Stage 3**.
2. **Baseline from production.** Generate a single squashed migration from the live catalog
   (`pg_policies.json` is the authoritative list) so the repository matches the database, then apply
   the § 3 and § 4 fixes as forward migrations on top of that baseline.
3. **Apply `20260226000001_invitee_select_update_policy.sql` deliberately** — it is the one case
   where the repository holds a fix production lacks and a user-facing flow is broken without it.
4. **Close the dashboard path.** Until policy changes go through migrations only, this section
   regenerates itself. Stage 4's pgTAP matrix, transcribed from `rls-heatmap.csv`, is the mechanism
   that makes a dashboard edit fail CI.

---

## 7. Proposed findings summary

Severities are **proposed**; banking them into `findings.json` against `findings.schema.json` and
`SEVERITY_SLA.md` is plan 01-12's job. Exposure rationale follows the three-part test in § 0:
anonymous reachability, tenant crossing, and whether a compensating control exists at the
authorization ring.

| # | Finding | Table(s) | Proposed severity | Anonymous-reachable | Compensating control at Ring 2 |
|---|---|---|---|---|---|
| 1 | Self-service privilege escalation: any authenticated user can set their own `users.roles` to `admin`, and can self-unban | `users` | **Critical** | no — requires sign-in | **none** — the escalation is a direct PostgREST write, it does not pass through a handler |
| 2 | Unauthenticated write to the moderation audit log via two `WITH CHECK (true)` `{public}` INSERT policies | `admin_audit_log` | **Critical** | **yes** | none — direct PostgREST write |
| 3 | Moderation bypass: `WITH CHECK (true)` on INSERT permits self-approved events with a forged `created_by` | `events` | **High** | no — requires sign-in | none for the direct write path |
| 4 | Anonymous interaction forgery poisoning recommendations and popularity, amplified by an `AFTER INSERT` trigger | `user_interactions` | **High** | **yes** | none |
| 5 | Any authenticated user may INSERT/UPDATE/DELETE any popularity score (`cmd = ALL`, role check in the predicate) | `event_popularity_scores` | **High** | no | none |
| 6 | Attendance graph world-readable via `USING (true)`, on a table declared by no migration | `rsvps` | **High** | **yes** | none — 6 of 8 handlers are RLS-reliant |
| 7 | Migration/production policy divergence: 41 live policies undeclared, 24 declared policies absent | all | **High** | n/a | n/a — this finding *is* the failure of the compensating controls |
| 8 | Social and club-follow graphs bulk-readable by `anon` | `user_follows`, `club_followers` | Medium | **yes** | none |
| 9 | Review text and author linkage readable by `anon` | `reviews` | Medium | **yes** | none |
| 10 | `events.status`, the predicate of the anonymous feed policy, is not indexed | `events` | Medium | **yes** (cost is paid anonymously) | none |
| 11 | Club-invitation acceptance broken: invitee policies exist in a migration, not in production | `club_invitations` | Medium | no | none — the handler is RLS-reliant |
| 12 | Experiment reads return zero rows for non-admins; A/B assignment silently degrades | `experiments`, `experiment_variants`, `experiment_assignments` | Medium | no | none |
| 13 | 39 policies rely on an `auth.uid()`-bearing predicate rather than a `TO` clause to exclude `anon`; 61 of 101 policies carry no `TO` clause and there is no `TO anon` policy anywhere | 25 public tables + `storage.objects` | Low | no (today) | n/a |
| 14 | 68 unwrapped `auth.uid()` occurrences across 59 policies, re-evaluated per row; 1 of 101 policies wraps it in a subselect | most tables | Low | n/a | n/a |
| 15 | Role checks written as `auth.role() = …` predicates instead of `TO` clauses | `tag_interaction_counts`, `user_event_scores`, `event_popularity_scores` | Low | no | n/a |
| 16 | Four remaining unindexed policy columns | `featured_events`, `moderation_reviews` | Low | partly | n/a |
| 17 | Duplicate `USING (true)` SELECT policies on one table | `event_popularity_scores` | Low | **yes** | n/a |
| 18 | Any authenticated user can read every object in every storage bucket | `storage.objects` | Low | no | plan 01-10 owns this |
| 19 | 12 policies inline the admin `EXISTS` instead of calling `is_admin()`; only 6 call the helper | 11 tables | Low | no | n/a |
| 20 | `relforcerowsecurity` is false on all 38 relations | all | Informational | no | n/a |
| 21 | Pending and rejected clubs are publicly readable | `clubs` | Low | **yes** | none |

---

## 8. What this hands to the next stages

- **AUDIT-06** — `rls-heatmap.csv`, generated from `pg_policies.json` and `rls-enabled.json` by
  `tools/pivot-rls-heatmap.mjs`, is the table × command × role grid this review's conclusions are
  drawn on; `rls-heatmap-notes.csv` traces each `allow` back to the policies that produced it.
- **Stage 4 pgTAP** — the grid transcribes directly into assertions. The three-value cell
  (`allow` / `deny` / `none`) maps to one test each, and § 4c's escalation path and § 6b's broken
  invitee flow are the two tests most worth writing first.
- **REFAC-01** — § 6's reconciliation (do not replay; baseline from production) and § 5's
  `events (status, start_date)` index.
- **AUDIT-07 / plan 01-12** — § 0 fact 3 and the per-table handler split determine, for every gap
  here, whether a service-role callsite is masking it. Findings 11 and 12 are gaps nothing masks.
- **Plan 01-10** — `storage.objects` is included in the heatmap and its `USING (true)` policy is
  flagged, but the storage verdict (buckets, folder scoping, public-bucket posture) is that plan's.

---

*Phase: 01-read-only-foundation-audit · Plan: 01-09 · Requirement: AUDIT-05*
*Every claim above cites `.planning/audit/rls/pg_policies.json` or a sibling artifact derived from
`.planning/audit/raw/prod/`. No policy was modified, and no SQL was issued by this plan.*
