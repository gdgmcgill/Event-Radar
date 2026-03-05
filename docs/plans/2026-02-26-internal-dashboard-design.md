# Internal Dashboard — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Author:** Adyan Ullah (with Claude)

## Overview

An internal, gitignored Vite + React mini-app that provides a Bloomberg terminal-style dashboard for tracking GitHub activity across the Event-Radar team (~17 contributors, 11 interns). It combines local git data with GitHub CLI data to surface commit stats, PR activity, line-of-code contributions, and team health at a glance.

## Goals

- See who's active and who's gone quiet at a glance
- Track commits, PRs, LOC, reviews, issues, and branch activity per contributor
- Configurable time ranges (7d / 30d / 90d / all time)
- On-demand refresh — no background processes
- Bloomberg terminal aesthetic — dark, dense, monospace, data-forward

## Architecture

### Tech Stack

- **Vite + React + TypeScript** — familiar DX, fast HMR
- **Chart.js + react-chartjs-2** — sparklines, bar charts, activity heatmap
- **Raw CSS with CSS variables** — no Tailwind, full control over Bloomberg look
- **Node.js script (`collect.ts`)** — data collection via `git log` + `gh` CLI

### Directory Structure

```
internal/
├── collect.ts          # Data collection script (git log + gh CLI)
├── data/
│   └── cache.json      # Cached metrics output
├── team.config.json    # Username aliases + team roster
├── src/
│   ├── main.tsx
│   ├── App.tsx         # Layout shell + time range selector
│   ├── components/
│   │   ├── Header.tsx          # Title bar + refresh button + time range
│   │   ├── Leaderboard.tsx     # Ranked contributor table (main view)
│   │   ├── ContributorRow.tsx  # Single row in leaderboard
│   │   ├── PRTable.tsx         # PR list with status indicators
│   │   ├── ActivityChart.tsx   # Commit frequency heatmap
│   │   ├── StatCard.tsx        # Single metric box (total commits, etc.)
│   │   └── StatusDot.tsx       # Green/amber/red activity indicator
│   ├── lib/
│   │   └── data.ts             # Load + transform cache.json
│   └── index.css               # Bloomberg terminal styles
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Data Flow

1. Run `npx tsx collect.ts` — shells out to `git log` and `gh` CLI, writes `data/cache.json`
2. Open Vite app (`npm run dev`) — reads `cache.json`, renders dashboard
3. Click "↻ Refresh" in the UI — re-runs collect script, reloads data

## Data Collection

### Git Log (local, fast)

- `git shortlog -sne` — commit counts per author
- `git log --numstat --format='%H|%ae|%an|%aI'` — per-commit lines added/removed, author, date
- `git branch -a` — active branches per person

### GitHub CLI (via `gh`)

- `gh pr list --state all --json author,title,state,createdAt,mergedAt,url,number --limit 500` — all PRs
- `gh pr list --state merged --json author,reviews --limit 500` — review data
- `gh api repos/gdgmcgill/Event-Radar/issues --paginate` — issues assigned/closed

### Team Config (`team.config.json`)

```json
{
  "aliases": {
    "GeorgesAbiChahine": "Georges Abi Chahine",
    "GDG-McGill": "Adyan Ullah",
    "af-yshen": "Y.C. Shen"
  },
  "pinned": ["Adyan Ullah", "Aaron Shah", "Georges Abi Chahine"]
}
```

Aliases merge duplicate git identities. Pinned members appear at top of leaderboard.

### Cache Shape (`cache.json`)

```json
{
  "generatedAt": "2026-02-26T14:30:00Z",
  "contributors": {
    "Georges Abi Chahine": {
      "commits": 87,
      "linesAdded": 4200,
      "linesRemoved": 1100,
      "prsOpened": 12,
      "prsMerged": 10,
      "prsOpen": 1,
      "reviewsGiven": 8,
      "issuesClosed": 5,
      "activeBranches": 3,
      "lastActivity": "2026-02-25T18:00:00Z",
      "commitsByWeek": [3, 5, 12, 8, 0, 2],
      "commitsByDay": [
        { "date": "2026-02-25", "count": 3 },
        { "date": "2026-02-24", "count": 1 }
      ]
    }
  },
  "prs": [
    {
      "number": 142,
      "title": "feat: club invites",
      "author": "Georges Abi Chahine",
      "state": "merged",
      "createdAt": "2026-02-24T10:00:00Z",
      "mergedAt": "2026-02-25T14:00:00Z",
      "url": "https://github.com/gdgmcgill/Event-Radar/pull/142"
    }
  ]
}
```

Granular per-commit data stored so time range filtering happens client-side.

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  UNI-VERSE COMMAND CENTER          [7d] [30d] [90d] [ALL]  [↻] │
│  gdgmcgill/Event-Radar    last refresh: 2026-02-26 14:30 UTC   │
├────────────┬────────────┬────────────┬────────────┬─────────────┤
│  COMMITS   │  PRS MERGED│  PRS OPEN  │  LINES NET │  ACTIVE     │
│  466       │  38        │  4         │  +42,180   │  11/17      │
├─────────────────────────────────────────────────────────────────┤
│  LEADERBOARD                                        sorted by ▼ │
│ ##  CONTRIBUTOR         CMT  +LINE  -LINE  PRo  PRm  REVW  LAST │
│ 01  Georges Abi Chah..  87   4200   1100   12   10    8    1d   │
│ 02  Aaron Shah          64   3800    900    9    8    5    2d   │
│ ·· ···················  ···  ····   ····   ··   ··   ··   ···   │
├──────────────────────────────┬──────────────────────────────────┤
│  RECENT PRS                  │  COMMIT ACTIVITY (30d)           │
│  #142 feat: club invites  ● │  Mon ░░▓▓░░░░▓▓▓░░░▓▓░░░░▓░░░░  │
│  #139 fix: auth redirect ●  │  Tue ░▓▓▓▓░░░░▓▓░░▓▓▓░░░▓▓░░░░  │
│  ● merged  ○ open  ✕ closed │  Sun ░░░░░░░░░░░░░░░░░░░░░░░░░  │
└──────────────────────────────┴──────────────────────────────────┘
```

