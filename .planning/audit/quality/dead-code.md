# Dead Code, Stale Docs and Legacy-Directory Disposition — AUDIT-15

**Phase:** 01-read-only-foundation-audit **Plan:** 01-05 **Captured:** 2026-09-14
**Tree:** `main` @ `adffe81` **Tools:** `knip@6.35.1`, `dependency-cruiser@18.3.0` — pinned one-shot `npx`, never installed
**Raw evidence:** `knip.out.json`, `knip.md`, `depcruise.out.json` (308 modules, 703 dependencies, 0 unresolved)

**Every row in every section carries a disposition.** A row without one is a note, not a finding. The four values are: **Stage 2** (remove/fix in the stabilization stage), **Stage 3** (remove/fix in the refactor stage), **keep** (intentional, not dead), **needs-decision** (a human must choose; the evidence does not decide it).

```bash
# Reproduce
npx --yes knip@6.35.1 -c .planning/audit/quality/knip.config.json --reporter json --no-exit-code --no-progress \
  > .planning/audit/quality/knip.out.json
npx --yes dependency-cruiser@18.3.0 -c .planning/audit/quality/depcruise.config.cjs \
  -T json "src/**/*.{ts,tsx}" > .planning/audit/quality/depcruise.out.json
bash .planning/audit/tools/readonly-guard.sh
```

---

## 1. Unreferenced files and exports

### 1a. Unreferenced files

knip's five unused files, each cross-checked against the independent dependency-cruiser graph. The cross-check is not decoration: two tools disagreeing on a file is the signal that one of them is wrong.

| File | knip | dependency-cruiser (`depcruise.out.json`) | Agreed? | Disposition |
|---|---|---|---|---|
| `src/components/clubs/ClubCard.tsx` | unused file | `dependents: []` | yes | **Stage 2 — remove** |
| `src/components/shared/EditEventModal.tsx` | unused file | `dependents: []` | yes | **Stage 2 — remove** |
| `src/components/ui/breadcrumb.tsx` | unused file | `dependents: []` | yes | **Stage 2 — remove** (shadcn-generated, never wired up) |
| `src/components/ui/dropdown-menu.tsx` | unused file | `dependents: []` | yes | **Stage 2 — remove together with `@radix-ui/react-dropdown-menu`** (see § 2) |
| `src/components/events/EventImageUpload.tsx` | unused file | `dependents: ["src/components/shared/EditEventModal.tsx"]` | **partially** | **Stage 2 — remove, but only as a pair.** Its one importer is itself dead. Removing `EventImageUpload` alone breaks `EditEventModal`; removing `EditEventModal` alone leaves this file newly orphaned. They are one unit of work. |

**The dependency-cruiser orphan list is NOT the dead-file list, and must not be read as one.** `depcruise.out.json` reports 13 `orphan: true` modules; all 13 are App Router convention files that the framework routes by filesystem position rather than by import:

`src/app/auth/signout/route.ts`, `src/app/contributors/page.tsx`, `src/app/global-error.tsx`, `src/app/invites/loading.tsx`, `src/app/landing/layout.tsx`, `src/app/moderation/organizer-requests/page.tsx`, `src/app/moderation/stats/page.tsx`, `src/app/my-clubs/layout.tsx`, `src/app/my-clubs/loading.tsx`, `src/app/notifications/loading.tsx`, `src/app/profile/loading.tsx`, `src/app/robots.ts`, `src/app/settings/page.tsx`.

**Disposition for all 13: keep.** Deleting `src/app/settings/page.tsx` because "nothing imports it" would delete a route that `src/middleware.ts` actively protects. The correct filter is *non-entry modules with zero dependents*, which returns exactly 4 files — the same 4 knip agrees on.

### 1b. Unreferenced exports

Read from `knip.out.json`. `API_ENDPOINTS` leads because AUDIT-15 names it.

