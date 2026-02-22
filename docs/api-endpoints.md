# API Endpoints

## POST /api/events/:id/save

Save an event to the authenticated user's saved list.

- **Authentication:** Required (Supabase session cookie)
- **Path Parameters:**
  - `id` (string, required) — UUID of the event to save
- **Request Body (JSON):**
  - `user_id` (string, required) — UUID of the authenticated user (must match session user)
- **Responses:**
  - `201 Created` — `{ "success": true, "saved_at": "2025-12-02T14:39:54.530Z" }`
  - `200 OK` — `{ "message": "Event already saved", "saved_at": "2025-12-02T14:39:54.530Z" }`
  - `400 Bad Request` — `{ "error": "user_id is required" }`
  - `401 Unauthorized` — `{ "error": "Unauthorized" }`
  - `403 Forbidden` — `{ "error": "user_id does not match authenticated user" }`
  - `404 Not Found` — `{ "error": "Event not found" }`
  - `500 Internal Server Error` — `{ "error": "Failed to save event" }` or `{ "error": "Internal server error" }`

### Database Schema

Saves to the `saved_events` table:

```sql
CREATE TABLE saved_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);
```

### Example Request

```http
POST /api/events/44a6be58-533b-4b15-bd15-631919439803/save HTTP/1.1
Content-Type: application/json

{
  "user_id": "7e7a6f4b-afde-4a90-b518-3655a172de42"
}
```

### Example Success Response (201)

```json
{
  "success": true,
  "saved_at": "2025-12-02T14:39:54.530Z"
}
```

### Example Duplicate Response (200)

```json
{
  "message": "Event already saved",
  "saved_at": "2025-12-02T14:39:54.530Z"
}
```

### Testing Without Authentication

Since authentication is not yet implemented, you can test this endpoint by temporarily enabling the service role client in the route handler:

1. In `src/app/api/events/[id]/save/route.ts`, uncomment the service role client code and comment out the regular `createClient()` call
2. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
3. Create a test JSON file:
   ```powershell
   @"
   {"user_id":"7e7a6f4b-afde-4a90-b518-3655a172de42"}
   "@ | Out-File -Encoding utf8 -NoNewline test.json
   ```
4. Test with curl:
   ```powershell
   curl.exe "http://localhost:3000/api/events/44a6be58-533b-4b15-bd15-631919439803/save" -X POST -H "Content-Type: application/json" -d "@test.json"
   ```
5. Verify the first call returns `201 Created` and subsequent calls return `200 OK`
6. **Important:** Re-comment the service role code before committing

---

## Date Validation (POST /api/events/create & PATCH /api/events/:id)

Both the **create** and **update** endpoints enforce strict ISO 8601 date validation on the `start_date` and `end_date` fields.

### Accepted Date Formats

All date values must conform to ISO 8601. Both date-only and full datetime strings (with timezone designator) are accepted:

| Format                         | Example                     |
| ------------------------------ | --------------------------- |
| Date-only                      | `2026-03-15`                |
| UTC datetime (Z suffix)        | `2026-03-15T09:00:00Z`      |
| UTC datetime with milliseconds | `2026-03-15T09:00:00.000Z`  |
| Datetime with UTC offset       | `2026-03-15T09:00:00+05:30` |

> **Rejected formats:** `03/15/2026`, `15-03-2026`, `March 15 2026`, Unix timestamps, ISO datetimes without a timezone designator (e.g. `2026-03-15T09:00:00` with no `Z` or `±HH:mm`).

### Constraints

| Field        | Constraint                                                                     |
| ------------ | ------------------------------------------------------------------------------ |
| `start_date` | Required. Must be a valid ISO 8601 date **in the future**.                     |
| `end_date`   | Optional. When provided, must be ISO 8601 and **strictly after** `start_date`. |

Calendar validity is enforced (e.g. `2026-02-30` and `2026-02-29` on a non-leap year are rejected). PATCH is a partial update — if only `end_date` is changed and `start_date` is omitted, the ISO 8601 format is still validated but the future-date constraint is not re-applied to `end_date` alone.

### Error Response Shape

All date validation errors return `400 Bad Request` with the following body:

```json
{
  "error": "<human-readable message>",
  "field": "start_date" | "end_date"
}
```

The `field` property identifies exactly which field failed, making it easy for clients to surface the error next to the right input.

### Example Error Responses

**Invalid format:**

```json
{
  "error": "start_date must be a valid ISO 8601 date (e.g. \"2026-03-15\" or \"2026-03-15T09:00:00Z\")",
  "field": "start_date"
}
```

**Date in the past:**

```json
{
  "error": "start_date must be a date in the future",
  "field": "start_date"
}
```

**end_date before start_date:**

```json
{
  "error": "end_date must be after start_date",
  "field": "end_date"
}
```

### Implementation

- Validation logic lives in [`src/lib/dateValidation.ts`](../src/lib/dateValidation.ts).  
  Exported functions: `isValidISODate`, `isDateInFuture`, `isEndAfterStart`, `validateEventDates`.
- Unit tests: [`src/lib/dateValidation.test.ts`](../src/lib/dateValidation.test.ts) (42 tests).
- Integration tests: [`src/__tests__/api/events/date-validation.test.ts`](../src/__tests__/api/events/date-validation.test.ts) (22 tests).
