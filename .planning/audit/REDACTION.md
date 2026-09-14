# Redaction Ledger — Phase 1 Foundation Audit

**Written:** 2026-09-14, Wave 1 (created empty so every credentialed task has somewhere to append)
**Why this exists:** `commit_docs` is `true` and AUDIT-01 explicitly requires the schema snapshots to be **committed artifacts**. The natural raw outputs of this phase contain, unredacted: live session tokens from the AUDIT-08 `set-cookie` and `Cookie:` headers, connection strings with a database password, `auth` schema grants, and both project refs. Once committed, they are in git history permanently. **Redaction is a task, not a habit.**

---

## How the ledger is assembled

Each credentialed plan ends with a redaction step that writes its own note to:

```
.planning/audit/redaction/<plan-id>.md        e.g. .planning/audit/redaction/01-08.md
```

At the phase gate, plan 01-13 concatenates those per-plan notes into the table below and runs the sweep in the next section over the whole of `.planning/audit/`. A plan that touched a credential and left no note in `.planning/audit/redaction/` is a gate failure, not an oversight.

Each note records, per artifact: the file path, what class of value was removed, what placeholder replaced it, and the command that performed the substitution.

## Ledger

| Plan | Artifact | Value class removed | Replaced with | Rationale |
|---|---|---|---|---|
| _(pending — populated at the phase gate from `.planning/audit/redaction/*.md`)_ | | | | |

## Standard placeholders

| Placeholder | Stands for |
|---|---|
| `<REDACTED>` | Any `set-cookie` response header value |
| `<SESSION-A>` / `<SESSION-B>` | The two `sb-<ref>-auth-token` cookie sets from the AUDIT-08 probe |
| `<PROD-REF>` / `<STAGING-REF>` | The two Supabase project references |
| `<PROD-HOST>` | The production hostname, where the operator asks for it to be withheld |
| `<REDACTED-JWT>` | Any JWT-shaped string |
| `<REDACTED-SECRET-KEY>` | A Supabase secret-key-prefixed string |
| `postgres://<REDACTED>@` | The credential portion of a connection string |
| `<REDACTED-TOKEN>` | An HTTP bearer token |

---

## Phase-gate sweep patterns

Run over the whole of `.planning/audit/` before the phase's final commit. **File names and match counts only — never `-o`, never print a matching line**, because printing the match is itself the leak.

| # | Pattern | What it catches |
|---|---|---|
| 1 | `eyJ[A-Za-z0-9_-]{10,}\.` | JWT shape — Supabase anon keys, service-role keys, access tokens, session cookies |
| 2 | `sb_secret_` | Supabase secret-key prefix |
| 3 | `postgres(ql)?://[^ ]*:[^@]*@` | Connection string carrying a password |
| 4 | `[Aa]uthorization:\s*[Bb]earer\s+\S` | HTTP bearer-token prefix in a captured header |
| 5 | `sb-[a-z0-9]+-auth-token=` and `[Ss]et-[Cc]ookie:\s*\S` | Cookie values, both request and response side |
| 6 | `$PROD_PROJECT_REF` and `$STAGING_PROJECT_REF` | Both project refs, read from the environment at sweep time and never written into this file |

**Self-reference caveat:** this document and `.planning/audit/tools/validate.mjs` both contain the *patterns* themselves, so both will appear as hits on patterns 1–5. The sweep must exclude `REDACTION.md` and `tools/` from its result set, or treat hits in those two paths as expected and verify by eye that they are pattern definitions rather than values. Every other hit anywhere under `.planning/audit/` is a leak until proven otherwise.

The same sweep is the AUDIT-16 client-bundle sweep applied to a different target tree; see `security/client-bundle-sweep.md` for the `.next/static` and `public/` runs.

---

*Phase: 01-read-only-foundation-audit*
*Plan: 01-01*
