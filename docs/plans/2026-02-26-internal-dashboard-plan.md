# Internal Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a gitignored Vite + React internal dashboard with Bloomberg terminal aesthetics that tracks team GitHub activity (commits, PRs, LOC, reviews) via local git + `gh` CLI.

**Architecture:** A standalone Vite + React + TypeScript app in `internal/`. A Node script (`collect.ts`) gathers data from `git log` and `gh` CLI into `data/cache.json`. The React app reads the cache and renders a dense, dark, monospace dashboard with sortable leaderboard, stat cards, PR list, and activity heatmap.

**Tech Stack:** Vite, React 18, TypeScript, Chart.js + react-chartjs-2, raw CSS with CSS variables, `tsx` for running the collection script.

**Design Doc:** `docs/plans/2026-02-26-internal-dashboard-design.md`

---

### Task 1: Scaffold Vite + React project

**Files:**
- Create: `internal/package.json`
- Create: `internal/tsconfig.json`
- Create: `internal/vite.config.ts`
- Create: `internal/index.html`
- Create: `internal/src/main.tsx`
- Create: `internal/src/App.tsx`
- Create: `internal/src/index.css`
- Modify: `.gitignore`

**Step 1: Create the `internal/` directory**

```bash
mkdir -p internal/src/components internal/src/lib internal/data
```

**Step 2: Create `internal/package.json`**

```json
{
  "name": "event-radar-internal",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "collect": "tsx collect.ts"
  },
  "dependencies": {
    "chart.js": "^4.4.0",
    "react": "^18.3.0",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.4.0",
    "vite": "^6.0.0"
  }
}
```

**Step 3: Create `internal/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

**Step 4: Create `internal/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 4444 },
});
```

**Step 5: Create `internal/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>UNI-VERSE COMMAND CENTER</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create `internal/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 7: Create `internal/src/App.tsx` (placeholder)**

```tsx
export function App() {
  return <div className="app">UNI-VERSE COMMAND CENTER</div>;
}
```

**Step 8: Create `internal/src/index.css` (minimal placeholder)**

```css
:root {
  --bg: #0a0a0a;
  --text: #e0e0e0;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", "Consolas", monospace;
}
```

**Step 9: Add `internal/` to `.gitignore`**

Append to the end of `.gitignore`:

```
# internal dashboard (gitignored tool)
/internal
```

**Step 10: Install dependencies and verify**

```bash
cd internal && npm install
npm run dev
```

Expected: Vite starts on `http://localhost:4444`, shows "UNI-VERSE COMMAND CENTER" text on a black background.

**Step 11: Stop dev server, commit**

```bash
# Only commit the .gitignore change and the design/plan docs
cd ..
git add .gitignore docs/plans/2026-02-26-internal-dashboard-design.md docs/plans/2026-02-26-internal-dashboard-plan.md
git commit -m "docs: add internal dashboard design and plan, gitignore internal/"
```

---

### Task 2: Team config and TypeScript types

**Files:**
- Create: `internal/team.config.json`
- Create: `internal/src/types.ts`

**Step 1: Create `internal/team.config.json`**

Use `git shortlog -sne` on the repo to identify all contributor names and emails, then map aliases. Run from the repo root:

```bash
cd /Users/adyanullah/Documents/GitHub/Event-Radar && git shortlog -sne --all
```

Use the output to build the config. Starter template:

```json
{
  "aliases": {
    "GeorgesAbiChahine": "Georges Abi Chahine",
    "Georges Abi Chahine": "Georges Abi Chahine",
    "GDG-McGill": "GDG-McGill",
    "af-yshen": "Y.C. Shen",
    "y-c-shen": "Y.C. Shen"
  },
  "pinned": []
}
```

Adjust aliases based on actual `git shortlog` output. The key is the git author name, the value is the canonical display name. Multiple keys can map to the same value to merge identities.

**Step 2: Create `internal/src/types.ts`**

