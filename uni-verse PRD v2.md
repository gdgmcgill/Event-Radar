# **UNI-VERSE — PRODUCT REQUIREMENTS DOCUMENT**

**Status:** Draft v2.0  
**Product Name:** Uni-Verse  
**Product Owner:** Adyan Ullah  
**Technical Lead:** George Kontorousis  
**Organization:** Google Developer Group on Campus, McGill University  
**Last Updated:** November 9, 2025  
**Review Cycle:** Bi-weekly

**Quick Links:**  
Figma | [GitHub](https://github.com/gdgmcgill/Event-Radar) | Notion | Architecture | Research

---

## **EXECUTIVE SUMMARY**

### **Vision Statement**

Uni-Verse will become the definitive platform for campus life at McGill, transforming how 40,000+ students discover, engage with, and remember the events that define their university experience.

### **The Problem**

McGill students currently navigate a fragmented ecosystem of 15+ channels to discover campus events; Instagram stories, Discord servers, email lists, physical posters, and countless group chats. This fragmentation creates three critical failures:

1. **Discovery Failure:** Students miss 60-70% of relevant events due to information scatter  
2. **Equity Failure:** Smaller clubs with limited marketing reach cannot compete with established organizations  
3. **Engagement Failure:** Without centralized information and reminders, attendance rates remain chronically low

### **The Solution**

A centralized, intelligent event discovery platform that aggregates all McGill campus events, provides personalized recommendations using machine learning, and ensures students never miss opportunities aligned with their interests.

### **Success Definition**

* **Short-term (MVP \- Feb 2026):** 100 active beta users, 40% weekly engagement, 20+ clubs onboarded  
* **Medium-term (Phase 1 \- Apr 2026):** 500+ active users, 70% event interaction rate, club self-service portal  
* **Long-term (Phase 2 \- Summer 2026):** 2,000+ users, establish Uni-Verse as the default campus event platform

---

## **1\. STRATEGIC CONTEXT**

### **1.1 Market Opportunity**

**Target Market Size:**

* McGill undergraduate students: \~28,000  
* Graduate students: \~11,000  
* Total addressable market: 39,000+ students  
* Active clubs and organizations: 250+

**Market Gap:** No platform currently serves the specific need for centralized, searchable, personalized campus event discovery at McGill. Existing solutions:

* **Instagram:** Algorithm-driven, ephemeral, unsearchable  
* **Facebook Events:** Declining usage among Gen Z, requires account  
* **Email lists:** Overwhelming, no discovery mechanism  
* **Physical posters:** Location-dependent, temporary

**Competitive Advantage:**

* McGill-specific: Deep integration with campus culture and authentication  
* Intelligent curation: ML-driven personalization vs. chronological feeds  
* Low friction: Works without login, optimized for mobile browsers  
* Comprehensive: Aggregates events from all sources

### **1.2 Strategic Alignment**

**GDG Mission Alignment:** This project demonstrates Google technologies (Cloud, ML, modern web frameworks) while solving a real campus problem, directly aligning with GDG's mission to build community through technology.

**McGill Strategic Goals:** Supports McGill's student life initiatives by increasing engagement, improving equity of access to opportunities, and strengthening campus community bonds.

### **1.3 Assumptions and Dependencies**

**Critical Assumptions:**

* Students will adopt a new platform if it demonstrably saves time  
* Clubs will manually submit events if the process takes \<2 minutes  
* Instagram scraping will remain technically feasible throughout MVP phase  
* McGill OAuth access will be granted for student authentication

**External Dependencies:**

* Microsoft Azure AD for McGill authentication  
* Apify platform availability and pricing stability  
* Supabase service reliability  
* Club cooperation for event data and promotion

---

## **2\. PROBLEM DEEP-DIVE**

### **2.1 User Research Summary**

**Research Methods:**

* 100 student interviews (Jan 2025\)  
* Survey of 200+ McGill students  
* Analysis of 30+ club Instagram accounts  
* Behavioral observation of event discovery patterns

**Key Findings:**

**Finding 1: Information Overload Paradox**

* 78% of students report "feeling overwhelmed" by event information  
* Yet 65% also report "missing events they would have attended"  
* Students follow average of 23 club accounts but see \<10% of posts

**Finding 2: Discovery Friction**

* Average time to find a specific event: 8-12 minutes across platforms  
* First-year students spend 2x longer due to lack of network  
* 40% give up searching after checking 2-3 sources

**Finding 3: Memory and Reminder Gap**

* 53% of students save events mentally but forget to attend  
* Only 18% actively use calendar apps for campus events  
* Instagram "Save" feature rarely used for event planning

**Finding 4: Personalization Demand**

* 82% want event recommendations based on interests  
* Students join average 3.2 clubs but interested in 5-8  
* Discovery of "niche" communities is seen as valuable but difficult

### **2.2 Stakeholder Analysis**

| Stakeholder | Primary Need | Pain Point | Success Metric |
| ----- | ----- | ----- | ----- |
| **Students** | Find relevant events quickly | Information scatter | Time saved per week |
| **Small Clubs** | Reach target audience | Low organic visibility | Event attendance rate |
| **Large Clubs** | Maintain reach efficiency | Marketing fatigue | Engagement quality |
| **First-Years** | Discover communities | Lack of networks | Events attended |
| **Student Associations** | Campus engagement | Fragmented data | Overall participation |

### **2.3 Jobs to Be Done**

**Primary Job:** *"When I have free time or am looking to meet people, I want to quickly find events that match my interests, so I can make the most of my university experience without FOMO."*

**Supporting Jobs:**

* "Remember events I'm interested in without manual calendar work"  
* "Discover new communities aligned with my passions"  
* "Plan my week around social, academic, and career opportunities"  
* "Feel connected to campus culture and community"

---

## **3\. PRODUCT VISION & STRATEGY**

### **3.1 Product Positioning**

**For** McGill students who want to engage with campus life  
**Who** struggle to discover relevant events across fragmented channels  
**Uni-Verse** is an intelligent event discovery platform  
**That** aggregates all campus events and provides personalized recommendations  
**Unlike** Instagram, email lists, and Facebook  
**Our product** combines comprehensive coverage, smart personalization, and zero-friction access

### **3.2 Product Principles**

1. **Radical Simplicity:** Every feature must pass the "3-second rule" i.e can a student understand and use it in 3 seconds?  
2. **No Login Walls:** Core discovery must work without authentication  
3. **Mobile-First Reality:** 85% of student browsing happens on phones  
4. **Trust Through Accuracy:** One bad recommendation destroys credibility  
5. **Respect Time:** Students are busy \-\> optimize for speed over features

### **3.3 North Star Metric**

**Primary:** Weekly Active Users (WAU) / Total Registered Users  
**Why:** Engagement frequency indicates product stickiness and value

**Supporting Metrics:**

* Events viewed per session (depth of engagement)  
* Saved events per user (intent to attend)  
* Email open rate (reminder effectiveness)  
* Recommendation click-through rate (relevance)

---

## **4\. USER PERSONAS**

### **Persona 1: "The Connector" \- Emma, 2nd Year Arts**

**Demographics:**

* 19 years old, lives in residence  
* Member of 4 clubs: Debate, Environmental Action, Film Society, Model UN  
* Checks Instagram 8-10 times daily

**Goals:**

* Attend 3-5 events per week  
* Meet people with similar interests  
* Build resume through involvement

**Frustrations:**

* Misses smaller events from niche clubs  
* Forgets about events she planned to attend  
* Instagram algorithm hides posts from clubs she follows

**Usage Pattern:**

* Browses events Sunday evening to plan week  
* Checks calendar daily for updates  
* Saves 5-8 events per week, attends 3-4

**Quote:** *"I follow all these clubs but their posts just disappear in my feed. I find out about cool events after they've already happened."*

### **Persona 2: "The Explorer" \- James, 1st Year Engineering**

**Demographics:**

* 18 years old, new to Montreal  
* Joined 2 clubs: Robotics, Intramural Soccer  
* Wants to explore but feels overwhelmed

**Goals:**

* Find communities aligned with interests  
* Reduce social anxiety through structured events  
* Balance academics with social life

**Frustrations:**

* Doesn't know what clubs exist  
* Misses opportunities due to lack of network  
* Uncertain which events are "worth it"

**Usage Pattern:**

* Browses recommendations 2-3 times per week  
* Filters by "beginner-friendly" and "free" tags  
* Saves events but needs reminders to attend

**Quote:** *"Everyone else seems to know about events. I feel like I'm always finding out too late."*

### **Persona 3: "The Organizer" \- Sarah, 3rd Year, Club President**

**Demographics:**

* 21 years old, president of Medium-Sized Cultural Club (150 members)  
* Spends 10+ hours weekly on club management  
* Frustrated with current promotion tools

**Goals:**

* Increase event turnout from 20% to 40%  
* Reach students outside immediate network  
* Reduce time spent on marketing

**Frustrations:**

* Instagram posts reach \<15% of followers  
* No analytics on event interest  
* Competes with 250+ other clubs for attention

**Usage Pattern (Future):**

* Submits events once to reach entire student body  
* Checks analytics to understand audience  
* Uses tags to target specific student interests

**Quote:** *"We work so hard on our events but half our members don't even see our posts. It's exhausting to promote everywhere."*

---

## 

## **5\. MVP SCOPE & REQUIREMENTS**

### **5.1 Scope Philosophy**

The MVP focuses on solving the core problem, event discovery, with minimal viable quality. Features are prioritized by:

1. **Impact on discovery friction**  
2. **Technical feasibility within 3-month timeline**  
3. **Dependency relationships**

**MVP Boundaries:**

* ✅ **In Scope:** Browse, discover, save, remind  
* ❌ **Out of Scope:** Social features, reviews, club analytics, push notifications

### **5.2 User Stories (Prioritized)**

#### **Epic 1: Event Discovery (P0 \- Must Have)**

**US-1.1:** As a student, I want to see all upcoming campus events in one place, so I can quickly scan what's happening this week.

* **Acceptance Criteria:**  
  * Calendar displays minimum 50 events at launch  
  * Events load within 2 seconds on 4G connection  
  * Events sorted chronologically by default  
  * Each event card shows: title, date, time, location, club name, image

**US-1.2:** As a user, I want to filter events by category (academic, social, sports, career, cultural, wellness), so I can find events matching my interests.

* **Acceptance Criteria:**  
  * Filter UI clearly visible above event list  
  * Multiple filters can be applied simultaneously  
  * Filter updates calendar instantly (no page reload)  
  * Clear indication of active filters with count  
  * "Clear all filters" option available

**US-1.3:** As a user, I want to search events by keyword, so I can find specific topics or clubs.

* **Acceptance Criteria:**  
  * Search bar prominent in navigation  
  * Search covers event titles, descriptions, club names, tags  
  * Results update as user types (debounced)  
  * Minimum 3 characters to trigger search  
  * "No results" state with suggestion to check spelling

#### **Epic 2: Event Details (P0 \- Must Have)**

**US-2.1:** As a student, I want to click an event to see full details, so I can decide if I should attend.

* **Acceptance Criteria:**  
  * Event detail page loads from calendar click  
  * Displays: full description, date/time, location (with map link), organizer info, tags, contact email  
  * Back button returns to calendar with scroll position preserved  
  * Responsive design works on mobile and desktop

**US-2.2:** As a user, I want to see a location link for each event, so I can easily navigate to the venue.

* **Acceptance Criteria:**  
  * Location displays as clickable link  
  * Opens Google Maps with location pin  
  * Works on both mobile and desktop browsers

#### **Epic 3: Personalization (P0 \- Must Have)**

**US-3.1:** As a first-time visitor, I want to see recommended events based on my indicated interests, so I can quickly discover relevant opportunities without browsing everything.

* **Acceptance Criteria:**  
  * During first visit, user selects 3-5 interest tags  
  * Recommendation feed shows 10-15 events  
  * Mix of popular events \+ interest-matched events  
  * Updates when user changes preferences

**US-3.2:** As a returning user, I want recommendations to improve based on events I save, so the platform learns what I like.

* **Acceptance Criteria:**  
  * Saved events influence future recommendations  
  * Tags from saved events increase weight of similar events  
  * Minimum 3 saved events required for personalized feed  
  * Users with \<3 saved events see popular/trending events

#### **Epic 4: Authentication (P1 \- Should Have)**

**US-4.1:** As a student, I want to log in with my McGill email, so I can access personalized features.

* **Acceptance Criteria:**  
  * "Sign in with McGill" button uses Microsoft OAuth  
  * Only @mcgill.ca and @mail.mcgill.ca emails accepted  
  * Session persists across browser sessions  
  * Clear "You're logged in as \[email\]" indicator

**US-4.2:** As a guest user, I want to browse all events without creating an account, so I can try the platform before committing.

* **Acceptance Criteria:**  
  * Full calendar accessible without login  
  * Guest users see banner: "Sign in to save events and get recommendations"  
  * No features broken for guest users except save/remind

#### **Epic 5: Event Management (P1 \- Should Have)**

**US-5.1:** As a logged-in user, I want to save events I'm interested in, so I can reference them later.

* **Acceptance Criteria:**  
  * "Save" button visible on event cards and detail pages  
  * Saved events display in "My Events" page  
  * Visual indicator shows saved status  
  * Can unsave from calendar or My Events page

**US-5.2:** As a user, I want to receive email reminders for saved events, so I don't forget to attend.

* **Acceptance Criteria:**  
  * Reminder sent 24 hours before event  
  * Reminder sent 1 hour before event  
  * Email includes: event title, time, location, link to details  
  * User can opt out of reminders in settings  
  * Reminders stop if event is unsaved

#### **Epic 6: Event Ingestion (P0 \- Must Have, Dev-Facing)**

**US-6.1:** As a developer, I want to scrape events from club Instagram accounts, so we have comprehensive event coverage without manual entry.

* **Acceptance Criteria:**  
  * Apify scraper runs daily at 6 AM  
  * Targets 20-30 major club accounts  
  * Extracts: image, caption, date, time, location  
  * Stores in Supabase "pending\_events" table  
  * Flags posts without clear event data

**US-6.2:** As a developer, I want to manually add and edit events through an admin interface, so we can ensure data quality.

* **Acceptance Criteria:**  
  * Admin dashboard accessible only to dev team  
  * Form includes all event fields with validation  
  * Can approve/reject scraped events  
  * Can edit any event field  
  * Changes reflect immediately on public calendar

### **5.3 Functional Requirements**

#### **FR-1: Calendar System**

**FR-1.1 Event Display**

* **Description:** Master calendar shows all upcoming events in chronological order  
* **Inputs:** Query parameters for filters, search, date range  
* **Outputs:** Rendered grid of event cards (desktop: 3 columns, mobile: 1 column)  
* **Business Rules:**  
  * Events default to "upcoming" (now → 30 days future)  
  * Past events hidden unless user explicitly requests  
  * Maximum 100 events loaded initially, infinite scroll for more  
* **Error Handling:**  
  * Missing event data: Show fallback card with "Details pending"  
  * Missing images: Use club logo or default Uni-Verse graphic  
  * Database timeout: Show cached version with "Data may be outdated" warning  
* **Performance:** Initial load \<2s on 4G, filter updates \<500ms

**FR-1.2 Filtering**

* **Description:** Users filter by category tags, date range, time of day  
* **Inputs:** Selected filter values  
* **Outputs:** Filtered event subset matching all selected criteria  
* **Business Rules:**  
  * Filters use AND logic (all must match)  
  * Filter state persists in URL for sharing  
  * "Active filters" badge shows count  
* **Edge Cases:**  
  * No results: Display suggestion to broaden filters  
  * Single filter result: Show related events below

**FR-1.3 Search**

* **Description:** Keyword search across event titles, descriptions, clubs, tags  
* **Inputs:** Search string (min 3 characters)  
* **Outputs:** Ranked results based on relevance  
* **Business Rules:**  
  * Search uses fuzzy matching (Levenshtein distance ≤2)  
  * Prioritizes: title match \> club match \> tag match \> description match  
  * Debounced to reduce API calls (300ms delay)  
* **Performance:** Results returned within 400ms

#### **FR-2: Recommendation Engine**

**FR-2.1 Interest-Based Recommendations**

* **Description:** Show personalized event recommendations based on user preferences  
* **Inputs:** User interest tags, saved event history, interaction data  
* **Outputs:** Ranked list of 10-15 recommended events

**Algorithm (MVP):**  
1\. Extract tags from user's saved events  
2\. Calculate tag frequency scores  
3\. For each upcoming event:     
\- Score \= Σ(tag\_weight \* tag\_match)     
\- Boost if popular (\>10 saves)     
\- Penalize if user previously dismissed  
4\. Return top 15 scores

* **Business Rules:**  
  * New users (no saves) see "Popular This Week" instead  
  * Recommendations refresh daily at midnight  
  * Never recommend past events  
* **Error Handling:**  
  * If algorithm fails, fall back to chronological order  
  * Log failures for analysis

**FR-2.2 Cold Start Strategy**

* **Description:** Handle users with no interaction history  
* **Inputs:** Interest tags from onboarding flow  
* **Outputs:** Curated events matching selected interests  
* **Business Rules:**  
  * Minimum 5 events per selected interest tag  
  * Balance across different event types  
  * Prioritize events happening within 7 days

#### **FR-3: Authentication System**

**FR-3.1 McGill OAuth Integration**

* **Description:** Single Sign-On using Microsoft Azure AD  
* **Inputs:** User click on "Sign in with McGill"  
* **Outputs:** Authenticated session with user email and name  
* **Flow:**  
  * Redirect to Microsoft OAuth (mcgill.ca tenant)  
  * User approves permissions: email, name, profile  
  * Callback returns authorization code  
  * Exchange code for access token  
  * Store user in Supabase, create session  
  * Redirect to previous page or home  
* **Security:**  
  * Only @mcgill.ca and @mail.mcgill.ca domains allowed  
  * Session expires after 30 days  
  * CSRF protection via state parameter  
  * Tokens stored in httpOnly cookies

**FR-3.2 Guest Access**

* **Description:** Full calendar browsing without authentication  
* **Inputs:** None (default state)  
* **Outputs:** Complete calendar with banner prompting sign-in  
* **Limitations:**  
  * Cannot save events  
  * Cannot access recommendations  
  * Cannot receive reminders  
* **UX:** Soft prompt to sign in, never blocking

#### **FR-4: Event Management**

**FR-4.1 Save Events**

* **Description:** Logged-in users bookmark events for later  
* **Inputs:** User click on "Save" button, user ID, event ID  
* **Outputs:** Event added to user's "My Events" list  
* **Database:** Insert into user\_saved\_events(user\_id, event\_id, saved\_at)  
* **UI Feedback:**  
  * Button changes to "Saved" with checkmark  
  * Toast notification: "Event saved\!"  
  * Unsave with single click

**FR-4.2 My Events Page**

* **Description:** Dashboard of user's saved events  
* **Inputs:** User authentication  
* **Outputs:** List of saved events sorted by event date  
* **Features:**  
  * Tabs: Upcoming | Past  
  * Quick unsave option  
  * Link to export to Google Calendar (future)  
* **Empty State:** "No saved events yet. Browse the calendar to get started."

#### **FR-5: Notification System**

**FR-5.1 Email Reminders**

* **Description:** Automated emails before saved events  
* **Inputs:** User saved events, current time  
* **Trigger Logic:**  
  * Scheduled job runs every hour  
  * Identifies events 24h away AND 1h away  
  * Sends reminder if not already sent  
* **Email Content:**  
  * Subject: "Reminder: \[Event Title\] is tomorrow/in 1 hour"  
  * Body: Event details, location link, "Open in Uni-Verse" button  
  * Footer: Opt-out link  
* **Business Rules:**  
  * Skip if user opted out  
  * Skip if event was unsaved  
  * Maximum 2 reminders per event  
* **Delivery:** SendGrid or Supabase Edge Functions  
* **Tracking:** Log sent status to prevent duplicates

#### **FR-6: Event Ingestion Pipeline**

**FR-6.1 Instagram Scraping**

* **Description:** Automated scraping of club Instagram accounts  
* **Tool:** Apify Instagram Post Scraper  
* **Schedule:** Daily at 6:00 AM EST  
* **Target Accounts:** 20-30 major McGill clubs (manually curated list)  
* **Extraction Logic:**  
  * Filter posts from last 7 days  
  * Extract: image URL, caption, post date  
  * Parse caption for: date, time, location using regex patterns  
  * Assign confidence score (high/medium/low)  
* **Output:** Insert into pending\_events table with raw data  
* **Error Handling:**  
  * Log scraping failures per account  
  * Continue if individual account fails  
  * Alert dev team if \>30% of accounts fail

**FR-6.2 Manual Event Creation**

* **Description:** Admin interface for dev team to add events  
* **Access:** Protected route, requires admin role in database  
* **Form Fields:**  
  * Title (required, max 100 chars)  
  * Description (required, max 1000 chars)  
  * Date (required, future dates only)  
  * Time (required)  
  * Location (required, with suggested autocomplete)  
  * Club/Organizer (required, searchable dropdown)  
  * Tags (required, minimum 1, maximum 5\)  
  * Image URL (optional, with upload capability)  
  * Contact Email (required, validated)  
* **Validation:**  
  * Date cannot be in the past  
  * Time format: HH:MM AM/PM  
  * Image URL must be valid or empty  
  * Email must be valid format  
* **Submission:** Directly inserts into events table (bypasses pending)

**FR-6.3 Event Approval Workflow**

* **Description:** Review and approve scraped events before publication  
* **Interface:** Admin dashboard with pending events queue  
* **Display:** Show original Instagram post \+ extracted data side-by-side  
* **Actions:**  
  * Approve: Move to events table  
  * Edit: Modify fields before approval  
  * Reject: Mark as non-event, train future scraping  
* **Business Rules:**  
  * Events must be approved within 24 hours of scraping  
  * Auto-approve if confidence score \>0.9 (future enhancement)

### **5.4 Non-Functional Requirements**

#### **NFR-1: Performance**

| Metric | Target | Measurement Method |
| ----- | ----- | ----- |
| Calendar initial load | \<2s on 4G | Lighthouse Performance Score \>90 |
| Filter response time | \<500ms | Client-side timing logs |
| Search results | \<400ms | API response time monitoring |
| Event detail page | \<1.5s | Server response \+ rendering time |
| Recommendation generation | \<800ms | Background job timing |
| Database queries | \<200ms | Supabase slow query log |

**Optimization Strategies:**

* Image lazy loading and compression  
* Database indexing on event date, tags, club\_id  
* CDN for static assets  
* Query result caching (5-minute TTL for calendar)  
* Pagination for event lists

#### **NFR-2: Scalability**

**Expected Load (MVP):**

* 100 concurrent users  
* 500 events in database  
* 1,000 page views per day  
* 50 API requests per minute

**Scaling Strategy:**

* Supabase auto-scales database connections  
* Vercel Edge Functions handle API load  
* Rate limiting: 100 requests per IP per minute  
* Image CDN prevents bandwidth bottlenecks

**Future Considerations (Post-MVP):**

* Horizontal scaling with load balancer  
* Database read replicas  
* Redis caching layer  
* CDN for API responses

#### **NFR-3: Security**

**Authentication:**

* OAuth 2.0 with PKCE flow  
* JWT tokens with 30-day expiry  
* Refresh token rotation  
* httpOnly, secure, sameSite cookies

**Authorization:**

* Row-level security in Supabase  
* Admin endpoints require admin role check  
* User can only modify own saved events  
* API endpoints validate user session

**Data Protection:**

* All connections use HTTPS/TLS 1.3  
* Passwords never stored (OAuth only)  
* PII limited to email and name  
* HTML sanitization for user-generated content  
* XSS protection via Content Security Policy

**Compliance:**

* No data sold to third parties  
* User data deletion on request  
* GDPR-compliant data retention (2 years)

#### **NFR-4: Reliability**

**Uptime Target:** 99.5% (excluding planned maintenance)

* Maximum 3.6 hours downtime per month  
* Planned maintenance only on weekends 12-2 AM

**Monitoring:**

* Uptime checks every 60 seconds (UptimeRobot)  
* Error tracking (Sentry or Supabase logs)  
* Performance monitoring (Vercel Analytics)  
* Email alerts for \>5 min downtime

**Backup & Recovery:**

* Supabase automatic daily backups  
* Database can restore to any point in last 7 days  
* Manual backup before major deployments  
* Recovery Time Objective (RTO): 2 hours  
* Recovery Point Objective (RPO): 24 hours

**Graceful Degradation:**

* If scraping fails, calendar still shows existing events  
* If recommendations fail, show popular events  
* If database is slow, show cached version with warning  
* Never block core browsing functionality

#### **NFR-5: Usability**

**Accessibility (WCAG 2.1 AA Compliance):**

* Keyboard navigation for all actions  
* Screen reader compatibility  
* Color contrast ratio ≥4.5:1 for text  
* Alt text for all images  
* Focus indicators visible  
* Form labels and error messages clear

**Mobile Responsiveness:**

* All pages work on screens 320px \- 1920px wide  
* Touch targets minimum 44x44px  
* No horizontal scrolling  
* Optimized for one-handed use  
* Bottom navigation on mobile

**Browser Support:**

* Chrome, Firefox, Safari (last 2 versions)  
* Mobile Safari, Chrome Mobile (last 2 versions)  
* No IE support

**Load Time Perception:**

* Skeleton screens while loading  
* Optimistic UI updates  
* Progress indicators for \>1s operations  
* Instant feedback for user actions

#### **NFR-6: Maintainability**

**Code Quality:**

* TypeScript for type safety  
* ESLint \+ Prettier for consistency  
* Minimum 60% code coverage for critical paths  
* JSDoc comments for complex functions

**Documentation:**

* README with setup instructions  
* API documentation (Swagger/OpenAPI)  
* Architecture decision records (ADRs)  
* Inline comments for complex logic

**Deployment:**

* Automated CI/CD via Vercel/GitHub Actions  
* Preview deployments for all PRs  
* Production deploys only from main branch  
* Rollback capability within 5 minutes

**Monitoring:**

* Logging all errors with context  
* Performance metrics dashboard  
* User behavior analytics (privacy-respecting)  
* Weekly reports on key metrics

---

## **6\. TECHNICAL ARCHITECTURE**

### **6.1 Technology Stack**

**Frontend:**

* **Framework:** Next.js 14 (App Router)  
* **Language:** TypeScript  
* **Styling:** Tailwind CSS  
* **State Management:** React Context \+ SWR for data fetching  
* **UI Components:** shadcn/ui (Radix \+ Tailwind)  
* **Hosting:** Vercel

**Backend:**

* **Database:** Supabase (PostgreSQL)  
* **API:** Next.js API Routes \+ Supabase Edge Functions  
* **Authentication:** Supabase Auth \+ Microsoft OAuth  
* **File Storage:** Supabase Storage (event images)

**Integrations:**

* **Scraping:** Apify (Instagram Post Scraper)  
* **Email:** Supabase SMTP  
* **Analytics:** Vercel Analytics \+ Posthog  
* **Monitoring:** Sentry (error tracking)

**Development Tools:**

* **Version Control:** GitHub  
* **Project Management:** GitHub Projects  
* **Design:** Figma  
* **Documentation:** Notion

### 

### **6.2 System Architecture Diagram**

![][image1]![][image2]

### 

### **6.3 Database Schema**

**Refer to Notion Document**

### **6.4 API Endpoints**

**Refer to Notion Document**

### **6.5 Data Flow Diagrams**

**Event Discovery Flow:**

User → Browse Calendar Page → API: GET /api/events?date\_start=today  
     → Supabase: Query events table with filters  
     → Return events array  
     → Frontend: Render event cards  
     → User clicks event  
     → Navigate to /events/:id  
     → API: GET /api/events/:id  
     → Return event details \+ club info  
     → Render event detail page

**Save Event Flow:**

Logged-in User → Click "Save" button → API: POST /api/events/:id/save  
              → Verify user session  
              → Supabase: INSERT into user\_saved\_events  
              → Schedule email reminders in background  
              → Return success  
              → Frontend: Update UI to "Saved" state

**Instagram Scraping Flow:**

Cron Job (6 AM) → Trigger Apify scraper with club account list  
                → Apify: Fetch posts from last 7 days  
                → For each post:  
                  → Extract: image, caption, date  
                  → Parse caption with regex for event details  
                  → Calculate confidence score  
                  → API: POST /api/admin/pending-events  
                  → Supabase: INSERT into pending\_events  
                → Admin reviews queue daily  
                → Approve/Edit/Reject  
                → Approved events → events table

**Recommendation Generation Flow:**

User loads homepage → API: GET /api/recommendations?user\_id=X  
                   → Fetch user's interest\_tags from users table  
                   → Fetch user's saved events from user\_saved\_events  
                   → Extract tags from saved events  
                   → Calculate tag frequency weights  
                   → Query events with matching tags  
                   → Score each event: Σ(tag\_weight × tag\_match)  
                   → Boost popular events (\>10 saves)  
                   → Return top 15 scored events  
                   → Frontend: Render recommendation feed

### **6.6 Third-Party Integrations**

**Microsoft OAuth (McGill Authentication):**

* **Purpose:** Student authentication  
* **Configuration:**  
  * Client ID: Registered in Azure AD  
  * Redirect URI: https://uni-verse.app/auth/callback  
  * Scopes: openid, email, profile  
  * Tenant: McGill University tenant ID  
* **Cost:** Free (educational tenant)

**Apify (Instagram Scraping):**

* **Purpose:** Automated event ingestion from Instagram  
* **Actor:** Instagram Post Scraper  
* **Configuration:**  
  * Input: Array of Instagram usernames  
  * Filters: Posts from last 7 days only  
  * Output: JSON with post data  
* **Cost:** $49/month for 100 scraper runs (estimated MVP usage: 30 runs/month)  
* **Rate Limits:** 100 actor runs per month on Starter plan

**SendGrid (Email Delivery):**

* **Purpose:** Event reminder emails  
* **Configuration:**  
  * From: reminders@uni-verse.app  
  * Templates: 24h reminder, 1h reminder  
  * Unsubscribe link in footer  
* **Cost:** Free tier (100 emails/day) sufficient for MVP  
* **Fallback:** Supabase SMTP if SendGrid fails

**Vercel (Hosting):**

* **Purpose:** Frontend and API hosting  
* **Configuration:**  
  * Auto-deploys from GitHub main branch  
  * Preview deployments for PRs  
  * Edge Functions for API routes  
* **Cost:** Free tier (Hobby plan) sufficient for MVP

**Supabase (Backend):**

* **Purpose:** Database, auth, storage  
* **Configuration:**  
  * Database: PostgreSQL 15  
  * Storage: Event images (max 5MB each)  
  * Edge Functions: Background jobs  
* **Cost:** Free tier (500MB database, 1GB bandwidth) → $25/month if exceeded

### **6.7 Security Architecture**

**Authentication Flow:**

User → Click "Sign in with McGill"  
    → Redirect to Microsoft OAuth consent page  
    → User approves (email, name permissions)  
    → Redirect to /auth/callback?code=XXX\&state=YYY  
    → Verify state parameter (CSRF protection)  
    → Exchange code for access\_token  
    → Fetch user profile from Microsoft Graph API  
    → Check email domain is @mcgill.ca or @mail.mcgill.ca  
    → Create/update user in Supabase Auth  
    → Generate session token (JWT)  
    → Set httpOnly, secure, sameSite=strict cookie  
    → Redirect to homepage (logged in)

**Authorization Rules (Supabase RLS):**

\-- Users can only read their own data  
CREATE POLICY "Users can view own profile"  
  ON users FOR SELECT  
  USING (auth.uid() \= id);

\-- Users can only modify their own saved events  
CREATE POLICY "Users can manage own saved events"  
  ON user\_saved\_events FOR ALL  
  USING (auth.uid() \= user\_id);

\-- Events are publicly readable  
CREATE POLICY "Events are public"  
  ON events FOR SELECT  
  USING (is\_published \= true);

\-- Only admins can create/edit events  
CREATE POLICY "Admins can manage events"  
  ON events FOR ALL  
  USING (  
    auth.uid() IN (SELECT id FROM users WHERE role \= 'admin')  
  );

**Data Sanitization:**

* All user inputs sanitized with DOMPurify  
* SQL injection prevented by parameterized queries (Supabase handles)  
* HTML/JavaScript stripped from event descriptions  
* Image URLs validated before storage

**Rate Limiting:**

// Per-IP rate limits (using Vercel Edge Middleware)  
const rateLimits \= {  
  '/api/events': { requests: 100, window: '1m' },  
  '/api/recommendations': { requests: 20, window: '1m' },  
  '/api/events/:id/save': { requests: 10, window: '1m' }  
};

---

## **7\. MILESTONES & ROADMAP**

### **7.1 Development Phases**

#### **Phase 0: Foundation (Weeks 1-2) — December 2025**

**Goals:**

* Set up development environment  
* Design database schema  
* Create design system in Figma

**Deliverables:**

* GitHub repo with Next.js boilerplate  
* Supabase project configured  
* Database tables created with RLS policies  
* Figma mockups for 5 core screens  
* Technical architecture documented

**Success Criteria:**

* Dev environment runs locally for all team members  
* Database migrations executable  
* Design approved by stakeholders

#### **Phase 1: MVP Core (Weeks 3-6) — January 2026**

**Goals:**

* Build calendar and event detail pages  
* Implement Instagram scraping pipeline  
* Create admin panel for event management

**Deliverables:**

* Calendar view with filtering and search  
* Event detail page with full information  
* Apify scraper running daily  
* Admin dashboard for event approval  
* Manual event creation form

**Success Criteria:**

* Calendar displays 50+ real McGill events  
* Scraper successfully parses 70% of club posts  
* Admin can add event in \<2 minutes  
* All pages mobile-responsive

#### **Phase 2: Personalization (Weeks 7-9) — Early February 2026**

**Goals:**

* Implement McGill OAuth login  
* Build recommendation engine  
* Create "My Events" page

**Deliverables:**

* Microsoft OAuth integration  
* Interest tag selection onboarding  
* Recommendation algorithm v1  
* Saved events functionality  
* User preference settings

**Success Criteria:**

* Login works for all McGill emails  
* Recommendations differ based on user tags  
* Users can save/unsave events  
* Preference changes reflect in recommendations

#### **Phase 3: Notifications & Polish (Weeks 10-12) — Late February 2026**

**Goals:**

* Launch email reminder system  
* Optimize performance  
* Beta testing with 100 students

**Deliverables:**

* Email reminder scheduler (24h \+ 1h)  
* Performance optimizations (lazy loading, caching)  
* Bug fixes from internal testing  
* Analytics integration  
* Privacy policy and terms of service

**Success Criteria:**

* Email reminders send reliably  
* Calendar loads in \<2s on mobile  
* Zero critical bugs in beta testing  
* 100 students onboarded

**Beta Launch:** February 24, 2026

#### **Phase 4: Growth & Iteration (Weeks 13-20) — March-April 2026**

**Goals:**

* Scale to 500 users  
* Improve recommendation accuracy  
* Launch club submission portal

**Deliverables:**

* Club self-service event submission form  
* Recommendation algorithm v2 (collaborative filtering)  
* Enhanced search with fuzzy matching  
* User feedback system  
* Marketing push with clubs and associations

**Success Criteria:**

* 500 weekly active users  
* 20+ clubs actively submitting events  
* 70% of users interact with 3+ events  
* Recommendation CTR \>15%

#### **Phase 5: Maturity (Summer 2026\)**

**Goals:**

* Establish Uni-Verse as default event platform  
* Add social features  
* Build club analytics

**Deliverables:**

* Event reviews and ratings  
* Friend system and shared calendars  
* Club dashboard with attendance analytics  
* Push notifications (progressive web app)  
* Moderation tools

**Success Criteria:**

* 2,000+ weekly active users  
* 50+ clubs onboarded  
* 80% of users prefer Uni-Verse over Instagram for events  
* Sustainable operation with minimal dev maintenance

### **7.2 Release Strategy**

**MVP Beta (Feb 2026):**

* Invitation-only for 100 students  
* Focus groups: First-years, club presidents, engaged upperclassmen  
* Weekly feedback sessions  
* Rapid iteration on critical bugs

**Public Launch (March 2026):**

* Open to all McGill students  
* Marketing: Club partnerships, campus posters, social media  
* Press release to McGill Tribune and Daily  
* Onboarding webinars for club executives

**Growth Phase (April-May 2026):**

* Referral program for early adopters  
* Integration with club fairs and orientation  
* Feature announcements via email newsletter  
* Community ambassador program

### **7.3 Risk Mitigation Timeline**

| Risk | Mitigation Plan | Checkpoint |
| ----- | ----- | ----- |
| Low initial adoption | Pre-launch partnerships with 5 major clubs | Week 8 |
| Instagram scraping breaks | Manual submission portal as backup | Week 6 |
| Poor recommendation quality | Fall back to popularity-based ranking | Week 9 |
| Performance issues at scale | Load testing with 1000 simulated users | Week 11 |
| Team velocity drops | Task breakdown into \<4 hour units | Ongoing |

---

## **8\. SUCCESS METRICS & KPIs**

### **8.1 North Star Metric**

**Weekly Active Users (WAU) / Total Registered Users**

This ratio measures true product stickiness and value. A high percentage indicates students find Uni-Verse essential to their campus life.

**Targets:**

* MVP (Feb 2026): 40% weekly active rate (40 of 100 users)  
* Phase 1 (Apr 2026): 50% weekly active rate (250 of 500 users)  
* Phase 2 (Summer 2026): 60% weekly active rate (1,200 of 2,000 users)

### **8.2 Primary KPIs**

**Engagement Metrics:**

| Metric | MVP Target | Phase 1 Target | Phase 2 Target | Measurement |
| ----- | ----- | ----- | ----- | ----- |
| Events viewed per session | 5 events | 7 events | 10 events | Analytics |
| Saved events per user | 3 events | 5 events | 8 events | Database query |
| Recommendation CTR | 10% | 15% | 20% | Click tracking |
| Return visit rate (7-day) | 30% | 45% | 60% | User tracking |

**Platform Health:**

| Metric | MVP Target | Phase 1 Target | Phase 2 Target | Measurement |
| ----- | ----- | ----- | ----- | ----- |
| Calendar load time | \<2s (4G) | \<1.5s | \<1s | Lighthouse |
| API error rate | \<2% | \<1% | \<0.5% | Error logs |
| Email delivery rate | \>95% | \>97% | \>98% | SendGrid |
| Database query time | \<200ms avg | \<150ms avg | \<100ms avg | Monitoring |

**Content Metrics:**

| Metric | MVP Target | Phase 1 Target | Phase 2 Target | Measurement |
| ----- | ----- | ----- | ----- | ----- |
| Events in database | 50 events | 200 events | 500 events | Database count |
| Events per week | 10 new events | 40 new events | 100 new events | Weekly uploads |
| Clubs onboarded | 10 clubs | 20 clubs | 50 clubs | Club table |
| Scraping success rate | 60% | 75% | 85% | Scraper logs |

### **8.3 Secondary Metrics**

**User Satisfaction:**

* Net Promoter Score (NPS): Target \>50  
* Feature satisfaction survey: Target \>4.0/5.0  
* Support ticket volume: Target \<5 per week

**Business Impact:**

* Event attendance increase: Target 20% (reported by clubs)  
* Student engagement scores: Track via McGill surveys  
* Club marketing efficiency: Hours saved per event promotion

### **8.4 Measurement Infrastructure**

**Analytics Stack:**

* **Vercel Analytics:** Page views, load times, Core Web Vitals  
* **PostHog:** User behavior tracking, funnels, retention cohorts  
* **Supabase:** Custom queries for database metrics  
* **Sentry:** Error tracking and performance monitoring

**Dashboards:**

1. **Real-Time Dashboard:** Active users, events viewed, API health  
2. **Weekly Dashboard:** WAU, engagement metrics, content growth  
3. **Monthly Dashboard:** Retention cohorts, NPS, goal progress

**Reporting Cadence:**

* Daily: Check error rates and uptime  
* Weekly: Team standup with metrics review  
* Monthly: Stakeholder report with progress vs. targets  
* Quarterly: Strategic review and goal adjustment

### **8.5 A/B Testing Plan (Post-MVP)**

**Hypotheses to Test:**

| Hypothesis | Metric | Test Duration |
| ----- | ----- | ----- |
| Showing event images increases saves by 20% | Save rate | 2 weeks |
| Personalizing event cards improves CTR by 15% | Click-through rate | 2 weeks |
| Email reminders 6h before (vs. 1h) improve attendance | Email engagement | 4 weeks |
| Recommendation carousel (vs. list) increases interaction | Interaction rate | 2 weeks |

---

## **9\. GO-TO-MARKET STRATEGY**

### **9.1 Pre-Launch (January 2026\)**

**Objective:** Build anticipation and secure club partnerships

**Tactics:**

1. **Club Partnership Program:**

   * Identify 10 major clubs (SSMU, EUS, AUS, cultural clubs)  
   * Pitch Uni-Verse as solution to low event turnout  
   * Offer exclusive early access for event submissions  
   * Co-create launch event calendar  
2. **Student Ambassador Recruitment:**

   * Recruit 10 engaged students across faculties  
   * Provide early access and training  
   * Incentivize with "Founding Member" recognition  
   * Task: Each recruit 10 peers for beta  
3. **Social Media Teaser Campaign:**

   * Create @universeapp Instagram account  
   * Post countdowns, sneak peeks, problem-highlighting content  
   * Run poll: "How do you currently find campus events?"  
   * Build waitlist landing page

### **9.2 Beta Launch (February 2026\)**

**Objective:** Validate product with 100 core users

**Tactics:**

1. **Invitation Campaign:**

   * Email invitations to ambassadors and club leaders  
   * Instagram stories with signup link  
   * Tabling at key campus locations  
   * QR codes on posters in high-traffic areas  
2. **Feedback Loop:**

   * Weekly surveys to beta users  
   * In-app feedback widget  
   * Focus groups with 3 user types (first-years, club leaders, engaged students)  
   * Rapid iteration on pain points  
3. **Content Strategy:**

   * Ensure 50+ high-quality events at launch  
   * Daily posts highlighting featured events  
   * User testimonials: "How I found my community"

### **9.3 Public Launch (March 2026\)**

**Objective:** Scale to 500 users and establish credibility

**Tactics:**

1. **Campus Media Blitz:**

   * Press release to McGill Tribune, McGill Daily  
   * Interview with Résonance (French student radio)  
   * Student blog features  
   * McGill subreddit announcement  
2. **Club Ecosystem Integration:**

   * Webinar: "How to Promote Your Events on Uni-Verse"  
   * Email all 250+ clubs with onboarding guide  
   * Sponsor 5 high-profile events with Uni-Verse branding  
   * Create "Powered by Uni-Verse" badge for posters  
3. **Student Association Partnerships:**

   * SSMU newsletter feature  
   * Faculty association endorsements  
   * Integration with Frosh programming (Fall 2026 prep)  
4. **Referral Program:**

   * Users get "VIP" badge for referring 5 friends  
   * Top referrer wins prize (McGill merch bundle)

### **9.4 Growth & Retention (April-August 2026\)**

**Objective:** Achieve 2,000 WAU and 60% weekly engagement

**Tactics:**

1. **Habit Formation:**

   * "Events This Week" email every Monday  
   * Push notifications for saved events (PWA)  
   * Weekly digest of personalized recommendations  
2. **Community Building:**

   * Feature "Event of the Week"  
   * Spotlight underrated clubs  
   * User-generated content: "My Uni-Verse Story"  
3. **Network Effects:**

   * "Friends also saved" social proof  
   * Shared calendars feature  
   * Event attendee meetup coordination  
4. **Viral Mechanisms:**

   * Shareable event cards for Instagram stories  
   * "I'm going to \[event\]" story templates  
   * Referral incentives continue

### **9.5 Marketing Budget (MVP Phase)**

| Item | Cost | Purpose |
| ----- | ----- | ----- |
| Instagram ads | $200 | Beta signup campaign |
| Campus posters/flyers | $150 | Physical awareness |
| Launch event sponsorship | $300 | Credibility and buzz |
| Referral prizes | $200 | User acquisition |
| Club partnership incentives | $150 | Content supply |
| **Total** | **$1,000** |  |

---

## **10\. TEAM & RESOURCES**

### **10.1 Core Team**

**Adyan Ullah — Product Owner & Project Lead**

* Responsibilities: Vision, roadmap, stakeholder management, PRD, user research  
* Time Commitment: 8-10 hours/week  
* Key Deliverables: This PRD, Go-to-market strategy, Beta recruitment

**George Kontorousis — Technical Lead**

* Responsibilities: Architecture, backend development, DevOps, code reviews  
* Time Commitment: 10-12 hours/week  
* Key Deliverables: Database design, API development, Deployment pipeline

**\[Frontend Developer\]** — TBD

* Responsibilities: UI implementation, responsive design, frontend state management  
* Time Commitment: 8-10 hours/week  
* Key Deliverables: Calendar view, Event pages, Recommendation feed

**\[ML/Data Developer\]** — TBD

* Responsibilities: Recommendation algorithm, scraping pipeline, data quality  
* Time Commitment: 6-8 hours/week  
* Key Deliverables: Recommendation engine, Apify integration, Data normalization

### **10.2 Extended Team (Contributors)**

**Design:** 1 UI/UX Designer (volunteer or design student) **Marketing:** 2-3 GDG members for social media and outreach **Beta Testers:** 10 student ambassadors **Advisors:** GDG mentors, McGill Student Life staff

### **10.3 Development Workflow**

**Sprint Structure:**

* 2-week sprints  
* Sprint planning: Mondays 6-7 PM  
* Daily async standups (Slack)  
* Sprint demos: Fridays 5-6 PM  
* Retros: Every other Friday

**Communication:**

* Slack workspace: \#universe-general, \#universe-dev, \#universe-design  
* Weekly all-hands: Fridays 5 PM  
* GitHub for code and issues  
* Notion for documentation

**Code Standards:**

* Pull request reviews required (2 approvals)  
* CI/CD checks must pass  
* Test coverage for critical paths  
* Documentation for new features

### **10.4 Budget & Resources**

**Development Costs (Monthly):**

| Item | Cost | Notes |
| ----- | ----- | ----- |
| Supabase | $0-$25 | Free tier likely sufficient for MVP |
| Apify | $49 | Starter plan (100 scrapes/month) |
| SendGrid | $0 | Free tier (100 emails/day) |
| Vercel | $0 | Hobby plan sufficient |
| Domain (uni-verse.app) | $1.25 | Annual $15 ÷ 12 |
| Monitoring (Sentry) | $0 | Free tier (5K events/month) |
| **Total** | **$50.25/month** | **$603/year** |

**One-Time Costs:**

* Domain registration: $15/year  
* Design assets (if needed): $0-$100  
* Launch marketing: $1,000

**Total Year 1 Budget: \~$1,700**

**Funding Strategy:**

* GDG on Campus budget: $500  
* McGill Student Life grant: $500 (apply January 2026\)  
* SSMU Innovation Fund: $700 (apply February 2026\)  
* Personal contribution: $0-$200 if needed

---

## **11\. RISKS & MITIGATION**

### **11.1 Technical Risks**

**Risk 1: Instagram Scraping Becomes Unreliable**

* **Likelihood:** Medium (Instagram frequently changes structure)  
* **Impact:** High (primary data source)  
* **Mitigation:**  
  * Build manual event submission portal by Week 6  
  * Diversify sources (Facebook Events API, email parsing)  
  * Partner with clubs for direct data sharing  
  * Maintain 50% manual \+ 50% scraped ratio  
* **Contingency:** If scraping fails completely, pivot to fully manual club submissions with streamlined 30-second form

**Risk 2: Poor Recommendation Algorithm Accuracy**

* **Likelihood:** Medium (ML is hard)  
* **Impact:** Medium (can fallback to popularity)  
* **Mitigation:**  
  * Start with simple tag-based matching  
  * Collect user feedback on recommendations  
  * Iterate algorithm based on CTR data  
  * A/B test improvements before full rollout  
* **Contingency:** Default to "Popular This Week" \+ "Recently Added" if personalization fails

**Risk 3: Performance Degradation at Scale**

* **Likelihood:** Low (modern stack is scalable)  
* **Impact:** High (poor UX kills adoption)  
* **Mitigation:**  
  * Load testing before public launch  
  * Database query optimization and indexing  
  * CDN for images and static assets  
  * Implement caching layer (Redis) if needed  
* **Contingency:** Emergency performance sprint, potentially upgrade Supabase plan

**Risk 4: Security Breach or Data Leak**

* **Likelihood:** Low (using established auth providers)  
* **Impact:** Critical (trust destruction)  
* **Mitigation:**  
  * Regular security audits  
  * Row-level security in Supabase  
  * HTTPS everywhere  
  * Minimal PII collection (only email/name)  
  * Bug bounty program (post-launch)  
* **Contingency:** Incident response plan, immediate user notification, forensic analysis

### **11.2 Product Risks**

**Risk 5: Low User Adoption**

* **Likelihood:** Medium (competitive attention economy)  
* **Impact:** Critical (threatens viability)  
* **Mitigation:**  
  * Pre-launch club partnerships guarantee initial content  
  * Ambassador program seeds initial users  
  * Clear value prop: "Find all events in 30 seconds vs. 10 minutes"  
  * Incentivize early adopters (VIP badges, prizes)  
* **Contingency:** Pivot to club-focused tool (analytics dashboard) if students don't engage

**Risk 6: Clubs Don't Submit Events**

* **Likelihood:** Medium (requires behavior change)  
* **Impact:** High (empty calendar \= no value)  
* **Mitigation:**  
  * Scraping provides baseline content  
  * Make submission \<2 minutes with pre-filled fields  
  * Show clubs their event reach analytics  
  * Partner with SSMU to mandate Uni-Verse for funded events  
* **Contingency:** Dev team manually adds events indefinitely, hire student worker if budget allows

**Risk 7: Students Forget to Use Platform**

* **Likelihood:** High (habit formation is difficult)  
* **Impact:** High (low retention kills growth)  
* **Mitigation:**  
  * Weekly email digest (opt-in)  
  * Push notifications for saved events (Phase 2\)  
  * Integration with existing student workflows (embed in portals)  
  * Make product so fast it becomes default search behavior  
* **Contingency:** Aggressive retargeting campaigns, remind users via Instagram

**Risk 8: Competing Platform Launches**

* **Likelihood:** Low-Medium (no current competitors identified)  
* **Impact:** Medium (market fragmentation)  
* **Mitigation:**  
  * First-mover advantage: Launch by February  
  * Lock in exclusive club partnerships  
  * Build network effects (saved events, recommendations)  
  * Superior UX as moat  
* **Contingency:** Differentiate on personalization and McGill-specific features; consider acquisition or partnership

### **11.3 Team & Resource Risks**

**Risk 9: Key Team Member Drops Out**

* **Likelihood:** Medium (students have competing priorities)  
* **Impact:** High (delays or quality issues)  
* **Mitigation:**  
  * Comprehensive documentation for all systems  
  * Code reviews ensure knowledge sharing  
  * Recruit backup developers early  
  * Break tasks into small, transferable units  
* **Contingency:** Extend timeline, recruit replacement from GDG community, simplify scope

**Risk 10: Budget Overruns**

* **Likelihood:** Low (lean stack with free tiers)  
* **Impact:** Low (costs are minimal)  
* **Mitigation:**  
  * Monitor usage dashboards weekly  
  * Set up billing alerts at 80% threshold  
  * Optimize before scaling (caching, query efficiency)  
  * Apply for grants before launch  
* **Contingency:** Personal funding from team, GDG emergency budget, scale back scraping frequency

**Risk 11: Burnout / Scope Creep**

* **Likelihood:** High (common in student projects)  
* **Impact:** High (quality suffers, morale drops)  
* **Mitigation:**  
  * Ruthless MVP scope discipline: "Is this essential to solve core problem?"  
  * Bi-weekly retros to address overwork  
  * 2-week sprints with realistic commitments  
  * Celebrate small wins  
* **Contingency:** Extend timeline, cut non-essential features, recruit more help

### **11.4 External Risks**

**Risk 12: Legal/Privacy Compliance Issues**

* **Likelihood:** Low (minimal data collection)  
* **Impact:** Medium (potential takedown)  
* **Mitigation:**  
  * Privacy policy drafted by Week 10  
  * Terms of service clearly state acceptable use  
  * Instagram scraping limited to public posts  
  * GDPR/privacy-by-design principles  
* **Contingency:** Legal consultation via McGill resources, immediate compliance fixes

---

## **12\. OPEN QUESTIONS & DECISIONS NEEDED**

### **12.1 Product Questions**

**Q1: Should we integrate Apple/Google Calendar export in MVP?**

* **Pros:** Increases utility, meets users where they are  
* **Cons:** Additional development time (1-2 weeks)  
* **Recommendation:** Delay to Phase 1 unless user testing shows strong demand

**Q2: Should clubs have verified badges?**

* **Pros:** Trust signal, prevents impersonation  
* **Cons:** Requires verification workflow and moderation  
* **Recommendation:** Implement in Phase 1 after 20+ clubs onboarded

**Q3: Should event images be mandatory or optional?**

* **Pros (Mandatory):** Consistent visual experience  
* **Cons (Mandatory):** Friction for event submission  
* **Recommendation:** Optional with high-quality fallback images

**Q4: Do we want to show "X friends are going" in the future?**

* **Pros:** Social proof increases attendance  
* **Cons:** Privacy concerns, requires friend graph  
* **Recommendation:** Add to Phase 2 roadmap with opt-in privacy controls

**Q5: Should we allow anonymous event reporting/flagging?**

* **Pros:** Community moderation of spam/inappropriate content  
* **Cons:** Potential abuse, requires review workflow  
* **Recommendation:** Implement simple "Report" button in Phase 1

### **12.2 Technical Questions**

**Q6: Should we use GraphQL or REST for API?**

* **Current:** REST (simpler for MVP)  
* **Alternative:** GraphQL (more flexible for complex queries)  
* **Decision Needed:** Week 2 (architecture phase)  
* **Recommendation:** REST for MVP, evaluate GraphQL in Phase 2

**Q7: Client-side or server-side rendering for calendar?**

* **Trade-offs:** SSR better for SEO/performance, CSR simpler  
* **Decision Needed:** Week 3 (before building calendar)  
* **Recommendation:** Hybrid \- SSR for initial load, CSR for filters

**Q8: How do we handle time zones?**

* **Issue:** McGill is EST, but some events may reference other zones  
* **Decision Needed:** Week 1 (database design)  
* **Recommendation:** Store all times in EST, no timezone conversion in MVP

**Q9: What's the data retention policy?**

* **Issue:** How long do we keep past events and user data?  
* **Decision Needed:** Week 10 (before launch)  
* **Recommendation:** Events: 1 year, User data: Until account deletion \+ 30 days

### **12.3 Go-to-Market Questions**

**Q10: Should we launch during exam period (April)?**

* **Pros:** Students have time to explore  
* **Cons:** Low event activity, engagement may be misleading  
* **Recommendation:** Launch in February (before midterms), avoid exam periods

**Q11: Do we need a mobile app for success?**

* **Current:** Progressive Web App (PWA) approach  
* **Alternative:** Native iOS/Android apps  
* **Recommendation:** PWA sufficient for MVP, evaluate native apps in Phase 2 based on data

**Q12: Should we charge clubs for premium features?**

* **Context:** Featured listings, advanced analytics  
* **Timeline:** Post-Phase 2 consideration  
* **Recommendation:** Free for all during first year, evaluate B2B model in Year 2

### **12.4 Partnership Questions**

**Q13: Should we partner with other universities early?**

* **Pros:** Faster growth, network effects  
* **Cons:** Complexity, dilutes McGill focus  
* **Recommendation:** McGill-only for Year 1, expand in Year 2 if successful

**Q14: Do we want McGill administration as official partner?**

* **Pros:** Credibility, potential funding, institutional data access  
* **Cons:** Bureaucracy, slower iterations, potential content restrictions  
* **Recommendation:** Informal relationship initially, formal partnership after proving value

---

## **13\. ACCEPTANCE CRITERIA**

### **13.1 MVP Launch Readiness**

**Calendar & Discovery:**

* \[ \] Calendar displays minimum 50 verified events  
* \[ \] Events load in under 2 seconds on 4G mobile connection  
* \[ \] Filtering by 6 categories (academic, social, sports, career, cultural, wellness) works correctly  
* \[ \] Search returns accurate results for event titles, clubs, and descriptions  
* \[ \] All event cards display: title, date, time, location, club name, and image (or fallback)  
* \[ \] Calendar is responsive on screens 320px to 1920px wide

**Event Details:**

* \[ \] Event detail page shows complete information: full description, date/time, location with map link, organizer contact, tags  
* \[ \] Location links open Google Maps with correct pin  
* \[ \] "Back" navigation returns to calendar with scroll position preserved  
* \[ \] Missing data shows appropriate placeholders ("Details coming soon")

**Authentication:**

* \[ \] "Sign in with McGill" button redirects to Microsoft OAuth  
* \[ \] Only @mcgill.ca and @mail.mcgill.ca emails are accepted  
* \[ \] Session persists across browser sessions  
* \[ \] Logout clears session completely  
* \[ \] Guest users can browse full calendar without restrictions

**Personalization:**

* \[ \] First-time users see interest tag selection (minimum 3, maximum 5\)  
* \[ \] Recommendation feed shows 10-15 events based on selected interests  
* \[ \] Users with \<3 saved events see "Popular This Week" instead  
* \[ \] Saved events influence future recommendations (verified by saving events in different categories)

**Event Management:**

* \[ \] Logged-in users can save events with single click  
* \[ \] "My Events" page displays all saved events sorted by date  
* \[ \] Users can unsave events from calendar or My Events page  
* \[ \] Saved status persists across sessions

**Email Notifications:**

* \[ \] Reminder sent 24 hours before saved event  
* \[ \] Reminder sent 1 hour before saved event  
* \[ \] Email includes event title, time, location, and link to details  
* \[ \] Unsubscribe link works and opts user out of future reminders  
* \[ \] No duplicate emails sent for same event

**Admin Panel:**

* \[ \] Admin can manually add events via form in under 2 minutes  
* \[ \] Form validates all required fields (title, date, time, location, club, tags)  
* \[ \] Admin can approve scraped events from pending queue  
* \[ \] Admin can edit event fields before approval  
* \[ \] Admin can reject non-event posts with reason

**Scraping Pipeline:**

* \[ \] Scraper runs daily at 6:00 AM EST without manual intervention  
* \[ \] Successfully extracts data from 20+ club Instagram accounts  
* \[ \] Stores posts in pending\_events table with confidence scores  
* \[ \] Flags posts without clear event data for manual review  
* \[ \] Error logs capture failed scrapes for debugging

### **13.2 Performance Benchmarks**

**Load Times:**

* \[ \] Calendar initial load: \<2s on 4G (tested via Lighthouse)  
* \[ \] Event detail page: \<1.5s  
* \[ \] Filter application: \<500ms  
* \[ \] Search results: \<400ms  
* \[ \] Recommendation generation: \<800ms

**Core Web Vitals:**

* \[ \] Largest Contentful Paint (LCP): \<2.5s  
* \[ \] First Input Delay (FID): \<100ms  
* \[ \] Cumulative Layout Shift (CLS): \<0.1

**API Performance:**

* \[ \] 95th percentile response time: \<300ms  
* \[ \] Error rate: \<1%  
* \[ \] Uptime: \>99.5%

### **13.3 User Experience Quality**

**Accessibility:**

* \[ \] All interactive elements keyboard-navigable  
* \[ \] Screen reader announces page changes and updates  
* \[ \] Color contrast ratio ≥4.5:1 for all text  
* \[ \] All images have descriptive alt text  
* \[ \] Form errors are clearly announced

**Mobile Usability:**

* \[ \] Touch targets minimum 44x44px  
* \[ \] No horizontal scrolling on any page  
* \[ \] Text readable without zooming  
* \[ \] Navigation accessible with thumb (bottom or top)

**Error Handling:**

* \[ \] User-friendly error messages (no technical jargon)  
* \[ \] Network errors show retry option  
* \[ \] Empty states have clear calls-to-action  
* \[ \] Failed image loads show fallback graphic

### **13.4 Beta Launch Criteria**

**Content:**

* \[ \] Minimum 75 events spanning next 4 weeks  
* \[ \] At least 15 different clubs represented  
* \[ \] Events cover all 6 major categories  
* \[ \] 80% of events have images

**Users:**

* \[ \] 100 students registered and verified  
* \[ \] Mix of users: 40% first-years, 40% upperclassmen, 20% club leaders  
* \[ \] At least 5 different faculties represented

**Quality:**

* \[ \] Zero critical bugs (P0: crashes, data loss, security)  
* \[ \] \<5 high-priority bugs (P1: broken features)  
* \[ \] Feedback form integrated and tested

**Support:**

* \[ \] Help documentation published (FAQ, How-to guides)  
* \[ \] Support email monitored daily  
* \[ \] Onboarding flow tested with 10+ users

---

## **14\. APPENDICES**

### **14.1 User Research Summary**

**Survey Results (n=200, January 2025):**

* 89% find event discovery "somewhat" or "very" difficult  
* 72% have missed events they wanted to attend  
* Average student checks 5.2 platforms to find events  
* Top frustration: "Information is scattered everywhere" (68%)  
* 82% would use a centralized event platform if it existed  
* 61% want personalized recommendations

**Interview Insights (n=50, January 2025):**

* First-years rely heavily on residence floor groups  
* Club executives spend 3-5 hours per event on marketing  
* Instagram engagement for club posts averages \<12%  
* Students want to discover "smaller, niche" communities  
* FOMO is a major driver of event interest  
* Physical posters still effective in high-traffic areas

### **14.2 Competitive Analysis**

| Platform | Strengths | Weaknesses | Opportunity |
| ----- | ----- | ----- | ----- |
| **Instagram** | High engagement, visual | Algorithm buries posts, unsearchable, ephemeral | Aggregate and make searchable |
| **Facebook Events** | Structured data, RSVP | Declining Gen Z usage, requires account | Offer no-login browsing |
| **Email Lists** | Direct communication | Overwhelming, low open rates, no discovery | Filter and personalize |
| **Physical Posters** | Localized reach | Temporary, location-dependent, no reminders | Digitize and archive |
| **Eventbrite** | Professional features | Too heavy for campus events, costs | Free, campus-specific solution |

**Conclusion:** No platform combines comprehensive coverage, intelligent personalization, and zero-friction access for campus events.

### **14.3 Event Schema Reference**

interface Event {  
  id: string;  
  title: string;  
  description: string;  
  event\_date: Date;  
  event\_time: Time;  
  location: string;  
  location\_url?: string;  
  club\_id: string;  
  club\_name: string;  
  image\_url?: string;  
  contact\_email: string;  
  tags: EventTag\[\];  
  source: 'manual' | 'instagram' | 'facebook';  
  is\_published: boolean;  
  created\_at: Date;  
  updated\_at: Date;  
}

enum EventTag {  
  ACADEMIC \= 'academic',  
  SOCIAL \= 'social',  
  SPORTS \= 'sports',  
  CAREER \= 'career',  
  CULTURAL \= 'cultural',  
  WELLNESS \= 'wellness',  
  VOLUNTEERING \= 'volunteering',  
  ARTS \= 'arts',  
  MUSIC \= 'music',  
  FOOD \= 'food'  
}

interface Club {  
  id: string;  
  name: string;  
  description?: string;  
  instagram\_handle?: string;  
  email: string;  
  logo\_url?: string;  
  category: string;  
  created\_at: Date;  
}

interface User {  
  id: string;  
  email: string;  
  full\_name: string;  
  interest\_tags: EventTag\[\];  
  email\_notifications\_enabled: boolean;  
  created\_at: Date;  
  last\_active: Date;  
}

### **14.4 Instagram Scraping Regex Patterns**

// Date patterns  
const datePatterns \= \[  
  /(\\w+day),?\\s+(\\w+)\\s+(\\d{1,2})/i, // Monday, January 15  
  /(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})/,  // 01/15/2026  
  /(\\w+)\\s+(\\d{1,2})/i                // January 15  
\];

