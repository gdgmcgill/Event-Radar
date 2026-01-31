# New Tickets - January 24, 2026

## 📋 Sprint Goal: Complete MVP Core for Feb 24 Beta Launch

---

## 🎯 apollo-ullah (Project Lead) - 4 Tickets

### Ticket A-1: [Frontend] Implement Interest Tag Selection Onboarding Flow
**Priority:** P0-Critical | **Labels:** Frontend, mvp, user-story

**Description:**
Create the first-time user onboarding flow where users select 3-5 interest tags. This is critical for the recommendation system to work.

**Acceptance Criteria:**
- [ ] Modal/page appears for new users without interest tags
- [ ] Display all 6 event categories with visual icons
- [ ] Minimum 3 tags required, maximum 5
- [ ] Tags saved to user profile via `/api/profile/interests`
- [ ] Skip option available (defaults to popular events)
- [ ] Mobile-responsive design

**Technical Notes:**
- Use existing `EventTag` enum from `src/types/index.ts`
- Connect to existing `/api/profile/interests` endpoint
- Store in Supabase `users.interest_tags` column

---

### Ticket A-2: [Full Stack] Create My Events Page with Saved Events Display
**Priority:** P0-Critical | **Labels:** Full Stack, mvp, feature

**Description:**
Complete the My Events page (`/my-events`) to display user's saved events with proper filtering and unsave functionality.

**Acceptance Criteria:**
- [ ] Fetch saved events from API on page load
- [ ] Display events in grid layout (reuse EventGrid)
- [ ] Tabs: "Upcoming" and "Past" saved events
- [ ] Unsave button on each event card
- [ ] Empty state with CTA to browse events
- [ ] Show sign-in prompt for unauthenticated users

**Technical Notes:**
- Use existing save endpoint: `/api/events/[id]/save`
- Implement unsave via DELETE method
- Reference ticket J-3 (forknay) for unsave endpoint

---

### Ticket A-3: [Backend] Implement Email Reminder Scheduler
**Priority:** P1-High | **Labels:** Backend, mvp, feature

**Description:**
Create a scheduled job that sends email reminders 24 hours and 1 hour before saved events.

**Acceptance Criteria:**
- [ ] Cron job/Edge Function runs hourly
- [ ] Identifies events 24h and 1h away
- [ ] Sends reminder email with event details
- [ ] Prevents duplicate reminders (track sent status)
- [ ] Respects user notification preferences
- [ ] Includes unsubscribe link

**Technical Notes:**
- Use Supabase Edge Functions or Vercel Cron
- Consider using Supabase SMTP or SendGrid
- Create `reminder_sent` tracking table

---

### Ticket A-4: [Frontend] Build Landing Page Hero Section with Featured Events
**Priority:** P1-High | **Labels:** Frontend, mvp, enhancement

**Description:**
Create an engaging hero section on the homepage featuring trending/popular events and personalized recommendations.

**Acceptance Criteria:**
- [ ] Hero banner with search bar prominently displayed
- [ ] "Recommended for You" carousel (authenticated users)
- [ ] "Popular This Week" section (all users)
- [ ] "Happening Today" quick-view section
- [ ] Smooth animations and transitions
- [ ] Mobile-first responsive design

**Technical Notes:**
- Use existing `/api/events/popular` endpoint
- Use existing `/api/recommendations` endpoint
- Consider using Framer Motion or CSS animations

---

## 👥 Team Member Tickets (2 each)

---

## GeorgesAbiChahine - AI/ML Focus

### Ticket G-1: [Full Stack] Integrate AI Recommendation Service with Frontend
**Priority:** P0-Critical | **Labels:** AI/ML, Full Stack, mvp

**Description:**
Connect the Python AI recommendation service (`/AI`) with the Next.js frontend through the existing API routes.

**Acceptance Criteria:**
- [ ] `/api/recommendations` calls AI service
- [ ] Handle cold start (new users with no interactions)
- [ ] Cache recommendations for performance (5-min TTL)
- [ ] Fallback to popular events if AI service unavailable
- [ ] Log recommendation requests for analytics

**Technical Notes:**
- AI service runs on `localhost:8000` (see `AI/run.py`)
- Use `/api/recommendations/sync` for real-time sync
- Reference existing cosine similarity implementation

---

### Ticket G-2: [AI/ML] Implement User Preference Learning from Interactions
**Priority:** P1-High | **Labels:** AI/ML, Backend, feature

**Description:**
Enhance the recommendation system to learn from user interactions (views, saves, clicks) beyond just interest tags.

**Acceptance Criteria:**
- [ ] Track event views via `/api/interactions`
- [ ] Weight recent interactions higher
- [ ] Update user embeddings based on interaction history
- [ ] A/B test against tag-only recommendations
- [ ] Document the algorithm in AI/README.md

