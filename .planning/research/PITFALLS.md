# Domain Pitfalls

**Domain:** Campus event platform -- organizer dashboards, analytics, reviews, multi-org support
**Project:** Uni-Verse (Event-Radar)
**Researched:** 2026-03-05

## Critical Pitfalls

Mistakes that cause rewrites or major security/data issues.

### Pitfall 1: RLS Policies That Don't Actually Isolate Club Data

**What goes wrong:** Supabase RLS policies are written too broadly (e.g., `USING (true)` or missing tenant filtering), allowing organizers of Club A to read/modify Club B's events, analytics, or member lists. The current codebase already has application-level auth checks (e.g., `my-clubs/route.ts` checks `club_organizer` role, `members/route.ts` checks membership), but these are defense-in-depth on top of RLS -- if RLS is misconfigured, a direct Supabase client call from the browser bypasses all application logic.

**Why it happens:** The existing codebase uses `createClient()` from `@/lib/supabase/server` in API routes, which provides server-side Supabase access. But the anon key is public (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), meaning anyone can create a client-side Supabase instance and query tables directly. If RLS policies don't properly filter by club membership, data leaks across organizations.

**Consequences:** One club organizer sees another club's analytics, member emails, or pending events. On a campus platform where clubs are run by students who know each other, this is a trust-destroying bug that could kill adoption.

**Prevention:**
- Write RLS policies that join through `club_members` to verify the requesting user has membership in the relevant club before allowing SELECT/INSERT/UPDATE/DELETE
- For analytics tables, enforce that `club_id` matches a club where `auth.uid()` has membership
- Test RLS from the **client SDK** (not SQL Editor, which bypasses RLS)
- Create a test script that authenticates as User A (member of Club X) and attempts to read Club Y's data -- it must return zero rows

**Detection:** Before each release, run cross-club access tests. If an organizer endpoint returns data for a club they don't belong to, RLS is broken.

**Phase mapping:** Must be addressed in the very first phase (club management foundation). Every new table added later (analytics, reviews) inherits this risk if the pattern isn't established early.

---

### Pitfall 2: Authorization Checked Only at the API Route Level, Not at the Data Layer

**What goes wrong:** The current pattern (visible in `my-clubs/route.ts`, `members/route.ts`) performs auth checks in API route handlers: fetch user, check roles, then query. This is fine for API routes, but Next.js App Router has multiple entry points -- Server Components, Server Actions, and direct Supabase client calls can all access data. If authorization logic lives only in route handlers, a new Server Action or component that queries the same table skips the check entirely.

**Why it happens:** It's natural to put auth at the "front door" (the API route). But Next.js App Router encourages data fetching in Server Components and Server Actions, creating many front doors. The official Next.js docs explicitly warn: "Returning null in a layout or top-level component if a user is not authorized will not prevent nested route segments and Server Actions from being accessed."

**Consequences:** A developer adds a Server Component that fetches club data for a dashboard and forgets to check membership. Or a Server Action for "quick edit event title" skips the ownership check. The feature works in testing (the developer is a member of the test club) but leaks data in production.

**Prevention:**
- Rely on Supabase RLS as the **primary** authorization layer (it applies regardless of how the data is accessed)
- Create a shared `verifyClubMembership(userId, clubId)` utility (similar to the existing `verifyAdmin()` in `src/lib/admin.ts`) and use it in every club-scoped operation
- Treat API-level checks as UX guardrails (better error messages) and RLS as the security boundary
- Never use the service role key in client-facing code paths

**Detection:** Code review checklist: "Does this data access path have authorization?" If the answer is "the API route checks it," ask "what if this code runs outside that API route?"

**Phase mapping:** Foundation phase. Establish the `verifyClubMembership` utility and RLS-first pattern before building any organizer features.

---

### Pitfall 3: Building Analytics Before Defining What Organizers Actually Need to Know

