# Plan: Categories Page (`/categories`)

## Overview
Netflix-style browse page where each of the 6 categories (academic, social, sports, career, cultural, wellness) gets its own section with a horizontal scroll of EventCards.

## DB Changes
None. Reuses existing `events` table and tags.

## Files to Create
| File | Purpose |
|------|---------|
| `src/app/categories/page.tsx` | Main categories browse page |
| `src/components/events/CategorySection.tsx` | Single category row: header + horizontal scroll of events |
| `src/components/events/HorizontalEventScroll.tsx` | Horizontal scrollable container with arrow buttons |

## Implementation Details

### Data Strategy
- Fetch ALL approved events via `GET /api/events` (existing endpoint) in a single call
- Group events by tags client-side (an event can appear in multiple category sections)
- ~50-100 events total means one fetch is simpler and faster than 6 API calls

### Components
1. **HorizontalEventScroll** - Reusable horizontal scroll container with:
   - Left/right arrow buttons (hidden when at scroll boundary)
   - CSS snap scrolling
   - Fade edges to indicate scrollability

2. **CategorySection** - Renders:
   - Category icon + label + event count
   - `HorizontalEventScroll` of `EventCard`s
   - "No events in this category yet" for empty categories

3. **Categories Page** - Client component that:
   - Fetches all approved events
   - Groups by tags (event appears in multiple sections if multi-tagged)
   - Renders 6 `CategorySection` components
   - Includes `EventDetailsModal` for click-to-view
   - Loading state: 6 skeleton sections

### Reused Components
- `EventCard`, `EventDetailsModal`, `EventCardSkeleton`
- `EVENT_CATEGORIES` and `EVENT_TAGS` from constants
- Lucide icons mapped from `EVENT_CATEGORIES[tag].icon`

## Key Decisions
- Events appear in multiple sections if multi-tagged (matches the multi-tag model)
- Fetch once, split client-side (simpler than 6 API calls)
