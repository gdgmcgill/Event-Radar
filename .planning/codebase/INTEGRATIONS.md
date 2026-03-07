# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

**Recommendation Engine:**
- Two-Tower Recommendation Service - AI-powered event recommendations
  - Client: Plain `fetch()` calls in `src/app/api/recommendations/route.ts`
  - Endpoint: `${RECOMMENDATION_API_URL}/recommend` (POST)
  - Auth: None (internal service)
  - Env var: `RECOMMENDATION_API_URL` (defaults to `http://localhost:8000`)
  - Payload: User profile (major, year, interests), feedback signals, exclusion list
  - Response: Ranked list of event IDs with scores
  - Fallback: Returns empty recommendations with `source: "popular_fallback"` when service is unreachable

**Unsplash:**
- Image hosting only (no API integration)
- Allowed as remote image source in `next.config.js` (`images.unsplash.com`)

## Data Storage

**Database:**
- Supabase (PostgreSQL)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`
  - Anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Service key: `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)

**Three Supabase client patterns:**

1. **Browser client** - `src/lib/supabase/client.ts`
   - Uses `createBrowserClient()` from `@supabase/ssr`
   - For client components and React hooks
   - Respects RLS policies

2. **Server client** - `src/lib/supabase/server.ts`
   - Uses `createServerClient()` from `@supabase/ssr`
   - Cookie-based auth via `next/headers`
   - For API routes and Server Components
   - Respects RLS policies

3. **Service client** - `src/lib/supabase/service.ts`
   - Uses `createClient()` from `@supabase/supabase-js` with service role key
   - Bypasses RLS entirely
   - For admin routes and cron jobs only

**Database types:** `src/lib/supabase/types.ts` (manually maintained, not auto-generated)

**Core tables:**
- `events` - Event data (title, description, dates, location, tags, status, club_id)
- `clubs` - Organization profiles (name, description, instagram_handle, logo_url, status)
- `users` - User profiles (email, name, avatar_url, roles, interest_tags)
- `saved_events` - User-event bookmarks
- `notifications` - In-app notification records
- `user_interactions` - Event interaction tracking (views, clicks, saves, shares)
- `event_popularity` - Computed popularity/trending scores
- `user_engagement` - Aggregated user engagement metrics
- `recommendation_feedback` - Implicit recommendation feedback (impressions, clicks, saves, dismisses)
- `recommendation_explicit_feedback` - Explicit thumbs up/down feedback
- `club_members` - Club membership with roles
- `club_followers` - Club following relationships
- `organizer_requests` - Requests to become club organizers
- `feedback` - General app feedback

**Migrations:** `supabase/migrations/` (27 migration files, sequentially numbered)

**File Storage:**
- Supabase Storage - `event-images` bucket
  - Used in `src/app/api/events/upload-image/route.ts`
  - Max file size: 5MB
  - Public URL generation via `getPublicUrl()`
- Supabase Storage - avatar/logo uploads via `src/app/api/profile/avatar/route.ts` and `src/app/api/clubs/logo/route.ts`

**Caching:**
- SWR (`swr` ^2.3.7) for client-side data caching
- Vercel CDN cache headers on API routes (`s-maxage=60, stale-while-revalidate=300` in `vercel.json`)
- In-memory rate limit store in `src/middlewareRateLimit.ts` (single-process only)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth with Azure AD (Microsoft) OAuth
  - Implementation: OAuth PKCE flow
  - Callback handler: `src/app/auth/callback/route.ts`
  - Sign-out: `src/app/auth/signout/route.ts`
  - Domain restriction: McGill emails only (`@mcgill.ca` or `@mail.mcgill.ca`)
  - Validation: `isMcGillEmail()` in `src/lib/utils.ts` and `src/app/auth/callback/route.ts`
  - Non-McGill users are signed out and their `auth.users` row is deleted

**Session Management:**
- Cookie-based sessions via `@supabase/ssr`
- Middleware (`src/middleware.ts`) refreshes sessions on every request
- Stale/orphaned auth cookie cleanup in middleware
- Large token chunking support (Microsoft Azure tokens are large)

