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
