## Event Components — Cleanup Summary

`EventCard` and `RelatedEventCard` kept separate: genuinely different layouts (full image card vs compact link row, ~15% JSX overlap).

`FilterSidebar` kept as positional wrapper around `EventFilters` — no duplicated state.

**Fixes applied:**
- `EventFilters`: removed unused `Badge` and `Filter` imports
- `FilterSidebar`: removed unused `ChevronRight`, `ChevronLeft`, `Filter` imports
- `HappeningNowSection`: removed unused `Clock` import
- `CreateEventForm`: removed unused `Badge`, `Upload`, `X` imports; fixed double `onSuccess()` call
- `RsvpButton`: added optimistic rollback for cancel-RSVP (DELETE) on error