```ts
export interface Contributor {
  name: string;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  prsOpened: number;
  prsMerged: number;
  prsOpen: number;
  reviewsGiven: number;
  issuesClosed: number;
  activeBranches: number;
  lastActivity: string; // ISO date
  commitsByDay: { date: string; count: number }[];
}

export interface PR {
  number: number;
  title: string;
  author: string;
  state: "open" | "merged" | "closed";
  createdAt: string;
  mergedAt: string | null;
  url: string;
}

export interface CacheData {
  generatedAt: string;
  contributors: Record<string, Contributor>;
  prs: PR[];
}

export interface TeamConfig {
  aliases: Record<string, string>;
  pinned: string[];
}

export type TimeRange = "7d" | "30d" | "90d" | "all";

export type SortKey =
  | "commits"
  | "linesAdded"
  | "linesRemoved"
  | "prsOpened"
  | "prsMerged"
  | "reviewsGiven"
  | "lastActivity";
```

---

### Task 3: Data collection script (`collect.ts`)

**Files:**
- Create: `internal/collect.ts`

This is the most complex task. The script:
1. Runs `git log` to get per-commit data (author, date, lines added/removed)
2. Runs `git branch -a` to get branch info
3. Runs `gh pr list` to get PR data
4. Runs `gh api` to get issue data
5. Applies aliases from `team.config.json`
6. Writes everything to `data/cache.json`

**Step 1: Create `internal/collect.ts`**

