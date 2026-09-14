# Redaction Ledger — Phase 1 Foundation Audit

**Created:** 2026-09-14, Wave 1 (empty, so every credentialed task had somewhere to append)
**Consolidated:** 2026-09-14 by plan 01-13 at the phase gate
**Why this exists:** `commit_docs` is `true` and AUDIT-01 explicitly requires the schema snapshots to be **committed artifacts**. The natural raw outputs of this phase contain, unredacted: live session tokens from the AUDIT-08 `set-cookie` and `Cookie:` headers, connection strings with a database password, `auth` schema grants, and both project refs. Once committed, they are in git history permanently. **Redaction is a task, not a habit.**

---

## How the ledger is assembled

Each credentialed plan ended with a redaction step writing its own note to `.planning/audit/redaction/<plan-id>.md`. Those five files remain in place as the underlying evidence; the table below is their consolidation. A plan that touched a credential and left no note is a gate failure, not an oversight — all five that did are present.

---

## Ledger — one row per artifact family

| Plan | Artifact family | Value class removed or excluded | Replaced with | Rationale |
|---|---|---|---|---|
| 01-06 | `schema/prod.schema.sql` | the **auth schema** in its entirety — columns, grants and data | never captured | An auth dump can carry role grants and inline keys into git history permanently. The snapshot is scoped to `public` (all objects), `storage` (buckets and policies only) and `cron` (the job inventory only). A roles-only dump was never produced; `--role-only` is on the phase's forbidden list. |
| 01-06 | `schema/prod.schema.sql`, `raw/prod/MANIFEST.json` | the Supabase **project reference** | `<PROD-PROJECT-REF>` | Substituted by the capture agent at capture time, so the literal ref appears in no committed file. The human-readable project *name* is retained deliberately: it is not a credential and it is what makes the provenance auditable. |
| 01-06 | `raw/prod/*.json` (21 files) | nothing — **0 redactions at capture** | n/a | `MANIFEST.json` reports `total_redactions: 0` across all 20 captures, independently re-verified in `redaction/01-06.md` § 4 rather than taken on trust. The credential itself was an OAuth grant held by the agent runtime and never entered the executing shell, so it could not reach a file or a log. |
| 01-08 | `schema/migration-list.*.txt`, `schema/db-diff.*.sql`, `schema/drift.{json,md}` | nothing removed; **two artifacts are BLOCKED stubs carrying variable names only** | `BLOCKED — input not supplied` | A real `db diff` can carry function bodies with inline keys; none was captured. The drift artifacts hold schema identifiers only — no values, no rows of data. All six sweep patterns returned 0. |
| 01-09 | `rls/pg_policies.json`, `rls/rls-flags.json`, `rls/rls-review.md` | nothing removed; **policy expression text inspected literal-by-literal** | n/a | The highest-risk artifact family in the phase: a policy expression is arbitrary SQL and is the classic carrier for a hard-coded value. 101 expressions were inspected individually (`redaction/01-09.md` § 4). Zero network connections were opened and no credential existed in the environment — the plan read `raw/prod/*.json` from disk. |
| 01-10 | `storage/*.json`, `async/*.json`, `async/vercel-crons.md` | nothing removed; **two identifier classes deliberately retained** | n/a | Vercel project and deployment ids (`prj_…`, `dpl_…`) and the GitHub org/repo name are retained: they are opaque resource identifiers that confer no access, every API call using one still requires a token, and they are the only way a later pass can confirm it read the same project. **This plan's sweep fired for the first time in the phase** — see § Classification below. |
| 01-12 | `cache/curl/*.headers.txt` (45 files) | every `set-cookie` **response header value**; every response header outside the caching allow-list; all response **bodies** | `<REDACTED>`; dropped; never requested | `sed -E 's/^([Ss]et-[Cc]ookie:).*$/\1 <REDACTED>/'` runs **inside the same pipeline that writes the file**, so an unredacted value never reaches disk, not even momentarily. Bodies are discarded with `-o /dev/null -D -`. `set -x` was never enabled. |
| 01-12 | session cookies `COOKIE_A` / `COOKIE_B` | **not supplied** — the cross-session half of the probe did not run | n/a | No cookie value entered this machine's shell, let alone a file. The presence check ran once and printed only booleans. This is why AUDIT-08 is withheld rather than completed. |
| 01-13 | `security/threat-model-*.md`, `findings.json`, `FOUNDATION_AUDIT.md` | nothing captured; **evidence is a path plus an anchor, never an inline value** | n/a | A finding that inlines the value it is about publishes that secret. `validate.mjs --check findings` asserts every `evidence` field resolves to an existing file and contains no whitespace, so an inline literal fails the gate mechanically. |

---

## Standard placeholders