**What goes wrong:** Engineers build a full analytics dashboard with charts, time series, and breakdowns before validating what metrics club organizers actually care about. The result is an over-engineered dashboard that shows 15 metrics nobody looks at, while missing the one thing organizers want ("how many people saw my event?").

**Why it happens:** Analytics feels like a "more is better" domain. The existing `user_interactions` table already tracks views, clicks, saves, shares, and calendar adds. It's tempting to build dashboards for all of these. But campus club organizers are typically students with limited time -- they want actionable summaries, not data exploration tools.

**Consequences:** Wasted development time on charts nobody uses. Organizers feel overwhelmed and stop checking the dashboard. Performance degrades from complex aggregation queries that run on every page load.

**Prevention:**
- Start with exactly three metrics: **views**, **saves**, and **follower count change**. These map to awareness, intent, and loyalty -- the three things organizers actually act on.
- Pre-aggregate analytics (materialized views or cron-computed summary rows) rather than computing on the fly
- Add metrics only when an organizer asks "I wish I could see X" -- not speculatively
- The existing `user_interactions` table and `EventPopularityScore` type already capture the raw data; the pitfall is in the presentation layer, not the data layer

**Detection:** If the analytics spec has more than 5 distinct metrics in v1, it's over-scoped. If any metric requires a query joining 3+ tables, it needs pre-aggregation.

**Phase mapping:** Analytics phase. Keep the first iteration minimal. The interaction tracking infrastructure already exists; the work is in aggregation and display.

---

### Pitfall 4: Multi-Club Switching That Corrupts State Across Clubs

**What goes wrong:** An organizer manages Club A and Club B. They open the dashboard for Club A, start editing an event, then switch to Club B via the quick-switch dropdown. The edit form submits with Club B's context, creating an event under the wrong club. Or analytics data from Club A persists in the UI after switching to Club B, showing stale/wrong numbers.

**Why it happens:** Client-side state management in React doesn't naturally scope to a "current club" context. If the club selector updates a global state variable but components don't re-fetch or reset their local state, data from the previous club bleeds through. This is especially dangerous with optimistic UI updates or cached SWR/React Query data.

**Consequences:** Events posted under the wrong club (data integrity issue). Organizers see wrong analytics and make bad decisions. Trust in the platform erodes.

**Prevention:**
- Use the club ID as a **URL parameter** (e.g., `/dashboard/[clubId]/events`) rather than client-side state. This forces a full re-render on club switch and makes the current context explicit in the URL.
- If using client-side state, invalidate all club-scoped queries when the active club changes
- Forms must include `club_id` as a hidden field populated at render time, not from a global selector that can change mid-edit
- The existing `events/create/route.ts` accepts `body.club_id` -- the pitfall is on the client side, not the API side

**Detection:** QA test: open event creation for Club A, switch to Club B in another tab, submit the form. If it creates under Club B, the state is leaking.

**Phase mapping:** Club management foundation phase. The URL-based routing pattern must be decided before building any organizer UI.

## Moderate Pitfalls

### Pitfall 5: Review System That Allows Pre-Event or Duplicate Reviews

**What goes wrong:** Students can submit reviews for events that haven't happened yet, or submit multiple reviews for the same event. The review system becomes unreliable, and organizers can't trust the feedback.

**Why it happens:** The review form is added without date validation or uniqueness constraints. The database allows inserts without checking `event_date < now()` or enforcing a unique constraint on `(user_id, event_id)`.

**Prevention:**
- Add a database CHECK constraint: reviews can only be inserted for events where `event_date < CURRENT_DATE` (or `start_date` in this schema)
- Add a UNIQUE constraint on `(user_id, event_id)` in the reviews table
- On the UI side, only show the "Review" button for past events the user RSVP'd to or saved
- Enforce a delay: don't allow reviews until 2+ hours after the event ends (prevents mid-event spite reviews)
- The existing `saved_events` table can serve as a proxy for "attended" until actual attendance tracking exists

**Detection:** If the reviews table has entries where `created_at < event.start_date`, the guard is broken.

**Phase mapping:** Reviews phase. These constraints must be in the migration that creates the reviews table.

