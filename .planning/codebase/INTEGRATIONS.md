# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**Authentication:**
- Microsoft Azure OAuth - McGill university SSO via Azure AD
  - SDK/Client: Supabase Auth with Azure provider
  - Implementation: `src/app/auth/callback/route.ts`, `src/components/auth/SignInButton.tsx`
  - Auth: Configured via Supabase dashboard (provider not in code)
  - Handling: OAuth callback at `/auth/callback` with token exchange and user profile upsert

**Event Data Ingestion:**
- Webhook receiver for external event sources
  - Endpoint: `/functions/v1/events-webhook` (Supabase Edge Function)
  - Location: `supabase/functions/events-webhook/index.ts`
  - Security: HMAC-SHA256 signature verification
  - Payload structure: WebhookEvent with title, description, date, time, location, image_url, source_url, tags, capacity, price, registration_url

**Image Sources:**
- Unsplash - Free stock photos
  - Allowed in Next.js image optimization config
- Supabase Storage - Internal image hosting for club logos and event images
  - Bucket access via Supabase client

## Data Storage

**Databases:**
- Supabase PostgreSQL (v17)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (public anon key), `SUPABASE_SERVICE_ROLE_KEY` (server key)
  - Client: @supabase/supabase-js (browser) and @supabase/ssr (server)
  - Tables: events, clubs, users, saved_events, rsvps, interactions, user_engagement_summary, notifications, organizer_requests, club_members

**File Storage:**
- Supabase Storage buckets (local dev at port 54328)
  - File size limit: 50MiB per file
  - Subdomain pattern: `{projectRef}.supabase.co`/storage

**Caching:**
- SWR 2.3.7 - HTTP caching with deduplication
- Zustand 5.0.9 - Client-side state persistence
- Next.js built-in caching - For database queries via Supabase client

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (hosted by Supabase)
  - Primary method: Microsoft Azure OAuth (McGill SSO)
  - Backup methods: Email/password, Google (configurable)
  - Implementation in `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server)

**User Validation:**
- McGill email enforcement: Only `*@mcgill.ca` or `*@mail.mcgill.ca` addresses allowed
  - Validation: `src/app/auth/callback/route.ts` line 25-27
  - Non-McGill users are deleted from auth system via service role key

**Admin Assignment:**
- Hardcoded admin email list via `ADMIN_EMAILS` environment variable
  - Automatic role assignment on first login if email matches
  - Location: `src/app/auth/callback/route.ts` lines 20-23, 176-182

**Session Management:**
- JWT tokens (default 3600s = 1 hour expiry)
  - Refresh token rotation enabled
  - Cookie-based session persistence via @supabase/ssr
  - Token cleanup logic in `src/middleware.ts` to prevent stale cookies

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar service integration

**Logs:**
- Console logging throughout codebase
  - Error logs in middleware, auth callback, API routes
  - Health check logs for debugging
  - Location: Various files use `console.error()`, `console.log()`

**Health Checks:**
- Comprehensive health endpoint at `GET /api/health`
  - Location: `src/app/api/health/route.ts`
  - Checks: Server, Database, Supabase Auth, Azure OAuth config, Environment variables, Memory usage
  - Returns HTTP 200 (healthy) or 503 (unhealthy/degraded)

**Analytics:**
- Event interaction tracking via custom `interactions` table
  - Tracks: view, click, save, unsave, share, calendar_add events
  - Location: `src/app/api/interactions/route.ts`
  - Data stored in `public.interactions` table for engagement analysis

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from Next.js 16 App Router setup)
- Supabase Cloud for database and auth

**CI Pipeline:**
- Not detected in codebase - No GitHub Actions, GitLab CI, or similar workflows committed

**Environment Setup:**
- Development: `npm run dev` starts Next.js (port 3000) and Supabase local stack (port 54321)
- Production: `npm run build` → `npm run start`

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public, client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key for browser requests (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role for server operations only (secret)
- `ADMIN_EMAILS` - Comma-separated list of emails to auto-assign admin role (optional)

**Optional env vars:**
- Supabase-specific: OpenAI API key for Supabase AI features (commented in config)
- S3 configuration for OrioleDB storage (experimental)

**Secrets location:**
- `.env.local` (not committed, never read by tools)
- Supabase dashboard for provider-specific secrets
- Hardcoded lists in code: `ADMIN_EMAILS` (env var), OAuth provider config (Supabase dashboard)

## Webhooks & Callbacks

**Incoming:**
- OAuth callback: `GET /auth/callback` - Receives authorization code from Azure OAuth
  - Processes code exchange, creates/updates user profile, enforces McGill domain
  - Returns redirect with success/error status
  - Location: `src/app/auth/callback/route.ts`

- Event webhook: `POST /functions/v1/events-webhook` - External event ingestion
  - Validates HMAC-SHA256 signature
  - Accepts array of events with standardized schema
  - Maps external categories/tags to internal enum
  - Location: `supabase/functions/events-webhook/index.ts`

**Outgoing:**
- Not detected - No webhook calls to external services
- Internal events via Supabase Realtime (not external)

## Rate Limiting

**API Rate Limits:**
- Supabase auth: 30 sign-in/sign-up requests per 5 minutes per IP
- 150 token refresh requests per 5 minutes per IP
- Custom middleware rate limiting for public API endpoints
  - Location: `src/middleware.ts` references `applyApiRateLimit()`
  - Consumed by all routes via matcher pattern

## Middleware & Security

**Middleware:**
- Session refresh via Supabase cookie handler
- Route protection (redirect unauthenticated users from `/my-events`, `/create-event`, `/notifications`, `/profile`)
- Onboarding guard (redirect users with `needs_onboarding` cookie)
- Stale auth cookie cleanup
- Location: `src/middleware.ts`

**Security Headers (via Next.js):**
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

---

*Integration audit: 2026-02-25*
