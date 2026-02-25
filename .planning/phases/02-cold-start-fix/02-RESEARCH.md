# Phase 2: Cold Start Fix - Research

**Researched:** 2026-02-23
**Domain:** Recommendation API fallback logic, UI conditional rendering, constants centralization
**Confidence:** HIGH

---

## Summary

Phase 2 is a pure TypeScript/Next.js codebase change — no new libraries, no schema migrations, no infrastructure work. The entire problem lives in two places: the `/api/recommendations` route and the `RecommendedEventsSection` component (plus a constants file and the home page threshold check).

The current recommendations API returns an empty array when a user has no saved events and no interest tags (lines 225-227 of `route.ts`). The API currently fetches all users and runs full k-means clustering on every request — this is the expensive path we must bypass, not modify, for cold-start users. The correct fix is to detect the cold-start condition early (saved count < 3) and short-circuit to a popularity-ranked fallback query before touching k-means at all.

The home page (`src/app/page.tsx`, line 128) already has the threshold check hardcoded as `savedEventIds.size >= 3`. The threshold value must move to `src/lib/constants.ts` as `RECOMMENDATION_THRESHOLD = 3` and be consumed from there by both `page.tsx` and the API. The `RecommendedEventsSection` component currently has no awareness of the `source` field in the API response — it ignores `data.recommendations` shape beyond the array. The API must add a `source: "personalized" | "popular_fallback"` field to its response, and the component must read it to switch its heading and show the onboarding nudge.

**Primary recommendation:** Add cold-start detection at the top of the recommendations GET handler, build a Supabase popularity-ranked fallback query that mirrors the scoring rules (save_count > 10 → +2, start_time within 7 days → +1), return `source: "popular_fallback"` in the JSON, then update `RecommendedEventsSection` to use the source field for label and nudge display.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLD-01 | /api/recommendations returns popularity-ranked fallback feed when user has <3 saved events | API modification: early exit to fallback query before k-means path |
| COLD-02 | Fallback query filters start_time > NOW() to exclude past events | Supabase `.gte("start_date", new Date().toISOString())` — already used in `/api/events/popular/route.ts` line 103 |
| COLD-03 | Fallback scoring: >10 saves → +2, within 7 days → +1 | In-memory scoring after fetching `event_popularity_scores` join — no new table needed |
| COLD-04 | API response includes `source` field ("personalized" or "popular_fallback") | Add `source` string to `NextResponse.json()` at each return site |
| COLD-05 | RecommendedEventsSection shows "Popular on Campus" label when source is popular_fallback | Component reads `data.source` from fetch response; conditional heading render |
| COLD-06 | Already-saved events excluded from fallback feed | Filter using `currentUserSaved` Set — same pattern already applied to personalized candidates (line 261) |
| COLD-07 | RECOMMENDATION_THRESHOLD constant centralized in `src/lib/constants.ts` and used by both page.tsx and API | Add constant, import in page.tsx and route.ts |
| COLD-08 | Onboarding nudge displayed in cold-start state ("Save N more events to unlock personalized recommendations") | Render nudge in RecommendedEventsSection when source === "popular_fallback" using savedEventIds.size and RECOMMENDATION_THRESHOLD |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.0.3 | API routes + React Server/Client components | Already in use; no new dep needed |
| @supabase/supabase-js | ^2.49.0 | Database queries from API routes | Already in use; server client available |
| TypeScript (strict) | 5.4.0 | All new code must satisfy strict mode | Project requirement per CLAUDE.md |
| Tailwind CSS + shadcn/ui | 3.x / existing | Component styling | Existing pattern; no new components needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | ^0.344.0 | Icons for nudge UI | Use `Sparkles` or `BookmarkPlus` for nudge CTA |
| zustand (useAuthStore) | ^5.0.9 | Access user auth state in client components | Already imported in RecommendedEventsSection |
| useSavedEvents hook | internal | Get savedEventIds.size for nudge math | Already imported in RecommendedEventsSection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory popularity scoring | Direct Supabase ORDER BY | In-memory is more flexible for the +2/+1 boost logic; direct ORDER BY can't express the composite boost rule without a computed column or RPC |
| Modifying RecommendedEventsSection | Creating a new ColdStartSection component | Modifying existing component is simpler and avoids duplicating the scroll/arrow layout; use conditional rendering inside the existing component |

**Installation:**
```bash
# No new packages needed — all dependencies already present
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/recommendations/route.ts   # ADD: cold-start detection + fallback query + source field
├── components/events/
│   └── RecommendedEventsSection.tsx   # ADD: source-aware heading + onboarding nudge
├── lib/
│   └── constants.ts                   # ADD: RECOMMENDATION_THRESHOLD = 3
└── app/page.tsx                       # CHANGE: import RECOMMENDATION_THRESHOLD, remove magic number
```