---

### Pitfall 6: N+1 Query Problem in the My-Clubs Dashboard

**What goes wrong:** The existing `my-clubs/route.ts` already shows this pattern: it fetches memberships, then runs `Promise.all` with two queries per club (upcoming count + pending count). For an organizer with 5 clubs, that's 1 + 10 = 11 queries per page load. Adding analytics (follower count, recent views, latest review score) per club multiplies this further.

**Why it happens:** Supabase's query builder makes it easy to write simple per-record queries. The N+1 pattern feels natural because each query is simple and correct in isolation.

**Consequences:** Dashboard load time grows linearly with the number of clubs. At 10 clubs with 5 metrics each, that's 50+ queries per page load. Supabase connection pooling can handle it at small scale, but it's wasteful and slow.

**Prevention:**
- Use Supabase's relational queries (`select("*, events(*)")`) with filters to batch-fetch in fewer queries
- For aggregate stats, create a Postgres view or function that returns all club stats in a single query: `SELECT club_id, COUNT(*) FILTER (WHERE status = 'approved' AND start_date >= now()) as upcoming, ...`
- For analytics, pre-compute into a `club_stats` materialized view refreshed on a schedule (the existing cron infrastructure in `api/cron/send-reminders` shows the pattern)

**Detection:** Monitor query count per API call. If any endpoint fires more than 5 queries, refactor.

**Phase mapping:** Club management foundation phase. Fix the pattern in `my-clubs` before adding more per-club stats.

---

### Pitfall 7: Auto-Approval Logic That Doesn't Handle Edge Cases

**What goes wrong:** The existing `events/create/route.ts` auto-approves events when the creator is a `club_organizer` with membership in the specified club. But edge cases break this: What if the organizer is removed from the club between event creation and the event date? What if they create an event with `club_id: null` (no club association) -- it falls through to "pending" even for organizers posting personal events? What if an admin demotes them from organizer?

**Why it happens:** Auto-approval is checked only at creation time. The system doesn't re-validate when circumstances change.

**Consequences:** Events remain approved even after the organizer loses club access. Or organizers get frustrated when events they expected to be auto-approved end up pending.

**Prevention:**
- Auto-approval at creation is fine for the happy path, but add a periodic audit: if an organizer is removed from a club, flag their future (not-yet-occurred) events for review
- Document clearly: auto-approval requires both `club_organizer` role AND active membership in the specific club
- Consider an `approved_reason` field (`auto_approved_by_organizer`, `admin_approved`, etc.) for audit trail
- When an organizer is removed from a club, trigger a check on their pending/future events for that club

**Detection:** Query for approved events where `created_by` is no longer a member of `club_id`. If results exist for future events, the edge case is live.

**Phase mapping:** Club management phase, specifically when building the member removal flow.

---

### Pitfall 8: Follower Count as a Live Query Instead of a Counter

**What goes wrong:** Every club profile page runs `SELECT COUNT(*) FROM club_followers WHERE club_id = X` to display follower count (the current `clubs/[id]/route.ts` does exactly this). This is fine at 50 followers but degrades as the platform grows. Worse, if follower count appears in list views (club directory, organizer dashboard), the COUNT runs once per club per page load.

**Why it happens:** COUNT queries are the simplest correct approach. Denormalized counters feel premature.

**Prevention:**
- Add a `follower_count` column to the `clubs` table, updated via a Postgres trigger on INSERT/DELETE to `club_followers`
- The trigger approach is atomic and consistent, unlike application-level counter updates that can drift
- Use the live COUNT as a nightly reconciliation check against the denormalized counter

**Detection:** If the club profile endpoint takes >200ms at 1000+ followers, the live COUNT is the bottleneck.

**Phase mapping:** Follow/unfollow feature phase. Add the trigger when building the follow system.

## Minor Pitfalls

### Pitfall 9: Invitation Token Exposure in API Responses

