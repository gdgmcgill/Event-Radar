# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- TypeScript 5.4.0 - Entire codebase with strict mode enabled
- JavaScript (Node.js) - Build tooling and scripts

**Secondary:**
- SQL - Supabase PostgreSQL database and migrations
- TypeScript (Deno) - Supabase Edge Functions

## Runtime

**Environment:**
- Node.js (version not specified, no .nvmrc file)
- Supabase Edge Runtime (Deno 2) for serverless functions

**Package Manager:**
- npm (version not specified)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.0.3 (App Router) - Full-stack framework with built-in API routes
- React 18.3.0 - UI library
- Supabase 2.49.0 (@supabase/ssr 0.7.0) - Backend-as-a-service for auth and database

**UI & Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework
- shadcn/ui - Component library built on Radix UI primitives
- Lucide React 0.344.0 - Icon library
- Radix UI - Accessible component primitives:
  - @radix-ui/react-dialog (1.1.15)
  - @radix-ui/react-dropdown-menu (2.1.16)
  - @radix-ui/react-slider (1.3.6)
  - @radix-ui/react-switch (1.2.6)
  - @radix-ui/react-slot (1.0.2)

**Testing:**
- Vitest 4.0.18 - Test runner with jsdom environment
- @testing-library/react 16.3.2 - React component testing
- @testing-library/user-event 14.6.1 - User interaction simulation
- @testing-library/jest-dom 6.9.1 - Custom DOM matchers
- jsdom 28.1.0 - DOM implementation for testing

**Build/Dev:**
- ESLint 9.39.1 with Next.js config - Code linting
- Prettier 3.2.5 - Code formatting
- Autoprefixer 10.4.17 - PostCSS vendor prefixes
- PostCSS 8.4.35 - CSS transformation
- Embla Carousel React 8.3.0 - Carousel/slider component
- react-easy-crop 5.5.6 - Image cropping utility
- class-variance-authority 0.7.1 - Component variant system
- clsx 2.1.0 - Conditional className utility
- tailwind-merge 2.2.1 - Merge Tailwind classes
- tailwindcss-animate 1.0.7 - Animation utilities
- SWR 2.3.7 - Data fetching and caching library
- Zustand 5.0.9 - Lightweight state management
- date-fns 3.3.1 - Date utility library
- yaml 2.8.2 - YAML parsing

**API Documentation:**
- Swagger UI React 5.30.2 - Interactive API docs
- Redoc 2.5.1 - OpenAPI documentation rendering
- next-swagger-doc 0.4.1 - Swagger/OpenAPI generation for Next.js
- @swagger-api/apidom-ns-openapi-3-1 1.0.0-rc.3 - OpenAPI 3.1 support

**Development Tools:**
- cross-env 10.1.0 - Cross-platform environment variables
- @vitejs/plugin-react 5.1.4 - Vite React plugin (used by Vitest)

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.49.0 - Supabase JavaScript client for browser
- @supabase/ssr 0.7.0 - Supabase server-side rendering utilities for cookie management
- @supabase/functions-js - Supabase Edge Functions types and utilities

**Infrastructure:**
- date-fns 3.3.1 - Date formatting and manipulation
- swr 2.3.7 - HTTP client with caching for API calls
- zustand 5.0.9 - Global state management (lightweight Redux alternative)
- clsx/tailwind-merge - ClassName utilities for dynamic styling

## Configuration

**Environment:**
- Variables configured via `.env.local` (not committed)
- No `.env.example` file in repo
- Environment variable substitution in Supabase config.toml for secrets

**Build:**
- `tsconfig.json` - TypeScript configuration with strict mode
- `next.config.js` - Next.js configuration with image optimization
- `vitest.config.ts` - Vitest test runner configuration
- `.prettierrc` - Code formatting with semicolons, 80-char line width, 2 spaces
- `eslint.config.mjs` - ESLint using Next.js core-web-vitals config
- `supabase/config.toml` - Supabase local development and production settings

## Platform Requirements

**Development:**
- Node.js (version unspecified)
- npm (version unspecified)
- Supabase CLI for local development
- TypeScript strict mode compliance required

**Production:**
- Deployment target: Vercel (implied by Next.js 16 and Supabase integration)
- Supabase cloud project
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Build Commands

```bash
npm run dev       # Next.js dev server with large HTTP header support
npm run build     # Production build
npm run start     # Production server with large HTTP header support
npm run lint      # ESLint check
npm test          # Vitest watch mode
npm run test:run  # Vitest single run
```

## Special Configuration Notes

- **Node options:** Both dev and start commands use `NODE_OPTIONS=--max-http-header-size=32768` to support large Azure OAuth tokens (chunked into multiple cookies by Supabase)
- **Image optimization:** Next.js images allowed from Supabase URLs (`*.supabase.co`, `*.supabase.in`) and Unsplash
- **Security headers:** Comprehensive set via Next.js config (Frame options, Content-Type, XSS protection, HSTS)
- **Path aliases:** `@/*` maps to `src/*` for cleaner imports

---

*Stack analysis: 2026-02-25*
