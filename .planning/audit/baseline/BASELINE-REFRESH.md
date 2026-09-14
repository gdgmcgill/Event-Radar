# Baseline refresh log

## 2026-09-14 — during plan 01-06, at the credential checkpoint

**Trigger:** the operator resolved plan 01-06's blocking credential gate by authenticating the **Supabase MCP server** in the orchestrator session rather than by exporting a personal access token or a connection string. Doing so wrote one untracked path outside `.planning/`: `.mcp.json`.

**Assessment:** `.mcp.json` is AI-tooling configuration, not application source, configuration, dependencies, or database. Its entire content is a server name, a transport type, and the public Supabase MCP endpoint:

```json
{ "mcpServers": { "supabase": { "type": "http", "url": "https://mcp.supabase.com/mcp" } } }
```

It carries **no credential**. The MCP authorisation is an OAuth grant held by the agent runtime outside the repository; a sweep of `.mcp.json` for the JWT shape, `sb_secret_`, `sb_publishable_`, `sbp_`, a password-bearing `postgres://` URI, a bearer header, and a project-ref host returned **0 matches on every pattern**. Nothing the audit measures (routes, pages, migrations, lockfile, build, tests, lint, type-check) reads this path. No tracked file changed; the lockfile hash is unchanged.

`.mcp.json` is **not** committed by this phase. It is an operator artifact recorded as an expected untracked entry, exactly as `.agents/` and `skills-lock.json` were in the refresh below.

**Action:** `git-status.before.txt` recaptured so the guard's byte comparison includes the new untracked entry. The previous baseline is preserved below. The tracked-file check (`git diff --exit-code`) and the lockfile hash check are unaffected by this refresh.

**Previous baseline (verbatim):**
```
?? .agents/
?? docs/product-master-plan.md
?? skills-lock.json
```

---

## 2026-09-14 — after plan 01-05, before plan 01-06

**Trigger:** the operator ran `npx skills add supabase/agent-skills` in the repo root, which created two untracked paths outside `.planning/`: `.agents/` (skill directories, symlinked from the gitignored `.claude/skills/`) and `skills-lock.json`.

**Assessment:** agent-skill documentation for the AI tooling, not application source, configuration, dependencies, or database. Nothing the audit measures (routes, pages, migrations, lockfile, build, tests, lint, type-check) reads these paths. No tracked file changed; the lockfile hash is unchanged.

**Action:** `git-status.before.txt` recaptured so the guard's byte comparison includes the two new untracked entries. The previous baseline is preserved below. The tracked-file check (`git diff --exit-code`) and the lockfile hash check are unaffected by this refresh.

**Previous baseline (verbatim):**
```
?? docs/product-master-plan.md
```
