# Mobile Optimization Design Spec

**Date:** 2026-03-16
**Goal:** Optimize the app for mobile users without changing the desktop UI. All changes gated behind responsive breakpoints (`sm`, `md`, `lg`).

---

## 1. Hero Buttons (HeroSlide.tsx)

**Problem:** Two side-by-side buttons overflow at 375px. Title too large, bottom padding wastes vertical space.

**Current state:** Title is `text-5xl sm:text-6xl lg:text-8xl`, padding is `pb-28 md:pb-36`, buttons are `flex` row with `gap-5`.

**Changes:**
- Stack buttons vertically below `sm` breakpoint: `flex-col sm:flex-row`
- Reduce button padding on mobile: `px-6 py-3.5` base, keep `md:px-10 md:py-5` for desktop
- Reduce gap: `gap-3 sm:gap-5`
- Title: `text-3xl sm:text-5xl md:text-6xl lg:text-8xl` (add smaller mobile base, add `md` step)
- Hero min-height: `min-h-[400px] sm:min-h-[500px]`
- Bottom padding: `pb-20 sm:pb-28 md:pb-36`
- Button text size: `text-base sm:text-lg md:text-xl`
- Ensure both buttons are full-width on mobile via `w-full sm:w-auto`

**Files:** `src/components/ui/HeroSlide.tsx`

---

## 2. Calendar Month View — Apple Native Style

**Problem:** 7-column grid with `min-h-[100px]` cells and `text-[10px]` event text is illegible on mobile (~53px per column at 375px).

**Mobile approach (below `lg`):** Render a compact Apple Calendar-style month grid:
- Day cells show only the date number (no event text inside cells)
- Colored dots below each number indicate events (category-colored, max 3 dots)
- Today highlighted with filled circle (primary color)
- Non-current-month dates dimmed
- Tapping a day sets `selectedDate` (already exists in state at line 349) and scrolls to the event list below
- Event list renders below the grid: card-style items with category color strip, title, time, location
- Navigation buttons enlarged to 36px (from 32px) for touch targets
- Day header shows single letter (S, M, T...) instead of full "SUN", "MON"
- Remove `min-h-[100px]` on mobile cells — let them be compact (~40px tall)
- Events for the selected day are already in memory (fetched for entire month range via `getMonthFetchRange`) — no additional API calls needed
- **Empty state:** When a selected day has no events, show a centered message: "No events on this day" with a calendar icon

**Accessibility:**
- Each day cell with events must have `aria-label` describing event count (e.g., "March 16, 2 events")
- Dot indicators are decorative — `aria-hidden="true"`

**Desktop (lg+):** Completely unchanged — keep current grid with event text in cells.

**Saved view:** Unchanged on mobile — it already uses a responsive card list layout.

**View toggle UI:** The existing Month/Week/Saved toggle bar is adequate on mobile — no changes needed.

**Files:** `src/app/calendar/page.tsx`

---

## 3. Calendar Week View — Apple Native Style

**Problem:** Same 7-column squeeze issue as month view.

**Mobile approach (below `lg`):** Render a week strip with pill-style day cells:
- 7-column grid with taller, rounded day cells showing weekday abbreviation + date number
- Selected/today day highlighted with primary color fill
- Colored dots for events below the number
- Tapping a day shows its events in a list below (same card style as month view)
- Cells have minimum 44px width for touch targets
- Navigation header shows date range (e.g., "Mar 15 – 21")
- **Empty state:** Same as month view — "No events on this day"

**Accessibility:**
- Same `aria-label` pattern as month view for day cells with events

**Desktop (lg+):** Unchanged.

**Files:** `src/app/calendar/page.tsx`

---

## 4. Clubs Dashboard — Bottom Tab Bar

**Problem:** Horizontal scroll tab bar on mobile is a poor navigation pattern. Buttons are small, no indication of off-screen items.

**Changes:**
- Replace `md:hidden` horizontal scroll nav with a fixed bottom tab bar
- Bottom tab bar: `fixed bottom-0 left-0 right-0` with icon + label for each tab
- Tabs: Events, Members, Analytics, and conditionally Settings (owner-only, matching existing `visibleNavItems` filter)
- Active tab highlighted with primary color
- Tab items: `min-w-[64px]`, icon 22px, label 10px — meets 44px touch target
- Add `pb-20 md:pb-0` to main content area to clear the bottom bar
- Include safe area padding: `pb-[env(safe-area-inset-bottom)]`
- Desktop sidebar: completely unchanged
- Header on mobile: simplified — club name + status badge + create button
- Stats grid: `grid-cols-2 md:grid-cols-3` (was always 3 in ClubOverviewTab)
- Note: The main app footer is hidden on club dashboard pages (handled by AppShell), so no overlap concern

**Accessibility:**
- Bottom tab bar uses `role="tablist"` with `role="tab"` on each item
- Active tab has `aria-selected="true"`

**Files:** `src/components/clubs/ClubDashboard.tsx`

---

## 5. Profile Settings — Mobile Optimization

**Problem:** Settings sidebar nav is a horizontal scroll bar with small buttons. Some form sections could benefit from mobile-specific spacing.

**Current state:** McGill Details already uses `grid-cols-1 sm:grid-cols-2` — no change needed there. Settings nav pills use `px-4 py-2.5` which is close to 44px but not guaranteed.

**Changes:**

### Settings Navigation
- Ensure each pill has `min-h-[44px]` for proper touch targets
- Active pill uses primary background (already implemented)

### Form Layout
- Profile Photo + Name section: keep horizontal layout on mobile with smaller avatar (64px vs 96px): `w-16 h-16 sm:w-24 sm:h-24`
- Banner upload area: reduce height on mobile `h-28 sm:h-36`

### Save Button
- Full-width on mobile: `w-full sm:w-auto`
- Add shadow to make it stand out: `shadow-lg shadow-primary/20`

### Profile View Tab
- Hero height: `h-[30vh] sm:h-[38vh]` (reduce on mobile)
- `min-h-[220px] sm:min-h-[300px]`
- Avatar: keep `w-28 h-28` on mobile (already good)
- Stats grid cells: ensure `min-h-[44px]` touch targets

**Files:** `src/app/profile/ProfileClient.tsx`

---

## Scope Boundaries

**In scope:**
- All 5 areas listed above
- Only mobile-specific responsive changes
- Dark mode support for all changes (use existing theme tokens)

**Out of scope:**
- Bottom navigation bar for the main app (only for clubs dashboard)
- New components or pages
- Desktop UI changes
- New features or functionality
- Performance optimizations

## Testing

- Visual testing at 375px (iPhone SE), 390px (iPhone 14), 428px (iPhone 14 Plus)
- Verify desktop is unchanged at 1024px+
- Check dark mode for all changes
- Verify touch targets are minimum 44x44px
- Test calendar day selection and event list rendering
- Test empty state when selecting a day with no events
- Verify clubs dashboard bottom tab bar hides Settings for non-owners
- Test `prefers-reduced-motion` — no new animations added, existing transitions respected
