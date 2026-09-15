# The CI run record — STAB-14

**Plan:** 02-09 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Workflow:** `.github/workflows/ci.yml`, job `ci`, after the `Production vulnerability gate` step was added.

---

## 1. The headline — OBSERVED GREEN on 2026-09-15

> **THE CI RUN IS OBSERVED AND GREEN.** Run `35011042332` of `.github/workflows/ci.yml`, job `ci`,
> on commit `7e797af` (the push of the whole Phase 2 tree plus `02-SECURITY.md`), completed with
> `conclusion: success` and **all six workflow steps green**, in the workflow's declared order,
> including **`Production vulnerability gate`** and **`Run tests`**.
>
> https://github.com/gdgmcgill/Event-Radar/actions/runs/35011042332

STAB-14's evidence clause — a gate that has been seen to pass — is now met by an observed run,
recorded in § 5 with per-step conclusions read from the run object (`gh run view --json jobs`),
not inferred. §§ 1a–4 below are kept verbatim as the record of how the phase stood before the
push, because the honesty of that record is the reason the first observed run could be trusted
to be green rather than suppressed.

**What changed between the rehearsal tree (`445f7dc`, § 4) and the run's tree (`7e797af`):**
plans 02-10 and 02-11 (Renovate config, SBOM, bundle-size evidence, clean-room proof, the
completion note, the finding-register reconciliation), the code-review report, and the security
verification file. None of those commits touches `src/`, `package.json` or `package-lock.json`
(`check-baseline.mjs` `lockfile-discipline` and `react-untouched` still PASS on `7e797af`), so
the gate's input — the lockfile — is byte-identical to the one rehearsed in § 4.

## 1a. What the pre-push record said (preserved)

> **THE CI RUN IS UNOBSERVED. There is no green run to point at, and this file does not
> imply one.**
>
> STAB-14 asks for a gate that has been seen to pass, and that is not what this file
> delivers. What it delivers is the full local rehearsal of every step the workflow runs,
> in the workflow's own order, with exit codes — plus the exact, named, single action a
> human must take to convert it into the real thing.

The plan's instruction on this point is followed literally: *"If the CI run cannot be
observed from this session, say so explicitly in the note rather than implying a pass,
and record what a human needs to check. An unobserved run recorded honestly is a smaller
problem than a claimed one."*

## 2. Why it is unobserved — a measurement, not an excuse

**Every commit in this phase is local. Nothing has been pushed, deliberately.**

```bash
git rev-parse HEAD           # -> 445f7dcd68b2b2caae10d901f334e2d66f908f3d
git rev-parse origin/main    # -> 6f9c3b7042de9d3874997cd2464af4697cb0be9a
git rev-list --count origin/main..HEAD   # -> 113
```

**113 commits ahead of the remote.** Phase 2's entire batch sequence — batches 0 through 6,
plans 02-01 through 02-09 — exists only in this working tree. GitHub Actions has therefore
never seen the workflow file that contains the gate step, let alone run it. No amount of
looking will find a run of a workflow that was never pushed.

The most recent completed run on the remote predates all of it and cannot be read either:

```bash
gh run list --limit 1
# -> completed  success  "Add brand asset kit, ..."  CI  main  push  26121379844  1m44s  2026-05-19T19:51:00Z
gh run view 26121379844 --log
# -> failed to get run log: HTTP 410 (.../actions/runs/26121379844/logs)
gh api repos/gdgmcgill/Event-Radar/actions/jobs/76823962562/logs
# -> {"message":"Server Error","status":"410"}
```

GitHub has expired that run's logs. **Re-checked here rather than transcribed from
`evidence/devdir-investigation.md` § 6, and the answer is unchanged.**

## 3. What a human must do — one action, one check

**The unblock condition is a push. That is the whole of it.**

1. Push this branch. The gate step is already in `.github/workflows/ci.yml` and is already
   green against this exact tree locally (§ 4), so the run is expected to pass — but
   *expected* is the word this file refuses to upgrade on its own.
2. Open the resulting run and confirm **six** step conclusions: `Install dependencies`,
   `Run linter`, `TypeScript type-check`, `Run tests`, **`Production vulnerability gate`**,
   `Run build`.
