# Codebase Cleanup & Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crawl every file in the Uni-Verse codebase, eliminate dead code, fix bugs, remove redundancies, tighten types, and produce a sub-100-word summary `.md` for each logical group.

**Architecture:** Files are grouped into 10 logical clusters. Each task reads the files in a group, applies cleanup rules, commits, then writes a summary. No new features — only subtraction and tightening.

**Tech Stack:** Next.js 16, TypeScript 5 (strict), Tailwind, Supabase, Vitest

**Cleanup Rules (apply to every file):**
- Remove unused imports
- Remove `console.log` / `console.error` left from debugging (keep intentional server-side error logs in API routes)
- Remove dead/unreachable code paths
- Tighten `any` types to real types where obvious
- Remove commented-out code blocks
- Collapse duplicate logic into shared helpers
- Fix missing `await` / unhandled promise rejections
- Remove redundant `useEffect` deps or stale state
- Ensure every API route returns a typed `NextResponse`
- Delete files that are purely duplicates or stubs with no usage

---

## Task 1: Config & Root Files

**Files:**
- Review: `next.config.js`
- Review: `tailwind.config.ts`
- Review: `tsconfig.json`
- Review: `vercel.json`
- Review: `vitest.config.ts`
- Review: `vitest.setup.ts`
- Review: `postcss.config.js`
- Review: `package.json`

**Step 1: Read and audit each file**

Open each file and check for:
- Unused plugins / overrides in `next.config.js`
- Dead Tailwind `safelist` entries or redundant `extend` keys
- Overly permissive `tsconfig` compiler options (`skipLibCheck` is fine, but catch loose `noUncheckedIndexedAccess` gaps)
- `vercel.json` routes that no longer exist
- Vitest setup importing mocks that are never used
- Unused `package.json` scripts or mismatched `engines` field

**Step 2: Apply fixes**

Remove/fix anything found. Do NOT add new config — only tighten existing.

**Step 3: Commit**

```bash
git add next.config.js tailwind.config.ts tsconfig.json vercel.json vitest.config.ts vitest.setup.ts postcss.config.js package.json
git commit -m "chore: clean root config files"
```

**Step 4: Write summary**

Create `docs/summaries/config.md` — sub-100-word description of what each config file does and any changes made.

---

## Task 2: Types & Constants

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/constants.ts`

**Step 1: Read both files**

In `src/types/index.ts` look for:
- Types defined but never imported anywhere (use `grep -r "TypeName" src/` to verify)
- Fields typed as `any` that can be tightened
- Duplicate interface definitions (e.g. `Event` fields repeated in `SavedEvent`)
- Optional fields (`?`) that should be required or vice versa

In `src/lib/constants.ts` look for:
- Constants that are no longer referenced in any file
- Tag arrays with duplicates or inconsistent casing
- McGill color values that don't match the values used in Tailwind config

**Step 2: Apply fixes**

Delete unused types. Tighten `any`. Fix duplicate constants.

**Step 3: Commit**

```bash
git add src/types/index.ts src/lib/constants.ts
git commit -m "chore: remove unused types and dead constants"
```

**Step 4: Write summary**

Create `docs/summaries/types-constants.md`.

---

## Task 3: Supabase Clients & Lib Utilities

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/lib/supabase/service.ts`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/admin.ts`
- Modify: `src/lib/roles.ts`
- Modify: `src/lib/swagger.ts`
- Modify: `src/lib/tagMapping.ts`
- Modify: `src/lib/upload-utils.ts`

**Step 1: Read all files**

Supabase clients — check for:
- Multiple `createClient` calls being constructed instead of using a singleton
- `service.ts` exposing the service role key client where it should be restricted to API routes only
- `types.ts` — generated types vs manually written, ensure no drift or duplication with `src/types/index.ts`

Utilities — check for:
- `utils.ts`: functions defined but unused (verify with grep)
- `admin.ts` / `roles.ts`: overlapping role-check logic — consolidate if duplicated
- `swagger.ts`: confirm it's actually consumed by the docs route; if not, delete
- `tagMapping.ts`: unused tag mappings, duplicates vs `constants.ts`
- `upload-utils.ts` vs `image-upload.ts` (in lib) — these may overlap; identify and merge

**Step 2: Apply fixes**

Merge `upload-utils.ts` and `image-upload.ts` if they overlap. Remove dead exports. Fix singleton pattern if broken.

**Step 3: Commit**

```bash
git add src/lib/
git commit -m "chore: consolidate supabase clients and lib utilities"
```

**Step 4: Write summary**

Create `docs/summaries/lib-supabase.md`.

---

## Task 4: Middleware, Hooks & Store

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/middlewareRateLimit.ts`
- Modify: `src/hooks/useEvents.ts`
- Modify: `src/hooks/useUser.ts`
- Modify: `src/hooks/useSavedEvents.ts`
- Modify: `src/hooks/useTracking.ts`
- Modify: `src/store/useAuthStore.ts`

