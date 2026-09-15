# Batch 1 lockfile diff review — STAB-11

**Plan:** 02-04 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15

> **Verdict: the diff is 8,842 changed lines — over the plan's ~2,000-line warning
> threshold — and it is nonetheless clean.** The threshold is a proxy for the property
> that actually matters: *did npm change anything I did not ask it to?* That property
> was checked directly, entry by entry, and it holds. **299 lock entries removed, 0
> added, 0 re-resolved to a different version.**

A line count cannot distinguish "npm quietly upgraded forty packages" from "one very
large dead subtree left the tree." Batch 1 removes the Vercel CLI and the Swagger UI /
apidom stack, which are among the largest subtrees in this lockfile, so a big diff was
always going to be the *expected* shape of a correct change. Rather than lower the
threshold or wave the number through, the diff was reduced to a structural comparison
that answers the underlying question directly.

## 1. The structural comparison

```bash
node -e '
const {execSync}=require("child_process");
const B=JSON.parse(execSync("git show HEAD:package-lock.json",{maxBuffer:1e9})).packages;
const A=JSON.parse(require("fs").readFileSync("package-lock.json")).packages;
const bk=Object.keys(B),ak=Object.keys(A);
const removed=bk.filter(k=>!A[k]), added=ak.filter(k=>!B[k]);
const changed=bk.filter(k=>A[k]&&B[k].version!==A[k].version);
console.log(bk.length,ak.length,removed.length,added.length,changed.length);'
```

| Dimension | Value | What it means |
|---|---|---|
| Lock entries before | 1,270 | |
| Lock entries after | 971 | |
| **Entries removed** | **299** | The dead subtrees, and only those |
| **Entries added** | **0** | No package entered the tree (closes T-02-04-05) |
| **Entries re-resolved to a new version** | **0** | No silent upgrade rode along |
| `dev`/`optional`/`peer` flag flips | 167 | See § 2 — this is the batch's actual win |
| `lockfileVersion` | 3 → 3 | Unchanged |
| Raw diff | 2,591 insertions / 6,251 deletions = 8,842 | See § 3 |

## 2. Why 167 flag flips, and why they are the point

165 of the 167 are `dev=false → dev=true`. These are packages that were in the
**production** tree only because something batch 1 removed pulled them there, and that
are now correctly dev-only. This is the same fact as `audit --omit=dev`'s production
dependency count falling from **680 to 293**, seen from the lockfile side instead of the
audit side. The remaining two flips are an `optional` and a `devOptional` reclassification.

Exactly one surviving entry has a non-flag field change: the root entry's `.dependencies`,
which is the manifest mirror. That is the edit itself.

## 3. Where the 8,842 lines come from

Fully accounted for, with no remainder:

- **6,251 deletions** — the 299 removed entries, averaging ~21 lines of JSON each.
- **2,591 insertions** — a flag flip rewrites its entry block, so `git diff` scores each
  of the 167 flipped entries as a delete plus an insert. Those paired inserts, plus the
  root manifest mirror, are the insertion count. **Not one insertion is a new package.**

This is why the raw count is the wrong instrument here: 2,591 "insertions" that add
nothing read identically to 2,591 insertions that add forty packages, unless you look.

## 4. The eleven declarations, before → after

```bash
node -e 'const B=...,A=...; for (const r of roots) console.log(B["node_modules/"+r], A["node_modules/"+r])'
```

| Declaration | Was | Now |
|---|---|---|
| `vercel` | 32.3.0 | gone |
| `swagger-ui-react` | 5.32.1 | gone |
| `@swagger-api/apidom-ns-openapi-3-1` | 1.8.0 | gone |
| `chart.js` | 4.5.1 | gone |
| `react-chartjs-2` | 5.3.1 | gone |
| `@radix-ui/react-switch` | 1.2.6 | gone |
| `@radix-ui/react-tabs` | 1.1.13 | gone |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | gone (with its dead wrapper) |
| `@types/swagger-ui-react` | 5.18.0 | gone |
| `baseline-browser-mapping` | 2.10.10 direct pin | direct pin gone; **still installed at 2.10.10** transitively |
| `yaml` | 2.8.2 | **WITHDRAWN FROM THE BATCH — still declared at ^2.8.2.** See § 6 |