---

## gkontorousis - Tech Lead

### Ticket GK-1: [Backend] Set Up Apify Instagram Scraping Pipeline
**Priority:** P0-Critical | **Labels:** Backend, mvp, Tech Lead

**Description:**
Configure Apify Instagram scraper to run daily and populate pending_events table.

**Acceptance Criteria:**
- [ ] Apify actor configured with 20-30 club accounts
- [ ] Scheduled to run daily at 6:00 AM EST
- [ ] Extract: image, caption, date, time, location
- [ ] Parse event details using regex patterns
- [ ] Insert into `pending_events` table with confidence score
- [ ] Error alerting if >30% accounts fail

**Technical Notes:**
- See PRD Section 14.4 for regex patterns
- Use Supabase webhook endpoint: `/api/admin/events`
- Budget: $49/month Apify Starter plan

---

### Ticket GK-2: [Backend] Create Event Data Normalization Service
**Priority:** P1-High | **Labels:** Backend, feature, Tech Lead

**Description:**
Build a service to normalize and validate scraped event data before admin review.

**Acceptance Criteria:**
- [ ] Standardize date/time formats
- [ ] Auto-detect and assign event tags
- [ ] Validate location strings (McGill campus detection)
- [ ] Generate confidence score (0-1)
- [ ] Flag incomplete/invalid data for review
- [ ] Create duplicate detection logic

---

## thaimtl - Frontend Focus

### Ticket T-1: [Frontend] Build Interest Tag Selection UI Component
**Priority:** P0-Critical | **Labels:** Frontend, mvp, component

**Description:**
Create a reusable, visually appealing tag selection component for the onboarding flow and profile settings.

**Acceptance Criteria:**
- [ ] Grid of tag cards with icons and labels
- [ ] Visual selection state (highlight, checkmark)
- [ ] Counter showing selected count (3-5 required)
- [ ] Smooth selection/deselection animations
- [ ] Accessible (keyboard nav, ARIA labels)
- [ ] Matches design system colors

**Technical Notes:**
- Use constants from `src/lib/constants.ts`
- Consider using Radix UI ToggleGroup
- Export for reuse in profile settings

---

### Ticket T-2: [Frontend] Implement Event Save/Unsave Animation & Feedback
**Priority:** P1-High | **Labels:** Frontend, enhancement, user-story

**Description:**
Add micro-interactions and visual feedback when users save/unsave events.

**Acceptance Criteria:**
- [ ] Heart/bookmark icon animation on save
- [ ] Toast notification on save/unsave
- [ ] Optimistic UI update (immediate visual feedback)
- [ ] Loading state while API call in progress
- [ ] Error state with retry option
- [ ] Haptic feedback on mobile (if supported)

---

## y-c-shen - Backend Focus

### Ticket Y-1: [Backend] Implement Event Reminder Email Service
**Priority:** P1-High | **Labels:** Backend, feature

**Description:**
Create the email service that sends event reminder notifications.

**Acceptance Criteria:**
- [ ] Email templates for 24h and 1h reminders
- [ ] Include: event title, time, location, map link
- [ ] "Open in Uni-Verse" CTA button
- [ ] Unsubscribe link in footer
- [ ] Track delivery status
- [ ] Handle bounces gracefully

**Technical Notes:**
- Use Supabase SMTP or SendGrid
- Create HTML email templates
- Store templates in database for easy editing

---

### Ticket Y-2: [Backend] Create Admin Event Approval/Rejection Endpoints
**Priority:** P0-Critical | **Labels:** Backend, mvp, admin

**Description:**
Build API endpoints for admins to approve, reject, or edit pending events.

**Acceptance Criteria:**
- [ ] POST `/api/admin/events/[id]/approve` - move to events table
- [ ] POST `/api/admin/events/[id]/reject` - mark as rejected with reason
- [ ] PUT `/api/admin/events/[id]` - edit pending event
- [ ] Admin role verification on all endpoints
- [ ] Audit log of approval actions
- [ ] Return updated event data

---

## vlrr7 - Full Stack

### Ticket V-1: [Frontend] Build Admin Pending Events Queue UI
**Priority:** P0-Critical | **Labels:** Frontend, mvp, admin

**Description:**
Create the admin interface for reviewing and approving scraped events.

**Acceptance Criteria:**
- [ ] List view of pending events with filters
- [ ] Side-by-side: original Instagram post + extracted data
- [ ] Approve/Edit/Reject action buttons
- [ ] Bulk approve option for high-confidence events
- [ ] Filter by confidence score
- [ ] Pagination for large queues

