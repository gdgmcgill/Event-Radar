# AUDIT-16 — Client-Bundle Secret Sweep

**ENVSTATE: `INCONCLUSIVE-key-absent-from-build-env`**

**Verdict: INCONCLUSIVE.** Zero hits were found for every pattern, but the build that
produced the swept bundle ran without `SUPABASE_SERVICE_ROLE_KEY` in its environment.
A clean result therefore proves only that the key was **absent**, not that it would not
have been inlined had it been present. This is 01-RESEARCH.md Pitfall 7, and it is why
`ENVSTATE` is the first line of this artifact rather than a footnote.

| | |
|---|---|
| Requirement | AUDIT-16 |
| Produced by | plan 01-03, Task 3 |
| Swept artifact | `.next/static` — 78 files, 69 JS chunks, 4,490,961 bytes |
| Source build | `.planning/audit/baseline/build.txt` (`npm run build`, exit 0) |
| Swept at | 2026-09-14 |
| Read-only | `.next/` is gitignored (`.gitignore:12` → `/.next/`); `git check-ignore -q .next/static` exits 0 |

---

## 1. How ENVSTATE was determined

The probe is an **exit-code test**. It never prints, interpolates, or logs the value:

```bash
node -e "process.exit(process.env.SUPABASE_SERVICE_ROLE_KEY ? 0 : 1)" \
  && ENVSTATE="real-secrets-present" \
  || ENVSTATE="INCONCLUSIVE-key-absent-from-build-env"
```

Result: **exit 1 — the variable is not set in the build environment.**

Corroborated from the dotenv side, again by NAME only. Next.js reported
`- Environments: .env` in `build.txt`, so `.env` *was* loaded by the build; it simply
does not define the key:

```bash
for f in .env .env.local .env.production .env.development; do
  [ -f "$f" ] && echo "$f present ($(wc -c < "$f") bytes)" || echo "$f absent"
done
command grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' .env | tr -d '='   # NAMES only, never values
```