### Interactions

- **Time range buttons** filter all data (leaderboard, stats, charts, PRs)
- **Refresh button** re-runs `collect.ts` and reloads data
- **Leaderboard columns** are sortable — click any header to re-rank
- **Status dot** on contributor row: green (<3d), amber (3-7d), red (>7d since last activity)
- **PR list** shows most recent first, color-coded by merge status

### Visual Design

- **Background:** `#0a0a0a`
- **Primary text:** `#e0e0e0`
- **Accent green:** `#00ff41` (positive metrics, active status)
- **Accent amber:** `#ffb800` (warnings, open PRs)
- **Accent red:** `#ff3333` (inactive, closed/rejected)
- **Borders:** `#1a1a1a`
- **Muted text:** `#666666`
- **Font:** `'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace`
- **No rounded corners, no shadows, thin 1px borders**

## Metrics Summary

| Metric | Source | Priority |
|--------|--------|----------|
| Commits (count, frequency) | git log | High |
| PRs (opened, merged, open) | gh CLI | High |
| Lines added/removed | git log --numstat | Medium |
| PR reviews given | gh CLI | Medium |
| Last activity date | git log | Medium |
| Issues closed | gh API | Low |
| Active branches | git branch | Low |

## Decisions

- **Gitignored** — `internal/` added to `.gitignore`
- **No Tailwind** — raw CSS for full Bloomberg aesthetic control
- **Client-side filtering** — cache stores granular data, UI slices by time range
- **No server component** — refresh is manual (`npm run collect` or button that spawns child process)
- **Monospace everything** — no variable-width fonts anywhere
