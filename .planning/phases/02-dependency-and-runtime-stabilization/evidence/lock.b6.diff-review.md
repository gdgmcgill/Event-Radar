# Batch 6 lockfile diff review — the `postcss` override

**Plan:** 02-09 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Method:** the structural comparison established in `evidence/lock.b1.diff-review.md` § 1, re-run unchanged.

> **Verdict: 0 insertions, 57 deletions, and every one of those 57 lines belongs to
> two entries that were deleted on purpose.** 1,071 lock entries before, 1,069 after.
> **2 removed, 0 added, 0 re-resolved to a different version, 0 flag flips,
> `lockfileVersion` 3 → 3, and not one field of the root entry changed except the
> manifest mirror.** This is the smallest lockfile diff in the phase.

This is a manifest change, and this phase said it would not make one. **Read
`02-09-SUMMARY.md` § Deviations before reading this file** — the constraint was set
aside on a recorded user decision, and this review is one half of the compensating
control that decision was granted against. The other half is smoke row 7.

---

## 1. The structural comparison

```bash
node -e '
const {execSync}=require("child_process");
const B=JSON.parse(execSync("git show HEAD:package-lock.json",{maxBuffer:1e9})).packages;
const A=JSON.parse(require("fs").readFileSync("package-lock.json")).packages;
const bk=Object.keys(B),ak=Object.keys(A);
const removed=bk.filter(k=>!A[k]), added=ak.filter(k=>!B[k]);
const changed=bk.filter(k=>A[k]&&B[k].version!==A[k].version);
const flags=bk.filter(k=>A[k]&&["dev","optional","peer","devOptional"]
  .some(f=>!!B[k][f]!==!!A[k][f]));
console.log(bk.length,ak.length,removed.length,added.length,changed.length,flags.length);'
```

| Dimension | Value | What it means |
|---|---|---|
| Lock entries before | 1,071 | at `83ab1e7` |
| Lock entries after | 1,069 | |
| **Entries removed** | **2** | both named below; both are duplicate `postcss` copies |
| **Entries added** | **0** | no package entered the tree |
| **Entries re-resolved to a new version** | **0** | no silent upgrade rode along |
| `dev`/`optional`/`peer`/`devOptional` flag flips | **0** | nothing changed trust category |
| Root entry fields changed | **1** | `.devDependencies`? No — see § 4. The root entry is byte-identical |
| `lockfileVersion` | 3 → 3 | Unchanged |
| Raw diff | **0 insertions / 57 deletions** | fully accounted for in § 2 |

`check-baseline.mjs` re-ran green on this tree, including
`lockfile-discipline :: lockfile-version-unchanged`,
`react-untouched :: react-range-byte-identical` (`^18.3.0 -> ^18.3.0`),
`react-untouched :: react-dom-range-byte-identical`, and
`no-unplanned-majors :: no-unplanned-major-changes` (55 declared ranges compared,
0 planned majors moved). **22 passed, 0 failed, 0 skipped.**

---

## 2. The two removed entries, traced to their parents

Both are **nested duplicate copies of `postcss`** that existed only because their
parent pinned a version the root range did not cover. The override collapses both
into the single root copy. Nothing was deleted that anything still needs — the
parents both resolve to `node_modules/postcss` now.

| Removed entry | Was | Parent | Parent's declared spec | Why it existed | Where it resolves now |
|---|---|---|---|---|---|
| `node_modules/next/node_modules/postcss` | 8.5.23 | `next@16.3.5` | `"postcss": "8.5.23"` — an **exact** pin | The root range `^8.5.28` cannot satisfy an exact `8.5.23`, so npm nested a second copy | `node_modules/postcss` @ **8.5.28** |
| `node_modules/styled-components/node_modules/postcss` | 8.4.49 (`peer: true`) | `styled-components@6.3.8`, itself an auto-installed peer of `redoc@2.5.4` | `"postcss": "8.4.49"` — an **exact** pin | Same reason. **This copy carried the last production High** | `node_modules/postcss` @ **8.5.28** |

Confirmed in the installed tree after `npm ci`:

```bash
node -e "console.log(require('postcss/package.json').version)"   # -> 8.5.28
ls -d node_modules/next/node_modules/postcss                     # -> No such file or directory
ls node_modules/styled-components/node_modules/                  # -> (empty; directory absent)
node -e "console.log(require('styled-components/package.json').version)"  # -> 6.3.8
```

**`styled-components` did not move.** It is still 6.3.8, still `peer: true`, still
resolved from `redoc`'s own peer range. Only the `postcss` underneath it moved. That
distinction is the whole point of § 3.