// Time patterns  
const timePatterns \= \[  
  /(\\d{1,2}):?(\\d{2})?\\s\*(am|pm|AM|PM)/,      // 5:30 PM  
  /(\\d{1,2})\\s\*(am|pm|AM|PM)/,                // 5 PM  
  /(\\d{1,2}):(\\d{2})/                         // 17:30  
\];

// Location patterns  
const locationPatterns \= \[  
  /@\\s\*(\[^@\\n\]+)/,                    // @ Shatner Building  
  /location:?\\s\*(\[^\\n\]+)/i,           // Location: SSMU Ballroom  
  /where:?\\s\*(\[^\\n\]+)/i               // Where: McConnell Engineering  
\];

### **14.5 Recommendation Algorithm (Pseudocode)**

def generate\_recommendations(user\_id, limit=15):  
    \# Get user profile  
    user \= db.query("SELECT interest\_tags FROM users WHERE id \= ?", user\_id)  
      
    \# Get user's saved events  
    saved\_events \= db.query("SELECT event\_id, tags FROM user\_saved\_events JOIN events")  
      
    \# Calculate tag weights from saved events  
    tag\_weights \= {}  
    for event in saved\_events:  
        for tag in event.tags:  
            tag\_weights\[tag\] \= tag\_weights.get(tag, 0\) \+ 1  
      
    \# Normalize weights  
    total \= sum(tag\_weights.values())  
    for tag in tag\_weights:  
        tag\_weights\[tag\] /= total  
      
    \# Get upcoming events  
    upcoming\_events \= db.query("SELECT \* FROM events WHERE event\_date \>= TODAY() AND is\_published \= true")  
      
    \# Score each event  
    scored\_events \= \[\]  
    for event in upcoming\_events:  
        score \= 0  
          
        \# Tag matching score  
        for tag in event.tags:  
            if tag in tag\_weights:  
                score \+= tag\_weights\[tag\] \* 10  
            elif tag in user.interest\_tags:  
                score \+= 5  
          
        \# Popularity boost  
        save\_count \= db.query("SELECT COUNT(\*) FROM user\_saved\_events WHERE event\_id \= ?", event.id)  
        if save\_count \> 10:  
            score \+= 2  
          
        \# Recency boost (prefer events happening soon)  
        days\_until \= (event.event\_date \- today()).days  
        if days\_until \<= 7:  
            score \+= 1  
          
        scored\_events.append((event, score))  
      
    \# Sort by score and return top N  
    scored\_events.sort(key=lambda x: x\[1\], reverse=True)  
    return \[event for event, score in scored\_events\[:limit\]\]