| Export | File:line | Evidence | Disposition |
|---|---|---|---|
| **`API_ENDPOINTS`** | `src/lib/constants.ts:406` | **Unused export, and the constant is actively bypassed.** `git grep -n "API_ENDPOINTS" -- src` returns exactly **one** line — its own definition. Meanwhile **60 files** in `src/` call `fetch("/api/...")` with a hardcoded string literal. Three of the seven paths the constant declares are duplicated verbatim elsewhere: `/api/admin/experiments` (1 file), `/api/events/featured` (1 file), `/api/admin/featured` (2 files). The constant is not dead-because-obsolete; it is dead **because every call site ignores it**, which is the exact failure AUDIT-15 was written to confirm. | **needs-decision** — two valid answers with opposite costs: delete the constant (1 file touched, drift is permanent), or adopt it across the 60 call sites (Stage 3 refactor, gives one place to change a route). Do not silently delete it; it is the seed of a convention. |
| `TAG_CHILDREN` | `src/lib/constants.ts:357` | Derived from `TAG_HIERARCHY` via `reduce`; zero importers | **Stage 3 — remove** unless the recommendation engine's tag-hierarchy work claims it |
| `default` (duplicate of `useAuthStore`) | `src/store/useAuthStore.ts:189` | knip `duplicates`: the module exports `useAuthStore` **and** `default` for the same binding. All 3 sampled importers use the named form (`import { useAuthStore } from "@/store/useAuthStore"`). | **Stage 2 — remove the default export.** Two names for one store is how half the codebase ends up importing the other one. |
| `formatTime`, `formatDateTime` | `src/lib/utils.ts:36,68` | Zero importers | **Stage 3 — remove** |
| `downloadExportFile` | `src/lib/exportUtils.ts:5` | Zero importers; the module's other exports are used and tested (`exportUtils.test.ts`) | **needs-decision** — an export-to-CSV feature that was built and never wired to a button. Product call, not a cleanup call. |
| `CONTACT_LINKS` | `src/lib/contact.ts:8` | Zero importers | **Stage 3 — remove** |
| `mapTags`, `tagMapping` | `src/lib/tagMapping.ts:10,42` | Zero importers | **needs-decision** — the same file carries the `"no more event_date/event_time split"` comment AUDIT-19 depends on. Confirm AUDIT-19 is closed before deleting either. |
| `hasRole`, `isOrganizer` | `src/lib/roles.ts:3,8` | Zero importers — **but `CLAUDE.md` documents all three role helpers as project API.** `isAdmin` (the third) *is* used, so this is not a dead module, it is a partially-adopted one. | **needs-decision** — either adopt them at the authorization call sites (which AUDIT-07/09/10 are inventorying anyway) or delete them and correct `CLAUDE.md`. Deleting a documented helper without touching the doc creates a *new* stale-doc finding. |
| `useClubEvents`, `useFollowStatus` | `src/hooks/useClubs.ts:26,72` | Zero importers | **Stage 3 — remove** |
| `useEventAnalytics` | `src/hooks/useAnalytics.ts:16` | Zero importers | **Stage 3 — remove** |
| `timeAgo` | `src/components/notifications/NotificationItem.tsx:117` | Zero importers; a date helper exported from a component file | **Stage 3 — remove or relocate to `src/lib/utils.ts`** |
| `buttonVariants`, `badgeVariants` (+ `ButtonProps`, `BadgeProps`, `InputProps`) | `src/components/ui/{button,badge,input}.tsx` | Zero importers | **keep** — shadcn/ui generates these as part of its component contract. Removing them breaks the next `shadcn add` and any future consumer that composes variants. Classic knip-versus-generated-code noise. |
| `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger` | `src/components/ui/dialog.tsx:113-116` | Zero importers | **keep** — same reason: a Radix wrapper re-exports the full primitive set by design. |
| 18 unused types in `src/types/index.ts` (`ClubInvitation`, `ClubFollower`, `UserFollow`, `EventInvite`, `SavedEvent`, `FeedbackRequestLog`, `InteractionType`, `UserInteraction`, `ExperimentStatus`, `ExperimentMetric`, `Experiment`, `ExperimentVariant`, `ExperimentAssignment`, `VariantMetrics`, `ExperimentResults`, `ModerationAction`, `ReportStatus`, `EventReport`) | `src/types/index.ts` | Zero importers each | **keep for now, needs-decision in Stage 3.** `CLAUDE.md` states these types define the data model and must stay in sync with the DB schema. Several name tables that AUDIT-01/02 are about to snapshot (`rsvps`, `user_interactions`, `experiments`). Deleting them before the schema drift table exists would destroy the only written record of the intended shape. |
| `ExtractedEvent`, `ClassificationSignal` | `src/lib/classifier.ts:29,54` | Zero importers | **needs-decision** — `classifier.ts` is scraper-adjacent; confirm against the out-of-repo AI pipeline before removing. |

