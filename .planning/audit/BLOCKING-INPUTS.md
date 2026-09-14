# Blocking Inputs — Phase 1 Foundation Audit

**Written:** 2026-09-14, Wave 1, **before any credentialed task runs**
**Purpose:** every human-supplied input this phase needs, grouped by the plan that consumes it, with the AUDIT requirement each one blocks.

> ## No value listed in this file is ever pasted into any file under `.planning/`
>
> `commit_docs` is `true` for this project, so everything written under `.planning/audit/` is committed to git permanently. This document records **environment variable NAMES and shell variable NAMES only**. Tokens, passwords, connection strings, project refs and cookie values live in the operator's terminal environment for the duration of a task and nowhere else. A task that needs a secret reads it from `process.env` or `$VAR`; it never echoes it, never passes it as a CLI argument (shell history), and never runs under `set -x`.
>
> If you find yourself about to paste a value here to "make it easier next time", stop. That is the exact failure this file exists to prevent.

---

## Summary — what is blocked and by what

| Blocked requirement | What it needs | Consuming plan(s) | Without it |
|---|---|---|---|
| AUDIT-01 — live schema snapshots | Supabase PAT + both project refs (Docker for the dumps) | Wave 2A | No prod/staging snapshot; local-only snapshot still possible |
| AUDIT-02 — three-way drift table | Supabase PAT + both project refs + Docker (shadow DB for `db diff`) | Wave 2A | Migrations-vs-types half only; the prod column stays empty |
| AUDIT-05 — live RLS policy review | Supabase PAT + `PROD_PROJECT_REF` (Management API SQL; no Docker needed) | Wave 2A | Blocked entirely — migration files are NOT an acceptable substitute |
| AUDIT-06 — RLS coverage heatmap | Derived from AUDIT-05 | Wave 2A | Blocked entirely |
| AUDIT-08 — cache/personalization exposure | Production hostname + two signed-in McGill session cookie sets | Wave 2B | Static half (declared headers) only; the empirical two-session probe is blocked |
| AUDIT-11 — cron and webhook inventory | Supabase PAT (for `cron.job`) + the Vercel project Cron Jobs list | Wave 2A / 2B | Repo-side half only; the `cron.job` and Vercel halves are blocked |
| AUDIT-18 — storage bucket policies | Supabase PAT + `PROD_PROJECT_REF` | Wave 2A | Blocked entirely |
| AUDIT-19 — authoritative `events` date columns | Supabase PAT + `PROD_PROJECT_REF` (`information_schema.columns`) | Wave 2A | Blocked entirely — the types file is explicitly not authoritative here |

**Wave 1 (AUDIT-03, 04, 07, 09, 10, 12, 13, 14, 15, 16, 17 and this plan) has zero blocking inputs** and runs to completion regardless of what is supplied below. Do not serialize the phase behind this gate.

---

## 1. Supabase database access — blocks AUDIT-01, AUDIT-02, AUDIT-05, AUDIT-06, AUDIT-18, AUDIT-19 and the `cron.job` half of AUDIT-11

The repository is **not linked** to any Supabase project: `supabase/.temp/` contains only `cli-latest`, `supabase status` reports `linked_project: null`, and no project ref appears in any tracked file. Both refs must be supplied.

**Preferred transport — Management API (no Docker required):**

| Variable NAME | What it is | Notes |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | A Supabase Management API personal access token | Needs the `database_read` scope. Read-only work only; no task in this phase issues a write. |
| `PROD_PROJECT_REF` | The production project reference | Treated as a secret: it is also a redaction sweep pattern at the phase gate. |
| `STAGING_PROJECT_REF` | The staging project reference | Same treatment. |

**Fallback transport — direct connection (only if the Management API is unavailable):**

