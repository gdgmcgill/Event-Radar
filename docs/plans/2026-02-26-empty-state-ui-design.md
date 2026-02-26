# Design: Empty State UI for Event Discovery & Calendar

**Date:** 2026-02-26
**Status:** Approved

## Problem

The Event Discovery (EventGrid) and Calendar pages have minimal or missing empty state UI:
- **EventGrid**: plain text only — no icon, no CTA
- **Calendar**: single line of text — no icon, no CTA
- **My Events**: decent (icon + text + CTA) but uses one-off inline code

This creates a poor UX when no events are available and wastes an opportunity to guide users toward action.

## Goals

- Visually communicate "nothing here" clearly and warmly
- Guide users toward resolution (clear filters, browse events)
- Keep the design consistent across all three surfaces
- Stay minimal — polish existing patterns, not a redesign

## Approach: Shared `EmptyState` Component

Create one reusable `EmptyState` component and drop it into EventGrid, Calendar, and My Events. Keeps styling consistent and easy to maintain.

**Rejected alternatives:**
- Inline per-component (duplicates code, risks visual drift)
- Custom SVG illustrations (overkill for this ticket)

## Component API

```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;          // renders as <Link> button
    onClick?: () => void;   // renders as <Button>
  };
}
```

## Visual Design

```
[Icon — h-16 w-16 text-muted-foreground/30]

  Title                    ← text-xl font-semibold text-foreground
  Description text here    ← text-base text-muted-foreground max-w-md

  [ Action Button ]        ← optional
```

Container: `py-20 text-center animate-in fade-in duration-500`
Matches the existing My Events empty state pattern exactly.

## Context-Aware Behavior per Surface

### EventGrid (`src/components/events/EventGrid.tsx`)

New props: `hasFilters?: boolean`, `onClearFilters?: () => void`

| State | Icon | Title | Description | Action |
|---|---|---|---|---|
| Filters active | `SearchX` | "No results for these filters" | "Try clearing your filters or adjusting your search." | "Clear Filters" (calls `onClearFilters`) |
| No filters | `CalendarOff` | "No upcoming events" | "Check back soon for new events from McGill clubs." | — |

### Calendar Page (`src/app/calendar/page.tsx`)

| State | Icon | Title | Description | Action |
|---|---|---|---|---|
| Empty month | `CalendarOff` | "No events this month" | "Check back soon or browse all upcoming events." | "Browse Events" → `/` |

### My Events (`src/app/my-events/page.tsx`)

Replace the existing inline empty state block with the shared `EmptyState` component. Visual output is identical; this just removes duplication.

| State | Icon | Title | Description | Action |
|---|---|---|---|---|
| No saved events | `Heart` | "No saved events yet" | "Start exploring events and tap the heart icon to save them here for later." | "Discover Events" → `/` |

## Files to Create / Modify

| File | Change |
|---|---|
| `src/components/ui/EmptyState.tsx` | **Create** — shared component |
| `src/components/events/EventGrid.tsx` | **Modify** — use EmptyState, add `hasFilters` + `onClearFilters` props |
| `src/app/calendar/page.tsx` | **Modify** — replace inline text with EmptyState |
| `src/app/my-events/page.tsx` | **Modify** — replace inline block with EmptyState |
| `src/app/page.tsx` | **Modify** — pass `hasFilters` + `onClearFilters` to EventGrid |

## Accessibility

- Icon is `aria-hidden` (decorative)
- Title is an `<p>` (not a heading, stays visually consistent)
- CTA button/link is keyboard-navigable
- Sufficient color contrast: muted-foreground text on card/background

## Out of Scope

- Custom SVG artwork
- Animated illustrations
- Different empty states per event category