### **14.6 Privacy Policy Summary**

**Data We Collect:**

* Email address (for authentication)  
* Full name (from McGill OAuth)  
* Interest tags (user-selected)  
* Saved events (user action)  
* Usage analytics (anonymized)  
* Student ID number  
* Year of study

**Data Usage:**

* Personalize event recommendations  
* Send reminder emails (opt-in)  
* Improve platform performance  
* Aggregate analytics (anonymized)

**Data Sharing:**

* Never sold to third parties  
* Never shared with clubs (unless explicitly consented)  
* Anonymized data may be shared with McGill for research

**User Rights:**

* Access your data: Email support@uni-verse.app  
* Delete your account: Settings → Delete Account  
* Opt out of emails: Settings or unsubscribe link  
* Export your data: Request via email

### **14.7 Club Onboarding Guide**

**How to Get Your Events on Uni-Verse:**

**Option 1: Instagram (Automatic)** If we're already scraping your account, your events appear automatically\! Just make sure to include:

* Clear date and time  
* Location  
* Event description  
* Eye-catching image

**Option 2: Manual Submission (Coming Phase 1\)**

1. Go to uni-verse.app/submit  
2. Fill out quick form (takes 2 minutes)  
3. Submit for approval  
4. Your event goes live within 24 hours

**Tips for Great Events:**