**Technical Notes:**
- Page: `/admin/pending`
- Connect to admin approval endpoints (Y-2)
- Show confidence score visually (color-coded)

---

### Ticket V-2: [Frontend] Implement Event Statistics Dashboard Widgets
**Priority:** P1-High | **Labels:** Frontend, admin, enhancement

**Description:**
Build dashboard widgets showing key metrics on the admin dashboard.

**Acceptance Criteria:**
- [ ] Total events (approved/pending/rejected)
- [ ] User engagement metrics (saves, views)
- [ ] Popular tags chart
- [ ] Events by club breakdown
- [ ] Weekly activity trend graph
- [ ] Real-time or near-real-time updates

---

## Aaronshahh - AI/ML

### Ticket AA-1: [AI/ML] Create Event Tag Auto-Suggestion from Description
**Priority:** P1-High | **Labels:** AI/ML, feature

**Description:**
Build ML model to automatically suggest tags based on event description text.

**Acceptance Criteria:**
- [ ] Model trained on existing tagged events
- [ ] Returns top 3-5 tag suggestions with confidence
- [ ] Exposed via API endpoint
- [ ] Used in admin review workflow
- [ ] >80% accuracy on test set
- [ ] Documentation of model approach

**Technical Notes:**
- Consider using embeddings from `AI/models/embedder.py`
- Could use simple TF-IDF or transformer-based approach

---

### Ticket AA-2: [AI/ML] Implement Trending Events Detection Algorithm
**Priority:** P2-Medium | **Labels:** AI/ML, feature

**Description:**
Create algorithm to detect trending events based on recent engagement patterns.

**Acceptance Criteria:**
- [ ] Define "trending" criteria (views, saves, time decay)
- [ ] Calculate trending score for each event
- [ ] API endpoint: GET `/api/events/trending`
- [ ] Update scores periodically (hourly)
- [ ] Handle new events (boost factor)

---

## emmag-22 - AI/ML

### Ticket E-1: [AI/ML] Build User Segmentation Service for Recommendations
**Priority:** P1-High | **Labels:** AI/ML, feature

**Description:**
Create user segmentation based on behavior patterns to improve recommendation diversity.

**Acceptance Criteria:**
- [ ] Segment users into behavioral clusters
- [ ] Use existing k-means implementation
- [ ] Expose segment ID via user profile API
- [ ] Use segments to diversify recommendations
- [ ] Document segment characteristics

**Technical Notes:**
- Builds on existing k-means clustering work
- Integrate with `AI/services/recommender.py`

---

### Ticket E-2: [AI/ML] Create Recommendation Quality Metrics Dashboard
**Priority:** P2-Medium | **Labels:** AI/ML, analytics

**Description:**
Build analytics dashboard to monitor recommendation system performance.

**Acceptance Criteria:**
- [ ] Track recommendation CTR (click-through rate)
- [ ] Save rate of recommended events
- [ ] A/B test comparison views
- [ ] Recommendation diversity metrics
- [ ] Export data for analysis

---

## dwei-exe - Testing/Backend

### Ticket D-1: [Testing] Add Integration Tests for Recommendations API
**Priority:** P1-High | **Labels:** Backend, testing

**Description:**
Write comprehensive integration tests for the recommendation endpoints.

**Acceptance Criteria:**
- [ ] Test authenticated vs guest recommendations
- [ ] Test cold start scenario
- [ ] Test with various user interaction histories
- [ ] Test fallback behavior when AI service down
- [ ] >80% code coverage for recommendation routes
- [ ] CI/CD integration

---

### Ticket D-2: [Backend] Implement Event Search with Fuzzy Matching
**Priority:** P1-High | **Labels:** Backend, feature

**Description:**
Enhance search to support fuzzy matching and typo tolerance.

**Acceptance Criteria:**
- [ ] Fuzzy match on event title, description, club name
- [ ] Levenshtein distance ≤2 tolerance
- [ ] Search results ranked by relevance
- [ ] Debounced API calls (300ms)
- [ ] "Did you mean?" suggestions for no results

---

## jerryluo01 - Full Stack

### Ticket JL-1: [Frontend] Create Saved Events Counter Component
**Priority:** P1-High | **Labels:** Frontend, component

**Description:**
Build a component showing the user's saved events count in the header.

**Acceptance Criteria:**
- [ ] Badge showing saved count next to "My Events" link
- [ ] Real-time update when events saved/unsaved
- [ ] Animation on count change
- [ ] Hidden for unauthenticated users
- [ ] Cached count with optimistic updates

---

### Ticket JL-2: [Frontend] Implement "Events This Week" Section
**Priority:** P1-High | **Labels:** Frontend, feature