**What goes wrong:** The existing `members/route.ts` returns `token` from `club_invitations` in the API response. If this token is used for invitation acceptance, exposing it in an API response that any club member can access means any member can share or steal invitation links.

**Prevention:**
- Only return tokens to the user who created the invitation, or to owners
- Better: don't return tokens in API responses at all; send them only via email
- The current code only returns invites to owners (good), but the token itself should still be treated as sensitive

**Phase mapping:** Club management foundation phase, when reworking the invitation flow.

---

### Pitfall 10: Review Rating Scale Without Clear Anchors

**What goes wrong:** A 1-5 star rating without descriptive anchors produces biased, unhelpful data. Students rate everything 4-5 stars unless they hated it (1 star), making the data useless for organizers trying to improve.

**Prevention:**
- Use specific attribute ratings instead of a single overall score: "How was the venue?", "How was the content?", "Would you attend again?"
- Or use a simple thumbs-up/thumbs-down with an optional comment -- campus events don't need granular ratings
- Since this is organizer-facing first (per PROJECT.md), optimize for actionable feedback over statistical precision

**Phase mapping:** Reviews phase. Design the rating schema before building the UI.

---

### Pitfall 11: Not Handling the "Orphaned Club" Scenario

**What goes wrong:** The sole owner of a club graduates or deletes their account. The club has followers, upcoming events, and no one who can manage it. There's no ownership transfer flow, no admin override for reassignment.

**Prevention:**
- Require clubs to have at least one owner at all times (prevent self-removal if sole owner -- the current code already prevents this)
- Build an admin tool to reassign club ownership
- Consider requiring a "successor" designation for club owners, especially relevant for campus orgs with annual exec turnover

**Phase mapping:** Club management phase. The admin reassignment tool is low effort but high impact.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Club management foundation | RLS policies too broad or too restrictive | Write and test RLS before building UI; test from client SDK |
| Club management foundation | Multi-club state bleeding across contexts | Use URL-based club scoping (`/dashboard/[clubId]/...`) |
| Club management foundation | N+1 queries in club listing | Batch queries or use Postgres views from day one |
| Event creation flow | Auto-approval edge cases with revoked membership | Add `approved_reason` audit field; handle member removal cascading |
| Analytics dashboard | Over-engineering metrics nobody uses | Start with 3 metrics max; pre-aggregate; add on demand |
| Analytics dashboard | Live aggregation queries too slow | Pre-compute into materialized views or summary tables |
| Review system | Reviews on future events or duplicates | Database constraints from the start (CHECK + UNIQUE) |
| Review system | Useless ratings from unanchored scales | Use attribute-based or binary ratings, not bare star ratings |
| Follow/unfollow | Follower count as live COUNT(*) | Denormalized counter column with Postgres trigger |
| Member management | Orphaned clubs after owner leaves | Admin reassignment tool; sole-owner removal guard |

## Sources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) -- HIGH confidence
- [Supabase RLS Best Practices](https://www.leanware.co/insights/supabase-best-practices) -- MEDIUM confidence
- [Multi-Tenant RLS Deep Dive](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2) -- MEDIUM confidence
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) -- HIGH confidence
- [Event Tracking Mistakes (Woopra)](https://www.woopra.com/blog/event-tracking-mistakes) -- MEDIUM confidence
- [Analytics Mistakes (Metabase)](https://www.metabase.com/learn/grow-your-data-skills/analytics/analytics-mistakes) -- MEDIUM confidence
- [Product Reviews UX (Smashing Magazine)](https://www.smashingmagazine.com/2023/01/product-reviews-ratings-ux/) -- MEDIUM confidence
- [Rating Systems UX](https://uxdesign.cc/the-ux-of-rating-systems-bc4f9d424b90) -- MEDIUM confidence
- Existing codebase analysis: `src/app/api/my-clubs/route.ts`, `src/app/api/clubs/[id]/route.ts`, `src/app/api/events/create/route.ts`, `src/app/api/clubs/[id]/members/route.ts` -- HIGH confidence (direct code inspection)