* Use high-quality images (at least 800x600px)  
* Write compelling descriptions (focus on benefits)  
* Tag accurately (helps students find you)  
* Include all essential details upfront

**Questions?** Email clubs@uni-verse.app

### **14.8 Beta Testing Feedback Template**

**Weekly Beta User Survey:**

1. How many times did you use Uni-Verse this week?

   * \[ \] 0 times  
   * \[ \] 1-2 times  
   * \[ \] 3-5 times  
   * \[ \] 6+ times  
2. Did you discover any new events you wouldn't have found otherwise?

   * \[ \] Yes (please describe)  
   * \[ \] No  
3. How relevant were your personalized recommendations? (1-5 scale)

4. What frustrated you most about the experience?

5. What feature would make you use Uni-Verse daily?

6. Would you recommend Uni-Verse to a friend? Why or why not?

7. Any bugs or issues you encountered?

### **14.9 Success Story Template (For Marketing)**

**"How I Found My Community at McGill"**

\[Student Photo\]

**\[Name\], \[Year\], \[Faculty\]**

*"Before Uni-Verse, I had no idea \[Club Name\] existed. Now I'm..."*

\[150-word story about discovering event, attending, impact on university experience\]

**Events Found on Uni-Verse:** \[Number\] **Communities Discovered:** \[Number\]