---

## 3. Where the 57 deleted lines come from

Fully accounted for, with no remainder:

- **29 lines** — the `node_modules/next/node_modules/postcss` entry block.
- **28 lines** — the `node_modules/styled-components/node_modules/postcss` entry
  block (one line longer's worth of content minus the `peer: true` line difference;
  both are stock `postcss` entries with a `funding` array).
- **0 insertions.** Unlike batch 1, where 167 flag flips scored as paired
  delete-plus-insert, nothing here was rewritten. Entries were removed and the
  surviving root entry was not touched, so `git diff` has nothing to insert.

```bash
git --no-pager diff --numstat package-lock.json   # -> 0  57  package-lock.json
git --no-pager diff --numstat package.json        # -> 3   0  package.json
```

The three added manifest lines are the entire `overrides` block:

```json
  "overrides": {
    "postcss": "^8.5.28"
  },
```

---

## 4. One thing the lockfile does **not** record, named rather than discovered later

**npm 11.13.0 did not mirror the `overrides` block into the lockfile.**

```bash
command grep -c '"overrides"' package-lock.json   # -> 0
node -e "console.log(require('./package-lock.json').packages[''].overrides)"  # -> undefined
```

This is worth stating because a reader diffing the lockfile alone sees two `postcss`
entries vanish with no recorded cause. The cause is in `package.json`, not here.

**It does not threaten reproducibility, and both install paths were checked rather
than reasoned about:**

- `npm ci` installs the tree *as written in the lockfile*. That tree has one
  `postcss` at 8.5.28 and no nested copies, so `npm ci` reproduces it without needing
  to know why. **It was run, and it did not report a package.json / lockfile
  sync error** — `added 989 packages, and audited 990 packages in 10s`. This matters
  specifically because `npm ci` aborts when the two files disagree, and an unmirrored
  `overrides` block was a plausible way to disagree. It does not.
- `npm install` re-resolves and reads `overrides` from `package.json` directly.

The two paths converge on the same tree. Plan 02-10's clean-room install is the
independent third check, and it inherits this manifest change — **02-10's clean room
is now installing a tree with an `overrides` entry in it, which it was not when 02-07
wrote its recommendation.**

---

## 5. What the override does **not** do

This section exists because an `overrides` entry is a blunt instrument and the blast
radius should be stated by measurement, not by intent.

| Claim | Check | Result |
|---|---|---|
| No new package entered the tree | structural comparison § 1 | 0 added |
| No package was silently upgraded | structural comparison § 1 | 0 re-resolved |
| `react` / `react-dom` untouched | `check-baseline.mjs --check react-untouched` | `^18.3.0 -> ^18.3.0`, byte-identical, both |
| `styled-components` untouched | installed-tree read, § 2 | still 6.3.8, still `peer: true` |
| `redoc`'s declared peer range not rewritten | no `styled-components` key in `overrides` | npm prints no `peer overridden` line |
| No major moved | `check-baseline.mjs --check no-unplanned-majors` | 55 ranges compared, 0 moved |
| No forced remediation | `check-baseline.mjs --check lockfile-discipline` | commit range clean |

**The one real blast-radius item, stated plainly:** `next@16.3.5` declares
`"postcss": "8.5.23"` as an **exact** pin, and this override moves the copy it
resolves to up to **8.5.28** — five patch releases forward inside the same minor.
Plan 02-07 deliberately declined to do this and accepted the duplicate instead. That
acceptance is now reversed, and the compensating evidence is that the full batch gate
re-ran on the result: `npm run lint` 0, `npx tsc --noEmit` 0, `npm test -- --ci` 0
(278 passed / 5 skipped / 22 of 23 suites — the batch-5 figures exactly), and a cold
`rm -rf .next && npm run build` 0 whose **route table is byte-identical to batch 5's**.
`postcss` is the CSS pipeline Next builds through; a cold build is the direct test of
that pin, and it passed.

---

## 6. Reproduce this review

```bash
git --no-pager diff --numstat package-lock.json package.json
npm ci && npm run lint && npx tsc --noEmit && npm test -- --ci
rm -rf .next && npm run build
node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs
npm audit --audit-level=high --omit=dev ; echo "exit=$?"
```

Lockfile after: `sha256 842ed8a7ea336d74e3dd4966467743df7aaf886a62aa191a7209b78ec9af3812`
Lockfile before: `evidence/lock.b6.before.sha256`

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-09 (batch 6)*
