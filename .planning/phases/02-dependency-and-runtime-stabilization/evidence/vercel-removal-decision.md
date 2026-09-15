# Vercel CLI Removal Decision — STAB-04

**Plan:** 02-04 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Status:** Decided and executed in this plan's batch-1 commit. STAB-04 requires only that
the decision be *recorded*; this file records it, states the alternative that was rejected,
and re-runs the evidence rather than citing it.

> **Decision: remove `vercel` outright. Do not relocate it to `devDependencies`.**
> The CLI was a production dependency at `^32.3.0`, is invoked by nothing in this
> repository at any lifecycle point, and rooted the single Critical advisory in the
> production tree. Keeping it as a devDependency would preserve that subtree — including
> the `tar` critical — in the dev tree in exchange for no capability the project uses.

Every figure and command result below was produced in this working tree on 2026-09-15.
Nothing is transcribed from `02-RESEARCH.md`; where this file's re-derived count differs
from the research document's, the difference is stated rather than smoothed over (§ 5).

---

## 1. The three negative checks

All three are negative. Each is re-runnable and annotated with the result it produced here.

**Check 1 — the CI workflow never invokes the CLI.**

```bash
command grep -nE '(^|[^@/[:alnum:]-])vercel([^[:alnum:]./-]|$)' .github/workflows/*.yml
# -> no output, exit 1 (no match)
```

The character-class guards on either side are deliberate: a bare `grep vercel` would match
`@vercel/analytics` and the word "vercel" inside a URL, and would make this check look
positive when it is not.

**Check 2 — no `package.json` script invokes it.**

```bash
node -e 'const s=require("./package.json").scripts;
  console.log(Object.entries(s).filter(([k,v])=>/(^|[^@\/\w-])vercel([^\w.\/-]|$)/.test(v)).length)'
# -> 0
#
# the full script set at the time of the decision:
#   dev, build, start, lint, test, test:ci, load:online, load:onboarding
#   none of the eight shells out to the CLI
```

**Check 3 — nothing in the source or script tree imports or requires it.**

```bash
command grep -rnE "from ['\"]vercel['\"]|require\(['\"]vercel['\"]\)|import\(['\"]vercel['\"]\)" \
  src/ scripts/ supabase/ load-tests/
# -> no output, exit 1 (no match)
```

**Check 4 — the deployment path does not run a local CLI.** Deployment is Vercel's git
integration; `vercel.json` sets the build command, and that command is `npm run build`:

```bash
node -e 'const v=require("./vercel.json");console.log(v.buildCommand, "|", v.framework)'
# -> npm run build | nextjs
```

There is no CLI anywhere in the path from a push to a deployment. This is the check that
answers the fear the package's *name* creates, and it is why "keep it just in case" has
nothing to be in case of.

---

## 2. THE NEAR-MISS — read this before removing anything matching `@vercel/*`

**`@vercel/analytics` and `@vercel/speed-insights` are imported by the application and must
not be removed. They are different packages from the `vercel` CLI.**

```bash
command grep -rn "@vercel/" src/
# -> src/app/layout.tsx:3:import { SpeedInsights } from "@vercel/speed-insights/next";
# -> src/app/layout.tsx:4:import { Analytics } from "@vercel/analytics/next";
```

Both are rendered in the root layout, so removing either is a user-visible production
behaviour change — precisely what Phase 2 exists not to do (phase-locked constraint 7).

**The documented failure mode is a plan step that removes `@vercel/*` as a group.** The
`vercel` CLI's own subtree contains a dozen packages that genuinely do match `@vercel/*`
(`@vercel/node`, `@vercel/redwood`, `@vercel/static-build`, `@vercel/routing-utils`,
`@vercel/gatsby-plugin-vercel-builder`, …), all of which left the tree as *transitive*
consequences of deleting one line. That is what makes the trap convincing: a glob over
`@vercel/*` would have looked like it was retiring the same advisory rows, and would have
silently taken analytics and speed-insights with it.

This paragraph exists so the trap is documented rather than merely avoided once. Batches
2-5 inherit it.

---

## 3. The rejected alternative: taking npm's suggested fix

`npm audit` proposed a version, and it is re-derived here from the committed before-census
rather than quoted from the research document:

```bash
node -e 'const r=require("./.planning/phases/02-dependency-and-runtime-stabilization/evidence/audit.b1.before.json").vulnerabilities.vercel;
  console.log(JSON.stringify(r.fixAvailable))'
# -> {"name":"vercel","version":"59.17.0","isSemVerMajor":true}
# installed at the time: 32.3.0   =>  a 27-major jump
```

Taking that fix would have upgraded a CLI that nothing calls across 27 major versions —
strictly more risk for strictly less benefit than deleting the line, and forbidden in
spirit by this phase's exclusion of forced audit remediation (phase-locked constraint 2).
It is also the outcome the exit gate's vulnerability-count phrasing quietly encourages:
start at the top of `npm audit --omit=dev` and work down, and this is the first thing it
tells you to do.

