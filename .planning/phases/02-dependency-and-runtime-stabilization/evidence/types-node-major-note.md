# `@types/node` 20 → 24 — Major Version Migration Note (STAB-10)

**Plan:** 02-01 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-14

> **Decision: raise `@types/node` from `^20.11.0` to `^24.13.4`.** The bump is *forced* by the
> Node 24 runtime pin landed in the same commit, not elected on its own merits. It is the only
> major-version change in the whole of Phase 2.

---

## 1. Why this major is forced rather than elected

`.nvmrc`, `package.json` `engines.node`, and `.github/workflows/ci.yml` now all name Node **24**.
`@types/node` is the TypeScript declaration surface for that runtime. Leaving it on `^20` would
mean the compiler type-checks against a Node 20 API surface while every developer, every CI job,
and every Vercel build executes Node 24 — which is precisely the runtime/type drift the pin exists
to remove. Declaring one Node major in three places and a different one in `devDependencies` would
make the pin cosmetic.

| Consumer | Before this plan | After this plan |
|---|---|---|
| Local runtime (`node -v`) | 24.16.0 | 24.16.0 (unchanged — this machine was already ahead of the repo) |
| `.nvmrc` | *(file did not exist)* | `24` |
| `package.json` `engines.node` | *(no `engines` block at all)* | `24.x` |
| `.github/workflows/ci.yml` | `node-version: 20` | `node-version-file: '.nvmrc'` |
| `@types/node` | `^20.11.0` (resolved 20.19.25) | `^24.13.4` (resolved 24.13.4) |

Before the bump, CI type-checked Node 20 types on a Node 20 runner while the developer ran Node
24 — internally consistent on each side, but two different systems. After the bump there is one
Node major and one type surface, and CI reads the major from the same `.nvmrc` the developer's
version manager reads.

`24.x` (rather than `>=24`) is the form Vercel maps to the latest 24.x release line, and
`engines.node` overrides the Vercel project dashboard's **Node.js Version** setting — which makes
the repository, not the dashboard, the single source of truth. The dashboard's current value is
recorded as unobserved (`02-RESEARCH.md` assumption A1) and is carried as a `user_setup` item on
this plan rather than silently assumed.

## 2. Type-check impact: zero diagnostics before, zero after

| Measurement | Command | Result |
|---|---|---|
| Before (`@types/node@^20.11.0`) | `npx tsc --noEmit` | **0 diagnostics**, exit 0 — captured verbatim in `.planning/audit/baseline/tsc.txt` (plan 01-04) |
| After (`@types/node@^24.13.4`) | `npx tsc --noEmit` | **0 diagnostics**, exit 0 — captured verbatim in `evidence/batch-00-tsc.txt` (this plan) |

The major produced **no new diagnostics and required no source change**. Not one file under `src/`
was touched by this plan.

Two caveats that keep that clean result honest, both inherited from the baseline and both still
true:

1. `tsconfig.json` excludes `**/*.test.ts` and `**/*.test.tsx`, so the 21 Jest test files are not
   covered by `tsc --noEmit`. The Jest run is the only type-check they get, and only for the 16
   suites that execute. This exclusion is deliberately retained in Phase 2 (F-066 is recorded as
   partially addressed — see `02-RESEARCH.md` Open Question 3).
2. `"skipLibCheck": true` is set, so the compiler does not type-check `.d.ts` files in
   `node_modules` against each other. A Node 24 / Node 20 declaration conflict *between* packages
   would not have surfaced here. No such conflict is expected — `@types/node` is a leaf dependency
   with no `@types` peers in this tree.

## 3. Lockfile impact

| Item | Value |
|---|---|
| `package-lock.json` sha256 before | `35b2d0025d290679bb03b5b42d283b101d7f886619b19e0b8f7deb3166f0ff72` (`evidence/lock.b0.before.sha256`) |
| Reconciliation command | `npm install --package-lock-only` — never `npm audit fix`, never a lockfile delete |
| `git --no-pager diff --stat package-lock.json` | **46 lines changed** (12 insertions, 34 deletions), 1 file |
| `lockfileVersion` | unchanged |
| New package *names* entering the tree | **0** — `@types/node` was already a direct devDependency; only its version moved |
| `npm ci` from the reconciled lockfile | exit 0 |

The deletion count exceeds the insertion count because `@types/node@24` collapses a transitive
entry that `@types/node@20` carried. No dependency was added.

## 4. Package legitimacy

No legitimacy checkpoint is warranted. `@types/node` is a first-party DefinitelyTyped package that
was **already** a declared direct devDependency of this repository at `^20.11.0`; this change moves
a version, it does not introduce a name. `02-RESEARCH.md` § Package Legitimacy Audit records 0 SLOP
and 0 genuine SUS findings for this phase's package set. Threat `T-02-01-02` is dispositioned
**accept** on exactly this basis.

## 5. Scope statement — the only major in Phase 2

**This is the only major-version bump that lands in Phase 2.** Every other version change in the
phase's remaining batches is a minor or patch move within an existing major. React and React DOM
are never touched at all (phase-locked constraint 1 — React 19 is deferred by project constraint);
this plan's verification asserts `react` and `react-dom` are byte-identical in the manifest, and
`git diff -- package.json | grep -cE '^[+-].*"react(-dom)?"'` prints 0.

If a later Phase 2 batch discovers a second forced major, it gets its own note in this directory
and this sentence is corrected there rather than quietly outgrown.

---

*Phase: 02-dependency-and-runtime-stabilization · Plan: 02-01 · Requirements: STAB-01, STAB-10*
