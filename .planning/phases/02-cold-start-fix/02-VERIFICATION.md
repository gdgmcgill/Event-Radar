---
phase: 02-cold-start-fix
verified: 2026-02-23T22:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 2: Cold-Start Fix Verification Report

**Phase Goal:** New users with fewer than 3 saved events see a popularity-ranked feed of upcoming campus events instead of an empty or broken recommendations section, and understand what action unlocks personalized picks
**Verified:** 2026-02-23T22:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user with 0 saved events who calls GET /api/recommendations receives a non-empty JSON with source: 'popular_fallback' and a recommendations array | VERIFIED | Line 180-185 of route.ts: `if (currentUserSavedIds.size < RECOMMENDATION_THRESHOLD)` returns `{ recommendations: fallbackEvents, source: "popular_fallback" as const }` |
| 2 | Every event in the fallback response has a start_date strictly after the current time | VERIFIED | Line 120 of route.ts: `.gt("start_date", now.toISOString())` — uses `.gt()` not `.gte()` per COLD-02 |
| 3 | Events the user has already saved do not appear in the fallback recommendations | VERIFIED | Line 133 of route.ts: `.filter((e) => !savedIds.has(e.id))` |
| 4 | A user with 3+ saved events who calls GET /api/recommendations receives source: 'personalized' in the JSON response | VERIFIED | Lines 298, 339, 429 of route.ts all return `source: "personalized" as const` on the personalized path |
| 5 | RECOMMENDATION_THRESHOLD constant is defined in constants.ts and imported by both page.tsx and the API route | VERIFIED | constants.ts line 107: `export const RECOMMENDATION_THRESHOLD = 3`; imported at route.ts line 13, page.tsx line 24, RecommendedEventsSection.tsx line 11 |
| 6 | A cold-start user sees section titled 'Popular on Campus' instead of 'Recommended For You' | VERIFIED | RecommendedEventsSection.tsx line 131: `{source === "popular_fallback" ? "Popular on Campus" : "Recommended For You"}` |
| 7 | A cold-start user sees a nudge message telling them exactly how many more saves are needed | VERIFIED | RecommendedEventsSection.tsx lines 141-149: IIFE computes `remaining = Math.max(0, RECOMMENDATION_THRESHOLD - savedEventIds.size)` and renders "Save N more event(s) to unlock personalized recommendations", gated on `!isLoading` |
| 8 | Authenticated cold-start users see RecommendedEventsSection (which shows fallback), not PopularEventsSection | VERIFIED | page.tsx lines 355-365: `!user \|\| recommendationFailed` shows PopularEventsSection; `!isSavedLoading` shows RecommendedEventsSection for all authenticated users regardless of save count |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/constants.ts` | RECOMMENDATION_THRESHOLD = 3 constant | VERIFIED | Line 107: `export const RECOMMENDATION_THRESHOLD = 3;` with JSDoc comment |
| `src/app/api/recommendations/route.ts` | Cold-start fallback query and source field on all response paths | VERIFIED | `buildPopularityFallback` function at lines 109-147; cold-start gate at line 180; `source: "popular_fallback"` at line 184; `source: "personalized"` at lines 298, 339, 429 |
| `src/components/events/RecommendedEventsSection.tsx` | Source-aware heading and onboarding nudge | VERIFIED | `source` state at line 27; conditional heading at line 131; nudge at lines 141-149; `data.source` read at line 69 |
| `src/app/page.tsx` | RECOMMENDATION_THRESHOLD import replacing magic number | VERIFIED | Import at line 24; `canShowRecommendations` uses constant at line 129; conditional rendering fixed at lines 355-365 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/recommendations/route.ts` | `src/lib/constants.ts` | `import RECOMMENDATION_THRESHOLD` | WIRED | Line 13: `import { RECOMMENDATION_THRESHOLD } from "@/lib/constants"` — used at line 180 in cold-start gate |
| `src/app/api/recommendations/route.ts` | `supabase.from('events')` | `buildPopularityFallback` | WIRED | Lines 116-121: query with `.eq("status", "approved").gt("start_date", ...)` inside `buildPopularityFallback`; function called at line 181 |
| `src/components/events/RecommendedEventsSection.tsx` | `/api/recommendations` | `fetch reads data.source field` | WIRED | Line 68-69: `const data: RecommendationsResponse = await res.json(); const fetchedSource = data.source ?? "personalized"` — `fetchedSource` stored via `setSource(fetchedSource)` at line 77 |
| `src/app/page.tsx` | `src/lib/constants.ts` | `import RECOMMENDATION_THRESHOLD` | WIRED | Line 24 import; consumed at line 129 in `canShowRecommendations` definition |
| `src/components/events/RecommendedEventsSection.tsx` | `src/lib/constants.ts` | `import RECOMMENDATION_THRESHOLD for nudge math` | WIRED | Line 11 import; consumed at line 142: `RECOMMENDATION_THRESHOLD - savedEventIds.size` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLD-01 | 02-01-PLAN.md | /api/recommendations returns popularity-ranked fallback feed when user has <3 saved events | SATISFIED | route.ts lines 162-186: targeted saved_events fetch, threshold check, `buildPopularityFallback` call |
| COLD-02 | 02-01-PLAN.md | Fallback query filters start_date > NOW() to exclude past events | SATISFIED | route.ts line 120: `.gt("start_date", now.toISOString())` — strictly greater than, not gte |
| COLD-03 | 02-01-PLAN.md | Fallback scoring applies popularity boost (>10 saves → +2) and recency boost (within 7 days → +1) | SATISFIED | route.ts lines 137-139: `if ((pop?.save_count ?? 0) > 10) score += 2; if (start <= sevenDaysFromNow) score += 1` |
| COLD-04 | 02-01-PLAN.md | API response includes source field ("personalized" or "popular_fallback") | SATISFIED | route.ts lines 184, 298, 339, 429: all four 200-response paths include `source` field |
| COLD-05 | 02-02-PLAN.md | RecommendedEventsSection shows "Popular on Campus" label when source is popular_fallback | SATISFIED | RecommendedEventsSection.tsx line 131: ternary renders "Popular on Campus" when `source === "popular_fallback"` |
| COLD-06 | 02-01-PLAN.md | Already-saved events excluded from fallback feed | SATISFIED | route.ts line 133: `.filter((e) => !savedIds.has(e.id))` applied before scoring/sorting |
| COLD-07 | 02-01-PLAN.md, 02-02-PLAN.md | RECOMMENDATION_THRESHOLD constant centralized in src/lib/constants.ts and used by both page.tsx and API | SATISFIED | All three consumers import from `@/lib/constants`: route.ts line 13, page.tsx line 24, RecommendedEventsSection.tsx line 11 |
| COLD-08 | 02-02-PLAN.md | Onboarding nudge displayed in cold-start state | SATISFIED | RecommendedEventsSection.tsx lines 141-149: nudge gated on `source === "popular_fallback" && !isLoading`, shows dynamic remaining count |