**Step 1: Read all files**

Middleware — check for:
- `middleware.ts` vs `middlewareRateLimit.ts`: are both actually wired into the Next.js middleware chain? Only one `middleware.ts` is loaded by Next.js at the root. If `middlewareRateLimit.ts` is a separate module imported by `middleware.ts`, verify the import exists.
- Dead matcher patterns for routes that no longer exist

Hooks — check for:
- `useEvents.ts`: stale `useEffect` dependency arrays, redundant state (e.g. loading flag + data in separate states when a `status` union is cleaner)
- `useUser.ts`: redundant fetches if `useAuthStore` already caches user
- `useSavedEvents.ts`: overlapping logic with `useEvents.ts` saved-event filtering
- `useTracking.ts`: any `console.log` calls left in, verify it's actually called somewhere

Store — check for:
- `useAuthStore.ts`: actions that are defined but never dispatched

**Step 2: Apply fixes**

Reconcile middleware files. Remove stale deps. Delete dead store actions.

**Step 3: Commit**

```bash
git add src/middleware.ts src/middlewareRateLimit.ts src/hooks/ src/store/
git commit -m "chore: clean middleware, hooks, and auth store"
```

**Step 4: Write summary**

Create `docs/summaries/middleware-hooks-store.md`.

---

## Task 5: ML / Classifier Lib

**Files:**
- Modify: `src/lib/classifier.ts`
- Modify: `src/lib/classifier-pipeline.ts`
- Modify: `src/lib/kmeans.ts`
- Modify: `src/lib/dateValidation.ts`
- Modify: `src/lib/exportUtils.ts`
- Modify: `src/lib/image-upload.ts`

**Step 1: Read all files**

Classifier — check for:
- Dead classification paths (categories that exist in the classifier but not in `constants.ts`)
- Redundant loops or O(n²) operations that can be simplified
- `any` types in return shapes

K-means — check for:
- Hardcoded magic numbers (cluster count, max iterations) — move to named constants
- Missing edge case handling (empty input array)

Date validation — check for:
- Functions duplicated in `utils.ts`

Export utils — check for:
- Unused export formats (CSV, ICS — verify both are consumed by the export API route)

Image upload — check for:
- Overlap with `upload-utils.ts` (see Task 3)

**Step 2: Apply fixes**

**Step 3: Commit**

```bash
git add src/lib/classifier.ts src/lib/classifier-pipeline.ts src/lib/kmeans.ts src/lib/dateValidation.ts src/lib/exportUtils.ts src/lib/image-upload.ts
git commit -m "chore: clean ML lib and utility modules"
```

**Step 4: Write summary**

Create `docs/summaries/lib-ml.md`.

---