### Pattern 1: Early Return Cold-Start Detection in API
**What:** Check saved event count for the requesting user at the very start of the handler. If below threshold, skip all k-means and collaborative filtering work entirely and jump to the popularity fallback.
**When to use:** Prevents the expensive parallel fetch of all users + all saved events + k-means computation for users who don't yet have enough signal.
**Example:**
```typescript
// In GET /api/recommendations — after fetching savedEventsResult
const currentUserSaved = (savedEventsResult.data ?? [])
  .filter((s) => s.user_id === user.id)
  .map((s) => s.event_id);

if (currentUserSaved.length < RECOMMENDATION_THRESHOLD) {
  // Short-circuit: return popularity fallback
  const fallback = await buildPopularityFallback(supabase, new Set(currentUserSaved));
  return NextResponse.json({ recommendations: fallback, source: "popular_fallback" });
}
```

### Pattern 2: Popularity Fallback Scoring (In-Memory)
**What:** Fetch upcoming approved events joined with their popularity scores, then apply the boost formula in-memory before slicing to 20.
**When to use:** The boost rules (+2 for save_count > 10, +1 for start within 7 days) cannot be expressed as a single ORDER BY — requires a computed score.
**Example:**
```typescript
async function buildPopularityFallback(
  supabase: ReturnType<typeof createClient>,
  savedIds: Set<string>
): Promise<{ events: Event[]; source: "popular_fallback" }> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("events")
    .select("*, popularity:event_popularity_scores(*)")
    .eq("status", "approved")
    .gt("start_date", now.toISOString())
    .limit(200);

  const scored = (data ?? [])
    .filter((e) => !savedIds.has(e.id))
    .map((e) => {
      const pop = e.popularity?.[0];
      let score = pop?.popularity_score ?? 0;
      if ((pop?.save_count ?? 0) > 10) score += 2;
      const start = new Date(e.start_date);
      if (start <= sevenDaysFromNow) score += 1;
      return { event: e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ event }) => transformEventFromDB(event));

  return scored;
}
```

### Pattern 3: Source-Aware UI in RecommendedEventsSection
**What:** The component fetches `/api/recommendations`, reads `data.source` alongside `data.recommendations`, and conditionally renders "Popular on Campus" vs "Recommended For You" heading, and shows/hides the onboarding nudge.
**When to use:** Any time the API returns `source: "popular_fallback"`.
**Example:**
```typescript
// In fetchRecommendedEvents:
const data = await res.json();
const source: "personalized" | "popular_fallback" = data.source ?? "personalized";
const fetchedEvents = Array.isArray(data.recommendations) ? data.recommendations : [];
setSource(source);  // new state field
setEvents(fetchedEvents);

// In render:
const heading = source === "popular_fallback" ? "Popular on Campus" : "Recommended For You";
const remaining = Math.max(0, RECOMMENDATION_THRESHOLD - savedEventIds.size);

// Nudge (only when popular_fallback):
{source === "popular_fallback" && remaining > 0 && (
  <p className="text-sm text-muted-foreground mt-1">
    Save {remaining} more event{remaining !== 1 ? "s" : ""} to unlock personalized recommendations
  </p>
)}
```

### Pattern 4: RECOMMENDATION_THRESHOLD Constant
**What:** Single source of truth integer exported from `src/lib/constants.ts`.
**When to use:** Every consumer of the threshold (page.tsx, route.ts) imports this constant.
**Example:**
```typescript
// src/lib/constants.ts — add alongside existing exports:
export const RECOMMENDATION_THRESHOLD = 3;

// src/app/page.tsx — replace line 128:
// Before: const canShowRecommendations = savedEventIds.size >= 3;
// After:
import { RECOMMENDATION_THRESHOLD } from "@/lib/constants";
const canShowRecommendations = savedEventIds.size >= RECOMMENDATION_THRESHOLD;

// src/app/api/recommendations/route.ts:
import { RECOMMENDATION_THRESHOLD } from "@/lib/constants";
if (currentUserSaved.length < RECOMMENDATION_THRESHOLD) { ... }
```

