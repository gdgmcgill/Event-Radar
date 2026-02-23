# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- TypeScript 5.4.0 - All source code (strict mode enabled via `tsconfig.json`)

**Secondary:**
- JavaScript - Configuration files (`postcss.config.js`, `next.config.js`, `eslint.config.mjs`)

## Runtime

**Environment:**
- Node.js (no specific version pinned - no `.nvmrc` file)

**Package Manager:**
- npm (version managed in `package-lock.json`)
- Lockfile: present

## Frameworks

**Core:**
- Next.js 16.0.3 - Full-stack framework with App Router, API routes, middleware
- React 18.3.0 - UI library

**UI Components & Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework
- shadcn/ui (via @radix-ui components) - Accessible component library
  - @radix-ui/react-dialog ^1.1.15
  - @radix-ui/react-dropdown-menu ^2.1.16
  - @radix-ui/react-slider ^1.3.6
  - @radix-ui/react-switch ^1.2.6
  - @radix-ui/react-slot ^1.0.2
- Lucide React 0.344.0 - Icon library
- Tailwind Merge 2.2.1 - Utility for merging Tailwind classes
- Tailwind CSS Animate 1.0.7 - Animation utilities
- Class Variance Authority 0.7.1 - Component variant system

**Testing:**
- Vitest 4.0.18 - Unit/component test runner
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - Custom matchers
- @testing-library/user-event 14.6.1 - User interaction simulation
- jsdom 28.1.0 - DOM implementation for testing

**Build/Dev:**
- TypeScript 5.4.0 - Type checking and compilation
- Autoprefixer 10.4.17 - CSS vendor prefixing
- PostCSS 8.4.35 - CSS processing
- ESLint 9.39.1 - Code linting (extends `eslint-config-next`)
- Prettier 3.2.5 - Code formatting
- Cross-env 10.1.0 - Cross-platform environment variables
- @vitejs/plugin-react 5.1.4 - React support for Vitest

## Key Dependencies

**Critical:**
- @supabase/ssr 0.7.0 - Server-side Supabase integration for cookie handling in Next.js
- @supabase/supabase-js 2.49.0 - Supabase JavaScript client for database and auth
- swr 2.3.7 - Data fetching library for React hooks
- zustand 5.0.9 - Lightweight state management library

**Date & Time:**
- date-fns 3.3.1 - Date manipulation and formatting utilities

**Image & Media:**
- react-easy-crop 5.5.6 - Image cropping component
- embla-carousel-react 8.3.0 - Headless carousel component

**API Documentation:**
- next-swagger-doc 0.4.1 - Swagger/OpenAPI doc generation from route comments
- @swagger-api/apidom-ns-openapi-3-1 1.0.0-rc.3 - OpenAPI 3.1 support
- swagger-ui-react 5.30.2 - Interactive API documentation UI
- redoc 2.5.1 - Alternative API documentation viewer
- yaml 2.8.2 - YAML parsing (for Swagger spec generation)

**Utilities:**
- clsx 2.1.0 - Utility for constructing class strings
- @types/node 20.11.0 - Node.js type definitions
- @types/react 18.2.0 - React type definitions
- @types/react-dom 18.2.0 - React DOM type definitions
- @types/swagger-ui-react 5.18.0 - Swagger UI type definitions

## Configuration

**Environment:**
- `.env.local` (Git-ignored, contains Supabase credentials and cron secret)
- `.env.local.example` provided as template
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key for browser access
  - `SUPABASE_SERVICE_ROLE_KEY` - Secret key for server-side operations
  - `CRON_SECRET` - Authentication token for scheduled jobs (set in Vercel)
  - `ADMIN_EMAILS` (optional) - Comma-separated admin email list for auto-role assignment

**Build:**
- `next.config.js` - Next.js configuration with:
  - Remote image patterns for Supabase and Unsplash
  - Security headers (X-Frame-Options, CSP, HSTS, etc.)
- `tsconfig.json` - TypeScript configuration with:
  - Path alias: `@/*` → `src/*`
  - Strict mode enabled
  - Target: ES2020
- `tailwind.config.ts` - Tailwind CSS configuration with custom theme colors
- `postcss.config.js` - PostCSS config for Tailwind and Autoprefixer
- `vitest.config.ts` - Vitest configuration:
  - Environment: jsdom (DOM testing)
  - Setup file: `vitest.setup.ts`
  - Globals enabled
  - Excludes: `supabase/**`, `src/lib/kmeans.test.ts`

**Code Quality:**
- `.eslintrc` extensions via `eslint.config.mjs` - ESLint configuration extending Next.js core web vitals
- `.prettierrc` (inferred to exist but auto-configured)

## Platform Requirements

**Development:**
- Node.js (LTS recommended, no version pinned)
- npm for package management

**Production:**
- Vercel (recommended deployment platform per `CRON_SECRET` environment variable)
- Supabase project (database and authentication backend)

---

*Stack analysis: 2026-02-23*
