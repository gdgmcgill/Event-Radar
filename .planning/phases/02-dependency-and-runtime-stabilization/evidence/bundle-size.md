# Bundle size, before and after — STAB-16

**Phase:** 02-dependency-and-runtime-stabilization · **Plan:** 02-10 (batch 6b)
**Before side:** `evidence/bundle-size.before.txt` / `evidence/bundle-size.before.json` — captured by plan 02-04 at `3a2bee6`, `next@16.2.1`, 2026-09-15T04:46:57Z
**After side:** `evidence/bundle-size.after.txt` / `evidence/bundle-size.after.json` — captured by this plan at `e95714b`, `next@16.3.5`, 2026-09-15T15:47:00Z

The after side compares against **`bundle-size.before.txt`**, never against
`.planning/audit/baseline/versions.txt`. That instruction comes from the before file's own
DRIFT block and from 02-04-SUMMARY § Carry-forward: the Phase 1 baseline was measured on a
different day and a different manifest, and folding its +171 B of unattributable drift into
this phase's delta would credit a dependency removal with bytes it did not move.

---

## Why two families of metrics

"Remove unused dependencies" and "shrink the bundle" sound like the same thing and are not.
This phase did both, in different batches, and a single-column table would have made one of
them look like a failure.

| Family | What it measures | Which batch moves it |
|---|---|---|
| **Install-tree** | `prod_pkg_count`, `node_modules_kb`, production advisory counts | **Batch 1** (ten dead declarations removed) and **batch 6a** (the postcss override) |
| **Route-bundle** | `routes`, `first_load_js_*`, `next_static_bytes` | **Batch 2** (`next` 16.2.1 → 16.3.5 rewrites the framework chunks), and essentially nowhere else |

---

## The delta table

Every figure in the Before and After columns is a key read from `bundle-size.before.txt` and
`bundle-size.after.txt` respectively. Both sides were produced by the identical procedure:
`rm -rf .next && npm run build`, then the route-bundle diagnostics copied unmodified.