### Anti-Patterns to Avoid
- **Calling the fallback from a separate API endpoint (e.g. /api/events/popular):** The UI component already hits `/api/recommendations`; introducing a second endpoint adds a conditional fetch in the component and duplicates logic. Keep everything in the existing route.
- **Applying the cold-start fallback after k-means runs:** The current k-means path fetches ALL users and ALL saved events before the cold-start check. Put the threshold check BEFORE the parallel Promise.all to avoid the expensive DB round-trips for cold users.
- **Storing `source` in a Zustand store:** `source` is local to the recommendations fetch response; useState inside the component is the correct scope.
- **Hardcoding the remaining count in the nudge message:** Always compute `RECOMMENDATION_THRESHOLD - savedEventIds.size` dynamically so it counts down correctly as the user saves events.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event-to-frontend shape transformation | Custom field mapping | `transformEventFromDB()` from `@/lib/tagMapping` | Already handles the `start_date`→`event_date`, `tags` normalization, `club` join — used consistently across all routes |
| Save-count data | Manual count query | `event_popularity_scores.save_count` from existing table | Already tracked and joined in the popular events route |
| User's saved event IDs in client | Re-fetch in component | `useSavedEvents()` hook already imported in `RecommendedEventsSection` | Returns `savedEventIds` Set; needed for nudge math |

**Key insight:** All data infrastructure exists. This phase is pure logic wiring, not infrastructure build.

---

## Common Pitfalls

### Pitfall 1: Checking saved count AFTER the expensive parallel fetch
**What goes wrong:** The current API fetches all users, all saved events, and all events in a `Promise.all` before any cold-start check. If cold-start detection is added after line 165, cold users still pay the full DB cost on every page load.
**Why it happens:** Adding the check "where it's needed" without reading the full handler first.
**How to avoid:** Add a targeted fetch of just the current user's saved event count (or filter `savedEventsResult` early) and return the fallback before the full `Promise.all`.
**Warning signs:** The fallback works correctly but the API is slow for new users.

### Pitfall 2: Fallback returns past events
**What goes wrong:** Forgetting `.gt("start_date", now.toISOString())` in the fallback query, or using `.gte` with `now` (which includes events starting exactly at the current second — acceptable but less correct than `>` since the event is effectively already happening).
**Why it happens:** Copying the query from popular events route which uses `.gte`.
**How to avoid:** Use `.gt("start_date", now.toISOString())` in the fallback query. COLD-02 explicitly says "start_time > NOW()".

### Pitfall 3: Source field undefined on personalized path
**What goes wrong:** Adding `source: "popular_fallback"` to the fallback return but forgetting to add `source: "personalized"` to the existing `return NextResponse.json({ recommendations })` at line 357. The component receives `undefined` for source on the personalized path and falls back to treating it as cold-start.
**Why it happens:** Only modifying the new code path.
**How to avoid:** Update BOTH return sites in the GET handler.
**Warning signs:** Users with 3+ saved events see "Popular on Campus" heading.

### Pitfall 4: Nudge shows when savedEventIds is still loading
**What goes wrong:** `useSavedEvents` has an `isLoading` state. If the nudge renders before the saved events have loaded, it shows "Save 3 more events" even for users who are close to or past the threshold.
**Why it happens:** Rendering nudge before `isLoading` is false.
**How to avoid:** Wrap nudge render in `!isLoading` (the hook already exposes `isLoading`). The component already imports `useSavedEvents`.

### Pitfall 5: TypeScript strict mode — `source` field not typed
**What goes wrong:** Adding `source` to the JSON response without updating the type used by the component, resulting in `any` type or TypeScript error.
**Why it happens:** The component uses an inline `await res.json()` without type assertion.
**How to avoid:** Add a local interface or type alias for the API response in the component:
```typescript
interface RecommendationsResponse {
  recommendations: Event[];
  source?: "personalized" | "popular_fallback";
}
const data: RecommendationsResponse = await res.json();
```

### Pitfall 6: RECOMMENDATION_THRESHOLD import in API route
**What goes wrong:** `src/lib/constants.ts` uses `import { EventTag } from "@/types"` — verify that importing this file from the API route (server context) does not trigger any `"use client"` boundary issues.
**Why it happens:** The `@/` alias resolves correctly in both server and client contexts in Next.js App Router.
**How to avoid:** `constants.ts` is a plain module with no `"use client"` directive and no browser-only APIs — safe to import from both server routes and client components. Verified by examining the file (lines 1-104): no browser globals.

---

## Code Examples

Verified patterns from existing codebase:

### Existing: start_date future filter (from popular events route)
```typescript
// Source: /src/app/api/events/popular/route.ts line 103
.gte("start_date", new Date().toISOString())
```

### Existing: Popularity join query pattern
```typescript
// Source: /src/app/api/events/popular/route.ts lines 96-104
const { data: eventsData, error: eventsError } = await supabase
  .from("events")
  .select(`
    *,
    popularity:event_popularity_scores(*)
  `)
  .eq("status", "approved")
  .gte("start_date", new Date().toISOString())
  .order("start_date", { ascending: true });
```