## Task 6: Layout & UI Components

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/SideNavBar.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/components/layout/AppBreadcrumb.tsx`
- Modify: `src/components/layout/ThemeToggle.tsx`
- Modify: `src/components/layout/navItems.ts`
- Modify: `src/components/ui/` (all shadcn primitives)
- Modify: `src/components/ErrorBoundary.tsx`

**Step 1: Read layout files**

Header — check for:
- Redundant state (e.g. menu open + mobile open as separate booleans when one would do)
- Missing `aria-label` on icon-only buttons
- Hardcoded strings that should come from `navItems.ts`

SideNavBar — check for:
- Nav items duplicated in both `Header.tsx` and `SideNavBar.tsx` instead of sourced from `navItems.ts`
- Dead links pointing to routes that don't exist in the app router

Footer — check for:
- Dead links, placeholder text, hardcoded year (should be `new Date().getFullYear()`)

AppBreadcrumb — check for:
- Segments that are hardcoded instead of derived from the path

ThemeToggle — check for:
- Importing unused icons

UI primitives (`src/components/ui/`) — these are shadcn-generated; check for:
- Local modifications that deviate from shadcn defaults without comments explaining why
- Unused component files (e.g. `carousel.tsx` — verify it's actually used)

ErrorBoundary — check for:
- Missing `componentDidCatch` logging strategy

**Step 2: Apply fixes**

**Step 3: Commit**

```bash
git add src/components/layout/ src/components/ui/ src/components/ErrorBoundary.tsx
git commit -m "chore: clean layout and UI primitive components"
```

**Step 4: Write summary**

Create `docs/summaries/layout-ui.md`.

---

## Task 7: Event Components

**Files:**
- Modify: `src/components/events/EventCard.tsx`
- Modify: `src/components/events/EventGrid.tsx`
- Modify: `src/components/events/EventFilters.tsx`
- Modify: `src/components/events/FilterSidebar.tsx`
- Modify: `src/components/events/EventDetailsModal.tsx`
- Modify: `src/components/events/CreateEventForm.tsx`
- Modify: `src/components/events/CreateEventModal.tsx`
- Modify: `src/components/events/EventBadge.tsx`
- Modify: `src/components/events/EventCardSkeleton.tsx`
- Modify: `src/components/events/EventGridSkeleton.tsx`
- Modify: `src/components/events/EventImageUpload.tsx`
- Modify: `src/components/events/EventSearch.tsx`
- Modify: `src/components/events/HappeningNowSection.tsx`
- Modify: `src/components/events/HorizontalEventScroll.tsx`
- Modify: `src/components/events/PopularEventsSection.tsx`
- Modify: `src/components/events/RecommendedEventsSection.tsx`
- Modify: `src/components/events/RelatedEventCard.tsx`
- Modify: `src/components/events/RsvpButton.tsx`
- Modify: `src/components/events/CategorySection.tsx`

**Step 1: Read all event components**

Key checks:
- `EventCard` vs `RelatedEventCard`: are these genuinely different or is one a subset of the other? Merge if >70% identical.
- `EventFilters` vs `FilterSidebar`: same question — check for duplicate filter state logic
- `CreateEventForm` vs `CreateEventModal`: modal should be a thin wrapper, form should own all logic. Ensure no state is split awkwardly between them.
- `EventDetailsModal`: check for `any` props, missing loading states, unclosed subscriptions
- `HappeningNowSection`, `PopularEventsSection`, `RecommendedEventsSection`: each fetches independently — check if they trigger redundant API calls that `useEvents` already covers
- `RsvpButton`: ensure optimistic update is rolled back on error
- Remove any `console.log` calls

**Step 2: Apply fixes**

If `EventCard` and `RelatedEventCard` are near-identical, consolidate to one component with a `variant` prop.

**Step 3: Commit**

```bash
git add src/components/events/
git commit -m "chore: clean and consolidate event components"
```

**Step 4: Write summary**

Create `docs/summaries/event-components.md`.

---

## Task 8: Club, Profile, Auth & Notification Components

**Files:**
- Modify: `src/components/clubs/ClubDashboard.tsx`
- Modify: `src/components/clubs/ClubEventsTab.tsx`
- Modify: `src/components/clubs/ClubMembersTab.tsx`
- Modify: `src/components/clubs/ClubOverviewTab.tsx`
- Modify: `src/components/clubs/FollowButton.tsx`
- Modify: `src/components/clubs/OrganizerRequestDialog.tsx`
- Modify: `src/components/profile/AvatarCropModal.tsx`
- Modify: `src/components/profile/EditProfileButton.tsx`
- Modify: `src/components/profile/EditProfileModal.tsx`
- Modify: `src/components/profile/InterestTagSelector.tsx`
- Modify: `src/components/profile/InterestsCard.tsx`
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/auth/SignInButton.tsx`
- Modify: `src/components/auth/SignOutButton.tsx`
- Modify: `src/components/notifications/NotificationBell.tsx`
- Modify: `src/components/notifications/NotificationItem.tsx`
- Modify: `src/components/notifications/NotificationList.tsx`
- Modify: `src/components/providers/AuthProvider.tsx`
- Modify: `src/components/shared/EditEventModal.tsx`
- Modify: `src/components/ui/EmptyState.tsx`
- Modify: `src/components/redoc/RedocUI.tsx`

**Step 1: Read all files**

Clubs — check for:
- `ClubDashboard` managing state that should live in the tab components
- `FollowButton` vs `RsvpButton` (in events) — shared optimistic-update pattern? Abstract if so.
- `OrganizerRequestDialog`: confirm it's actually reachable in the UI flow

Profile — check for:
- `EditProfileButton` that just opens `EditProfileModal` — verify it's not an unnecessary wrapper
- `InterestTagSelector` vs `InterestsCard`: one edits, one displays — ensure no logic bleed
- `AvatarCropModal`: check for third-party crop library that may be unused or outdated

Auth — check for:
- `SignInButton` / `SignOutButton`: tiny components, verify they don't duplicate Supabase auth calls already in `AuthProvider`

Notifications — check for:
- Polling interval in `NotificationBell` that may not be cleared on unmount (memory leak)

