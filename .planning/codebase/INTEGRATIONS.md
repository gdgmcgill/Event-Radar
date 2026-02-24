# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**Supabase (Primary Backend):**
- Database and authentication provider
  - SDK/Client: @supabase/supabase-js 2.49.0
  - Server integration: @supabase/ssr 0.7.0
  - Auth: environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**API Documentation:**
- Swagger/OpenAPI endpoint generation
  - Framework: next-swagger-doc 0.4.1
  - Viewers: swagger-ui-react 5.30.2, redoc 2.5.1
  - Location: `/src/lib/swagger.ts`
  - Generated from route comments in `src/app/api/**`

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: Supabase project (URL in `NEXT_PUBLIC_SUPABASE_URL`)
  - Client: @supabase/supabase-js with typed queries
  - Type definitions: `src/lib/supabase/types.ts` (auto-generated from Supabase schema)
  - Tables: events, clubs, users, saved_events, notifications, club_members, organizer_requests, user_interactions, event_popularity_scores, user_engagement_summaries, rsvps
  - Authentication: Supabase Auth (built-in)

**File Storage:**
- Supabase Storage (via @supabase/supabase-js)
  - Images hosted on Supabase CDN (wildcard pattern `**.supabase.co`, `**.supabase.in`)
  - Image optimization via Next.js Image with remote patterns configured

**Image Sources:**
- Unsplash (images.unsplash.com) - Public image CDN allowed in Next.js config

**Client-Side Storage:**
- localStorage - Theme preference persistence (`src/components/layout/ThemeToggle.tsx`)
- sessionStorage - Session ID tracking for analytics (`src/hooks/useTracking.ts`)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (OAuth)
  - Implementation: `src/app/auth/callback/route.ts`
  - OAuth callback handler with Azure OAuth support
  - McGill email validation enforced (`@mcgill.ca`, `@mail.mcgill.ca`)
  - Sign-out route: `src/app/auth/signout/route.ts`

**Session Management:**
- Server-side session via Supabase Auth cookies
- Middleware refresh in `src/middleware.ts` using @supabase/ssr
- User profile upsert on callback
- Role-based access control (user, club_organizer, admin)
- Admin role auto-assignment via `ADMIN_EMAILS` environment variable

## Monitoring & Observability

**Error Tracking:**
- Not detected - errors logged to console only

**Logs:**
- Console logging (browser and server-side)
- No external logging service configured

**Health Check:**
- Health check endpoint: `src/app/api/health/route.ts`
- Returns status of database connectivity

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from `CRON_SECRET` env variable handling)
- Cross-env NODE_OPTIONS for header size management (Azure OAuth token chunking)

**CI Pipeline:**
- Not configured in codebase (GitHub Actions could be in `.github/workflows` outside src/)

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (browser accessible)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous API key (browser accessible)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side API key (secret)
- `CRON_SECRET` - Authentication for scheduled jobs (set in Vercel)
- `ADMIN_EMAILS` (optional) - Comma-separated list of admin emails for auto-role assignment

**Secrets location:**
- `.env.local` (not committed, template in `.env.local.example`)
- Vercel dashboard for deployment variables

**Configuration example:**
See `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
CRON_SECRET=your_cron_secret_here
```

## Webhooks & Callbacks

**Incoming:**
- OAuth callback endpoint: `src/app/auth/callback/route.ts`
  - Processes OAuth code exchange
  - Creates/updates user profile in Supabase
  - Validates McGill email domain
  - Assigns roles based on ADMIN_EMAILS

**Outgoing:**
- Not detected - no outbound webhook integration

## API Routes

**Public Routes:**
- `GET /api/health` - Health check endpoint
- `GET /api/clubs` - List all clubs
- `GET /api/clubs/[id]` - Get club details
- `GET /api/clubs/[id]/events` - Get events for a club
- `GET /api/recommendations` - Event recommendations (authenticated)
- `GET /api/recommendations/sync` - Sync recommendations (authenticated)
- `POST /api/interactions` - Track user interactions with events

**Authenticated Routes:**
- `GET /api/my-clubs` - User's club memberships
- `POST /api/organizer-requests` - Request organizer role for club
- `GET /api/user/engagement` - User engagement metrics

**Admin Routes:**
- `GET /api/admin/events` - List all events (filterable by status)
- `PATCH /api/admin/events/[id]/status` - Update event approval status
- `PUT /api/admin/events/[id]` - Update event details
- `DELETE /api/admin/events/[id]` - Delete event
- `GET /api/admin/clubs` - List clubs
- `POST /api/admin/clubs` - Create club
- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/[id]` - Update user
- `GET /api/admin/organizer-requests` - List organizer requests
- `PATCH /api/admin/organizer-requests/[id]` - Approve/reject organizer request
- `GET /api/admin/stats` - Dashboard statistics
- `POST /api/admin/calculate-popularity` - Calculate event popularity scores
- `GET /api/admin/calculate-popularity` - Get popularity calculation status

## Rate Limiting

**Implementation:**
- Custom in-memory rate limiter in `src/middlewareRateLimit.ts`
- Applied to public API endpoints via middleware before authentication
- State stored in globalThis for hot-reload persistence

## Data Syncing

**Client-Side Data Fetching:**
- SWR (stale-while-revalidate) pattern via `swr` 2.3.7 library
- Custom hooks: `src/hooks/useEvents`, `src/hooks/useUser`

**Recommendation Engine:**
- ML-based classification in `src/lib/classifier.ts`
- K-means clustering in `src/lib/kmeans.ts`
- Tag mapping in `src/lib/tagMapping.ts`
- Synchronization endpoint: `GET /api/recommendations/sync`

## User Interaction Tracking

**Tracked Interactions:**
- view, click, save, unsave, share, calendar_add
- Source attribution: home, search, recommendation, calendar, direct, modal, my-events
- Session ID tracking via sessionStorage
- Endpoint: `POST /api/interactions`
- Used for: popularity scoring, engagement metrics, personalization

---

*Integration audit: 2026-02-23*