`baseline-browser-mapping` behaving this way is the intended outcome, and it was
confirmed *before* the removal rather than discovered after. `.planning/audit/quality/dead-code.md`
row 13 conditions the removal on "confirm nothing pins a version through it":

```bash
# both of these depend on it, so dropping the direct pin cannot uninstall it
node -e '...' # -> node_modules/browserslist -> baseline-browser-mapping@^2.8.25
              # -> node_modules/next         -> baseline-browser-mapping@^2.9.19
```

The direct pin `^2.10.10` was narrower than both transitive ranges, so it was a leftover,
exactly as the report suspected.

## 5. Packages asserted to survive

The near-miss (T-02-04-04) and the two refuted knip false-positives, all confirmed present
in the post-`npm ci` tree:

| Package | Resolved | Why it must survive |
|---|---|---|
| `@vercel/analytics` | 2.0.1 | imported by `src/app/layout.tsx:4` — a **different package** from the `vercel` CLI |
| `@vercel/speed-insights` | 2.0.0 | imported by `src/app/layout.tsx:3` — likewise |
| `prettier` | 3.6.2 | knip false-positive refuted by grep in Phase 1; it is the formatter |
| `tsx` | 4.21.0 | knip false-positive refuted in Phase 1; runs the three `scripts/` maintenance files |
| `react` / `react-dom` | 18.3.1 | phase-locked constraint 1 — untouched, byte-identical ranges |
| `tailwindcss-animate` | 1.0.7 | relocated to `devDependencies`, not removed |
| `redoc`, `next-swagger-doc` | 2.5.2, 0.4.1 | reachable from the public `/docs` route |
| `recharts`, `d3`, `embla-carousel-autoplay`, `dotenv` | — | never on the Phase 1 dead list |

## 6. `yaml` was withdrawn from the batch — the build refuted the dead-code row

`yaml` was removed with the others, and `npm run build` failed:

```text
./node_modules/redoc/bundles/redoc.browser.lib.js:2:92881
Module not found: Can't resolve 'yaml'
  ./node_modules/redoc/bundles/redoc.browser.lib.js [Client Component Browser]
  ./src/components/redoc/RedocUI.tsx [Client Component Browser]
  ./src/app/docs/page.tsx [Server Component]
```

`redoc@2.5.2` ships prebuilt bundles that `require("yaml")` at runtime, and it declares
`yaml` in **neither** `dependencies` **nor** `peerDependencies`:

```bash
node -e 'const p=require("redoc/package.json");console.log(!!p.dependencies.yaml, !!p.peerDependencies.yaml)'
# -> false false
```

The root `yaml` declaration had been silently satisfying an **undeclared dependency of
`redoc`**. `redoc` is reachable and staying, so `yaml` is reachable and staying: it was
restored to `dependencies` at its original `^2.8.2`, and the build then passed.

**Why Phase 1 got this one wrong, and it is not a sloppiness problem.** `dead-code.md`
row 9 justified `yaml` with `git grep -n "from ['\"]yaml['\"]" -- src` → 0 matches. That
grep is correct and its conclusion still does not follow, because a `src/`-only search
cannot see a `require()` inside *another dependency's prebuilt bundle*. Phase 1's own
rule — "no dependency enters the dead list on knip alone; each hit carries the grep that
confirmed or refuted it" — was followed to the letter and still produced a false positive,
because the confirming grep had the wrong search domain.

**Rule strengthened for batches 2-5:** before removing a package that is not obviously
application-facing, also search the *installed tree* for consumers, not just `src/`:

```bash
command grep -rl "require(\"<pkg>\")\|require('<pkg>')\|from \"<pkg>\"" \
  node_modules/*/bundles node_modules/*/dist 2>/dev/null
```

A package with zero importers in `src/` may still be an undeclared dependency of a
dependency. The batch gate's `npm run build` is what caught this one; that is the gate
working as designed, but catching it in the plan is cheaper than catching it in the build.

**Net effect on the batch:** batch 1 removes **ten** declarations, not eleven, and
`yaml`'s moderate advisory row stays. The count is corrected rather than the requirement
quietly reinterpreted.

## 7. Reproduce this review

```bash
git --no-pager diff --numstat package-lock.json     # -> 2591  6251  package-lock.json
git --no-pager diff package.json
npm ci && npx tsc --noEmit && npm run build
npm audit --omit=dev --json --package-lock-only | node -e '...metadata'
```

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-04 (batch 1)*