---

## **15\. CONCLUSION & NEXT STEPS**

### **15.1 Vision Recap**

Uni-Verse will fundamentally transform how McGill students experience campus life by solving the critical problem of event discovery fragmentation. By aggregating all campus events, providing intelligent recommendations, and removing friction from the discovery process, we'll increase student engagement, strengthen community bonds, and ensure no student misses opportunities that could define their university experience.

### **15.2 MVP Value Proposition**

**For Students:** Find every campus event in 30 seconds instead of 10 minutes across 15 platforms. Never miss an event you'd want to attend. Discover communities that match your interests.

**For Clubs:** Reach your entire target audience with one submission. Stop competing with Instagram algorithms. Increase event attendance through better discovery.

**For McGill:** Increase student engagement metrics. Strengthen campus community. Provide data-driven insights into student life.

### **15.3 Critical Success Factors**

1. **Content Quality:** Minimum 50 high-quality events at launch  
2. **Performance:** Sub-2-second load times on mobile  
3. **Relevance:** Recommendations must feel personalized  
4. **Adoption:** Strategic partnerships with 10+ clubs pre-launch  
5. **Reliability:** 99.5% uptime and accurate event data  
6. **Iteration:** Weekly improvements based on user feedback

### **15.4 Immediate Action Items**

**Week 1 (Kickoff):**

