# The npm `devdir` Warning — STAB-02

**Plan:** 02-03 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Tree:** `main` @ `50e9e26`, `node` 24.16.0, `npm` 11.13.0 (`npm_version` in `.planning/audit/baseline/versions.txt`)

> **Decision: the warning does not reproduce on this tree, and STAB-02 closes as documentation, not as a change.**
> `devdir` is a node-gyp configuration key that npm removed from its schema. npm 11 emits it as an
> *unknown config* warning naming the scope it came from — project, user, global, or env — and all four
> scopes are empty on this machine. It is machine state, not repository state. **No repository file was
> edited to chase it, and that is the deliberate outcome, not an omission.**

Every value below was produced by the command printed next to it, in this working tree, on 2026-09-15.
**Nothing is transcribed from a planning or research document** — the probe was re-run rather than quoted,
and § 5 records where doing so corrected the research. Each command carries its actual output as an
inline `# ->` comment so a reader can re-run the note instead of believing it.

**A note on what is captured.** The probe deliberately captures only the `userconfig` and `globalconfig`
*path* lines and the single `devdir` key result. The full `npm config ls -l` dump is **not** pasted here:
it can contain `//registry.npmjs.org/:_authToken` and other credentials, and an evidence file in
`.planning/` is the wrong place for them (threat T-02-03-01).

---

## 1. The headline fact

**`devdir` is unset in all four of npm's configuration scopes, and no npm command on this tree emits an
unknown-config warning.** There is nothing to fix, in the repository or anywhere else this program controls.

---

## 2. The four-scope probe

**Scope 1 — the key itself.** npm resolves all four scopes before answering, so a single `undefined` here
already rules out all four:

```bash
npm config get devdir          # -> undefined
npm --version                  # -> 11.13.0
```

**Scope 2 and 3 — user and global.** npm names the two file paths it would read; neither file exists:

```bash
npm config ls -l | grep -E '^(userconfig|globalconfig) '
# -> globalconfig = "/Users/adyan/.local/share/fnm/node-versions/v24.16.0/installation/etc/npmrc"
# -> userconfig   = "/Users/adyan/.npmrc"

ls -la ~/.npmrc /usr/local/etc/npmrc \
       /Users/adyan/.local/share/fnm/node-versions/v24.16.0/installation/etc/npmrc
# -> "/Users/adyan/.npmrc": No such file or directory (os error 2)
# -> "/usr/local/etc/npmrc": No such file or directory (os error 2)
# -> ".../v24.16.0/installation/etc/npmrc": No such file or directory (os error 2)
```

The `globalconfig` path is inside an `fnm`-managed Node installation, which is why it is not
`/usr/local/etc/npmrc`; both were checked so the answer does not depend on knowing that.

**Scope 4 — environment.** No npm config variable of any kind is exported, so the `env` scope is empty
rather than merely lacking this one key:

```bash
env | grep -i 'npm_config_devdir'   # -> no output (exit 1)
env | grep -ci '^npm_config_'       # -> 0
```

**Scope 0 — project.** npm's project config is the `.npmrc` at the local prefix. The local prefix is this
repository root, and there is no `.npmrc` there:

```bash
npm config ls
# -> prints only the ';' comment header — node bin location, node version,
# -> npm local prefix = /Users/adyan/Documents/GitHub/Event-Radar,
# -> npm version, cwd, HOME — and NOT ONE key=value line from any scope
```

A `key=value` line in `npm config ls` output means some scope set it. There are none, so no scope sets
anything at all on this machine.

**The end-to-end check.** Both install-shaped commands, the local one and the one CI runs, emit no
warning line whatsoever:

```bash
npm install --dry-run 2>&1 | grep -iE 'warn|unknown'   # -> no output (exit 1)
npm ci      --dry-run 2>&1 | grep -iE 'warn|unknown'   # -> no output (exit 1)
```

---

## 3. Identifying the emitter

The warning was reproduced **synthetically, in a scratch directory outside this repository**, on the same
npm 11.13.0, to confirm the message wording and that the scope word is the diagnostic. **No `.npmrc` was
created inside this working tree at any point.**

```bash
# in a scratch directory under the session scratchpad, NOT in this repo
printf 'devdir=/tmp/foo\n' > .npmrc && npm ls
# -> npm warn Unknown project config "devdir". This will stop working in the
# -> next major version of npm. See `npm help npmrc` for supported config options.

rm -f .npmrc && npm_config_devdir=/tmp/foo npm ls
# -> npm warn Unknown env config "devdir". This will stop working in the next
# -> major version of npm. See `npm help npmrc` for supported config options.
```

**The scope word in the message — `project`, `user`, `global`, or `env` — names the file or variable that
has to be fixed.** With both set at once npm emits one line per scope, `env` first, so the message is
unambiguous even when more than one source is responsible. Whoever originally saw this warning saw it
from one of those four scopes, on their own machine, and the message they saw already told them which.

Because the key is a node-gyp configuration key that npm dropped from its schema, the warning is
advisory: it reports that a setting is being ignored. It does not change what npm installs.

---

## 4. What is deliberately **not** being done

**No repository file was edited to resolve STAB-02.** Not `package.json`, not `.github/workflows/ci.yml`,
not `vercel.json`, and no new `.npmrc`.

