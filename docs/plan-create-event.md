# Plan: Create Event Page (`/create-event`)

## Overview
Any authenticated user can submit events. Events go to "pending" status and require admin approval. Form includes title, description, date, time, location, tags, and optional image.

## DB Changes
- Verify/create Supabase Storage bucket `event-images` for user-uploaded images
- No schema changes needed - existing `events` table supports all fields

## Files to Create
| File | Purpose |
|------|---------|
| `src/app/create-event/page.tsx` | Create event form page with auth guard |
| `src/components/events/CreateEventForm.tsx` | Form component with validation |
| `src/app/api/events/create/route.ts` | POST endpoint for authenticated event creation |

## API Design: `POST /api/events/create`
- **Auth**: Requires authenticated user (not admin-only)
- **Body**: `{ title, description, start_date, end_date, location, tags[], image_url?, category? }`
- **Behavior**: Inserts event with `status: 'pending'`, `organizer` set to user's name or email
- **Response**: `{ event, message: "Event submitted for review" }`
- Separate from existing `POST /api/admin/events` which auto-approves

## Implementation Details

### API Route
- Verify authenticated user via `supabase.auth.getUser()`
- Validate required fields (title, description, start_date, location, at least 1 tag)
- Validate date is in the future
- Insert with `status: 'pending'`

### Form Component
- Fields: title (input), description (textarea), date (date picker), time (time input), location (input), tags (multi-select checkboxes from 6 categories), image (file upload - optional)
- Client-side validation matching API validation
- Success state: green banner "Event submitted for review!"
- Error state: inline field errors

### Image Upload Flow
1. User selects image file
2. On form submit, upload to Supabase Storage (`event-images` bucket) via client
3. Get public URL from storage
4. Include `image_url` in the event creation API call
5. Fallback: if no image, event uses null image_url

### Auth Guard
- If `!user && !loading`, show sign-in prompt
- Uses `useAuthStore` for auth state

## Key Decisions
- New route `/api/events/create` keeps admin and user event creation separated
- No club_id for user-created events; `organizer` field stores their name
- Image upload is optional
