# Next.js Upgrade Note — STAB-05 (batch 2)

**Plan:** 02-05 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Status:** Shipped. The framework moved alone, in one commit, with React provably untouched.

> **Shipped: `next` 16.2.1 → 16.3.5 and `eslint-config-next` 16.0.3 → 16.3.5, in lockstep,
> in a single commit that changed `package.json`, `package-lock.json` and seven comment
> lines in `next.config.js` and nothing else.** Production Critical advisories: **1 → 0**.
> No advisory rooted in the framework survives the batch.

Every number below was produced by a command in this working tree on 2026-09-15 and is
either printed here with its command or cited to a committed capture file. Nothing is
transcribed from `02-RESEARCH.md` — that document's figures were treated as a hypothesis
that task 1 re-tested against the live registry, which is the whole reason task 1 exists.

---

## 1. The requirement text is stale, and this is the correction

**STAB-05 as written names the wrong version.** The requirement says:

> "Next.js on **the patched release closing the July-2026 CVE batch**, own commit,
> `react`/`react-dom` untouched."

The patched release closing the July-2026 batch is **`next@16.2.11`**. Shipping it would
have satisfied the requirement's letter and left this application exposed.

**What happened between the requirement being written and this batch running.** On
**2026-08-25** Vercel published the August 2026 security release, and on **2026-09-08** two
**critical** advisories were disclosed against every 16.x below 16.3.3:

| Advisory | Severity | Summary | First patched (16.x) |
|----------|----------|---------|----------------------|
| `GHSA-2xp9-vwfh-vxw4` | critical | Unauthenticated remote code execution in the Image Optimization API when AVIF files are used | **16.3.3** |
| `GHSA-p293-qw3h-jr36` | critical | Unauthenticated remote code execution on Windows-hosted servers | **16.3.3** |

Both were read from the GitHub advisory database at the start of this batch, not from the
research document — see `evidence/next-target-verification.txt`, which carries the verbatim
`gh api /advisories` output. This tree's own `npm audit` independently agrees: it reports the
vulnerable range as `9.3.4-canary.0 - 16.3.2`, which is only consistent with 16.3.3 being the
first patched release.

| | Version | Verdict |
|---|---|---|
| **Original STAB-05 target** | `16.2.11` | Closes the eleven July-2026 advisories. **Leaves both 2026-09-08 criticals open.** |
| **Minimum patched target** | `16.3.3` | Closes both criticals. |
| **Shipped target** | **`16.3.5`** | Newest published stable on the 16.x line (2026-09-11T17:26:46Z). Inside the declared `^16.0.3` range. |

**Why 16.3.5 and not 16.3.3.** The decision rule recorded in
`evidence/next-target-verification.txt` is: *the target is the newest published stable release
on the 16.x line at or above the highest `first_patched` across every advisory affecting a 16.x
range.* The rule is written down so that a reader can re-derive the same answer later, and so
that a future batch does not re-argue it from memory. Applying it: highest `first_patched` =
16.3.3; newest published stable = 16.3.5; 16.3.5 ≥ 16.3.3, so 16.3.5.

**Both of task 1's hard stops were checked and neither fired.** The registry `latest` dist-tag
is 16.3.5, a 16.x — had it been a 17.x the target would have stayed on the newest 16.x line,
because a framework major is out of this phase's scope and would need its own change with a
migration note (STAB-10). And every one of the thirty 16.x-affecting advisories reports a
`first_patched` at or below 16.3.3, so there is no advisory whose fix requires a version that
does not exist. Had one existed, this plan's instruction was to stop and record a blocking
finding rather than upgrade into a version that does not close its own advisory.

**This is a documented correction, not a silent divergence.** A reader diffing STAB-05's text
against the shipped artifact will find 16.2.11 on one side and 16.3.5 on the other; this
section is why. Plan 02-11 should carry the correction into the requirement text rather than
leave the stale number standing.

---

## 2. React did not move — four values, not an assertion

This is the constraint the phase was most likely to violate by accident, so it is recorded as
evidence rather than claimed. Manifest ranges read from `package.json` at `HEAD~1` and `HEAD`;
resolved versions read from `package-lock.json` at the same two commits.

| Package | Manifest before | Manifest after | Resolved before | Resolved after |
|---------|-----------------|----------------|-----------------|----------------|
| `react` | `^18.3.0` | `^18.3.0` | `18.3.1` | `18.3.1` |
| `react-dom` | `^18.3.0` | `^18.3.0` | `18.3.1` | `18.3.1` |