```ts
import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";

// Resolve paths relative to the repo root (one level up from internal/)
const REPO_ROOT = resolve(join(import.meta.dirname, ".."));
const DATA_DIR = join(import.meta.dirname, "data");
const CONFIG_PATH = join(import.meta.dirname, "team.config.json");
const CACHE_PATH = join(DATA_DIR, "cache.json");

interface TeamConfig {
  aliases: Record<string, string>;
  pinned: string[];
}

interface CommitEntry {
  hash: string;
  author: string;
  date: string;
  additions: number;
  deletions: number;
}

interface PREntry {
  number: number;
  title: string;
  author: string;
  state: "open" | "merged" | "closed";
  createdAt: string;
  mergedAt: string | null;
  url: string;
}

function run(cmd: string): string {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
}

function loadConfig(): TeamConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { aliases: {}, pinned: [] };
  }
}

function resolveAlias(name: string, config: TeamConfig): string {
  return config.aliases[name] ?? name;
}

// --- Git log parsing ---

function collectCommits(config: TeamConfig): CommitEntry[] {
  // Format: HASH|EMAIL|NAME|DATE followed by numstat lines
  const SEP = "---COMMIT_SEP---";
  const raw = run(
    `git log --all --no-merges --format='${SEP}%H|%ae|%an|%aI' --numstat`
  );

  const commits: CommitEntry[] = [];
  const chunks = raw.split(SEP).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.trim().split("\n");
    if (lines.length === 0) continue;

    const headerLine = lines[0];
    const parts = headerLine.split("|");
    if (parts.length < 4) continue;

    const hash = parts[0];
    const author = resolveAlias(parts[2], config);
    const date = parts[3];

    let additions = 0;
    let deletions = 0;

    for (let i = 1; i < lines.length; i++) {
      const stat = lines[i].split("\t");
      if (stat.length < 3) continue;
      const add = parseInt(stat[0], 10);
      const del = parseInt(stat[1], 10);
      if (!isNaN(add)) additions += add;
      if (!isNaN(del)) deletions += del;
    }

    commits.push({ hash, author, date, additions, deletions });
  }

  return commits;
}

// --- Branch parsing ---

function collectBranches(config: TeamConfig): Record<string, number> {
  const raw = run("git branch -a --format='%(refname:short)|%(authorname)'");
  const branchCounts: Record<string, number> = {};

  for (const line of raw.trim().split("\n")) {
    const [, author] = line.split("|");
    if (!author) continue;
    const resolved = resolveAlias(author.trim(), config);
    branchCounts[resolved] = (branchCounts[resolved] ?? 0) + 1;
  }

  return branchCounts;
}

// --- GitHub CLI: PRs ---

function collectPRs(config: TeamConfig): PREntry[] {
  const raw = run(
    `gh pr list --repo gdgmcgill/Event-Radar --state all --json number,title,author,state,createdAt,mergedAt,url --limit 500`
  );

  const prs: Array<{
    number: number;
    title: string;
    author: { login: string };
    state: string;
    createdAt: string;
    mergedAt: string | null;
    url: string;
  }> = JSON.parse(raw);

  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: resolveAlias(pr.author.login, config),
    state: pr.state.toLowerCase() as "open" | "merged" | "closed",
    createdAt: pr.createdAt,
    mergedAt: pr.mergedAt,
    url: pr.url,
  }));
}

// --- GitHub CLI: Reviews ---

function collectReviews(config: TeamConfig): Record<string, number> {
  const raw = run(
    `gh pr list --repo gdgmcgill/Event-Radar --state merged --json number,reviews --limit 500`
  );

  const prs: Array<{
    number: number;
    reviews: Array<{ author: { login: string }; state: string }>;
  }> = JSON.parse(raw);

  const reviewCounts: Record<string, number> = {};
  for (const pr of prs) {
    if (!pr.reviews) continue;
    for (const review of pr.reviews) {
      const author = resolveAlias(review.author.login, config);
      reviewCounts[author] = (reviewCounts[author] ?? 0) + 1;
    }
  }

  return reviewCounts;
}

// --- GitHub CLI: Issues ---

function collectIssues(config: TeamConfig): Record<string, number> {
  let raw: string;
  try {
    raw = run(
      `gh issue list --repo gdgmcgill/Event-Radar --state closed --json assignees --limit 500`
    );
  } catch {
    return {};
  }

  const issues: Array<{
    assignees: Array<{ login: string }>;
  }> = JSON.parse(raw);

  const issueCounts: Record<string, number> = {};
  for (const issue of issues) {
    if (!issue.assignees) continue;
    for (const assignee of issue.assignees) {
      const author = resolveAlias(assignee.login, config);
      issueCounts[author] = (issueCounts[author] ?? 0) + 1;
    }
  }

  return issueCounts;
}

// --- Main ---

function main() {
  console.log("Collecting data...");
  const config = loadConfig();

  console.log("  [1/5] Parsing git log...");
  const commits = collectCommits(config);

  console.log("  [2/5] Parsing branches...");
  const branches = collectBranches(config);

  console.log("  [3/5] Fetching PRs...");
  const prs = collectPRs(config);

  console.log("  [4/5] Fetching reviews...");
  const reviews = collectReviews(config);

  console.log("  [5/5] Fetching issues...");
  const issues = collectIssues(config);

  // Build contributor map
  const contributors: Record<string, any> = {};

  function ensure(name: string) {
    if (!contributors[name]) {
      contributors[name] = {
        name,
        commits: 0,
        linesAdded: 0,
        linesRemoved: 0,
        prsOpened: 0,
        prsMerged: 0,
        prsOpen: 0,
        reviewsGiven: 0,
        issuesClosed: 0,
        activeBranches: 0,
        lastActivity: "",
        commitsByDay: [] as { date: string; count: number }[],
      };
    }
  }

  // Aggregate commits
  const commitsByAuthorDay: Record<string, Record<string, number>> = {};

  for (const c of commits) {
    ensure(c.author);
    const contrib = contributors[c.author];
    contrib.commits++;
    contrib.linesAdded += c.additions;
    contrib.linesRemoved += c.deletions;

    const day = c.date.slice(0, 10);
    if (!contrib.lastActivity || c.date > contrib.lastActivity) {
      contrib.lastActivity = c.date;
    }

    if (!commitsByAuthorDay[c.author]) commitsByAuthorDay[c.author] = {};
    commitsByAuthorDay[c.author][day] = (commitsByAuthorDay[c.author][day] ?? 0) + 1;
  }

  // Convert commitsByDay
  for (const [author, days] of Object.entries(commitsByAuthorDay)) {
    contributors[author].commitsByDay = Object.entries(days)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Aggregate branches
  for (const [author, count] of Object.entries(branches)) {
    ensure(author);
    contributors[author].activeBranches = count;
  }

  // Aggregate PRs
  for (const pr of prs) {
    ensure(pr.author);
    contributors[pr.author].prsOpened++;
    if (pr.state === "merged") contributors[pr.author].prsMerged++;
    if (pr.state === "open") contributors[pr.author].prsOpen++;
  }

  // Aggregate reviews
  for (const [author, count] of Object.entries(reviews)) {
    ensure(author);
    contributors[author].reviewsGiven = count;
  }

  // Aggregate issues
  for (const [author, count] of Object.entries(issues)) {
    ensure(author);
    contributors[author].issuesClosed = count;
  }

  // Write cache
  mkdirSync(DATA_DIR, { recursive: true });
  const cache = {
    generatedAt: new Date().toISOString(),
    contributors,
    prs: prs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };

  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`\nDone! Wrote ${CACHE_PATH}`);
  console.log(`  ${Object.keys(contributors).length} contributors`);
  console.log(`  ${commits.length} commits`);
  console.log(`  ${prs.length} PRs`);
}

main();
```