---

## 2. False-positive triage — knip's unused dependencies

**No package enters the removal list on knip's word alone.** Dynamic imports and shadcn-generated wrappers are knip's two classic false-positive sources (RESEARCH § Code Examples 7 caveat; Assumption A6). Each of the 13 hits below was hand-confirmed with a grep, and the deciding grep is recorded. A package Stage 2 removes on an unconfirmed hit is a package the UI needs at runtime and nobody notices until production.

**The one systemic check first:** `git grep -n "next/dynamic\|await import(" -- src` returns 9 matches. Eight are `await import("@/app/api/...")` inside Jest test files; the ninth is `src/app/friends/page.tsx:25` → `dynamic(() => import("@/components/ui/wireframe-dotted-globe"))`, a **local** component. **No npm package is dynamically imported anywhere in this codebase**, which is what retires the dynamic-import hypothesis for every row below.

| # | Package | knip verdict | Deciding grep | Result | Disposition |
|---|---|---|---|---|---|
| 1 | `chart.js` | unused prod dep | `git grep -n "chart.js\|chartjs\|from \"react-chartjs-2\"" -- src` → **0 matches**; `git grep -ln recharts -- src` → 2 files (`src/app/moderation/stats/page.tsx`, `src/components/clubs/ClubAnalyticsTab.tsx`) | **confirmed-dead** — the project charts with `recharts`; Chart.js is a superseded second charting library | **Stage 2 — remove** |
| 2 | `react-chartjs-2` | unused prod dep | same grep, **0 matches** | **confirmed-dead** (the React binding for #1; they leave together) | **Stage 2 — remove** |
| 3 | `@radix-ui/react-switch` | unused prod dep | `git grep -h "@radix-ui/[a-z-]*" -- src \| sort \| uniq -c` → only `react-dialog`, `react-dropdown-menu`, `react-slider`, `react-slot`. `git grep -ln "<Switch\|SwitchPrimitives" -- src` → **0**. No `src/components/ui/switch.tsx` exists. | **confirmed-dead** — no wrapper, no usage | **Stage 2 — remove** |
| 4 | `@radix-ui/react-tabs` | unused prod dep | Same census — absent. `Tabs` matches 10+ files but every one is a hand-rolled tab UI (e.g. `ClubsPageTabs.tsx` imports only `lucide-react`, `next/*` and local modules — **no Radix import at all**). No `src/components/ui/tabs.tsx` exists. | **confirmed-dead** — the name collision is the trap; the import census is the answer | **Stage 2 — remove** |
| 5 | `@radix-ui/react-dropdown-menu` | unused prod dep | Census shows **exactly 1** importer: `src/components/ui/dropdown-menu.tsx:4`. That file is itself a knip-unused file with `dependents: []` in `depcruise.out.json`. | **false-positive as stated, confirmed-dead as a pair.** knip is technically wrong (the package *is* imported) and practically right (its only importer is dead). | **Stage 2 — remove the package and `src/components/ui/dropdown-menu.tsx` in the same commit.** Removing the package alone breaks a file that still compiles today. |
| 6 | `swagger-ui-react` | unused prod dep | `git grep -n "swagger-ui-react" -- src` → **0 matches**; absent from every module in `depcruise.reaches-apidocs.json` | **confirmed-dead** — see `dependency-report.md` § 1 | **Stage 2 — remove** (retires 6 High advisories) |
| 7 | `@types/swagger-ui-react` | unused dev dep | Types for #6 | **confirmed-dead** | **Stage 2 — remove with #6** |
| 8 | `@swagger-api/apidom-ns-openapi-3-1` | unused prod dep | `git grep -n "@swagger-api/apidom-ns-openapi-3-1" -- src` → **0 matches** | **confirmed-dead** — a Swagger-UI companion package, declared directly and never imported | **Stage 2 — remove with #6** |
| 9 | `yaml` | unused prod dep | `git grep -n "from ['\"]yaml['\"]" -- src` → **0 matches** | **confirmed-dead** — and it carries a moderate advisory | **Stage 2 — remove** |
| 10 | `vercel` | unused prod dep | `git grep -n "from ['\"]vercel\|require('vercel'" -- src` → **0 matches** | **confirmed-dead as an import**, but it is a **CLI**, not a library — knip cannot tell the difference | **needs-decision → Stage 2.** The right move is almost certainly "move to `devDependencies` or drop entirely" (deployment uses Vercel's git integration, not a local CLI), but that is a deployment-workflow question a human must answer. It roots 7 of 24 High/Critical advisories (`dependency-report.md` § 2), so the decision is worth making early. |
| 11 | `prettier` | unused dev dep | No `format` script in `package.json`; no `.prettierrc` consumer in CI | **false-positive (tooling).** Developers and editors invoke Prettier directly; knip only sees `package.json` scripts. | **keep** |
| 12 | `tsx` | unused dev dep | `scripts/` contains three `.ts` files (`fix-instagram-images.ts`, `platform-analytics.ts`, `upload-images.ts`) with **no npm script** to run them — `tsx` is how a human runs them by hand | **false-positive (tooling).** | **keep**, and add the missing npm scripts in Stage 2 so the dependency becomes self-evidencing |
| 13 | `baseline-browser-mapping` | unused dev dep | Declared directly in `devDependencies`, but also present transitively in the **production** audit tree with a moderate advisory | **needs-confirmation** — the direct declaration looks like a leftover pin; the transitive copy stays regardless | **needs-decision** — drop the direct declaration only after confirming nothing pins a version through it |

**Net:** 9 confirmed-dead, 2 tooling false-positives (`keep`), 1 wrong-for-the-right-reason pairing (#5), 2 needing a human (#10, #13). Had this table been skipped, Stage 2 would have removed `prettier` and `tsx` and broken three maintenance scripts and the formatter.

---

## 3. Legacy-directory disposition — **already resolved, recorded not investigated**

`REQUIREMENTS.md` AUDIT-15 asks for the disposition of the `internal/` and `backend/` directories, and the project research summary carries it as an open question. **Both are already gone.** This section closes that open question with evidence rather than spending a Stage 1 task re-discovering it.

| Directory | What it was | Current state | Verifying commands | Disposition |
|---|---|---|---|---|
| **`backend/`** | Legacy Python backend | **Removed from the tree.** Deleted in commit **`5e7bf27`** — *"chore: remove legacy backend directory (superseded by AI/)"*. 7 commits touched the path across its lifetime; none after `5e7bf27`. | `git log --oneline -1 5e7bf27` → `5e7bf27 chore: remove legacy backend directory (superseded by AI/)`; `ls -d backend` → *No such file or directory*; `git log --oneline -- backend \| wc -l` → `7` | **keep as a closed record — no Stage 2 or Stage 3 work exists.** The superseding system (`AI/`) lives outside this repository; note that as the reason no in-repo replacement is visible. |
| **`internal/`** | A separate Vite app | **Never tracked, and gitignored.** `git log --all --oneline -- internal` returns **0** commits — the directory has never had a tracked file in any branch. `.gitignore:63` lists `/internal` under the comment `# internal dashboard`. It is additionally excluded in `tsconfig.json`. | `git log --all --oneline -- internal \| wc -l` → `0`; `grep -n internal .gitignore` → `62:# internal dashboard`, `63:/internal`; `ls -d internal` → *No such file or directory* | **keep the ignore rule — nothing to remove.** The claim that it "is committed" was never true. If an internal dashboard is still wanted it is a separate-repo decision, not a cleanup. |

**This closes one of the project research summary's open questions outright.** Record it as a negative finding with the commit sha; do not schedule a task against it.

---

## 4. Stale documentation

One row per item, with the evidence that proves it stale. `baseline/versions.txt` is the authority for every count — a planning document is never the authority for a count about the code.

| # | Stale claim | Where | Verified reality (2026-09-14) | Evidence | Disposition |
|---|---|---|---|---|---|
| 1 | "Framework: **Next.js 14** (App Router)" | `README.md:17` | `next` declared `^16.0.3`, installed **16.2.1** | `grep -n "Next.js 1" README.md`; `node -e 'require("./node_modules/next/package.json").version'` | **Stage 2 — fix the doc** (two major versions wrong is a misleading onboarding signal) |
| 2 | "State Management: **React Hooks**" | `README.md:21` | Zustand is the single source of truth for auth state (`src/store/useAuthStore.ts`), as `CLAUDE.md` itself documents | `grep -n "State Management" README.md` | **Stage 2 — fix the doc** |
| 3 | "**Vitest** (config at `vitest.config.ts`) — Unit test runner, jsdom environment" and "`@vitejs/plugin-react`" | `.claude/CLAUDE.md:43-44` | **Vitest is not installed and never runs.** Neither package appears in `package.json`. The actual runner is Jest + ts-jest (21 suites, `baseline/jest.txt`). `.claude/CLAUDE.md` does not mention Jest **at all** — it names the wrong framework *and* omits the right one. | `grep -n -i "vitest\|jest" .claude/CLAUDE.md` | **Stage 2 — fix the doc.** An agent-facing file that names a nonexistent test runner will cause an agent to write tests that cannot run. |
| 4 | "`swagger-ui-react` **^5.30.2**" | `.claude/CLAUDE.md:79` | `package.json:43` declares `^5.17.10`; installed is 5.32.1; and the package is **unused** (§ 2 #6) | `grep -n swagger-ui-react .claude/CLAUDE.md package.json` | **Stage 2 — the line is deleted, not corrected**, when the package is removed |
| 5 | "**Node.js 20**" as the project runtime | `.claude/CLAUDE.md:34,109` | Local toolchain is **24.16.0**; CI pins 20. Node 20 **cannot run** `dependency-cruiser@18.3.0` (`engines: ^22\|\|^24\|\|>=26`) and is borderline for `knip@6.35.1`. | `baseline/versions.txt` → `node_version`, `ci_node_major` | **needs-decision** — this is not just a doc fix; it is a real CI/local split that STAB-01 must resolve. Bump CI or pin local; either way the doc follows the decision. |
| 6 | "Protected routes: **6 entries**" (`/my-events`, `/create-event`, `/notifications`, `/profile`, `/my-clubs`, `/invites`) | `CLAUDE.md:50` | `src/middleware.ts:113` `PROTECTED_ROUTES` has **8** — it also contains **`/settings`** and **`/friends`** | `node -e` over `src/middleware.ts` → 8 entries; `baseline/versions.txt` → `protected_routes_source_count=8` | **Stage 2 — fix the doc.** Higher stakes than a typo: AUDIT-04 cross-references this list, and an auditor trusting `CLAUDE.md` would mark two protected routes as public. |
| 7 | "all **92** API handlers" | `.planning/PROJECT.md:41` | **94** `route.ts` files | `baseline/versions.txt` → `route_ts_count=94` | **Stage 2 — fix the doc.** Note `REQUIREMENTS.md` AUDIT-03 has **already been corrected to 94**; `PROJECT.md:41` is the last surviving copy of the old number. |
| 8 | "**45** migration files" | Orchestrator brief / upstream planning docs | **44** `.sql` files, all tracked. `PROJECT.md:109` **already says 44** — the repo-side copy is correct and no longer needs fixing. | `ls supabase/migrations \| wc -l` → 44; `baseline/versions.txt` → `migration_count=44` | **keep** — the in-repo documents agree with the tree; only the out-of-repo brief is stale. Recorded so the next reader does not "fix" a correct number. |
| 9 | `test-results/.last-run.json` — a **tracked Playwright run marker** | `test-results/.last-run.json` | Content is `{"status":"failed","failedTests":[]}`. **Playwright is not installed** (`node_modules/@playwright` absent; zero `playwright` occurrences in `package.json`). Last touched in commit `8f5c80e` ("fixing scraper"), i.e. incidentally. A tracked file asserting `"status": "failed"` from a test framework that does not exist. | `git ls-files test-results`; `ls node_modules/@playwright`; `grep -c playwright package.json` → 0 | **Stage 2 — delete the file and add `test-results/` to `.gitignore`** |
| 10 | **`vitest.config.ts`** and `vitest.setup.ts` — orphan config files | repo root | Both tracked; **nothing references them**. `git grep -n vitest -- package.json .github/workflows/` returns nothing; `tsconfig.json` explicitly excludes `vitest.config.ts`. They are the residue of the framework in row 3. | `git ls-files \| grep -i vitest`; `grep -n vitest tsconfig.json` | **Stage 2 — delete both** (already slated under STAB-08; Phase 1 records, does not delete) |
| 11 | **`check:feedback`** npm script points at a file that does not exist | `package.json:9` — `"check:feedback": "node scripts/check-feedback-loop.mjs"` | `scripts/` contains exactly three files: `fix-instagram-images.ts`, `platform-analytics.ts`, `upload-images.ts`. **`scripts/check-feedback-loop.mjs` is absent.** Running `npm run check:feedback` fails immediately. | `ls scripts/`; `test -f scripts/check-feedback-loop.mjs` → MISSING | **Stage 2 — delete the script entry**, or restore the file if the feedback-loop check is still wanted. A broken npm script is dead config that silently teaches people the command is broken rather than the file is missing. |
| 12 | CI runs lint + tsc + build but **never runs the tests** | `.github/workflows/ci.yml` | 21 Jest suites exist (`baseline/jest-listtests.txt`) and CI executes none of them | 01-PATTERNS.md § Incidental Findings; `baseline/test-runner-decision.md` | **needs-decision** — adding `npx jest --ci` to CI is a one-line change, but 5 of 21 suites are currently skipped, so the gate's meaning has to be chosen first (STAB-08/STAB-13) |

---

## 5. Disposition roll-up

Every row above carries one of the four values; this is the count, not a new list.

| Disposition | Count | Where |
|---|---|---|
| **Stage 2** | 24 | 5 unused files, 2 exports, 9 confirmed-dead dependencies, 8 stale-doc/dead-config rows |
| **Stage 3** | 6 | `TAG_CHILDREN`, `formatTime`/`formatDateTime`, `CONTACT_LINKS`, `useClubEvents`/`useFollowStatus`, `useEventAnalytics`, `timeAgo` |
| **keep** | 8 | 13 App Router orphans (one row), shadcn variant exports, Dialog re-exports, `src/types/index.ts` type block, `prettier`, `tsx`, both legacy-directory records, the already-correct migration count |
| **needs-decision** | 9 | `API_ENDPOINTS`, `downloadExportFile`, `mapTags`/`tagMapping`, `hasRole`/`isOrganizer`, `ExtractedEvent`/`ClassificationSignal`, `vercel`, `baseline-browser-mapping`, Node 20-vs-24, CI-does-not-run-tests |

**Handoff note for Stage 2.** The nine `needs-decision` rows are the ones that will stall a cleanup slice if they are discovered mid-work rather than decided up front — `API_ENDPOINTS` and `vercel` most of all, because both have a cheap wrong answer (delete the constant; upgrade the CLI 27 majors) that looks like progress.

---

*Requirement: AUDIT-15 · Plan: 01-05 · Phase: 01-read-only-foundation-audit*
*Nothing was removed, fixed, or installed. `readonly-guard.sh` exits 0.*
