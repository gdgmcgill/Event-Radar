# Lockfile diff review — 03-07, the one package this phase adds

**Plan:** 03-07 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-16

> STAB-11, which Phase 3 inherits: **`package-lock.json` changes are reviewed as diffs, never regenerated wholesale; `npm audit fix --force` is never used.** <!-- planner-discipline-allow: audit fix -->
> The review below mirrors the format of `02-11`'s `evidence/lockfile-review-log.md` and `evidence/lock.b1.diff-review.md`: a **structural** comparison of lock-entry keys, not a line count, because a line count cannot tell "one package arrived" from "npm quietly re-resolved forty".

---

## 1. The procedure, in the order it was run

| Step | Command | Why in this order |
|---|---|---|
| 1 | `npm install --package-lock-only --save-dev --save-exact @playwright/test@1.63.0` | Reconciles the lockfile against the manifest edit **without touching `node_modules`**, so the diff can be read before anything is executed |
| 2 | the structural diff in § 2 | The review itself. Nothing is installed until it reads clean |
| 3 | `npm ci` | Installs **from** the reviewed lockfile. The only command that consumes it |
| 4 | `npx playwright install chromium` | An explicit step, not an install hook — `postinstall` is `null` for both Playwright packages, and the browser lands in `~/Library/Caches/ms-playwright`, outside the repository |
| 5 | `npm audit --audit-level=high --omit=dev` and `check-baseline.mjs` | Re-assert the Phase 2 floor after the install rather than assuming it survived |

Raw output for steps 1, 3, 4 and 5: `evidence/playwright-install.txt`.

---

## 2. The structural diff

```
46	0	package-lock.json   (insertions  deletions  file)
```

| Measure | Value |
|---|---|
| `entries_before` | 1069 |
| `entries_after` | 1072 |
| `entries_added` | **3** |
| `entries_removed` | **0** |
| `entries_reresolved` | **0** |
| `lockfileVersion` | 3 → 3 |

```
key=value
entries_before=1069
entries_after=1072
entries_added=3
entries_removed=0
entries_reresolved=0
lockfile_version_before=3
lockfile_version_after=3
direct_declarations_added=1
diff_insertions=46
diff_deletions=0
```

**The three entries added, in full:**

| Lock entry | Version | How it got here |
|---|---|---|
| `node_modules/@playwright/test` | 1.63.0 | The one **direct** declaration. `devDependencies`, exact pin, no range prefix |
| `node_modules/playwright` | 1.63.0 | Transitive: `@playwright/test` depends on it exactly. **Not declared directly**, per the research's explicit instruction |
| `node_modules/playwright-core` | 1.63.0 | Transitive: `playwright` depends on it exactly |

**Entries removed: none. Entries re-resolved: none.** That is the shape a single additive install is supposed to have — nothing was displaced to make room, and no unrelated package moved.

**Zero deletions in the diff.** 46 insertions, 0 deletions. A wholesale regeneration on npm 11 could not produce that.

---

## 3. React is byte-identical, on all four values

```
react       declared range: ^18.3.0 -> ^18.3.0
react-dom   declared range: ^18.3.0 -> ^18.3.0
react       resolved version: 18.3.1 -> 18.3.1
react-dom   resolved version: 18.3.1 -> 18.3.1
```

Asserted mechanically as well as by eye — `check-baseline.mjs --check react-untouched` is one of the 22 checks that must stay green, and does.

---

## 4. The one thing this review must not let a reader miss

**`@playwright/test` is recorded in the lockfile as `devOptional: true`, not `dev: true`, and that is correct rather than a mistake.**

`next` declares `@playwright/test` as an **optional peer dependency** at `^1.51.1`:

```
node_modules/next  peerDependencies  { ..., "@playwright/test": "^1.51.1", ... }
```

So the package is reachable by two routes — as this project's devDependency, and as an optional peer of a production dependency — and npm's marker for that intersection is `devOptional`. Two consequences worth stating plainly:

1. **The pin satisfies the peer range.** 1.63.0 ∈ `^1.51.1`, so no peer conflict exists and none was overridden.
2. **The production vulnerability gate still excludes it.** `npm audit --audit-level=high --omit=dev` was re-run after `npm ci` and exits 0; neither Playwright package appears in its report. The gate is unsuppressed — no `continue-on-error`, no `|| true` — exactly as Phase 2 left it.

---

## 5. Attestations

| Claim | Evidence |
|---|---|
| Never regenerated wholesale | `lockfileVersion` 3 → 3; 0 entries removed; 0 re-resolved; 0 deletions in the diff |
| No forced remediation | `check-baseline.mjs --check lockfile-discipline` → `no-forced-remediation-in-commit-range` PASS. The string appears in this repository only inside npm's own advisory footer, quoted in `evidence/playwright-install.txt` |
| Reviewed as a diff | This file, produced from `git diff` and a key-by-key comparison against the pre-install lockfile, **before** `npm ci` ran |
| Exactly one new package **name** | 1 direct declaration; the other two entries are its own exact transitive dependencies. The raw `playwright` package is not, and must not become, a direct declaration |