Four values, all unchanged. Three further independent checks agree:

- `git diff HEAD~1 -- package.json | grep -cE '^[+-].*"react(-dom)?"'` → **0**. No line
  mentioning either package appears on either side of the manifest diff.
- Neither `node_modules/react` nor `node_modules/react-dom` appears in the structural
  lockfile diff's version-changed list (44 entries, all inside the
  `next` / `sharp` / `postcss` / `eslint-config-next` subtree).
- `check-baseline.mjs` asserts it as a standing rule:
  `PASS react-untouched :: react-range-byte-identical :: ^18.3.0 -> ^18.3.0` for both.

**Why it held.** Two explicit `npm pkg set` edits followed by one
`npm install --package-lock-only`. No broad `npm update --save`, no accepted bot PR, no
`npm audit fix`. The peer range at the target is
`^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0`, so React 18.3.1 satisfies 16.3.5 and npm
had no reason to move it.

---

## 3. Advisory delta

Both sides are committed JSON produced by the identical command,
`npm audit --omit=dev --json --package-lock-only`:
`evidence/audit.b2.before.json` → `evidence/audit.b2.after.json`.

| Severity | Before | After | Δ |
|----------|--------|-------|---|
| critical | **1** | **0** | **−1** |
| high | 8 | 6 | −2 |
| moderate | 6 | 6 | 0 |
| low | 0 | 0 | 0 |
| **total** | **15** | **12** | **−3** |

**Modules retired: `next`, `nanoid`, `sharp`. Modules added: none.**

Only `next` was targeted. The other two are side effects of the pin, exactly as
`02-RESEARCH.md` predicted:

- **`sharp` 0.34.5 → 0.35.4** — `next@16.3.5` requires `sharp ^0.35.4`, past the
  `<= 0.35.4-rc.0` advisory ceiling.
- **`nanoid` 3.3.11 → 3.3.19** — pulled forward through the framework subtree.
- **`postcss`**: the root copy moved 8.5.6 → 8.5.23 **and** the nested
  `node_modules/next/node_modules/postcss@8.4.31` entry — a pinned vulnerable copy — was
  deleted outright. `postcss` nevertheless still appears in the after census, and the honest
  reading is that **this is a different copy**: the surviving row is
  `node_modules/styled-components/node_modules/postcss@8.4.49`, reached via `redoc` →
  `styled-components`, with an advisory range of `<= 8.5.22`. Batch 4 owns it. Recording
  "postcss fixed" here would be wrong.

**Lockfile discipline (STAB-11).** The diff was read as a diff, not trusted from a count:
1054 lines / 303 insertions / 230 deletions, `lockfileVersion` 3 → 3 unchanged. Structurally,
972 entries against 971: **2 added, 1 removed, 44 version-changed**, and every one of the 44
sits inside the `next` / `sharp` / `postcss` / `eslint-config-next` subtree. This is the
structural review method plan 02-04 established in `evidence/lock.b1.diff-review.md`, applied
again here. No `npm audit fix` was run; the lockfile was reconciled, never regenerated.

**The two added entries are a small deviation from this plan's threat model and are recorded
rather than waved through.** Threat row T-02-05-SC asserted that "no new package name enters
the tree." Two did: `@img/sharp-freebsd-wasm32@0.35.4` and
`@img/sharp-webcontainers-wasm32@0.35.4`. They are `optionalDependencies` of `sharp@0.35.4`,
whose platform-binary matrix grew from 23 to 25 entries between 0.34.5 and 0.35.4. Checked
against the registry: same `@img` scope, same repository (`git+https://github.com/lovell/sharp`)
and the same sole maintainer (`lovell <npm@lovell.info>`) as the twenty-three `@img/sharp-*`
packages already in the tree. Both are platform-gated (`os: ["freebsd"]` and `cpu: ["wasm32"]`)
so neither installs on this host or on a Vercel Linux runtime. No new *direct* dependency, no
unrecognised name, no legitimacy checkpoint warranted — but the threat model said zero and the
answer was two, so it is written down.

---

## 4. The cache-poisoning advisories are closed BY VERSION. The exposure is NOT closed.

**This section exists so that nothing downstream can read "closed" as "fixed."**

