# Uni-Verse Launch Plan — March 14, 2026

## Phase 1: Pages

### 1. Notifications Page
- [ ] Design notification list UI (read/unread states)
- [ ] Hook up to `notifications` table
- [ ] Mark as read on click, mark all as read
- [ ] Real-time or polling for new notifications

### 2. Calendar Page
- [ ] Monthly/weekly calendar view for events
- [ ] Color-code by category (use EVENT_CATEGORIES theming)
- [ ] Click event to navigate to detail page
- [ ] Filter by saved events / all events

### 3. Club Page (`/clubs/[id]`)
- [ ] Club profile header (logo, name, description, instagram)
- [ ] Upcoming events by this club
- [ ] Follow/unfollow button
- [ ] Member count, follower count

### 4. People Page
- [ ] Browse/search users
- [ ] Follow/unfollow
- [ ] View user profiles and shared interests

### 5. My Events Page
- [ ] List of saved/bookmarked events
- [ ] RSVP status (going/interested)
- [ ] Past vs upcoming tabs
- [ ] Quick unsave action

### 6. My Clubs Page
- [ ] Clubs the user is a member of
- [ ] Clubs the user follows
- [ ] Quick unfollow/leave action

### 7. Help Page
- [ ] FAQ section (how to save events, follow clubs, etc.)
- [ ] Contact/support info
- [ ] Link to about page

### 8. About Page
- [ ] Review and finalize existing `/about` page
- [ ] Team credits, mission statement
- [ ] Link to help page

### 9. Moderation / Admin Page
- [ ] Review pending events (approve/reject)
- [ ] Review pending clubs (approve/reject)
- [ ] Audit log viewer
- [ ] User management (roles)
- [ ] Featured events management (already exists — verify it works)

### 10. Profile Page
- [ ] View/edit display name, avatar, pronouns, year, faculty
- [ ] Interest tags editor
- [ ] Saved events count, clubs count
- [ ] Sign out button

---

## Phase 2: Cleanup

### 11. Delete Redundant Code
- [ ] Audit all event card components — consolidate to DiscoveryCard + EventCard only
- [ ] Remove unused imports, dead components, orphaned API routes
- [ ] Remove any leftover placeholder/test components
- [ ] Run `npm run lint` and fix all warnings

### 12. Type & Schema Sync
- [ ] Regenerate Supabase types (`generate_typescript_types`)
- [ ] Ensure `src/types/index.ts` matches DB schema
- [ ] Fix any type mismatches from the regeneration

---

## Phase 3: Data

### 13. Wipe Test Data
- [ ] Drop all rows from: events, clubs, saved_events, club_members, club_followers, user_follows, event_rsvps, user_interactions, notifications, experiment_assignments
- [ ] Keep schema, RLS policies, functions intact
- [ ] Keep admin user accounts

### 14. Populate with Real Events
- [ ] Source real McGill events (clubs, SSMUs, faculty events)
- [ ] Create real club entries with logos
- [ ] Upload event images
- [ ] Ensure all events have proper tags, dates, locations

---

## Phase 4: QA

### 15. Auth Flow Testing
- [ ] Sign up with McGill email
- [ ] Sign in / sign out
- [ ] Onboarding flow (interest selection)
- [ ] Protected route redirects

### 16. Core Workflow Testing
- [ ] Browse homepage sections (trending, happening now, categories)
- [ ] Search and filter events
- [ ] View event detail page
- [ ] Save/unsave events
- [ ] RSVP to events
- [ ] Follow/unfollow clubs and users
- [ ] Notifications arrive on relevant actions
- [ ] Calendar shows correct events

### 17. Admin Workflow Testing
- [ ] Submit event as organizer -> appears in moderation queue
- [ ] Approve/reject events as admin
- [ ] Approve/reject clubs as admin
- [ ] Feature an event from admin panel
- [ ] Verify audit log entries

### 18. Responsive & Cross-Browser
- [ ] Test on mobile (iPhone Safari, Android Chrome)
- [ ] Test dark mode and light mode
- [ ] Test on desktop (Chrome, Firefox, Safari)

---

## Phase 5: Launch

### 19. Pre-Launch Checklist
- [ ] Environment variables set in production
- [ ] Supabase RLS policies reviewed
- [ ] Rate limiting configured in middleware
- [ ] Error boundaries on all major pages
- [ ] OG meta tags / social preview for sharing
- [ ] Favicon and PWA manifest

### 20. Deploy & Go Live
- [ ] Push to main
- [ ] Deploy to Vercel (or hosting platform)
- [ ] Smoke test production URL
- [ ] Share with initial users