3. Replace § 1 and § 5 of this file with the run URL, the run identifier, the commit SHA,
   the date, and those six conclusions.
4. While the logs are open, settle § 6 — it is a single `grep` and it closes STAB-02 for free.

**If the gate step fails on that first run, do not add `continue-on-error` and do not merge
past it.** A red gate on its first run means the tree moved between this rehearsal and the
push, and the correct response is to find what moved. The entire reason this step was added
last, in batch 6 rather than batch 0, is so that its first run is green; a first run that is
red and then suppressed reproduces F-065 exactly, which is the failure mode this phase exists
to close.

## 4. The local rehearsal — every workflow step, in workflow order

This is the strongest evidence that exists today. It is **not** a CI run and is not labelled
as one. It is the same commands, in the same order, on the same tree, on this machine.

| # | Workflow step | Command as the workflow runs it | Local exit | Evidence |
|---|---|---|---|---|
| 1 | Install dependencies | `npm ci` | **0** | `added 989 packages, and audited 990 packages in 10s` |
| 2 | Run linter | `npm run lint` | **0** | `evidence/batch-06-lint.txt` — 0 errors, 19 warnings, an identical warning set to batch 5 |
| 3 | TypeScript type-check | `npx tsc --noEmit` | **0** | `evidence/batch-06-tsc.txt` — zero bytes of output |
| 4 | Run tests | `npm test` | **0** | 278 passed, 5 skipped, 22 of 23 suites. Run as the workflow spells it — plain `npm test`, no `--ci` — so the rehearsal matches the step rather than approximating it. `evidence/batch-06-jest.txt` holds the `--ci` variant, with the same figures |
| 5 | **Production vulnerability gate** | `npm audit --audit-level=high --omit=dev` | **0** | `evidence/audit-gate-local.txt`, ending `exit_code=0` |
| 6 | Run build | `npm run build` | **0** | `evidence/batch-06-build.txt` — cold build, route table identical to batch 5 |

**Tree under rehearsal:** local `main` @ `445f7dc` (`fix(02-09): close the last production
High with a postcss override`).
**Lockfile:** `sha256 842ed8a7ea336d74e3dd4966467743df7aaf886a62aa191a7209b78ec9af3812`.
**Toolchain:** node v24.16.0, npm 11.13.0, typescript 5.9.3, jest 30.2.0, eslint 9.39.1, next 16.3.5.
**Date:** 2026-09-15.

**Two honest caveats on how far this rehearsal transfers:**

- **The runner is not this machine.** CI runs `ubuntu-latest` on Node 24 resolved from
  `.nvmrc` via `node-version-file`; this rehearsal ran macOS on node v24.16.0 from `fnm`.
  Same declared major, different image. Platform-specific optional dependencies — `sharp`
  and the `@next/swc-*` family — resolve to different binaries there.
- **Step 5 is the step least sensitive to that.** `npm audit` compares the lockfile's
  resolved versions against the registry's advisory database. It does not execute the
  dependency tree, so its answer is a property of `package-lock.json`, which is identical
  on both machines. Of all six steps, the gate is the one whose local result transfers most
  cleanly. That is a reason for confidence, not a substitute for the run.

## 5. The run record — filled in after the push, 2026-09-15

| Field | Value |
|---|---|
| Run URL | https://github.com/gdgmcgill/Event-Radar/actions/runs/35011042332 |
| Run identifier | `35011042332` (workflow `CI`, job `ci`, trigger `push` to `main`) |
| Commit SHA the run ran against | `7e797af3ab01caf6d1be56b6e147f980a5a4076f` — `docs(phase-02): add security threat verification` |
| Date | 2026-09-15 · created 19:00:53Z · completed 19:02:02Z (69 s) |
| Runner | `ubuntu-latest`, Node **v24.20.0** resolved from `.nvmrc` via `node-version-file` (`Found in cache @ /opt/hostedtoolcache/node/24.20.0/x64`) |
| `Install dependencies` | **success** |
| `Run linter` | **success** |
| `TypeScript type-check` | **success** |
| `Run tests` | **success** — `Test Suites: 1 skipped, 22 passed, 22 of 23 total` · `Tests: 5 skipped, 278 passed, 283 total` — identical to the local rehearsal and to the `check-baseline.mjs` figures |
| `Production vulnerability gate` | **success** — `npm audit --audit-level=high --omit=dev` exit 0 on the runner |
| `Run build` | **success** |