The five RSC cache-poisoning and cache-confusion advisories — `GHSA-3g8h-86w9-wvmq`,
`GHSA-vfv6-92ff-j949`, `GHSA-wfc6-r584-vfw7`, `GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q` —
are all patched below 16.3.3 and are therefore closed by this batch's version bump. They no
longer appear in `evidence/audit.b2.after.json`.

**And in the same breath: Phase 1 proved by measurement that the shared-cache precondition
these advisories need is live on this deployment right now.**

F-025 ("Personalized API responses are stored by the shared CDN cache under a key that ignores
the session", **Critical**) is backed by `.planning/audit/cache/cache-matrix.csv`: eight
personalized production routes returned `x-vercel-cache` HIT or STALE with non-zero age — up to
96 s — under the blanket `s-maxage=60` in `vercel.json:12`, and **not one response in the entire
run varied on `Cookie` or `Authorization`**; every `vary` read `accept-encoding` and nothing
else. A cache entry is keyed by URL alone and served to every caller of that URL.

So the correct statement is: **the framework advisories are closed; the exposure is not.**
Batch 2 removed the framework-level defects. It did not touch the deployment-level condition
that makes cache confusion consequential here, and it was never scoped to.

**`REFAC-19` in Phase 6 is the change that actually removes the precondition** — the blanket
`vercel.json` `s-maxage=60` cannot be lifted until every route is classified and refactored,
which is why it is last in the program rather than here. **F-025 remains Open at Critical and
Stage 2 does not close it.** Plan 02-11's completion note must not present the zero-Critical
production census as meaning the caching exposure is resolved: the census counts *advisories*,
and F-025 is a *finding* about this deployment's configuration.

This is `02-RESEARCH.md` assumption **A4** and named open item **#4** in
`evidence/VULNERABILITY-POLICY.md`, discharged exactly as that policy required —
by version, with the citation attached.

---

## 5. F-051 and F-057

**`F-051`** — "next 16.2.1 carries 25 advisories, two of them critical, reachable on every
request, with a fix inside the declared range" (High). **Closed by this batch.** The fix was
indeed inside the declared `^16.0.3` range, so the remediation cost was a lockfile update and
not a migration, as the finding predicted. `next` no longer appears as a vulnerable module in
`evidence/audit.b2.after.json`. Note that F-051's own severity rationale already flagged that
the five cache-poisoning records could not be closed by configuration because F-025 had proven
the precondition present — § 4 above is the discharge of that caveat.

**`F-057`** — "A Windows remote-code-execution critical is dispositioned 'not applicable' on an
unverified assumption about the host OS" (Low). **Closed by version, and the evidence gap is
now moot.** F-057 was never a vulnerability; it was an *evidence gap*. Phase 1 ruled
`GHSA-p293-qw3h-jr36` out on the assumption that the production runtime is Linux — almost
certainly correct, and confirmed by no capture in that phase. At 16.3.3+ the advisory is
patched regardless of the host operating system, so **the assumption stops mattering**. The
runtime OS was still never captured, and this note does not claim otherwise; it claims that the
question no longer has a consequence.

**Stated explicitly, because both alternatives misreport the state:** closing F-057 silently
would hide that an unverified assumption was ever load-bearing, and leaving it Open against a
patched advisory would imply a live exposure that no longer exists. F-057 is closed **on the
basis that the version bump made its gap moot**, with that reason recorded here. This is named
open item **#5** in `evidence/VULNERABILITY-POLICY.md`.

---

## 6. The image-optimization config line now explains itself

`next.config.js` sets `images.unoptimized: true`. That single boolean is what keeps the Next
Image Optimization endpoint — and therefore the AVIF decode path carrying
`GHSA-2xp9-vwfh-vxw4` — unreachable on this deployment. Before this batch, nothing in the file
said so. It was the one line in the repository that was load-bearing for security while being
silent about it, and it is one good-faith performance edit away from re-arming an
unauthenticated RCE.

A seven-line comment block naming the advisory now sits directly above the key. `git diff --
next.config.js` shows **added comment lines only** — no key and no value changed. The CSP's
inline-script and `eval` allowances, the frame and referrer headers and the remote image
patterns were all left exactly as they were; CSP tightening is a Phase 5 item and editing it
here would have broken the before/after comparison this phase exists to make meaningful.

The endpoint is therefore disabled by **two independent controls**: the version (which patches
the decode path upstream) and the config line (which makes the endpoint unreachable at all).
The comment is what stops the second one from being removed by accident. It was part of the
disposition in `evidence/VULNERABILITY-POLICY.md` named open item #3, not a nicety.

---

## 7. Residual risk: the changelogs were not read

**The claim that 16.3.5 introduces no behavioural change affecting this application does not
rest on a changelog review, because no changelog review was done.** Only advisory data and the
dependency manifest were read. The 16.2.x → 16.3.x release notes were not. This is
`02-RESEARCH.md` assumption **A3**, and it is recorded here rather than buried because the
batch's safety argument depends entirely on what replaced it: **the gate**.

What the gate actually proved:

| Check | Result | Capture |
|-------|--------|---------|
| `npm run lint` | exit 0, **0 errors** | `evidence/batch-02-lint.txt` |
| `npx tsc --noEmit` | exit 0, zero diagnostics | `evidence/batch-02-tsc.txt` |
| `npx jest --ci` | **247 passed, 36 skipped, 0 failed** — identical to the pre-batch wave-2 gate | `evidence/batch-02-jest.txt` |
| `npm run build` (cold) | exit 0, 44 routes | `evidence/batch-02-build.txt` |
| `scripts/smoke.sh` (Tier 2) | **9/10, ring rows 4/4** — verdicts identical to batch 0 and batch 1 | `evidence/smoke.b2.txt` |
| `check-baseline.mjs` | **22 passed, 0 failed** | — |

The ring rows are the load-bearing ones: `/profile` and `/my-events` still 307 to
`?signin=required`, the rate limiter still returns 429 with `Retry-After: 60` after 31 POSTs,
and `/_next/static/` still returns 200 with no `Location`. The only page-level authentication
ring this application has survived the framework bump. Smoke row 2 fails on an empty local
dataset, identically to `smoke.b0.txt` captured before any dependency changed, which is what
establishes it as pre-existing.

**A3 was not fully vindicated — the gate caught two real behavioural changes**, which is
precisely the outcome the assumption's mitigation anticipated:

1. **`eslint-config-next` 16.3.5 ships a rule the baseline config did not have.** Warnings went
   12 → 19. All twelve baseline warnings are unchanged; the seven new ones come from a single
   new rule, `@next/next/no-location-assign-relative-destination`, firing on pre-existing
   `window.location` writes in files this batch does not touch. 0 errors, so the gate still
   exits 0. Deferred, not fixed — `evidence/deferred-items.md` **D-01**.
2. **`next dev` now writes an agent-rules block into the tracked `CLAUDE.md`** (emitter:
   `node_modules/next/dist/server/lib/generate-agent-files.js`, new in the 16.3.x line). It
   appends inside `BEGIN`/`END` markers — 10 insertions, 0 deletions, every pre-existing line
   intact — and re-adds the block if deleted. Resolved by committing it, which is the
   upstream-sanctioned outcome and needs no config change in a framework-only batch. The
   alternative (`agentRules: false`) is a project-governance decision and is raised for the
   user in `evidence/deferred-items.md` **D-02**.

Neither is a runtime behavioural change to the application, and no test, type, build or smoke
verdict moved. But both are changes that a changelog review would have predicted and this batch
found empirically instead. **The honest summary of A3 after batch 2: the assumption held for
application behaviour and failed twice for tooling behaviour, and the gate is what found both.**

One further residual, unrelated to A3: the `⚠ The "middleware" file convention is deprecated`
warning is still present in the build log, once, exactly as in batches 0 and 1. The
`src/middleware.ts` → `src/proxy.ts` rename is **batch 3**. Its disappearance is batch 3's
evidence; its presence here is the control.

---

## 8. One gate check was changed, and it was tightened

`check-baseline.mjs`'s `warnings-not-above-baseline` rule compared a single aggregate warning
count against the AUDIT-13 baseline of 12. It failed at 19. **Changing a gate so that it passes
is the classic bad smell, so the reasoning is recorded in full rather than in a commit
message.**

The aggregate count is only a valid comparison while the **rule set** is held constant. Batch 2
moved `eslint-config-next`, which changed the rule set. Comparing 19 against 12 across that
boundary compares two different measurements and reports a regression that did not occur — all
twelve baseline warnings are individually unchanged.

The aggregate threshold was a **proxy**. The property it stood in for is *"this change
introduced no new lint problems in code under our control,"* and that property is now checked
directly, per rule:

- `no-baseline-rule-regressed` — for every rule present at baseline, live count ≤ baseline count.
- `warning-delta-fully-attributed` — every warning above the baseline total must be attributable
  to a rule absent at baseline, and the gate output **names those rules and their counts**, so
  the number never disappears from view.

**The gate got stricter, not looser**, and that was proven rather than asserted. Replaying the
new assertions against synthetic inputs:

```
GATE PASSES  actual batch-2 run (12 baseline warnings intact, +7 from one new rule)
GATE FAILS   SYNTHETIC: +1 warning on a baseline rule (no-img-element 4->5)
     no-baseline-rule-regressed: @next/next/no-img-element 4->5
     warning-delta-fully-attributed: delta +8 but only 7 from new rules
GATE FAILS   SYNTHETIC: regression hidden under an UNCHANGED total of 19
     no-baseline-rule-regressed: @next/next/no-img-element 4->5
```

The third case is the point: a real regression offset by a disappearing warning, leaving the
total unmoved. The old aggregate check could not see it. The new one fails on it.

This is the same move plan 02-04 made when it replaced the ~2,000-line lockfile-diff threshold
with a direct structural check of entries added, removed and re-resolved — *check the property,
not the proxy.* The `no-baseline-rule-regressed` line now appears in every subsequent batch's
gate output, so batches 3–5 inherit the stricter check.

---

## 9. Requirements

| Requirement | Status after this plan | Reason |
|---|---|---|
| **STAB-05** | **Complete** | Every clause delivered: the framework is on a patched release (16.3.5 ≥ 16.3.3), it shipped in its own commit (`cf6b3c9`), and `react`/`react-dom` are untouched on all four values. The requirement's *stated version* was superseded; § 1 records the correction, and 02-11 should amend the text. |
| **STAB-09** | **Pending** | Names the full batch sequence "each batch followed by a smoke pass." Batch 2 ran its smoke pass (`evidence/smoke.b2.txt`, ring 4/4), but batches 3–5 are outstanding. Marking it complete here would claim work that has not run. |
| **STAB-11** | **Pending** | Lockfile discipline is a standing property across the whole phase, not a deliverable of one batch. Batch 2 honoured it — reconciled never regenerated, no forced remediation, `lockfileVersion` unchanged, diff read structurally — and `check-baseline.mjs`'s `lockfile-discipline` rules assert it on every subsequent run. It is satisfiable only at the phase exit gate in 02-11. |

Precedent followed: a requirement is marked complete only when **every** clause is delivered by
the plan claiming it. Plans 02-01 and 02-04 both withheld requirements on this basis.

---

## 10. Artifacts

Produced by this plan, all under
`.planning/phases/02-dependency-and-runtime-stabilization/evidence/`:

| File | Contents |
|------|----------|
| `next-target-verification.txt` | Verbatim registry and advisory captures, the `target_next_version=16.3.5` line, the decision rule, and both hard-stop checks |
| `next-upgrade-note.md` | This file |
| `audit.b2.before.json` / `audit.b2.after.json` | The two censuses the § 3 delta is computed from |
| `lock.b2.before.sha256` | Pre-batch lockfile digest |
| `batch-02-{lint,tsc,jest,build}.txt` | The four gate commands, verbatim, with provenance blocks and `exit_code=` lines |
| `smoke.b2.txt` | Tier 2 smoke, 10 rows, with the batch-1 comparison and the row-2 explanation |
| `deferred-items.md` | D-01 (seven `window.location` sites) and D-02 (the `CLAUDE.md` write) |

Modified source: `package.json`, `package-lock.json`, `next.config.js` (comment lines only),
`evidence/tools/check-baseline.mjs` (§ 8), `CLAUDE.md` (the appended upstream block, D-02).

Cited but not produced here: `.planning/audit/findings.json` (F-051, F-057, F-025),
`.planning/audit/cache/cache-matrix.csv`, `.planning/audit/quality/dependency-report.md` § 3,
`.planning/audit/baseline/lint.txt`, `evidence/VULNERABILITY-POLICY.md`,
`evidence/lock.b1.diff-review.md`, `evidence/batch-01-build.txt`, `evidence/smoke.b0.txt`,
`evidence/smoke.b1.txt`.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-05*