| Dotenv file | State |
|---|---|
| `.env` | present, 182 bytes, gitignored, **loaded by the build** |
| `.env.local` | absent (CLAUDE.md's `.env.local` reference is stale — 01-RESEARCH.md § Runtime State Inventory) |
| `.env.production` | absent |
| `.env.development` | absent |

Variable **names** defined in `.env`: `SUPABASE_URL`, `SUPABSE_PUSHABLE_KEY`,
`SUPABSE_SECRET_KEY`. None is `SUPABASE_SERVICE_ROLE_KEY`, and none is a
`NEXT_PUBLIC_*` variable. Two of the three names are misspelled (`SUPABSE`, missing the
`A`) and none matches a name the application actually reads — see § 6.

**No `.env*` file was created, modified, or read for its values by this task.**

---

## 2. Sweep commands

Every sweep reports **file names and counts only**. No flag that prints matching content
is used anywhere: `-l` (names) and `-c`/`wc -l` (counts) only. The one command that emits
matched text, `grep -o` in § 4, is piped straight into `sort -u | wc -l` and its output is
never written to this file — a captured match here would publish the secret this sweep
exists to find (threat T-01-03-02).

`command grep` is used rather than the bare shell builtin: `grep` in this environment is a
ugrep shim that honours `.gitignore`, and `.next/` is gitignored. A zero from the shim
would be unfalsifiable. The positive control in § 5 proves the sweep reached the files.

```bash
# name / prefix sweep — six patterns
for pat in 'sb_secret_' 'service_role' 'SUPABASE_SERVICE_ROLE_KEY' \
           'ADMIN_API_KEY' 'ADMIN_EMAILS' 'CRON_SECRET'; do
  printf '%-28s %s\n' "$pat" \
    "$(command grep -rlF "$pat" .next/static 2>/dev/null | wc -l | tr -d ' ')"
done

# literal-value sweep — value read from the environment, never echoed
[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] \
  && command grep -rlF "$SUPABASE_SERVICE_ROLE_KEY" .next/static 2>/dev/null | wc -l

# JWT shape sweep — count of DISTINCT shaped strings; the strings are never printed
command grep -rhoE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}' \
  .next/static | sort -u | wc -l
```

---

## 3. Results — `.next/static` (the client bundle)

| pattern | files | what a non-zero would mean |
|---|---|---|
| sb_secret_ | 0 | a Supabase secret-key literal shipped to every visitor |
| service_role | 0 | the service-role JWT role claim present in client code |
| SUPABASE_SERVICE_ROLE_KEY | 0 | the RLS-bypassing key name reachable from the browser |
| ADMIN_API_KEY | 0 | the admin API key that gates `/api/admin/calculate-popularity` |
| ADMIN_EMAILS | 0 | the admin allowlist, an enumeration aid |
| CRON_SECRET | 0 | the shared secret protecting the two cron handlers |
| literal-service-role-key | not-run | sweep for the key's actual value — **not runnable**, no value in env (see ENVSTATE) |
| jwt-shape | 0 | any JWT-shaped string at all, whatever its name |

Additional shape sweeps, same method:

| surface | distinct JWT-shaped strings | note |
|---|---|---|
| `.next/static` | 0 | the client bundle |
| `public/` | 0 | 13 files, served verbatim, never passed through a bundler |
| `.planning/audit/` | 0 | this audit's own leakage surface (01-RESEARCH.md Pitfall 4) |

---

## 4. Server-side control — why 56 hits in `.next/server` is the *correct* result

```bash
command grep -rlF 'SUPABASE_SERVICE_ROLE_KEY' .next/server | wc -l   # -> 56
```

56 files under `.next/server` reference `SUPABASE_SERVICE_ROLE_KEY`. This is **expected and
correct**, and it is what makes the `.next/static` zero meaningful rather than vacuous:

- Next.js inlines only `NEXT_PUBLIC_*` variables into the client bundle. A non-public
  variable stays a **runtime `process.env` read** in server code, so what appears in
  `.next/server` is the variable **name**, not its value.
- The sweep's failure mode would be the reverse asymmetry — the name or value appearing
  under `.next/static`. It does not.
- `NEXT_PUBLIC_SUPABASE_URL` appears by name in 1 client file, which is the inlining
  path behaving as designed for a variable explicitly marked public.

The 56 server references are therefore **not a finding** and should not be filed as one.

---

## 5. Positive control — proof the sweep reached the files

A zero-hit sweep is worthless without evidence that the grep actually read the bundle.
Three known-present strings were swept with the identical command shape:

| control string | files in `.next/static` | conclusion |
|---|---|---|
| `mcgill` | 19 | the sweep reads the JS chunks |
| `supabase` | 2 | the sweep reads Supabase client code |
| `NEXT_PUBLIC_SUPABASE_URL` | 1 | the sweep reads inlined env references |

All three are non-zero under the same `command grep -rlF ... .next/static` invocation that
returned 0 for the six secret patterns. The zeros in § 3 are therefore **real zeros**, not
a grep that silently skipped a gitignored directory.

---

## 6. Finding candidates raised by this sweep

Neither is a secret leak. Both are recorded here because this task is where they surfaced;
plan 01-13 decides severity and whether they are filed.

1. **`.env` defines two misspelled variable names.** `SUPABSE_PUSHABLE_KEY` and
   `SUPABSE_SECRET_KEY` both misspell `SUPABASE`, and neither name is read anywhere in
   `src/`. The repo reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, `ADMIN_EMAILS`, `CRON_SECRET`. A local
   `.env` whose every key is inert is a configuration-drift smell, and — if the values
   behind those misspelled names are live credentials — a credential sitting in a file
   that nothing consumes and nobody rotates. **Values were never read.**

2. **AUDIT-16 cannot be closed from this machine.** The result is INCONCLUSIVE by
   construction. Closing it requires one re-run of this exact sweep against a build
   whose environment carries the real `SUPABASE_SERVICE_ROLE_KEY`, which is a
   `BLOCKING-INPUTS.md` item, not a code change.

---

## 7. Re-run instructions (to convert INCONCLUSIVE into a verdict)

```bash
export SUPABASE_SERVICE_ROLE_KEY=...          # operator's terminal only; never written under .planning/
node -e "process.exit(process.env.SUPABASE_SERVICE_ROLE_KEY ? 0 : 1)" || echo "still absent"
npm run build > .planning/audit/baseline/build.txt 2>&1
# re-run § 2, then:
bash .planning/audit/tools/readonly-guard.sh
node .planning/audit/tools/validate.mjs --check bundle-sweep
```

If the counts are still 0 with the key present, replace the verdict line at the top with
`real-secrets-present — bundle clean`. If any count is non-zero, file it as a **Critical**
finding recording the **file names only** — never the matched value.

---

## Read-only compliance

| Gate | Result |
|---|---|
| `git check-ignore -q .next/static` | exit 0 — the swept directory is gitignored |
| `bash .planning/audit/tools/readonly-guard.sh` after the sweep | exit 0 |
| `.env` / `.env.local` modified | no — names read, values never read |
| Matched secret values written into this artifact | none; counts and file names only |

---

*Requirement: AUDIT-16 — status: INCONCLUSIVE, blocked on a credentialed re-build*
*Phase: 01-read-only-foundation-audit — plan 01-03*