| Metric (key) | Before | After | Delta | Attribution |
|---|---:|---:|---:|---|
| `routes` | 44 | 44 | 0 | No route was added or deleted by the phase. The one source file deleted (`src/components/ui/dropdown-menu.tsx`) was a component, not a route. |
| `first_load_js_sum` | 39,846,495 B | 37,328,142 B | **−2,518,353 B (−6.32%)** | **Batch 2.** Batch 1 measured **exactly 0 B** on all 44 routes (02-04-SUMMARY § Results). Batch 2 alone took the sum to 37,327,033 B (02-05-SUMMARY). Batches 3–6 account for the remaining **+1,109 B**. |
| `first_load_js_max` | `/docs` 1,964,234 B | `/docs` 1,908,114 B | −56,120 B (−2.86%) | **Batch 2**, via the shared chunk only. `/docs` is `redoc`, reachable from the public route and staying; its redoc-specific chunks did not shrink at all. It fell by *less* than every other route. |
| `first_load_js_median` | `/help` 840,219 B | `/help` 783,002 B | −57,217 B (−6.81%) | **Batch 2.** The median route is a route with no route-specific movement, so its delta is the shared-chunk delta almost exactly. |
| `next_static_bytes` | 4,491,132 B | 4,014,162 B | **−476,970 B (−10.62%)** | **Batch 2.** Batch 1 moved this by −1,286 B — the dead Radix wrapper's own bytes (02-04-SUMMARY). Batch 2 took it to 4,013,053 B (02-05-SUMMARY). Batches 3–6 account for **+1,109 B**. |
| `next_static_file_count` | 78 | 76 | −2 | **Batch 2.** The universal first-load chunk set went from 13 chunks to 12; the framework chunking changed shape, not just size. |
| `prod_pkg_count` | 786 | 354 | **−432 (−54.96%)** | **Batch 1**, overwhelmingly — it removed eight production declarations rooted in the `vercel` CLI and the Swagger UI package. Batch 6a's postcss override collapsed one duplicate. |
| `node_modules_kb` | 999,564 KB | 723,520 KB | **−276,044 KB (−27.62%)** | **Batch 1** (999,564 → 710,644 KB, 02-04-SUMMARY). The tree then grew back **+12,876 KB** across batches 2–6, almost all of it **batch 5's dev-only jsdom + testing-library harness**. This key is prod + dev and therefore *understates* the production removal. |
| `audit_prod_critical` | 2 | **0** | −2 | **Batch 1** retired `tar` (reached only through the CLI's `@mapbox/node-pre-gyp` subtree); **batch 2** retired the `next` Critical by version. |
| `audit_prod_high` | 22 | **0** | **−22** | **Batch 1** retired 14 of them with the CLI and Swagger removals; batches 2 and 4a retired the rest; **batch 6a** closed the last one with `overrides: { postcss: ^8.5.28 }`. |
| `audit_prod_moderate` | 13 | 2 | −11 | **Batch 1** and **batch 4a**. The two survivors are the phase's accepted residue; `evidence/audit.after.json` is the verbatim record and `evidence/VULNERABILITY-POLICY.md` is the policy they are measured against. |
| `audit_prod_low` | 1 | 0 | −1 | **Batch 1.** |
| `audit_prod_total` | 38 | **2** | −36 | — |
| `audit_prod_dependencies` | 680 | 298 | −382 | **Batch 1.** `npm audit`'s own count, which is a different quantity from `prod_pkg_count`; both are recorded on both sides so neither can be mistaken for the other. |

---

## The honest part: the batch-1 removals moved install-tree metrics and not route bundles

**The ten declarations batch 1 removed had zero importers, so Turbopack had already tree-shaken
every one of them out of every route bundle before this phase began.** Their route-bundle delta
was measured at **exactly 0 B on all 44 routes** (02-04-SUMMARY § Results: sum 39,846,495 B
before, 39,846,495 B after). That is the **correct** result, not a disappointing one, and it is
the reason this document has two metric families instead of one. A reader looking only at
`first_load_js_sum` would conclude that removing 432 packages achieved nothing; a reader looking
only at `prod_pkg_count` would conclude that upgrading the framework achieved nothing. Both
would be wrong.

Three specific consequences worth stating rather than leaving to inference:

1. **`/docs` is the proof in one number.** It is the largest first-load bundle in the project at
   1.9 MB, and it is `redoc` — which is *reachable* from the public `/docs` route and *stayed*.
   Removing `swagger-ui-react`, the package a reader would assume owns the API-documentation
   route, moved it by nothing. `/docs` fell by 56,120 B, which is 1,098 B **less** than the
   57,218 B every ordinary route fell by, i.e. it moved on the shared framework chunk alone.

2. **The one removal that could have moved a route bundle did not.**
   `@radix-ui/react-dropdown-menu` came out together with its only importer,
   `src/components/ui/dropdown-menu.tsx`. But that wrapper itself had **no importers**, so it
   was never in any route's first-load set either. Its 1,286 B show up in `next_static_bytes`
   (batch 1's only route-family movement) and in no route's first-load total.

3. **The route-bundle reduction that *is* real is one shared chunk, and it is nameable.**
   Intersecting `firstLoadChunkPaths` across all 44 routes in the two committed JSON copies:

   | | Universal chunks | Universal first-load bytes |
   |---|---:|---:|
   | before | 13 | 823,979 B |
   | after | 12 | 766,761 B |
   | delta | **−1** | **−57,218 B** |

   That 766,761 B is exactly the first-load total of the smallest routes (`/_not-found`,
   `/about`, `/banned`, `/contributors`, `/invites/[token]`, `/my-clubs`, `/privacy`,
   `/settings`, `/terms`), which carry nothing but the universal set. Every route inherits the
   −57,218 B, which is why the per-route table below is very nearly a constant column. The 12
   surviving universal chunk paths and their on-disk sizes are listed in
   `bundle-size.after.txt` § Family 1; the two largest are
   `.next/static/chunks/03qv91e3xol49.js` (234,302 B) and
   `.next/static/chunks/2zx3q7e7c69qs.js` (155,744 B).

---

## Per-route table — every route moved by more than 1%

All 44 routes cleared the 1% threshold, so all 44 are listed. The last column is each route's
movement **in excess of** the universal −57,218 B, which is the only part attributable to that
route rather than to the shared chunk.

| Route | Before (B) | After (B) | Delta (B) | Delta % | Beyond shared −57,218 |
|---|---:|---:|---:|---:|---:|
| `/docs` | 1,964,234 | 1,908,114 | -56,120 | -2.86% | +1,098 |
| `/my-clubs/[id]` | 1,396,683 | 1,339,487 | -57,196 | -4.10% | +22 |
| `/moderation/stats` | 1,242,762 | 1,185,566 | -57,196 | -4.60% | +22 |
| `/events/[id]` | 967,797 | 910,591 | -57,206 | -5.91% | +12 |
| `/profile` | 967,325 | 906,850 | -60,475 | -6.25% | -3,257 |
| `/my-events` | 928,454 | 871,248 | -57,206 | -6.16% | +12 |
| `/calendar` | 924,477 | 867,259 | -57,218 | -6.19% | — |
| `/moderation/pending` | 911,595 | 854,377 | -57,218 | -6.28% | — |
| `/` | 908,709 | 851,491 | -57,218 | -6.30% | — |
| `/moderation/clubs` | 899,353 | 842,135 | -57,218 | -6.36% | — |
| `/moderation/featured` | 896,101 | 838,883 | -57,218 | -6.39% | — |
| `/moderation/events` | 890,766 | 833,548 | -57,218 | -6.42% | — |
| `/clubs` | 888,284 | 831,078 | -57,206 | -6.44% | +12 |
| `/moderation/users` | 879,017 | 821,799 | -57,218 | -6.51% | — |
| `/moderation/organizers` | 877,888 | 820,670 | -57,218 | -6.52% | — |
| `/moderation/appeals` | 876,940 | 819,722 | -57,218 | -6.52% | — |
| `/create-event` | 873,927 | 816,709 | -57,218 | -6.55% | — |
| `/friends` | 868,483 | 812,570 | -55,913 | -6.44% | +1,305 |
| `/clubs/[id]` | 866,928 | 809,722 | -57,206 | -6.60% | +12 |
| `/landing` | 855,388 | 798,170 | -57,218 | -6.69% | — |
| `/onboarding` | 854,116 | 796,898 | -57,218 | -6.70% | — |
| `/clubs/create` | 842,839 | 785,621 | -57,218 | -6.79% | — |
| `/help` | 840,219 | 783,002 | -57,217 | -6.81% | +1 |
| `/moderation/audit-log` | 838,854 | 781,636 | -57,218 | -6.82% | — |
| `/moderation/organizer-requests` | 838,596 | 781,378 | -57,218 | -6.82% | — |
| `/health` | 838,291 | 781,073 | -57,218 | -6.83% | — |
| `/moderation/reports` | 837,183 | 779,965 | -57,218 | -6.83% | — |
| `/notifications` | 837,013 | 779,795 | -57,218 | -6.84% | — |
| `/people` | 835,418 | 778,200 | -57,218 | -6.85% | — |
| `/admin/experiments/[id]` | 834,759 | 777,541 | -57,218 | -6.85% | — |
| `/admin/experiments` | 832,241 | 775,023 | -57,218 | -6.88% | — |
| `/feedback` | 832,233 | 775,015 | -57,218 | -6.88% | — |
| `/moderation` | 830,056 | 772,838 | -57,218 | -6.89% | — |
| `/admin-login` | 827,731 | 770,513 | -57,218 | -6.91% | — |
| `/users/[id]` | 826,024 | 768,806 | -57,218 | -6.93% | — |
| `/_not-found` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/about` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/banned` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/contributors` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/invites/[token]` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/my-clubs` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/privacy` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/settings` | 823,979 | 766,761 | -57,218 | -6.94% | — |
| `/terms` | 823,979 | 766,761 | -57,218 | -6.94% | — |

Ten routes have a non-zero excess column and they sum to **−761 B**, which reconciles the table
to the top-level figure exactly: 44 × −57,218 = −2,517,592, plus −761 = **−2,518,353**, the
`first_load_js_sum` delta. Nothing is unaccounted for.

Of those ten, only two are material:

- **`/profile` −3,257 B beyond the shared chunk.** The single largest route-specific reduction in
  the phase. It is *not* attributable to batch 1 — batch 1 measured 0 B on this route like every
  other. It belongs somewhere in batches 2–6, and this document does not claim to know which,
  because isolating it would require rebuilding at each intermediate commit and this plan is
  forbidden from touching the lockfile.
- **`/friends` +1,305 B beyond the shared chunk.** A route-specific chunk *grew*. Recorded rather
  than smoothed away. `/friends` still fell 55,913 B (−6.44%) overall.

---

## What did not move, and the residual that is not claimed

**Batches 3–6 contributed +1,109 B**, not a reduction, to both `first_load_js_sum` and
`next_static_bytes` — the same number on both, which is the signature of a single chunk that
appears in exactly one route's first-load set and once on disk. That is **+0.003%** and it is
reported because the alternative is to quietly round the phase's improvement up.

It is **not build noise**. Two independent cold builds on the after side produced byte-identical
`route-bundle-stats.json` and identical derived figures (recorded in `bundle-size.after.txt`
§ Procedure parity). The most likely mechanism is the one the before file's DRIFT block already
named as candidate (b): **browserslist date sensitivity** — the `not dead` term in browserslist's
`defaults` query is evaluated against the current date, and **batch 4a refreshed
`caniuse-lite`/browserslist directly**, which changes the transpile target set and therefore
shared-chunk bytes. Batch 3 (the `middleware.ts` → `proxy.ts` rename) cannot contribute, since
proxy code is not in any client bundle, and batch 6a's postcss override is a CSS-pipeline change.

**Nothing in this phase was a bundle-size *optimisation*.** No dynamic import was added, no
package was swapped for a smaller one, no code was split. The −6.32% first-load reduction is a
side effect of a framework patch upgrade taken for security reasons, and the −54.96% production
package reduction is the removal of code that was never shipped to a browser in the first place.
Both are real; neither is a performance project, and Phase 6 still owns that work.

---

## Reproducing this document

```bash
# after side, both families — the exact commands are inline in bundle-size.after.txt
rm -rf .next && npm run build
cp .next/diagnostics/route-bundle-stats.json \
   .planning/phases/02-dependency-and-runtime-stabilization/evidence/bundle-size.after.json

# the per-route table and the reconciliation
node -e '
const d=".planning/phases/02-dependency-and-runtime-stabilization/evidence/";
const B=Object.fromEntries(Object.values(require("./"+d+"bundle-size.before.json")).map(x=>[x.route,x]));
const A=Object.fromEntries(Object.values(require("./"+d+"bundle-size.after.json")).map(x=>[x.route,x]));
for(const r of Object.keys(B)){const b=B[r].firstLoadUncompressedJsBytes,a=A[r].firstLoadUncompressedJsBytes;
  console.log(r,b,a,a-b,((a-b)/b*100).toFixed(2)+"%");}'

# the universal chunk set, both sides
node -e '
const d=".planning/phases/02-dependency-and-runtime-stabilization/evidence/";
for(const s of ["before","after"]){const a=Object.values(require("./"+d+"bundle-size."+s+".json"));
  let i=null; for(const r of a){const x=new Set(r.firstLoadChunkPaths); i=i===null?x:new Set([...i].filter(c=>x.has(c)));}
  console.log(s,i.size);}'
```

**Sources for the intermediate figures quoted in the Attribution column** — each was measured by
the plan that made the change, not re-derived here, and each is labelled as a quoted datum:
`02-04-SUMMARY.md` § Results (batch 1) and `02-05-SUMMARY.md` (batch 2). The Before and After
columns themselves are re-derived in this plan from the two committed JSON captures and the two
`.txt` key files, and nothing in them is transcribed from `02-RESEARCH.md` or from `02-10-PLAN.md`.
