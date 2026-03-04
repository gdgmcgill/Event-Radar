---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/events/EventCard.tsx
  - src/app/api/recommendations/route.ts
autonomous: true
requirements: [BUGFIX-EVENTCARD-RANK, BUGFIX-RECOMMENDATIONS-500]
must_haves:
  truths:
    - "EventCard renders without ReferenceError when rank/popularity props are passed"
    - "EventCard renders without ReferenceError when rank/popularity props are omitted"
    - "GET /api/recommendations returns fallback JSON (not 500) when recommendation service is unreachable"
    - "POST /api/recommendations returns 500 error JSON (not unhandled crash) when recommendation service is unreachable"
  artifacts:
    - path: "src/components/events/EventCard.tsx"
      provides: "Fixed prop destructuring — rank, showPopularityStats, popularity used without underscore prefix"
    - path: "src/app/api/recommendations/route.ts"
      provides: "Connection-failure fallback in both GET and POST handlers"
  key_links:
    - from: "src/components/events/EventCard.tsx"
      to: "JSX line ~207"
      via: "destructured prop names matching usage"
      pattern: "rank.*popularity"
---

<objective>
Fix two runtime bugs: (1) EventCard.tsx ReferenceError where `rank` and `popularity` are referenced in JSX but destructured as `_rank` and `_popularity`, and (2) /api/recommendations 500 error when the recommendation service is unreachable.

Purpose: Eliminate client-side crash on EventCard render and server-side 500 on recommendations API when the external service is down.
Output: Two patched files with no new dependencies.
</objective>

<execution_context>
@/Users/adyanullah/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adyanullah/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/events/EventCard.tsx
@src/app/api/recommendations/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix EventCard destructured prop names</name>
  <files>src/components/events/EventCard.tsx</files>
  <action>
In the destructuring block (lines 59-61), the props `rank`, `showPopularityStats`, and `popularity` are renamed with underscore prefixes (`_rank`, `_showPopularityStats`, `_popularity`), but the JSX at line 207 references the original names `rank` and `popularity`. The underscore prefix convention means "unused variable" — but these ARE used.

Fix: Remove the underscore prefixes from the destructuring. Change:
```
rank: _rank,
showPopularityStats: _showPopularityStats,
popularity: _popularity,
```
to:
```
rank,
showPopularityStats,
popularity,
```

This restores the original prop names so the JSX references at line 207 (`!rank && popularity && ...`) and lines 209/215 (`popularity.trending_score`, `popularity.popularity_score`) resolve correctly.

Do NOT rename the JSX references to use underscores — removing the prefix from destructuring is the correct fix since these props are actively used in the render output.
  </action>
  <verify>
    <automated>cd /Users/adyanullah/Documents/GitHub/Event-Radar && npx tsc --noEmit --strict src/components/events/EventCard.tsx 2>&1 | head -20</automated>
  </verify>
  <done>EventCard.tsx compiles without errors. The destructured names `rank`, `showPopularityStats`, and `popularity` match their JSX usage. No ReferenceError at runtime.</done>
</task>

<task type="auto">
  <name>Task 2: Add connection-failure fallback to recommendations API</name>
  <files>src/app/api/recommendations/route.ts</files>
  <action>
The GET handler calls `fetch(\`${RECOMMENDATION_API_URL}/recommend\`)` at line 241. When the recommendation service is not running, fetch throws a TypeError (connection refused). The existing fallback at lines 254-266 only handles `!response.ok` (successful connection, bad status code). The outer catch at line 304 returns a generic 500 error.

Fix the GET handler: Wrap the fetch call (lines 241-252) and the response.ok check (lines 254-267) in a dedicated try-catch. On connection failure (catch block), return the same fallback response that the `!response.ok` branch returns:
```typescript
let response: Response;
try {
  response = await fetch(`${RECOMMENDATION_API_URL}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ... }),
  });
} catch (fetchError) {
  console.warn("Recommendation service unreachable, returning fallback:", fetchError);
  return NextResponse.json({
    recommendations: [],
    total_events: 0,
    source: "popular_fallback",
    fallback: true,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

if (!response.ok) {
  // existing !response.ok fallback (lines 254-266) stays as-is
}
```

Also fix the POST handler similarly: Wrap the fetch call (lines 108-114) in a try-catch. On connection failure, return a JSON error with status 503 (Service Unavailable) instead of letting it bubble to the outer catch which returns a misleading 500:
```typescript
let response: Response;
try {
  response = await fetch(`${RECOMMENDATION_API_URL}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
} catch (fetchError) {
  console.warn("Recommendation service unreachable:", fetchError);
  return NextResponse.json(
    { error: "Recommendation service unavailable", fallback: true },
    { status: 503 }
  );
}
```

Keep the outer try-catch blocks in both handlers for unexpected errors (JSON parse failures, Supabase errors, etc.) — those should still return 500.
  </action>
  <verify>
    <automated>cd /Users/adyanullah/Documents/GitHub/Event-Radar && npx tsc --noEmit --strict src/app/api/recommendations/route.ts 2>&1 | head -20</automated>
  </verify>
  <done>Both GET and POST handlers in recommendations/route.ts gracefully handle connection failures. GET returns fallback JSON with 200 status. POST returns 503 with error message. No unhandled 500 errors when recommendation service is down.</done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes for both files: `npm run build` succeeds without errors.
2. EventCard renders without ReferenceError (no `rank is not defined` in browser console).
3. GET /api/recommendations returns `{ recommendations: [], fallback: true }` when recommendation service is offline (not 500).
4. POST /api/recommendations returns 503 with descriptive error when recommendation service is offline (not 500).
</verification>

<success_criteria>
- Zero TypeScript compilation errors in modified files
- EventCard.tsx: destructured prop names match all JSX references
- recommendations/route.ts: connection failures produce graceful fallback responses, not 500 errors
- `npm run build` passes
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-eventcard-rank-not-defined-error-and/1-SUMMARY.md`
</output>
