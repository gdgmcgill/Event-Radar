# API Endpoints

## POST /api/events/:id/save

Save an event to the authenticated user's saved list.

- **Authentication:** Required (Supabase session cookie)
- **Path Parameters:**
  - `id` (string, required) — UUID of the event to save
- **Request Body (JSON):**
  - `user_id` (string, required) — UUID of the authenticated user (must match session user)
- **Responses:**
  - `201 Created` — `{ "success": true, "saved_at": "2025-11-26T15:04:05.000Z" }`
  - `200 OK` — `{ "message": "Event already saved", "saved_at": "2025-11-26T15:04:05.000Z" }`
  - `400 Bad Request` — `{ "error": "user_id is required" }`
  - `401 Unauthorized` — `{ "error": "Unauthorized" }`
  - `403 Forbidden` — `{ "error": "user_id does not match authenticated user" }`
  - `404 Not Found` — `{ "error": "Event not found" }`
  - `500 Internal Server Error` — `{ "error": "Failed to save event" }` or `{ "error": "Internal server error" }`

### Example Request

```http
POST /api/events/00000000-0000-0000-0000-000000000000/save HTTP/1.1
Content-Type: application/json

{
  "user_id": "11111111-1111-1111-1111-111111111111"
}
```

### Example Success Response (201)

```json
{
  "success": true,
  "saved_at": "2025-11-26T15:04:05.000Z"
}
```