AuthProvider — check for:
- Double-subscription to Supabase `onAuthStateChange`

**Step 2: Apply fixes**

**Step 3: Commit**

```bash
git add src/components/clubs/ src/components/profile/ src/components/auth/ src/components/notifications/ src/components/providers/ src/components/shared/ src/components/ui/EmptyState.tsx src/components/redoc/
git commit -m "chore: clean club, profile, auth, and notification components"
```

**Step 4: Write summary**

Create `docs/summaries/domain-components.md`.

---

## Task 9: API Routes

**Files — Events API:**
- `src/app/api/events/route.ts`
- `src/app/api/events/[id]/route.ts`
- `src/app/api/events/[id]/rsvp/route.ts`
- `src/app/api/events/[id]/save/route.ts`
- `src/app/api/events/create/route.ts`
- `src/app/api/events/export/route.ts`
- `src/app/api/events/happening-now/route.ts`
- `src/app/api/events/popular/route.ts`
- `src/app/api/events/upload-image/route.ts`

**Files — Clubs API:**
- `src/app/api/clubs/route.ts`
- `src/app/api/clubs/[id]/route.ts`
- `src/app/api/clubs/[id]/events/route.ts`
- `src/app/api/clubs/[id]/follow/route.ts`
- `src/app/api/clubs/[id]/invites/route.ts`
- `src/app/api/clubs/[id]/members/route.ts`
- `src/app/api/clubs/logo/route.ts`

**Files — Admin/Moderation API:**
- `src/app/api/admin/calculate-popularity/route.ts`
- `src/app/api/admin/clubs/route.ts`
- `src/app/api/admin/clubs/[id]/route.ts`
- `src/app/api/admin/events/route.ts`
- `src/app/api/admin/events/[id]/route.ts`
- `src/app/api/admin/events/[id]/status/route.ts`
- `src/app/api/admin/organizer-requests/route.ts`
- `src/app/api/admin/organizer-requests/[id]/route.ts`
- `src/app/api/admin/stats/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`

**Files — Other API:**
- `src/app/api/cron/send-reminders/route.ts`
- `src/app/api/feedback/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/interactions/route.ts`
- `src/app/api/my-clubs/route.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/app/api/onboarding/complete/route.ts`
- `src/app/api/organizer-requests/route.ts`
- `src/app/api/profile/avatar/route.ts`
- `src/app/api/profile/interests/route.ts`
- `src/app/api/recommendations/route.ts`
- `src/app/api/recommendations/analytics/route.ts`
- `src/app/api/recommendations/feedback/route.ts`
- `src/app/api/recommendations/sync/route.ts`
- `src/app/api/user/engagement/route.ts`
- `src/app/api/user/following/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/users/saved-events/route.ts`
- `src/app/auth/callback/route.ts`
- `src/app/auth/signout/route.ts`

**Step 1: Read all API routes**

Apply to every route:
- Consistent error response shape: `{ error: string }` — no ad-hoc shapes
- Auth guard present where needed (check `createClient` from server, verify session before mutating)
- Remove `console.log` debug lines; keep `console.error` for genuine server errors
- `try/catch` around every Supabase call that can throw
- Input validation: ensure body parsing doesn't silently accept `undefined` fields
- Check for duplicate routes (e.g. `src/app/api/organizer-requests/` vs `src/app/api/admin/organizer-requests/`) — are both needed?
- Rate limiting: verify `middlewareRateLimit` covers sensitive mutation routes

**Step 2: Apply fixes**

Standardize error shapes. Add missing auth guards. Remove debug logs.

**Step 3: Commit**

```bash
git add src/app/api/ src/app/auth/
git commit -m "chore: clean and harden all API routes"
```

**Step 4: Write summary**

Create `docs/summaries/api-routes.md`.

---

## Task 10: App Pages & Tests