**Authorization:**
- Role-based: `user`, `admin`, `club_organizer` (defined in `src/types/index.ts`)
- Admin auto-assignment via `ADMIN_EMAILS` env var at login (`src/app/auth/callback/route.ts`)
- Protected routes enforced in middleware: `/my-events`, `/create-event`, `/notifications`, `/profile`
- Onboarding redirect for new users (cookie-based `needs_onboarding` flag)

**Client-side auth hook:**
- `src/hooks/useUser.ts` - Manages auth state, listens for `onAuthStateChange`

## Monitoring & Observability

**Error Tracking:**
- None (console.error only)

**Logs:**
- `console.log`, `console.error`, `console.warn` throughout
- Prefixed with context tags like `[Callback]`, `[Middleware]`, `[Cron]`

**Analytics:**
- Custom event interaction tracking system
  - Client hook: `src/hooks/useTracking.ts`
  - API endpoint: `src/app/api/interactions/route.ts`
  - Tracks: views, clicks, saves, unsaves, shares, calendar_add
  - Session-based (crypto.randomUUID stored in sessionStorage)
- Recommendation feedback tracking
  - API endpoint: `src/app/api/recommendations/feedback/route.ts`
  - Tracks: impressions, clicks, saves, dismisses
  - Explicit feedback: thumbs up/down
  - Analytics dashboard: `src/app/api/recommendations/analytics/route.ts`
- Event popularity calculation
  - API endpoint: `src/app/api/admin/calculate-popularity/route.ts`
  - Computes popularity_score and trending_score

## CI/CD & Deployment

**Hosting:**
- Vercel
- Config: `vercel.json`
- Region: `iad1` (US East - Washington DC)
- Framework preset: `nextjs`

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Triggers: push to `main`, PRs to `main`
- Steps: checkout, setup Node 20, `npm ci`, lint, `tsc --noEmit`, `npm run build`
- No automated test execution in CI

**Cron Jobs:**
- Event reminder notifications: `src/app/api/cron/send-reminders/route.ts`
  - Auth: Bearer token via `CRON_SECRET` env var
  - Sends 24-hour and 1-hour reminders for saved events
  - Likely triggered via Vercel Cron or external scheduler

## Rate Limiting

**Implementation:**
- In-memory token bucket in `src/middlewareRateLimit.ts`
- Applied at middleware level to all `/api/*` routes (except `/api/admin/*`)
- Limits per IP per minute:
  - GET: 100 requests
  - POST/PUT/PATCH/DELETE: 30 requests
- Returns HTTP 429 with `Retry-After` header when exceeded
- Single-process only; needs distributed store (e.g., Upstash Redis) for multi-region

## Webhooks & Callbacks

**Incoming:**
- Events webhook: `supabase/functions/events-webhook/index.ts` (Supabase Edge Function)
  - Auth: HMAC-SHA256 signature verification
  - Headers checked: `x-signature`, `x-hub-signature-256`, `x-webhook-signature`
  - Env: `WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - Accepts batch event payloads, validates structure, inserts with `status: "pending"`
  - Runtime: Deno (Supabase Edge Runtime)

- OAuth callback: `src/app/auth/callback/route.ts`
  - Handles Azure AD OAuth code exchange
  - Creates/updates user profile, enforces McGill domain, assigns admin role

**Outgoing:**
- None detected

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)
- `CRON_SECRET` - Bearer token for cron job endpoints

**Optional env vars:**
- `RECOMMENDATION_API_URL` - Recommendation service URL (default: `http://localhost:8000`)
- `ADMIN_EMAILS` - Comma-separated admin email addresses for auto-role assignment
- `WEBHOOK_SECRET` - HMAC secret for events webhook (Edge Function only)

**Secrets location:**
- `.env.local` (local development, gitignored)
- Vercel dashboard (production)
- Supabase dashboard (Edge Function secrets)

## Data Export

**Formats:**
- CSV export: `src/app/api/events/export/route.ts` (format=csv)
- iCal export: `src/app/api/events/export/route.ts` (format=ical)
- Supports filtering by tags, search, date range, club, specific event IDs

---

*Integration audit: 2026-03-05*
