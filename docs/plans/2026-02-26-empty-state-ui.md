# Empty State UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace minimal/missing empty states in EventGrid, Calendar, and My Events with a shared `EmptyState` component that uses a Lucide icon, clear copy, and an optional CTA button.

**Architecture:** Create one reusable `EmptyState` component in `src/components/ui/`. Update EventGrid to be context-aware (different state when filters are active vs. no events). Drop the component into Calendar and My Events pages.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Tailwind CSS, shadcn/ui, Lucide React

---

### Task 1: Create the shared EmptyState component

**Files:**
- Create: `src/components/ui/EmptyState.tsx`

**Step 1: Create the file with this exact content**

```tsx
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
      <Icon className="h-16 w-16 text-muted-foreground/30 mb-6" aria-hidden="true" />
      <p className="text-xl font-semibold mb-2 text-foreground">{title}</p>
      <p className="text-base text-muted-foreground max-w-md mb-6">{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button>{action.label}</Button>
          </Link>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/components/ui/EmptyState.tsx
git commit -m "feat: add shared EmptyState UI component"
```

---

### Task 2: Update EventGrid to use EmptyState (context-aware)

**Files:**
- Modify: `src/components/events/EventGrid.tsx`

**Step 1: Add two new optional props to the interface**

Add `hasFilters` and `onClearFilters` to `EventGridProps` (after the existing `trackingSource` prop):

```ts
/** True when any search/filter is active — shows filter-specific empty state */
hasFilters?: boolean;
/** Called when user clicks "Clear Filters" in the empty state */
onClearFilters?: () => void;
```

**Step 2: Add them to the destructured function parameters**

```ts
export function EventGrid({
  events,
  loading = false,
  showSaveButton = false,
  savedEventIds = new Set(),
  onEventClick,
  onUnsave,
  trackingSource,
  hasFilters = false,
  onClearFilters,
}: EventGridProps) {
```

**Step 3: Replace the existing empty state block**

Remove this block (lines 38–47 in the current file):
```tsx
if (events.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
      <p className="text-xl font-semibold mb-2 text-foreground">No events found</p>
      <p className="text-base text-muted-foreground max-w-md">
        Try adjusting your filters or check back later for more upcoming experiences.
      </p>
    </div>
  );
}
```

Replace with:
```tsx
if (events.length === 0) {
  return hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No results for these filters"
      description="Try clearing your filters or adjusting your search."
      action={onClearFilters ? { label: "Clear Filters", onClick: onClearFilters } : undefined}
    />
  ) : (
    <EmptyState
      icon={CalendarOff}
      title="No upcoming events"
      description="Check back soon for new events from McGill clubs."
    />
  );
}
```

**Step 4: Add the required imports at the top of the file**

Add after the existing imports:
```tsx
import { CalendarOff, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 6: Commit**

```bash
git add src/components/events/EventGrid.tsx
git commit -m "feat: update EventGrid with context-aware EmptyState"
```

---

### Task 3: Pass filter state to EventGrid from the home page

**Files:**
- Modify: `src/app/page.tsx`

**Context:** `page.tsx` already has `isFiltering` (line 195) — `true` when search or tags are active. `EventSearch` manages its own internal state, so to visually clear its input when filters are cleared, we remount it using a `key` prop.

**Step 1: Add `searchKey` state** (after the existing `useState` declarations, around line 57)

```tsx
const [searchKey, setSearchKey] = useState(0);
```

**Step 2: Add `handleClearFilters` callback** (after `handleFilterChange`, around line 193)

```tsx
const handleClearFilters = useCallback(() => {
  setSearchQuery("");
  setSelectedTags([]);
  setSearchKey((k) => k + 1);
}, []);
```

**Step 3: Add `key={searchKey}` to the EventSearch component** (around line 243)

Find:
```tsx
<EventSearch
  ref={searchInputRef}
  onSearchChange={handleSearchChange}
```
Change to:
```tsx
<EventSearch
  key={searchKey}
  ref={searchInputRef}
  onSearchChange={handleSearchChange}
```

**Step 4: Pass `hasFilters` and `onClearFilters` to EventGrid** (around line 384)

Find:
```tsx
<EventGrid
  events={filteredEvents.filter((e) => !popularEventIds.has(e.id))}
  loading={loading}
  showSaveButton={!!user}
  savedEventIds={savedEventIds}
  trackingSource="home"