**Step 2: Run the collection script**

```bash
cd internal && npm run collect
```

Expected: Script prints progress, writes `data/cache.json` with real data from the repo.

**Step 3: Verify `data/cache.json` looks correct**

```bash
head -50 data/cache.json
```

Check that contributor names are resolved, commit counts look reasonable, PRs are populated.

---

### Task 4: Data loading layer (`data.ts`)

**Files:**
- Create: `internal/src/lib/data.ts`

**Step 1: Create `internal/src/lib/data.ts`**

```ts
import type { CacheData, Contributor, PR, TimeRange } from "../types";

export async function loadCache(): Promise<CacheData> {
  const res = await fetch("/data/cache.json");
  if (!res.ok) throw new Error("Failed to load cache.json — run `npm run collect` first");
  return res.json();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function timeRangeToDays(range: TimeRange): number | null {
  switch (range) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "all": return null;
  }
}

export function filterByTimeRange(
  data: CacheData,
  range: TimeRange
): { contributors: Record<string, Contributor>; prs: PR[] } {
  const days = timeRangeToDays(range);
  if (days === null) {
    return { contributors: data.contributors, prs: data.prs };
  }

  const cutoff = daysAgo(days);
  const cutoffStr = cutoff.toISOString();

  // Filter PRs
  const prs = data.prs.filter((pr) => pr.createdAt >= cutoffStr);

  // Recompute contributor stats from commitsByDay within range
  const contributors: Record<string, Contributor> = {};

  for (const [name, c] of Object.entries(data.contributors)) {
    const filteredDays = c.commitsByDay.filter(
      (d) => new Date(d.date) >= cutoff
    );

    const commits = filteredDays.reduce((sum, d) => sum + d.count, 0);

    // PR counts for this range
    const authorPRs = prs.filter((pr) => pr.author === name);
    const prsOpened = authorPRs.length;
    const prsMerged = authorPRs.filter((pr) => pr.state === "merged").length;
    const prsOpen = authorPRs.filter((pr) => pr.state === "open").length;

    // For lines, reviews, issues, branches — we only have totals.
    // Use full totals for these (git log doesn't easily give per-range LOC).
    // Commits and PRs are the primary time-filtered metrics.
    contributors[name] = {
      ...c,
      commits,
      prsOpened,
      prsMerged,
      prsOpen,
      commitsByDay: filteredDays,
    };
  }

  return { contributors, prs };
}

export function getActivityStatus(lastActivity: string): "green" | "amber" | "red" {
  if (!lastActivity) return "red";
  const last = new Date(lastActivity);
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 3) return "green";
  if (diffDays < 7) return "amber";
  return "red";
}

export function formatLastActivity(lastActivity: string): string {
  if (!lastActivity) return "never";
  const last = new Date(lastActivity);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "<1d";
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}
```

**Step 2: Serve `data/` as static assets**

Vite needs to serve `data/cache.json`. The simplest way: symlink or copy it into `public/`. Instead, configure Vite to serve it.

Update `internal/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 4444 },
  publicDir: "data",
});
```

Wait — this would make `data/` the public dir, which replaces the default `public/`. Better approach: just use a `public/` dir and have the collect script write to `public/cache.json`.

Actually, simplest: use `public/` as the directory and update `collect.ts` to write to `internal/public/cache.json`. OR, just make a `public/data/` folder:

Update `collect.ts` line for `CACHE_PATH`:

```ts
const DATA_DIR = join(import.meta.dirname, "public");
const CACHE_PATH = join(DATA_DIR, "cache.json");
```