Conclusions were read with
`gh run view 35011042332 --json status,conclusion,jobs` and are quoted as step name and
conclusion only, per § 7. The run's Node (v24.20.0) differs in patch from the local rehearsal's
(v24.16.0); both are the pinned major and the `engines` field admits both.

**STAB-14 is therefore delivered in whole**: the step exists, is unsuppressed, is positioned
after the tests and before the build, was green locally first (§ 4), and has now been observed
green on a real runner. Plan 02-11's completion note (`STAGE-2-COMPLETION.md` § 13) is amended
to record STAB-14 and STAB-02 as met, citing this section.

## 6. The CI half of STAB-02 — the npm unknown-config warning

**SETTLED on 2026-09-15 from the `Install dependencies` step log of run `35011042332`:
`ci_npm_unknown_config=absent`.** The grep below was run over the step's log
(`gh run view 35011042332 --log`, filtered to the `Install dependencies` step):

```
grep -ciE 'unknown .* config'     # -> 0
grep -ci  'npm warn'              # -> 12  (6 × "deprecated", 6 × "install-scripts"; no config scope word)
```

The twelve `npm warn` lines are the registry's deprecation notices for transitive packages and
npm 11's install-scripts notices; none carries the `Unknown <scope> config` shape, so no scope
word is recorded. STAB-02's CI clause closes on this observation. The paragraphs below are the
pre-push record, preserved.

**As it stood before the push:** still unobservable, re-checked rather than carried forward on
faith. The answer was: ABSENT locally, UNKNOWN on CI.

`evidence/devdir-investigation.md` § 6 named this as the one residual unknown of STAB-02 and
recorded `ci_npm_unknown_config=unobserved` (the value plan 02-01 wrote into
`evidence/batch-00-jest.txt:153`). This plan was supposed to settle it by reading the install
step's log of the run in § 5. There is no such run, and the one historical run that exists has
had its logs expired by GitHub (§ 2, both API paths re-tried and both returning 410).

What *was* re-run, on this tree, today:

```bash
npm ci --dry-run 2>&1 | command grep -ciE 'unknown .* config|npm warn'   # -> 0
```

Zero. No npm command on this tree emits an unknown-config warning of any scope, which is the
same result `devdir-investigation.md` §§ 1–2 recorded, re-derived on a tree six batches newer.

**What a human must grep, once a run exists.** Open the `Install dependencies` step log and
search for the warning:

```
npm warn Unknown <scope> config "<key>". This will stop working in the next major version of npm.
```

**The scope word is the diagnostic, not the key.** It is one of `project`, `user`, `global`,
or `env`, and it names the file or variable that would have to be fixed
(`devdir-investigation.md` § 3 reproduced all four synthetically, outside this repository, to
establish that). Record the result here as `ci_npm_unknown_config=present:<scope>` or
`ci_npm_unknown_config=absent`.

**What bounds the unknown, stated as a bound and not as a finding:** a GitHub-hosted runner is
a fresh image with no user `.npmrc` and no npm config environment variables, so the warning is
*unlikely* there for the same reason it is absent here. **"Unlikely" is not an observation and
is not recorded as one.** No work is scheduled against it; it closes for free the first time a
run's install log is readable.

**Current value: `ci_npm_unknown_config=absent`** (was `unobserved` until run `35011042332`).

## 7. What this file deliberately does not contain

Only step names, conclusions, run identifiers, the two Jest summary lines, the runner's Node
version line and the § 6 grep counts are quoted from the run; no other log content is copied in. The workflow's only environment values are two literal placeholder strings already
committed in `ci.yml` (`https://placeholder.supabase.co` and `placeholder-key`); no real
credential appears in the workflow, and none may be pasted into this file (threat T-02-09-06).

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-09*
*Cross-referenced from `evidence/devdir-investigation.md` § 6.*