All 8 requirements: SATISFIED. No orphaned requirements detected. REQUIREMENTS.md traceability table marks all COLD-01 through COLD-08 as Phase 2 / Complete.

---

## Anti-Patterns Found

No anti-patterns detected in any modified file.

| File | Pattern Checked | Result |
|------|----------------|--------|
| `src/lib/constants.ts` | TODO/FIXME/placeholder, empty implementations | Clean |
| `src/app/api/recommendations/route.ts` | TODO/FIXME/placeholder, stub returns, static empty responses | Clean |
| `src/components/events/RecommendedEventsSection.tsx` | TODO/FIXME/placeholder, stub returns | Clean |
| `src/app/page.tsx` | TODO/FIXME/placeholder, magic numbers | Clean — magic number 3 replaced with `RECOMMENDATION_THRESHOLD` |

---

## Human Verification Required

### 1. Cold-Start Feed Displays in Browser

**Test:** Sign in as a new McGill user with 0 saved events. Load the home page.
**Expected:** The recommendations section heading reads "Popular on Campus" (not "Recommended For You"), subtitle reads "Trending events from across campus", and a nudge message appears: "Save 3 more events to unlock personalized recommendations" with a BookmarkPlus icon.
**Why human:** Requires an authenticated browser session and a real Supabase connection to verify the API returns fallback data and the component renders it correctly.

### 2. Nudge Count Decrements as User Saves Events

**Test:** As the same cold-start user, save 1 event. Reload the page.
**Expected:** The nudge reads "Save 2 more events to unlock personalized recommendations". After saving a second event, it reads "Save 1 more event to unlock personalized recommendations" (singular). After a third save, the nudge disappears and the heading changes to "Recommended For You".
**Why human:** Requires interactive browser testing with real saved-event state changes across page loads.

### 3. Personalized Path Unaffected for Established Users

**Test:** Sign in as a user with 3 or more saved events. Load the home page.
**Expected:** Section heading reads "Recommended For You" with a "New" badge. Subtitle reads "Based on your interests and saved events". No nudge message is visible.
**Why human:** Requires an authenticated session with real saved events in Supabase to confirm the k-means personalized path runs and returns `source: "personalized"`.

### 4. Unauthenticated Users Still See PopularEventsSection

**Test:** Load the home page without signing in (or sign out first).
**Expected:** The PopularEventsSection renders (not RecommendedEventsSection). No nudge or "Popular on Campus" label appears in a recommendations section — the popular feed is the standard popular feed component.
**Why human:** Requires browser session verification to confirm `!user` branch renders the correct component.

---

## Gaps Summary

None. All 8 observable truths verified, all 4 required artifacts confirmed substantive and wired, all 5 key links confirmed connected end-to-end, all 8 requirements satisfied. TypeScript strict mode passes with zero errors (confirmed: `npx tsc --noEmit` produced no output). All three feature commits (1e89a9d, c7bc8ab, 8372cd5) verified in git log with correct file modifications.

The phase goal is fully achieved: authenticated cold-start users with fewer than 3 saves now receive a popularity-ranked feed with the "Popular on Campus" label and an onboarding nudge, while established users continue to receive the personalized feed — all gated by a single centralized `RECOMMENDATION_THRESHOLD` constant.

---

_Verified: 2026-02-23T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
