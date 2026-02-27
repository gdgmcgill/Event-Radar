# PR: API Event Endpoint Tests

## Summary

Adds full integration and unit test coverage for two core event API endpoints using Vitest with fully mocked Supabase — no live database required.

---

## Files Added

### `src/__tests__/api/events/date-validation.test.ts`

Integration tests for date validation logic across the event create and update endpoints.

**Endpoints covered:**
- `POST /api/events/create`
- `PATCH /api/events/:id`

**Infrastructure / Setup:**
- Constants defined for reusable date fixtures: `FUTURE_DATE`, `FUTURE_DATETIME`, `FUTURE_END_DATETIME`, `PAST_DATE`, `PAST_DATETIME`
- `createMockChain()` utility builds a chainable Supabase mock (covers `select`, `insert`, `update`, `eq`, `single`, `maybeSingle`)
- `mockSupabase` with `auth.getUser` and `from` mocked via `vi.mock`
- `@/lib/tagMapping` mocked as a pass-through
- `makeCreateRequest()` and `makeUpdateRequest()` helpers build `Request` objects for each endpoint
- `routeContext()` helper provides the dynamic route param `{ params: Promise<{ id }> }`
- `validCreateBody()` produces a minimal valid event payload
- `beforeEach` resets all module caches, clears mocks, resets `mockUser` to a valid McGill user with `admin` role, and re-imports route handlers fresh

**POST /api/events/create — date validation (14 test cases):**

| # | Test | Expected |
|---|------|----------|
| 1 | Valid future `start_date` (date-only `YYYY-MM-DD`) | `201` |
| 2 | Valid future ISO datetime with `end_date` after `start_date` | `201` |
| 3 | Missing `start_date` field | `400`, error matches `/start.?date/i` |
| 4 | Empty string `start_date` | `400`, `field: "start_date"` |
| 5 | `MM/DD/YYYY` format | `400`, `field: "start_date"` |
| 6 | `DD-MM-YYYY` format | `400`, `field: "start_date"` |
| 7 | Past `start_date` (date-only) | `400`, error matches `/future/i` |
| 8 | Past `start_date` (ISO datetime) | `400`, `field: "start_date"` |
| 9 | Calendar-invalid date (`2099-02-30`) | `400`, `field: "start_date"` |
| 10 | Non-ISO `end_date` string | `400`, `field: "end_date"` |
| 11 | `end_date` before `start_date` | `400`, error matches `/after/i` |
| 12 | `end_date` equal to `start_date` | `400`, `field: "end_date"` |
| 13 | Numeric value as `start_date` | `400`, `field: "start_date"` |
| 14 | ISO datetime without timezone designator (`T09:00:00` no `Z`) | `400`, `field: "start_date"` |

**PATCH /api/events/:id — date validation (8 test cases):**

| # | Test | Expected |
|---|------|----------|
| 1 | Update `start_date` to valid future datetime with valid `end_date` | `200` |
| 2 | Update only `end_date` to valid ISO date | `200` |
| 3 | Update non-date fields only (`title`) | `200` |
| 4 | `start_date` set to a past date | `400`, error matches `/future/i` |
| 5 | `start_date` in `MM/DD/YYYY` format | `400`, `field: "start_date"` |
| 6 | `end_date` before `start_date` in same update | `400`, `field: "end_date"` |
| 7 | `end_date` updated to natural-language date string (`"March 15 2099"`) | `400`, `field: "end_date"` |
| 8 | `end_date` set to an invalid string (`"not-valid"`) | `400`, `field: "end_date"` |

---

### `src/__tests__/api/events/get-events.test.ts`

Unit tests for the `GET /api/events` endpoint, covering response shape, pagination, filtering, and error handling.

**Infrastructure / Setup:**
- `MockEvent` interface mirrors the full DB event row shape
- `makeEvent(overrides)` factory creates a typed event fixture with sensible defaults, accepting partial overrides
- `createChainableBuilder()` builds a chainable Supabase query builder where `select`, `eq`, `order`, `overlaps`, `or`, `gte`, `lte` all return `this`, and `.range()` is the terminal method that resolves `mockQueryResult`
- `mockQueryResult` is a module-level variable tests override per-case to control what Supabase resolves to
- `makeRequest(params)` constructs a `NextRequest` with URL search params
- `beforeEach` resets modules, clears mocks, sets a default single-event result, and re-imports the route handler fresh

**GET /api/events — success (7 test cases):**

| # | Test |
|---|------|
| 1 | Returns `200` with `events`, `total`, `page`, `limit`, `totalPages` in response body |
| 2 | Returns the exact events resolved by Supabase (title, id verified) |
| 3 | Returns multiple events with correct `total` count |
| 4 | Defaults to `page=1`, `limit=50` when no params provided |
| 5 | Respects custom `page` and `limit` query parameters |
| 6 | Computes `totalPages` correctly (`Math.ceil(count / limit)`) |
| 7 | Returns `totalPages=0` and `total=0` when no events exist |

**GET /api/events — empty response (3 test cases):**

| # | Test |
|---|------|
| 1 | Returns `200` with `events: []` when Supabase returns zero rows |
| 2 | Handles `null` data from Supabase without crashing (returns `events: []`) |
| 3 | Returns empty events when search query matches nothing |

**GET /api/events — filters (7 test cases):**

| # | Test |
|---|------|
| 1 | Calls `overlaps("tags", [...])` when `tags` param is provided |
| 2 | Calls `or("title.ilike.%q%,description.ilike.%q%")` when `search` param is provided |
| 3 | Calls `gte("start_date", value)` when `dateFrom` param is provided |
| 4 | Calls `lte("start_date", value)` when `dateTo` param is provided |
| 5 | Does **not** call `overlaps()` when `tags` param is absent |
| 6 | Trims whitespace from individual tag values in comma-separated `tags` param |
| 7 | Passes correct `range(from, to)` offset for `page=2, limit=10` → `range(10, 19)` |

**GET /api/events — error handling (3 test cases):**

| # | Test |
|---|------|
| 1 | Returns `500` when Supabase returns an error object |
| 2 | Surfaces the Supabase error message directly in the `500` response body |
| 3 | Returns `500` with a generic error when an unexpected exception is thrown from `from()` |

**GET /api/events — response shape (4 test cases):**

| # | Test |
|---|------|
| 1 | Calls `eq("status", "approved")` — only approved events are returned |
| 2 | Queries the `"events"` table |
| 3 | Response body contains exactly the keys: `events`, `total`, `page`, `limit`, `totalPages` |
| 4 | `total` reflects the DB count (not the array length) for accurate pagination in paginated scenarios |

---

## Total Test Coverage Added

| File | Suites | Tests |
|------|--------|-------|
| `date-validation.test.ts` | 2 | 22 |
| `get-events.test.ts` | 5 | 24 |
| **Total** | **7** | **46** |