| Variable NAME | What it is | Notes |
|---|---|---|
| `PROD_DB_PASSWORD` | Production database password | Never passed as a CLI argument. Never logged. |
| `STAGING_DB_PASSWORD` | Staging database password | Same. |
| `PROD_DB_URL` | Full production connection string | Alternative to the password form. Matches a redaction sweep pattern by construction. |
| `STAGING_DB_URL` | Full staging connection string | Same. |

Every SQL statement in this phase runs inside `BEGIN TRANSACTION READ ONLY`. `supabase db push`, `db reset` against a linked project, `db diff -f`, and `migration repair` are forbidden for the whole phase.

## 2. Production HTTP access — blocks the empirical half of AUDIT-08

Zero production URLs exist anywhere in the repository: no `metadataBase`, no `NEXT_PUBLIC_SITE_URL`, no `VERCEL_URL` reference in `src/`.

| Shell variable NAME | What it is | Notes |
|---|---|---|
| `PROD_HOST` | The production hostname | Recorded in the cache artifacts only if the operator confirms it is not sensitive; otherwise substituted with `<PROD-HOST>`. |
| `COOKIE_A` | A complete signed-in McGill session cookie set for account A | **Held in the operator's terminal only. Never written under `.planning/`.** Redacted to `<SESSION-A>` in every captured header file. |
| `COOKIE_B` | A complete signed-in McGill session cookie set for a *different* account B | Same. Two distinct accounts are required: a cross-session cache `HIT` is the proof, and it can only appear on the second session's request. |

Cookie extraction is a human step by design — there is no automated path that does not put a live session token somewhere it should not be. The probe captures **response headers only** (`curl -sSI`, GET only) and post-processes `set-cookie` values to `<REDACTED>` before any file is written.

## 3. Docker / OrbStack daemon — blocks only `supabase db dump` and `supabase db diff`

**Verified 2026-09-14: the daemon is not reachable** (`/Users/adyan/.orbstack/run/docker.sock` is absent, `supabase status` returns `LegacyStatusDbInspectError`). `psql` and `pg_dump` are also not installed on this machine.

| Input | Verified by | Blocks |
|---|---|---|
| Docker or OrbStack daemon running | `docker info --format '{{.ServerVersion}}'` returning a version | The AUDIT-01 dumps and the AUDIT-02 `db diff` shadow build only |

**This does not block the pure-SQL work.** AUDIT-05, AUDIT-06, AUDIT-11 (`cron.job`), AUDIT-18 and AUDIT-19 route through the Management API and need no container. Sequence the SQL tasks first and put the dump/diff tasks behind this check so the wave degrades gracefully instead of blocking entirely.

## 4. Vercel project configuration — blocks the Vercel half of AUDIT-11

`vercel.json` has **no `crons` key** (verified), both `/api/cron/*` handlers export only `POST`, and neither is referenced from any other route. Email reminders are a **Validated** requirement in PROJECT.md, so "nothing triggers them" is a High finding, not a footnote — which means the answer has to come from outside the repo.

| Input | How to supply it | Blocks |
|---|---|---|
| The Vercel project's **Cron Jobs** list | Dashboard screenshot or copied configuration, pasted as the artifact (contains no secret) | The Vercel third of AUDIT-11 |

The other two sources are checked without human input: `cron.job` rows via the Management API (section 1), and `.github/workflows/` in-repo (verified: only `ci.yml` exists, and it does not call them).

---

## Handover protocol

1. Export the names in sections 1–2 into the shell that will run the credentialed plan. Do not write them to a file in this repository, including `.env.local`.
2. Start the Docker/OrbStack daemon if the AUDIT-01/02 dumps are wanted in this pass.
3. Confirm at the phase's `checkpoint:human-verify` gate which of the four sections are available. Anything absent is recorded as `BLOCKED — input not supplied` in the corresponding artifact, with the exact command that would produce it, so a later pass can fill the gap without re-deriving the work.
4. Every credentialed task ends by appending to `.planning/audit/redaction/<plan-id>.md`. See `REDACTION.md`.

---

*Phase: 01-read-only-foundation-audit*
*Plan: 01-01*