The second rejected alternative, **relocation to `devDependencies`**, fails for the reason
in the decision statement: it retains the entire subtree, including the `tar` critical,
and buys nothing, because checks 1-4 show no lifecycle point that would use it.

---

## 4. What the removal retired

Derived by diffing the two committed censuses — `audit.b1.before.json` against
`audit.b1.after.json` — not by counting what was expected to happen:

```bash
node -e 'const B=require("./...audit.b1.before.json").vulnerabilities,
         A=require("./...audit.b1.after.json").vulnerabilities;
  console.log(Object.keys(B).length, Object.keys(A).length,
              Object.keys(B).filter(k=>!A[k]).length)'
# -> 38 15 23
```

| | Before | After | Delta |
|---|---|---|---|
| Critical | 2 | 1 | **−1** |
| High | 22 | 8 | **−14** |
| Moderate | 13 | 6 | **−7** |
| Low | 1 | 0 | **−1** |
| **Total rows** | **38** | **15** | **−23** |
| Production dependencies audited | 680 | 293 | −387 |

**The 23 retired rows.** The Critical is `tar`, which reached the production tree only
through the CLI's `@mapbox/node-pre-gyp` subtree:

- *critical (1):* `tar`
- *high (14):* `@mapbox/node-pre-gyp`, `@vercel/gatsby-plugin-vercel-builder`, `@vercel/node`,
  `@vercel/redwood`, `@vercel/routing-utils`, `axios`, `form-data`, `immutable`, `lodash`,
  `path-to-regexp`, `picomatch`, `swagger-ui-react`, `undici`, `vercel`
- *moderate (7):* `@vercel/hydrogen`, `@vercel/remix-builder`, `@vercel/static-build`,
  `@vercel/static-config`, `ajv`, `esbuild`, `follow-redirects`
- *low (1):* `postcss-selector-parser`

**No row naming the CLI survives**, and no new row was introduced:

```bash
node -e 'const A=require("./...audit.b1.after.json").vulnerabilities;
  console.log(Object.keys(A).filter(k=>k==="vercel"||k.startsWith("@vercel/")).join(",")||"none")'
# -> none
```

The 15 rows that remain are `next` (critical — closed by batch 2's 16.3.5 upgrade),
`brace-expansion`, `fast-uri`, `fast-xml-builder`, `js-yaml`, `nanoid`, `postcss`, `sharp`,
`ws` (high), and `baseline-browser-mapping`, `dompurify`, `fast-xml-parser`, `sanitize-html`,
`styled-components`, `yaml` (moderate). None is rooted in a package this batch could delete.

---

## 5. Two counts that differ from the research document, stated rather than smoothed

The phase rule is that counts are re-derived, never transcribed. Two re-derivations here
disagree with `02-RESEARCH.md`, and both disagreements are recorded:

1. **"Seven High/Critical rows rooted in the CLI."** Re-deriving the rows whose advisory
   nodes sit under `node_modules/vercel`, or whose `effects` name it, returns **six**:
   `vercel`, `@vercel/node`, `@vercel/redwood` (high), `@vercel/hydrogen`,
   `@vercel/remix-builder`, `@vercel/static-build` (moderate). The broader true figure is
   larger, not smaller — 23 rows in total left with this batch — so the research
   document's headline understated the benefit while overstating that one predicate.
2. **`yaml` is not dead and was withdrawn from the batch.** It was planned as the eleventh
   removal. `redoc@2.5.2`'s prebuilt bundles `require("yaml")` while declaring it in
   neither `dependencies` nor `peerDependencies`, and `redoc` is reachable from the public
   `/docs` route. The build failed, `yaml` was restored at `^2.8.2`, and its moderate row
   is one of the 15 that remain. Full write-up in `lock.b1.diff-review.md` § 6.

---

## 6. Reproduce this file

```bash
command grep -nE '(^|[^@/[:alnum:]-])vercel([^[:alnum:]./-]|$)' .github/workflows/*.yml   # no match
command grep -rnE "from ['\"]vercel['\"]|require\(['\"]vercel['\"]\)" src/ scripts/        # no match
command grep -rn "@vercel/" src/                                                           # 2 matches, layout.tsx
node -p "require('./vercel.json').buildCommand"                                            # npm run build
npm audit --omit=dev --json --package-lock-only | node -e '...metadata.vulnerabilities'
```

Artifacts this file cites: `evidence/audit.b1.before.json`, `evidence/audit.b1.after.json`,
`evidence/lock.b1.diff-review.md`, `.planning/audit/quality/dependency-report.md`,
`.planning/audit/quality/dead-code.md`.

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-04 (batch 1)*