**Files — Pages:**
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/loading.tsx`
- `src/app/not-found.tsx`
- `src/app/about/page.tsx`
- `src/app/admin-login/page.tsx`
- `src/app/calendar/page.tsx`
- `src/app/categories/page.tsx`
- `src/app/clubs/page.tsx`
- `src/app/clubs/[id]/page.tsx`
- `src/app/clubs/create/page.tsx`
- `src/app/create-event/page.tsx`
- `src/app/docs/page.tsx`
- `src/app/events/[id]/page.tsx`
- `src/app/events/[id]/EventDetailClient.tsx`
- `src/app/feedback/page.tsx`
- `src/app/health/page.tsx`
- `src/app/help/page.tsx`
- `src/app/invites/[token]/page.tsx`
- `src/app/moderation/page.tsx`
- `src/app/moderation/layout.tsx`
- `src/app/moderation/ModerationNav.tsx`
- `src/app/moderation/clubs/page.tsx`
- `src/app/moderation/events/page.tsx`
- `src/app/moderation/organizer-requests/page.tsx`
- `src/app/moderation/pending/page.tsx`
- `src/app/moderation/stats/page.tsx`
- `src/app/moderation/users/page.tsx`
- `src/app/my-clubs/page.tsx`
- `src/app/my-clubs/layout.tsx`
- `src/app/my-clubs/[id]/page.tsx`
- `src/app/my-events/page.tsx`
- `src/app/notifications/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/terms/page.tsx`
- `src/app/user-profile/page.tsx`
- `src/app/globals.css`

**Files — Tests:**
- `src/__tests__/api/events/date-validation.test.ts`
- `src/__tests__/api/events/get-events.test.ts`
- `src/__tests__/api/events/rsvp.test.ts`
- `src/app/api/events/export/route.test.ts`
- `src/app/api/events/route.test.ts`
- `src/components/ErrorBoundary.test.tsx`
- `src/components/events/EventFilters.test.tsx`
- `src/components/events/FilterSidebar.test.tsx`
- `src/hooks/useEvents.test.ts`
- `src/lib/classifier-pipeline.test.ts`
- `src/lib/classifier.test.ts`
- `src/lib/dateValidation.test.ts`
- `src/lib/exportUtils.test.ts`
- `src/lib/image-upload.test.ts`
- `src/lib/kmeans.test.ts`

**Step 1: Read all pages**

Pages — check for:
- `layout.tsx`: metadata, viewport config, font loading — ensure no duplicate Google Font requests
- `page.tsx` (home): client component with heavy state — identify what can be lifted to server components or RSC
- `health/page.tsx` and `docs/page.tsx`: are these public? Should they be behind auth?
- `moderation/` pages: confirm all are protected by admin role check (middleware or page-level)
- `robots.ts` / `sitemap.ts`: ensure correct domain and no sensitive routes listed in sitemap
- `globals.css`: dead CSS classes, conflicting custom properties vs Tailwind tokens
- `user-profile/page.tsx` vs `profile/page.tsx`: confirm both are needed and not duplicates

**Step 2: Read all tests**

Tests — check for:
- Tests that import functions since removed — will fail silently if not caught
- Tests with no assertions (`expect` calls)
- Hardcoded UUIDs or tokens that should be `vi.fn()` mocks
- Run `npm run lint` and `npx vitest run` to surface failures before committing

**Step 3: Fix pages, then tests**

```bash
npx vitest run 2>&1 | tail -30
```

Fix any failing tests. Do NOT delete tests — fix them or skip with `it.skip` + a TODO comment explaining why.

**Step 4: Commit**

```bash
git add src/app/ src/__tests__/ src/components/ErrorBoundary.test.tsx src/components/events/EventFilters.test.tsx src/components/events/FilterSidebar.test.tsx src/hooks/useEvents.test.ts src/lib/
git commit -m "chore: clean app pages and fix test suite"
```

**Step 5: Write summary**

Create `docs/summaries/pages-tests.md`.

---

## Task 11: Final Verification

**Step 1: Run lint**

```bash
npm run lint 2>&1
```

Expected: 0 errors. Fix any that appear.

**Step 2: Run tests**

```bash
npx vitest run 2>&1
```

Expected: all tests pass (or are explicitly skipped with reason).

**Step 3: Build check**

```bash
npm run build 2>&1 | tail -40
```

Expected: successful build with no type errors.

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore: final cleanup pass — lint and build clean"
```

**Step 5: Write master index**

Create `docs/summaries/INDEX.md` — a single file listing each summary doc and one sentence on what changed in that group.

---

## Summary Docs to Create

| File | Contents |
|------|----------|
| `docs/summaries/config.md` | Root config files |
| `docs/summaries/types-constants.md` | Types and constants |
| `docs/summaries/lib-supabase.md` | Supabase clients and lib utilities |
| `docs/summaries/middleware-hooks-store.md` | Middleware, hooks, and Zustand store |
| `docs/summaries/lib-ml.md` | Classifier, k-means, and export utilities |
| `docs/summaries/layout-ui.md` | Layout and shadcn UI primitives |
| `docs/summaries/event-components.md` | All event-related components |
| `docs/summaries/domain-components.md` | Club, profile, auth, and notification components |
| `docs/summaries/api-routes.md` | All API routes |
| `docs/summaries/pages-tests.md` | App pages and test suite |
| `docs/summaries/INDEX.md` | Master index |

Each summary must be **under 100 words**.