* \[ \] Present PRD to GDG team for feedback  
* \[ \] Recruit frontend and ML developers  
* \[ \] Set up GitHub repository and project board  
* \[ \] Create Figma workspace and begin design  
* \[ \] Identify 20 club Instagram accounts to scrape

**Week 2 (Foundation):**

* \[ \] Finalize database schema with team  
* \[ \] Set up Supabase project and development environment  
* \[ \] Design 5 core screens in Figma  
* \[ \] Write technical architecture documentation  
* \[ \] Apply for Microsoft OAuth credentials

**Week 3 (Development Start):**

* \[ \] Sprint 1 planning meeting  
* \[ \] Begin calendar view development  
* \[ \] Set up Apify scraper (test run)  
* \[ \] Create component library in Next.js  
* \[ \] Outreach to 5 clubs for partnership

**Week 4-12 (MVP Development):**

* \[ \] Execute 2-week sprints per roadmap  
* \[ \] Weekly demos and stakeholder updates  
* \[ \] Continuous user testing with 10-person focus group  
* \[ \] Beta preparation: Recruit 100 testers

**Week 13 (Beta Launch \- Feb 24, 2026):**

* \[ \] Launch beta to 100 students  
* \[ \] Monitor metrics dashboard daily  
* \[ \] Weekly feedback sessions  
* \[ \] Rapid bug fixes and improvements