| Placeholder | Stands for |
|---|---|
| `<REDACTED>` | Any `set-cookie` response header value |
| `<SESSION-A>` / `<SESSION-B>` | The two `sb-<ref>-auth-token` cookie sets from the AUDIT-08 probe (never supplied) |
| `<PROD-PROJECT-REF>` / `<STAGING-REF>` | The two Supabase project references |
| `<PROD-HOST>` | The production hostname, where the operator asks for it to be withheld |
| `<REDACTED-JWT>` | Any JWT-shaped string |
| `<REDACTED-SECRET-KEY>` | A Supabase secret-key-prefixed string |
| `postgres://<REDACTED>@` | The credential portion of a connection string |
| `<REDACTED-TOKEN>` | An HTTP bearer token |
| `<REDACTED:path>` | A deploying developer's local filesystem path |

---

## Phase-gate self-sweep — result

Run by plan 01-13 over the whole of `.planning/audit/`, `public/`, and the phase's own plan and summary files. **File names and match counts only — never `-o`, never a matching line**, because printing the match is itself the leak. Executed from a script file under `bash` with the target paths held in an array, because this shell is zsh and does not word-split unquoted expansions; and with `command grep` throughout, because the interactive `grep` is a ugrep shim that honours `.gitignore` and would silently skip files the sweep exists to inspect.

### The five shapes

| # | Pattern | What it catches | Files matching the shape | Files carrying a payload |
|---|---|---|---|---|
| 1 | `eyJ[A-Za-z0-9_-]{10,}\.` | JWT shape — anon keys, service-role keys, access tokens, session cookies | **0** | **0** |
| 2 | `sb_secret_` | Supabase secret-key prefix | 24 | **0** |
| 3 | `postgres(ql)?://[^ ]*:[^@]*@` | Connection string carrying a password | **0** | **0** |
| 4 | `Authorization:\s*Bearer\s+\S` | HTTP bearer credential in a captured header | 7 | **0** |
| 5a | `sb-[a-z0-9]+-auth-token=` | Session cookie name prefix with a value | **0** | **0** |
| 5b | `Set-Cookie:\s*\S` | Cookie value, response side | 2 | **0** |
| 6 | both project refs | `$PROD_PROJECT_REF`, `$STAGING_PROJECT_REF` read from the environment at sweep time | not exported in the executing shell; both were placeholder-substituted at capture time (01-06) and `<PROD-PROJECT-REF>` appears in 5 files as the placeholder | **0** |

**`SWEEP_RESULT=CLEAN`.** Every shape match is a pattern definition or a documented finding string. Zero carry a payload.

### Classification is by value shape, not by path

Wave 1's caveat excluded `REDACTION.md` and `tools/` from the result set, on the reasoning that both contain the patterns themselves. By the phase gate that path list was no longer sufficient: `redaction/01-06.md` through `01-12.md`, `security/client-bundle-sweep.md`, `baseline/BASELINE-REFRESH.md`, `findings.json`, `FOUNDATION_AUDIT.md`, `authz/fail-open-register.md`, `async/cron-webhook-inventory.md`, `inventory/endpoints.{json,csv}` and every plan and summary in the phase all legitimately name a credential class. An allowlist long enough to cover them is no longer a classification — it is a way of not looking.

So the gate is a **residual sweep on value shape**. A credential has a payload; a pattern definition does not:

| Residual | Requires | Files |
|---|---|---|
| `sb_secret_[A-Za-z0-9_-]{8,}` | a key payload after the prefix | **0** |
| `[Bb]earer\s+[A-Za-z0-9._~+/-]{16,}` | a token of credential length | **0** |
| `sb-[a-z0-9]+-auth-token=[A-Za-z0-9._%+/-]{8,}` | a cookie value after the name | **0** |
| `Set-Cookie:\s*[A-Za-z0-9_.-]+=[A-Za-z0-9._%+/-]{8,}` | a `name=value` pair, not `<REDACTED>` | **0** |

All four are zero. Every one of the 24 `sb_secret_` occurrences is a bare literal with a zero payload count, verified per file. Every pattern-4 hit resolves to `Bearer undefined` (a finding string — F-002), an unexpanded `Bearer ${process.env.CRON_SECRET}` template, or a pattern definition; the residual confirms none is a token. Every pattern-5b hit is the `sed` substitution expression from 01-12's own redaction pipeline.

### Why this changed

The sweep fired for the first time in plan 01-10: pattern 4 returned 3 rather than 0. It was resolved by mechanical classification — counts only, never printing a matching line — into 1 × `Bearer undefined`, 2 × unexpanded template, 0 unclassified, with a residual check returning 0. The lesson generalised here, and is filed as finding **F-068**: a sweep that reports zero can be false-clean, and a non-zero count must be resolved into *classified-benign* or *scrubbed* with the residual re-run, never amended to say "clean".

### Nothing was scrubbed at the gate

No artifact required a scrub. The consolidated ledger records this as a result, not as an absence of work: the sweep ran over 3 target trees and 6 shapes, produced 33 shape matches, and classified all 33 to zero payloads.

---

*Phase: 01-read-only-foundation-audit*
*Seeded by plan 01-01 · Consolidated by plan 01-13 · Per-plan evidence retained in `redaction/*.md`*