**Description:**
Create a homepage section highlighting events happening in the current week.

**Acceptance Criteria:**
- [ ] Horizontal scrollable carousel
- [ ] Group by day (Today, Tomorrow, etc.)
- [ ] Quick-save button on each card
- [ ] "See all" link to filtered calendar view
- [ ] Empty state if no events this week

---

## fias06 - Frontend/Design

### Ticket F-1: [Frontend] Design and Implement Event Category Filter Pills
**Priority:** P1-High | **Labels:** Frontend, component, phase-1

**Description:**
Create visually appealing filter pills for event categories.

**Acceptance Criteria:**
- [ ] Horizontal scrollable pill row
- [ ] Each category with icon and color
- [ ] Multi-select support
- [ ] Active state styling
- [ ] Clear all button when filters active
- [ ] Mobile-friendly touch targets

---

### Ticket F-2: [Frontend] Create Animated Loading States for Event Grid
**Priority:** P2-Medium | **Labels:** Frontend, enhancement, phase-1

**Description:**
Design and implement engaging skeleton loading animations.

**Acceptance Criteria:**
- [ ] Shimmer effect on skeleton cards
- [ ] Staggered animation on load
- [ ] Smooth transition to real content
- [ ] Match EventCard dimensions exactly
- [ ] Reduced motion option for accessibility

---

## jumpman786 - Full Stack

### Ticket JM-1: [Frontend] Implement Event Share Functionality
**Priority:** P1-High | **Labels:** Full Stack, feature

**Description:**
Add ability to share events via native share or copy link.

**Acceptance Criteria:**
- [ ] Share button on event card and detail page
- [ ] Native share API on supported devices
- [ ] Copy link fallback with toast confirmation
- [ ] Share to specific platforms (optional)
- [ ] Track shares for analytics

---

### Ticket JM-2: [Frontend] Build Club Profile Page Layout
**Priority:** P2-Medium | **Labels:** Full Stack, feature

**Description:**
Create a page to display club information and their events.

**Acceptance Criteria:**
- [ ] Route: `/clubs/[id]`
- [ ] Club logo, name, description
- [ ] Instagram link
- [ ] List of upcoming events by this club
- [ ] Past events section
- [ ] Follow club option (future)

---

## forknay - Backend

### Ticket FK-1: [Backend] Create GET /api/recommendations/personalized Endpoint
**Priority:** P1-High | **Labels:** Backend, feature

**Description:**
Build endpoint for personalized recommendations with advanced filtering.

**Acceptance Criteria:**
- [ ] Accept filters: tags, date range, limit
- [ ] Return mix of tag-matched + popular events
- [ ] Include explanation field ("Because you liked...")
- [ ] Pagination support
- [ ] Handle cold start gracefully

---

### Ticket FK-2: [Backend] Implement User Activity Logging Middleware
**Priority:** P1-High | **Labels:** Backend, analytics

**Description:**
Create middleware to log user activity for recommendation improvement.

**Acceptance Criteria:**
- [ ] Log page views, searches, clicks
- [ ] Store in `user_interactions` table
- [ ] Batch writes for performance
- [ ] Privacy-compliant (anonymize where needed)
- [ ] Configurable logging levels

---

## 📊 Summary

| Assignee | Ticket Count | Priority Focus |
|----------|--------------|----------------|
| apollo-ullah | 4 | MVP Features, Onboarding |
| GeorgesAbiChahine | 2 | AI Integration |
| gkontorousis | 2 | Scraping Pipeline |
| thaimtl | 2 | Frontend Components |
| y-c-shen | 2 | Backend Services |
| vlrr7 | 2 | Admin UI |
| Aaronshahh | 2 | AI/ML Features |
| emmag-22 | 2 | AI Analytics |
| dwei-exe | 2 | Testing & Search |
| jerryluo01 | 2 | Frontend Features |
| fias06 | 2 | Design Components |
| jumpman786 | 2 | Share & Clubs |
| forknay | 2 | Backend APIs |

**Total New Tickets: 26**

---

## 🎯 Sprint Priority Order

### Must Complete This Sprint (P0)
1. A-1: Interest Tag Onboarding (apollo-ullah)
2. A-2: My Events Page (apollo-ullah)
3. G-1: AI Integration (GeorgesAbiChahine)
4. GK-1: Apify Setup (gkontorousis)
5. T-1: Tag Selection Component (thaimtl)
6. Y-2: Admin Approval Endpoints (y-c-shen)
7. V-1: Admin Pending Queue UI (vlrr7)

### Should Complete This Sprint (P1)
- All P1-High tickets listed above

### Nice to Have (P2)
- Analytics dashboards
- Club profiles
- Advanced animations