Then in `data.ts`, fetch from `/cache.json`.

Update the fetch in `data.ts`:

```ts
const res = await fetch("/cache.json");
```

---

### Task 5: Bloomberg terminal CSS

**Files:**
- Modify: `internal/src/index.css`

**Step 1: Write the full Bloomberg terminal stylesheet**

Replace `internal/src/index.css` with:

```css
:root {
  --bg: #0a0a0a;
  --bg-panel: #0f0f0f;
  --bg-hover: #1a1a1a;
  --border: #1e1e1e;
  --text: #e0e0e0;
  --text-muted: #666666;
  --text-dim: #444444;
  --green: #00ff41;
  --amber: #ffb800;
  --red: #ff3333;
  --blue: #4fc3f7;
  --font: "JetBrains Mono", "Fira Code", "SF Mono", "Consolas", monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
  height: 100vh;
}

#root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Layout */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 8px;
  gap: 8px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--bg-panel);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--green);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.header-subtitle {
  font-size: 11px;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Time range buttons */
.time-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.1s;
}

.time-btn:hover {
  border-color: var(--text-muted);
  color: var(--text);
}

.time-btn.active {
  border-color: var(--green);
  color: var(--green);
}

/* Refresh button */
.refresh-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 14px;
  padding: 4px 10px;
  cursor: pointer;
  margin-left: 8px;
}

.refresh-btn:hover {
  border-color: var(--amber);
  color: var(--amber);
}

.refresh-btn.loading {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Stat cards row */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.stat-card {
  border: 1px solid var(--border);
  background: var(--bg-panel);
  padding: 10px 12px;
}

.stat-card-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-card-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--green);
  margin-top: 2px;
}

/* Leaderboard */
.leaderboard {
  flex: 1;
  border: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.leaderboard-title {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.leaderboard-table {
  flex: 1;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  position: sticky;
  top: 0;
  background: var(--bg-panel);
  padding: 6px 12px;
  text-align: right;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

thead th:first-child,
thead th:nth-child(2) {
  text-align: left;
}

thead th:hover {
  color: var(--text);
}

thead th.sorted {
  color: var(--green);
}

tbody tr {
  border-bottom: 1px solid var(--border);
}

tbody tr:hover {
  background: var(--bg-hover);
}

tbody td {
  padding: 6px 12px;
  text-align: right;
  font-size: 12px;
  white-space: nowrap;
}

tbody td:first-child {
  text-align: left;
  color: var(--text-dim);
  width: 30px;
}

tbody td:nth-child(2) {
  text-align: left;
}

.contributor-name {
  color: var(--text);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.num-green {
  color: var(--green);
}

.num-red {
  color: var(--red);
}

.num-amber {
  color: var(--amber);
}

/* Status dot */
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot.green { background: var(--green); }
.status-dot.amber { background: var(--amber); }
.status-dot.red { background: var(--red); }

/* Bottom panels */
.bottom-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  height: 220px;
}

.panel {
  border: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.panel-body {
  flex: 1;
  padding: 8px 12px;
  overflow-y: auto;
}

/* PR list */
.pr-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
}

.pr-number {
  color: var(--text-dim);
}

.pr-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-status {
  font-size: 10px;
}

.pr-status.merged { color: var(--green); }
.pr-status.open { color: var(--amber); }
.pr-status.closed { color: var(--red); }

/* PR legend */
.pr-legend {
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  font-size: 10px;
  color: var(--text-dim);
}

/* Activity chart */
.activity-chart {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
}
```

---

### Task 6: Header component

**Files:**
- Create: `internal/src/components/Header.tsx`

**Step 1: Create `internal/src/components/Header.tsx`**