### **15.5 Decision Approvals Needed**

**From GDG Leadership:**

* \[ \] Approve $500 budget allocation  
* \[ \] Endorse project as flagship GDG initiative  
* \[ \] Support with promotion and recruitment

**From McGill IT:**

* \[ \] Grant Microsoft OAuth access for student authentication  
* \[ \] Approve use of McGill branding (if needed)

**From Product Owner:**

* \[ \] Final approval of MVP scope and timeline  
* \[ \] Sign-off on design mockups (Week 2\)  
* \[ \] Go/no-go decision for beta launch (Week 12\)

### **15.6 Long-Term Vision (Beyond Year 1\)**

**Year 2: McGill Dominance**

* 5,000+ weekly active users (25% of undergrads)  
* 100+ clubs actively using platform  
* Become the default way students discover events  
* Launch club analytics dashboard  
* Integrate with McGill student portal

**Year 3: Multi-University Expansion**

* Expand to Concordia, UdeM  
* Build inter-university event sharing  
* Develop mobile apps (iOS \+ Android)  
* Explore monetization (premium club features)

**Year 5: National Platform**

* Operate at 50+ Canadian universities  
* AI-powered smart search and recommendations  
* Event marketplace features  
* Become the standard for campus event discovery

---

**Document Status:** Ready for Team Review  
 **Next Review Date:** November 23, 2025  
 **Distribution:** GDG Core Team, Development Team, Beta Advisors

---

*This PRD is a living document and will be updated throughout the development process to reflect learnings, pivots, and scope adjustments.*

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>