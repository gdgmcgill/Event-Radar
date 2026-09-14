# Baseline refresh log

## 2026-09-14 — after plan 01-05, before plan 01-06

**Trigger:** the operator ran `npx skills add supabase/agent-skills` in the repo root, which created two untracked paths outside `.planning/`: `.agents/` (skill directories, symlinked from the gitignored `.claude/skills/`) and `skills-lock.json`.

**Assessment:** agent-skill documentation for the AI tooling, not application source, configuration, dependencies, or database. Nothing the audit measures (routes, pages, migrations, lockfile, build, tests, lint, type-check) reads these paths. No tracked file changed; the lockfile hash is unchanged.

**Action:** `git-status.before.txt` recaptured so the guard's byte comparison includes the two new untracked entries. The previous baseline is preserved below. The tracked-file check (`git diff --exit-code`) and the lockfile hash check are unaffected by this refresh.

**Previous baseline (verbatim):**
```
?? docs/product-master-plan.md
```