```tsx
import type { TimeRange } from "../types";

const TIME_RANGES: TimeRange[] = ["7d", "30d", "90d", "all"];

interface HeaderProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
  loading: boolean;
  generatedAt: string;
}

export function Header({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  loading,
  generatedAt,
}: HeaderProps) {
  const formatted = generatedAt
    ? new Date(generatedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className="header">
      <div className="header-left">
        <div className="header-title">UNI-VERSE COMMAND CENTER</div>
        <div className="header-subtitle">
          gdgmcgill/Event-Radar &nbsp;&nbsp; last refresh: {formatted}
        </div>
      </div>
      <div className="header-right">
        {TIME_RANGES.map((r) => (
          <button
            key={r}
            className={`time-btn ${timeRange === r ? "active" : ""}`}
            onClick={() => onTimeRangeChange(r)}
          >
            {r.toUpperCase()}
          </button>
        ))}
        <button
          className={`refresh-btn ${loading ? "loading" : ""}`}
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "..." : "↻"}
        </button>
      </div>
    </div>
  );
}
```

---

### Task 7: StatCard component

**Files:**
- Create: `internal/src/components/StatCard.tsx`

**Step 1: Create `internal/src/components/StatCard.tsx`**

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
}

export function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
```

---

### Task 8: StatusDot component

**Files:**
- Create: `internal/src/components/StatusDot.tsx`

**Step 1: Create `internal/src/components/StatusDot.tsx`**

```tsx
interface StatusDotProps {
  status: "green" | "amber" | "red";
}

export function StatusDot({ status }: StatusDotProps) {
  return <span className={`status-dot ${status}`} />;
}
```

---

### Task 9: Leaderboard + ContributorRow

**Files:**
- Create: `internal/src/components/ContributorRow.tsx`
- Create: `internal/src/components/Leaderboard.tsx`

**Step 1: Create `internal/src/components/ContributorRow.tsx`**

```tsx
import type { Contributor } from "../types";
import { getActivityStatus, formatLastActivity } from "../lib/data";
import { StatusDot } from "./StatusDot";

interface ContributorRowProps {
  rank: number;
  contributor: Contributor;
}

export function ContributorRow({ rank, contributor: c }: ContributorRowProps) {
  const status = getActivityStatus(c.lastActivity);
  const lastAct = formatLastActivity(c.lastActivity);

  return (
    <tr>
      <td>{String(rank).padStart(2, "0")}</td>
      <td>
        <StatusDot status={status} />
        <span className="contributor-name">{c.name}</span>
      </td>
      <td className="num-green">{c.commits}</td>
      <td className="num-green">+{c.linesAdded.toLocaleString()}</td>
      <td className="num-red">-{c.linesRemoved.toLocaleString()}</td>
      <td>{c.prsOpened}</td>
      <td className="num-green">{c.prsMerged}</td>
      <td>{c.reviewsGiven}</td>
      <td className={status === "red" ? "num-red" : status === "amber" ? "num-amber" : ""}>{lastAct}</td>
    </tr>
  );
}
```

**Step 2: Create `internal/src/components/Leaderboard.tsx`**

```tsx
import { useState } from "react";
import type { Contributor, SortKey } from "../types";
import { ContributorRow } from "./ContributorRow";

interface LeaderboardProps {
  contributors: Record<string, Contributor>;
  pinned: string[];
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "commits", label: "CMT" },
  { key: "linesAdded", label: "+LINE" },
  { key: "linesRemoved", label: "-LINE" },
  { key: "prsOpened", label: "PRo" },
  { key: "prsMerged", label: "PRm" },
  { key: "reviewsGiven", label: "REVW" },
  { key: "lastActivity", label: "LAST" },
];