/>
```
Change to:
```tsx
<EventGrid
  events={filteredEvents.filter((e) => !popularEventIds.has(e.id))}
  loading={loading}
  showSaveButton={!!user}
  savedEventIds={savedEventIds}
  trackingSource="home"
  hasFilters={isFiltering}
  onClearFilters={handleClearFilters}
/>
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 6: Verify visually in browser**

Run: `npm run dev`
- Navigate to `/`
- Apply a tag filter → see events grid empty → confirm "No results for these filters" with SearchX icon and "Clear Filters" button appears
- Click "Clear Filters" → grid resets, search input clears, tags deselect
- Remove all filters with no events in DB → confirm "No upcoming events" with CalendarOff icon (no CTA)

**Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire hasFilters and onClearFilters from home page to EventGrid"
```

---

### Task 4: Update the Calendar page empty state

**Files:**
- Modify: `src/app/calendar/page.tsx`

**Step 1: Add imports**

At the top of the file, add to the existing lucide-react import line:
```tsx
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarOff } from "lucide-react";
```

And add after the other component imports:
```tsx
import { EmptyState } from "@/components/ui/EmptyState";
```

**Step 2: Replace the existing empty state** (lines 297–301 in the current file)

Remove:
```tsx
{!loading && events.length === 0 && (
  <div className="mt-6 text-sm text-muted-foreground text-center">
    No events found for this month.
  </div>
)}
```

Replace with:
```tsx
{!loading && events.length === 0 && (
  <div className="mt-6">
    <EmptyState
      icon={CalendarOff}
      title="No events this month"
      description="Check back soon or browse all upcoming events."
      action={{ label: "Browse Events", href: "/" }}
    />
  </div>
)}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 4: Verify visually in browser**

- Navigate to `/calendar`
- Navigate to a future month with no events (or while DB is empty)
- Confirm CalendarOff icon + title + description + "Browse Events" button appear

**Step 5: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat: replace calendar empty state text with EmptyState component"
```

---

### Task 5: Update My Events page empty state

**Files:**
- Modify: `src/app/my-events/page.tsx`

**Step 1: Add EmptyState import**

Add to the existing import block:
```tsx
import { EmptyState } from "@/components/ui/EmptyState";
```

**Step 2: Replace the inline empty state block** (lines 198–212)

Remove:
```tsx
{/* Empty state */}
{!loading && !error && events.length === 0 && (
  <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
    <Heart className="h-16 w-16 text-muted-foreground/30 mb-6" />
    <p className="text-xl font-semibold mb-2 text-foreground">
      No saved events yet
    </p>
    <p className="text-base text-muted-foreground max-w-md mb-6">
      Start exploring events and tap the heart icon to save them here for
      later.
    </p>
    <Link href="/">
      <Button>Discover Events</Button>
    </Link>
  </div>
)}
```

Replace with:
```tsx
{/* Empty state */}
{!loading && !error && events.length === 0 && (
  <EmptyState
    icon={Heart}
    title="No saved events yet"
    description="Start exploring events and tap the heart icon to save them here for later."
    action={{ label: "Discover Events", href: "/" }}
  />
)}
```

**Step 3: Clean up now-unused imports**

`Link` and `Button` are no longer used in this file (they're now inside EmptyState). Remove them from the import block:

Remove from the import block:
```tsx
import Link from "next/link";
```

And remove `Button` from the shadcn import:
```tsx
import { Button } from "@/components/ui/button";
```

> Note: Before removing, confirm `Button` is not used anywhere else in the file (check the error state on line 188 — it uses `<Button onClick={fetchSavedEvents} variant="outline">Try Again</Button>`). So keep the Button import. Only remove `Link`.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Verify visually in browser**

- Sign in and navigate to `/my-events` with no saved events
- Confirm Heart icon + "No saved events yet" + "Discover Events" button appear
- Visual output should be identical to before (same icon, same copy)

**Step 6: Commit**

```bash
git add src/app/my-events/page.tsx
git commit -m "feat: replace my-events inline empty state with shared EmptyState component"
```

---

### Task 6: Final verification

**Step 1: Run production build**

```bash
npm run build
```
Expected: Compiled successfully, no TypeScript or lint errors

**Step 2: Responsive check**

In browser dev tools, test each empty state at:
- Mobile (375px): icon + text stacks vertically, text wraps within max-w-md ✓
- Tablet (768px): same, more breathing room ✓
- Desktop (1280px): same ✓

**Step 3: Accessibility check**

- Tab through each empty state — CTA button is reachable by keyboard
- Icon has `aria-hidden="true"` (decorative, no redundant label needed)
- Text has sufficient contrast (muted-foreground on background)