This is the requirement's documented failure mode, and it is worth naming so the absence of a diff is not
later read as unfinished work. STAB-02 reads like a repository defect, so the natural move is to grep the
repository for `devdir`, find nothing, and then either invent a plausible-looking fix or mark the
requirement blocked. Both are wrong for the same reason: **the repository does not have this defect.**
A commit that edits `package.json` to silence a warning emitted by an absent file on someone else's
machine changes nothing, and leaves behind a change no future reader can justify.

Adding a repository-level `.npmrc` is **optional and not required by STAB-02.** It would be warranted only
if the team wants to *assert* npm configuration — pinning `engine-strict`, a registry, or `save-exact`
for every contributor. That is a separate decision with its own rationale, it is not a fix for this
warning, and it is not being made here.

---

## 5. Correction: one `.npmrc` does exist in the tree, and it is not related

The repository-wide search returns a hit. `02-RESEARCH.md` § Pitfall 7 records this same command as
returning no results; **that is a measurement error in the research, and re-running the probe rather than
transcribing it is what caught it.**

```bash
find . -name .npmrc -not -path './node_modules/*' -not -path './.git/*'
# -> ./supabase/functions/events-webhook/.npmrc

cat supabase/functions/events-webhook/.npmrc
# -> # Configuration for private npm package dependencies
# -> # For more information on using private registries with Edge Functions, see:
# -> # https://supabase.com/docs/guides/functions/import-maps#importing-from-private-registries

grep -c devdir supabase/functions/events-webhook/.npmrc   # -> 0
```

It changes no conclusion in this note, for four independently checked reasons:

1. **It sets nothing.** The file is three comment lines. It has no `key=value` line, so it cannot
   contribute a `devdir` — or any other — unknown-config warning.
2. **npm never reads it.** npm's project config is the `.npmrc` at the local prefix, which
   `npm config ls` reports as `/Users/adyan/Documents/GitHub/Event-Radar` (§ 2). A file four directories
   down is outside that resolution for every npm command this project runs.
3. **It belongs to the Deno edge function**, which is excluded from `tsconfig.json` and is not built by
   npm at all. It is part of the Supabase scaffold — a stock template file.
4. **This plan did not create it.** It has been tracked in git since 2025-11-27, roughly ten months
   before this program began:

```bash
git log --diff-filter=A --format='%h %ad %s' --date=short -- supabase/functions/events-webhook/.npmrc
# -> 9c33891 2025-11-27 wrote supabase edge function for events webhook
```

The plan's acceptance criterion was phrased as "`find . -name .npmrc` returns nothing", intending
*no `.npmrc` was created by this plan*. The intent holds and is proved above by git ancestry; the literal
phrasing was written against the incorrect research measurement. Recorded here rather than silently
satisfied, and re-verified as `git status --porcelain` showing no added or modified `.npmrc`.

---

## 6. The CI half, and the one residual unknown

**CI: unobserved.** Plan 02-01 recorded the CI-side answer in
`evidence/batch-00-jest.txt` as `ci_npm_unknown_config=unobserved`, and that value is carried here rather
than upgraded. It is unobserved for two verified reasons, not for lack of trying: the batch-0 commits are
local only (`git log origin/main -1` is `6f9c3b7`, many commits behind local `main`), so no batch-0 CI run
exists to read; and the most recent completed run (id `26121379844`, 2026-05-19) can no longer be read
either — `gh run view 26121379844 --log` returns `HTTP 410`, GitHub having expired the logs.

**This is named as the one residual unknown rather than implied to be covered.** What bounds it: the CI
runner is a fresh GitHub-hosted image with no user `.npmrc` and no npm config environment variables, so
the warning is unlikely there for the same reason it is absent here — but "unlikely" is not an
observation, and this note does not record it as one. It closes for free the first time a CI run's
`Install dependencies` step log is readable: grep it for `Unknown .* config`. No work is scheduled for it.

**Vercel build image: known-unknown, no blocking effect.** The Vercel build image was not inspected, and
this note does not claim otherwise. It has no bearing on the runtime contract regardless:
`engines.node` in `package.json` governs the Node version Vercel uses and **overrides** the project
dashboard setting, which is exactly what plan 02-01 pinned. An unknown-config warning in a build log is
advisory output; it cannot change a resolved dependency tree, because the tree comes from
`package-lock.json`. Recorded as a bounded unknown with no action.

---

## 7. Reproduce this file

```bash
npm config get devdir
npm config ls -l | grep -E '^(userconfig|globalconfig) '
npm config ls
env | grep -ci '^npm_config_'
find . -name .npmrc -not -path './node_modules/*' -not -path './.git/*'
npm install --dry-run 2>&1 | grep -iE 'warn|unknown'
npm ci      --dry-run 2>&1 | grep -iE 'warn|unknown'
```

Cited artifacts: `.planning/audit/baseline/versions.txt` (`npm_version=11.13.0`, `node_version=24.16.0`),
`.planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-00-jest.txt`
(`ci_npm_unknown_config=unobserved`), `02-RESEARCH.md` § Pitfall 7 (corrected in § 5).

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-03*
