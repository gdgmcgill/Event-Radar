# Event Page Revamp — Missing Features & Gaps

Comparison between the Stitch design (Uni-Verse Event Details Page) and the current implementation.

## Features Present in Stitch Design but Not Yet Fully Implemented

### 1. Attendees Section with Avatar Stack
- **Stitch**: Shows "Attendees (342)" heading with a row of 4+ avatar photos, a "+338" overflow badge, and "including 12 of your friends" text
- **Current**: RSVP counts (going/interested) displayed as text + small FriendsGoing component with 3 avatars
- **Gap**: Need a unified attendees section that combines RSVP count with a larger avatar stack display (12px avatars → 48px avatars), total attendee count in heading, and friend count callout

### 2. Registration / Ticketing System
- **Stitch**: Sidebar shows "Registration: Free" with a "McGill ID Req." badge and a prominent "Register Now" CTA button with "Registration closes in 3 days. Limited spots available." countdown text
- **Current**: No registration system exists — only RSVP (Going/Interested). The "Register Now" button is rendered but has no backend functionality
- **Gap**: Need a registration model in the database (`event_registrations` table), registration capacity/deadline fields on events, and API routes for registration flow. The "Free" price and "McGill ID Req." are currently hardcoded placeholders

### 3. Google Maps Static Map Preview
- **Stitch**: Shows a styled dark-theme static map image with a red pin and "View larger map" overlay
- **Current**: A placeholder dark gradient box with a MapPin icon links to Google Maps
- **Gap**: Requires a Google Maps Static Maps API key to render actual map tiles. Add `GOOGLE_MAPS_API_KEY` env var and use the Static Maps API URL that's already templated in the code

### 4. Like/Favorite Functionality (Separate from Save)
- **Stitch**: Two distinct sidebar buttons — "Save" (bookmark icon) and "Like" (heart icon)
- **Current**: "Save" toggles via API. "Like" button is rendered but only toggles local state — no backend persistence
- **Gap**: Need a `event_likes` table or extend `user_interactions` to track likes separately from saves, plus API route

### 5. "Add to Calendar" Action
- **Stitch**: "Add to Calendar" link under the date/time section
- **Current**: Button exists but the onClick handler is empty. The app has `exportEventIcal()` in `lib/exportUtils.ts` but it's not wired up in the new view
- **Gap**: Wire the "Add to Calendar" button to call `exportEventIcal(event.id, event.title)`

### 6. ~~Light Mode Support for New Layout~~ (DONE)
- **Resolved**: Full dual-mode support added. Light mode uses warm off-white (`#faf8f7`) background, white cards with subtle shadows, slate-900 headings, slate-600 body text. Dark mode uses original Stitch glassmorphic styling. Hero gradient fades to correct background per mode.

## Features in Current Implementation Not Present in Stitch Design

### 1. Reviews Section
- Both the inline review display (star ratings, comments) and the ReviewPrompt input form exist in the current app
- Stitch design does not show reviews — they are kept below the fold in the left column as `children` content

### 2. Similar Events List
- Current sidebar shows up to 5 related events with thumbnails
- Stitch design does not show this section — it's placed below the sticky sidebar card

### 3. Social Sharing (Twitter, Facebook, Copy Link)
- Current app has dedicated share buttons for each platform
- Stitch design uses a single share icon button in the hero top bar (native share API)

### 4. Breadcrumb Navigation
- Replaced by the "Back to Events" pill button overlaying the hero image

### 5. Invite Friends Button & Modal
- Present in current app, not shown in Stitch design, but kept in the children slot

## Recommendations for Full Parity

1. **Priority 1**: Wire up "Add to Calendar" with existing `exportEventIcal`
2. **Priority 2**: Add Google Maps API key and render static map preview
3. **Priority 3**: Build unified Attendees section component combining RSVP counts + avatar stack
4. ~~**Priority 4**: Add light mode support~~ (DONE)
5. **Priority 4**: Build registration system (DB table, API routes, capacity tracking)
6. **Priority 6**: Add Like/Favorite API persistence
