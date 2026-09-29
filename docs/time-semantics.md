# Legacy event time semantics (DEC-80)

Legacy `public.events.start_date` and `end_date` are `timestamptz` columns, but they do not hold true instants. They hold **Toronto wall-clock time labelled UTC**: an event at 6:00 PM Eastern is stored as `…T18:00:00+00:00`.

- The create form stores "wall-clock EST stored as UTC".
- The `events-webhook` edge function runs in UTC and uses `setHours`.
- Phase 6 kept this convention on purpose (DEC-80). Existing rows are not reinterpreted, because a conversion would shift values that are already encoded. [discovery-time-semantics.md](discovery-time-semantics.md) has the M0 history.

Every other timestamp is a true instant, for example `created_at`, `updated_at`, `received_at`, and every opportunity and resource time.

## Code that honours the convention

- **`getESTNow()` / `getESTNowISO()`** (`src/lib/timezone.ts`) give "now" in the same encoding: Toronto wall-clock digits labelled UTC.
  - Compare legacy columns with these values, never with `new Date().toISOString()`.
  - Users: `/api/events`, `/api/users/saved-events`, and the Pending Review query.
  - Since M3: the stale-pending rule in `src/lib/ingest/staleness.ts` (`staleFilter`, `isPastWallClock`). The ingestion summary, `/api/admin/ingestion` (its per-row `is_past`), and the Pending Review stale banner all use it.
- **`public.discovery_public`** converts once, with `(start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Toronto'`. Its `starts_at`/`ends_at` for events are true instants, so discovery surfaces format them in `America/Toronto`.
  - Users: `ListingFacts`, and discovery cards (`presentation.ts`, which uses the listing's `source_timezone`, Toronto for events). Also the event detail sidebar and its past notice when the discovery projection is present.
- The moderation ingestion page formats a legacy `start_date` with `timeZone: "UTC"` and labels it "Toronto time". That shows the stored digits as they are.

## Code that does not honour it

- **`formatDate` / `formatTimeFromISO`** (`src/lib/utils.ts`) use `parseISO`, which reads the value in the viewer's local zone.
- **`new Date(start_date).toLocaleString()`** (and `toLocaleDateString` / `toLocaleTimeString`) on a legacy column does the same.
- The result: a Toronto viewer sees legacy times 4 hours early (5 in winter), so 11:59 PM shows as 7:59 PM.
- These formatters still render every switch-off (legacy) surface. That is a pre-existing defect.
- **Changing switch-off rendering is a pending owner decision** (M3 REPORT, residuals). With the `discovery_ui` switch off, rendering is unchanged.

## Rules for new code

1. For a "past / upcoming" comparison on a legacy event column, compare with `getESTNowISO()` or use `isPastWallClock`.
2. To display a legacy event time, prefer the discovery projection's converted instant and format it in `America/Toronto`. If only the raw column is available, format it in `UTC` and label it Toronto time.
3. Never pass a legacy column to `formatTimeFromISO`, `toLocaleString`, or `toISOString()` arithmetic as if it were an instant.