export function Leaderboard({ contributors, pinned }: LeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("commits");
  const [sortDesc, setSortDesc] = useState(true);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const sorted = Object.values(contributors).sort((a, b) => {
    // Pinned always at top
    const aPinned = pinned.includes(a.name);
    const bPinned = pinned.includes(b.name);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    let aVal: number | string;
    let bVal: number | string;

    if (sortKey === "lastActivity") {
      aVal = a.lastActivity || "";
      bVal = b.lastActivity || "";
    } else {
      aVal = a[sortKey];
      bVal = b[sortKey];
    }

    if (aVal < bVal) return sortDesc ? 1 : -1;
    if (aVal > bVal) return sortDesc ? -1 : 1;
    return 0;
  });

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-title">Leaderboard</span>
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
          sorted by {COLUMNS.find((c) => c.key === sortKey)?.label}{" "}
          {sortDesc ? "▼" : "▲"}
        </span>
      </div>
      <div className="leaderboard-table">
        <table>
          <thead>
            <tr>
              <th>##</th>
              <th>Contributor</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={sortKey === col.key ? "sorted" : ""}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <ContributorRow key={c.name} rank={i + 1} contributor={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### Task 10: PRTable component

**Files:**
- Create: `internal/src/components/PRTable.tsx`

**Step 1: Create `internal/src/components/PRTable.tsx`**

```tsx
import type { PR } from "../types";

interface PRTableProps {
  prs: PR[];
}

export function PRTable({ prs }: PRTableProps) {
  // Show most recent 20
  const visible = prs.slice(0, 20);

  return (
    <div className="panel">
      <div className="panel-header">Recent PRs</div>
      <div className="panel-body">
        {visible.map((pr) => (
          <div key={pr.number} className="pr-item">
            <span className="pr-number">#{pr.number}</span>
            <span className="pr-title">{pr.title}</span>
            <span className={`pr-status ${pr.state}`}>
              {pr.state === "merged" ? "●" : pr.state === "open" ? "○" : "✕"}
            </span>
          </div>
        ))}
      </div>
      <div className="pr-legend">
        <span style={{ color: "var(--green)" }}>●</span> merged &nbsp;
        <span style={{ color: "var(--amber)" }}>○</span> open &nbsp;
        <span style={{ color: "var(--red)" }}>✕</span> closed
      </div>
    </div>
  );
}
```

---

### Task 11: ActivityChart component

**Files:**
- Create: `internal/src/components/ActivityChart.tsx`

**Step 1: Create `internal/src/components/ActivityChart.tsx`**

```tsx
import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { Contributor, TimeRange } from "../types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface ActivityChartProps {
  contributors: Record<string, Contributor>;
  timeRange: TimeRange;
}

export function ActivityChart({ contributors, timeRange }: ActivityChartProps) {
  const chartData = useMemo(() => {
    // Aggregate all commits by day across all contributors
    const dayMap: Record<string, number> = {};

    for (const c of Object.values(contributors)) {
      for (const d of c.commitsByDay) {
        dayMap[d.date] = (dayMap[d.date] ?? 0) + d.count;
      }
    }

    const entries = Object.entries(dayMap).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    // Limit display based on time range
    const maxDays =
      timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : entries.length;
    const sliced = entries.slice(-maxDays);

    return {
      labels: sliced.map(([date]) => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      datasets: [
        {
          data: sliced.map(([, count]) => count),
          backgroundColor: "#00ff4180",
          borderColor: "#00ff41",
          borderWidth: 1,
          borderRadius: 0,
        },
      ],
    };
  }, [contributors, timeRange]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1a1a1a",
        titleColor: "#e0e0e0",
        bodyColor: "#00ff41",
        borderColor: "#333",
        borderWidth: 1,
        titleFont: { family: "JetBrains Mono, monospace", size: 11 },
        bodyFont: { family: "JetBrains Mono, monospace", size: 11 },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#666",
          font: { family: "JetBrains Mono, monospace", size: 9 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 15,
        },
        grid: { color: "#1a1a1a" },
        border: { color: "#1e1e1e" },
      },
      y: {
        ticks: {
          color: "#666",
          font: { family: "JetBrains Mono, monospace", size: 9 },
          stepSize: 1,
        },
        grid: { color: "#1a1a1a" },
        border: { color: "#1e1e1e" },
      },
    },
  } as const;

  return (
    <div className="panel">
      <div className="panel-header">
        Commit Activity ({timeRange === "all" ? "All Time" : timeRange})
      </div>
      <div className="panel-body">
        <div className="activity-chart">
          <Bar data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
}
```

---

### Task 12: Wire everything in App.tsx

**Files:**
- Modify: `internal/src/App.tsx`

**Step 1: Rewrite `internal/src/App.tsx`**

```tsx
import { useState, useEffect, useCallback } from "react";
import type { CacheData, TimeRange } from "./types";
import { loadCache, filterByTimeRange } from "./lib/data";
import { Header } from "./components/Header";
import { StatCard } from "./components/StatCard";
import { Leaderboard } from "./components/Leaderboard";
import { PRTable } from "./components/PRTable";
import { ActivityChart } from "./components/ActivityChart";

export function App() {
  const [data, setData] = useState<CacheData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cache = await loadCache();
      setData(cache);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="app" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "var(--red)", textAlign: "center" }}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>ERROR</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{error}</div>
          <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 8 }}>
            Run: cd internal && npm run collect
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "var(--green)" }}>LOADING...</div>
      </div>
    );
  }

  const filtered = filterByTimeRange(data, timeRange);
  const contribs = Object.values(filtered.contributors);
  const totalCommits = contribs.reduce((s, c) => s + c.commits, 0);
  const totalMerged = contribs.reduce((s, c) => s + c.prsMerged, 0);
  const totalOpen = contribs.reduce((s, c) => s + c.prsOpen, 0);
  const totalLinesNet = contribs.reduce(
    (s, c) => s + c.linesAdded - c.linesRemoved,
    0
  );
  const activeCount = contribs.filter((c) => {
    if (!c.lastActivity) return false;
    const diff = Date.now() - new Date(c.lastActivity).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  // Load pinned from team config (embedded at build time or fetched)
  // For now, just use empty — Task 2 config is read by collect.ts, not the frontend
  const pinned: string[] = [];

  return (
    <div className="app">
      <Header
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onRefresh={fetchData}
        loading={loading}
        generatedAt={data.generatedAt}
      />

      <div className="stat-cards">
        <StatCard label="Commits" value={totalCommits.toLocaleString()} />
        <StatCard label="PRs Merged" value={totalMerged} />
        <StatCard label="PRs Open" value={totalOpen} color="var(--amber)" />
        <StatCard
          label="Lines Net"
          value={`${totalLinesNet >= 0 ? "+" : ""}${totalLinesNet.toLocaleString()}`}
        />
        <StatCard
          label="Active (7d)"
          value={`${activeCount}/${contribs.length}`}
        />
      </div>

      <Leaderboard contributors={filtered.contributors} pinned={pinned} />

      <div className="bottom-panels">
        <PRTable prs={filtered.prs} />
        <ActivityChart
          contributors={filtered.contributors}
          timeRange={timeRange}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify the dashboard**

```bash
cd internal && npm run dev
```

Open `http://localhost:4444`. Expected: Full Bloomberg-style dashboard with real data from the repo.

---

### Task 13: Load pinned config in frontend

**Files:**
- Modify: `internal/collect.ts` (add pinned to cache output)
- Modify: `internal/src/types.ts` (add pinned to CacheData)
- Modify: `internal/src/App.tsx` (read pinned from cache)

**Step 1: Update `collect.ts` to include pinned in cache output**

Add to the `cache` object in `main()`, just before `writeFileSync`:

```ts
const cache = {
  generatedAt: new Date().toISOString(),
  pinned: config.pinned,
  contributors,
  prs: prs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ),
};
```

**Step 2: Update `CacheData` type in `types.ts`**

```ts
export interface CacheData {
  generatedAt: string;
  pinned: string[];
  contributors: Record<string, Contributor>;
  prs: PR[];
}
```

**Step 3: Update `App.tsx` to read pinned from data**

Replace the `const pinned: string[] = [];` line with:

```ts
const pinned = data.pinned ?? [];
```

---

### Task 14: Final verification

**Step 1: Run the full flow**

```bash
cd internal
npm run collect
npm run dev
```

**Step 2: Verify in browser at `http://localhost:4444`**

Checklist:
- [ ] Header shows "UNI-VERSE COMMAND CENTER" in green monospace
- [ ] Time range buttons (7d, 30d, 90d, ALL) switch and re-filter data
- [ ] 5 stat cards show totals (commits, PRs merged, PRs open, lines net, active)
- [ ] Leaderboard shows all contributors ranked by commits
- [ ] Clicking column headers re-sorts the table
- [ ] Status dots are green/amber/red based on last activity
- [ ] PR table shows recent PRs with colored status indicators
- [ ] Activity chart shows commit frequency as bar chart
- [ ] Everything is dark, monospace, no rounded corners — Bloomberg aesthetic
- [ ] Refresh button reloads data

**Step 3: Verify gitignore**

```bash
cd .. && git status
```

Expected: `internal/` does NOT appear in git status (only `.gitignore` and docs changes).