### Existing: transformEventFromDB usage
```typescript
// Source: /src/app/api/recommendations/route.ts line 101
function mapEventToResponse(event: DbEventRow): Event {
  return transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0]);
}
```

### Existing: Saved event filter (already-saved exclusion)
```typescript
// Source: /src/app/api/recommendations/route.ts lines 259-264
for (const event of allEvents ?? []) {
  if (currentUserSaved.has(event.id)) continue;
  const startDate = getEventStartDate(event);
  if (!startDate || startDate < now) continue;
  candidates.push(event);
}
```

### Existing: Threshold check in page.tsx (line 128)
```typescript
// Source: /src/app/page.tsx line 128
const canShowRecommendations = savedEventIds.size >= 3;
```

### Existing: Constants file exports pattern
```typescript
// Source: /src/lib/constants.ts lines 79-90
export const API_ENDPOINTS = {
  RECOMMENDATIONS: "/api/recommendations",
  // ...
} as const;
// New constant fits the same file — plain export, no type imports needed:
export const RECOMMENDATION_THRESHOLD = 3;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PopularEventsSection shown for all unauthenticated + under-threshold users | RecommendedEventsSection with fallback source field (this phase) | Phase 2 | Removes the separate PopularEventsSection component for authenticated cold-start users — they now see the unified recommendations section with a "Popular on Campus" label |
| Magic number `3` in page.tsx line 128 | RECOMMENDATION_THRESHOLD from constants.ts | Phase 2 | Eliminates the two-place sync risk between UI and API |

**Note on PopularEventsSection:** The current `page.tsx` (lines 354-364) shows `PopularEventsSection` for unauthenticated users and for authenticated users with `savedEventIds.size < 3`. After Phase 2, the authenticated cold-start case (user with < 3 saves) should show `RecommendedEventsSection` (which will return the fallback feed) rather than `PopularEventsSection`. The unauthenticated case continues to show `PopularEventsSection` unchanged. The threshold condition in page.tsx must be updated accordingly.

---

## Open Questions

1. **Does the fallback feed appear inside RecommendedEventsSection or should it replace it with a new component?**
   - What we know: The requirements say "RecommendedEventsSection shows 'Popular on Campus' label when source is popular_fallback" (COLD-05). This implies modifying the existing component, not creating a new one.
   - What's unclear: Whether to keep the horizontal scroll layout for the fallback or switch to the PopularEventsSection grid (3-column). The PopularEventsSection is currently shown for the same state — after Phase 2 the authenticated cold-start user will see the horizontal scroll layout with "Popular on Campus" heading.
   - Recommendation: Keep the existing horizontal scroll layout in RecommendedEventsSection; it's simpler and consistent. The PopularEventsSection grid with rank badges is only for the unauthenticated case.

2. **What is the exact `save_count` column name in `event_popularity_scores`?**
   - What we know: The TypeScript type in `src/types/index.ts` at line 146 names it `save_count`. The `EventPopularityScore` interface has `save_count: number`.
   - What's unclear: Whether the DB column is actually named `save_count` or is mapped by the ORM. Since this is direct Supabase/PostgREST and the type is auto-generated, the column name matches.
   - Recommendation: Trust the TypeScript type — use `pop.save_count` in the fallback scoring.

3. **Should `source: "popular_fallback"` also be returned in the unauthenticated (401) path?**
   - What we know: The current API returns 401 for unauthenticated users; the component is never rendered for unauthenticated users (page.tsx shows PopularEventsSection instead). The RecommendedEventsSection is only mounted for `user && ...` users.
   - Recommendation: No change needed for the 401 path. Source field is only relevant for 200 responses.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `/src/app/api/recommendations/route.ts` (full file, 365 lines)
- Codebase direct inspection — `/src/components/events/RecommendedEventsSection.tsx` (full file, 167 lines)
- Codebase direct inspection — `/src/app/page.tsx` (full file, 411 lines)
- Codebase direct inspection — `/src/app/api/events/popular/route.ts` (full file, 165 lines)
- Codebase direct inspection — `/src/lib/constants.ts` (full file, 104 lines)
- Codebase direct inspection — `/src/types/index.ts` (full file, 234 lines)
- Codebase direct inspection — `/src/hooks/useSavedEvents.ts`

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — authoritative requirement descriptions for COLD-01 through COLD-08
- `.planning/STATE.md` — project decisions and context (Phase 2 independent of Phase 1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing import patterns
- Architecture: HIGH — derived directly from reading the existing files; no speculation
- Pitfalls: HIGH — identified by close reading of actual code paths and TypeScript strict mode constraints

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable — no external dependencies; all in-repo)
