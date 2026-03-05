# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript 5.4.0 - All application code (`src/`), strict mode enabled in `tsconfig.json`

**Secondary:**
- SQL - Supabase migrations (`supabase/migrations/`)
- TypeScript (Deno) - Supabase Edge Functions (`supabase/functions/events-webhook/index.ts`)

## Runtime

**Environment:**
- Node.js 20 (specified in `.github/workflows/ci.yml`)
- Deno runtime for Supabase Edge Functions

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.0.3 (`next`) - Full-stack React framework, App Router
- React 18.3.0 (`react`, `react-dom`) - UI rendering

**Testing:**
- Vitest (config at `vitest.config.ts`) - Unit test runner, jsdom environment
- `@vitejs/plugin-react` - React support in Vitest

**Build/Dev:**
- PostCSS 8.4.35 (`postcss.config.js`) - CSS processing
- Autoprefixer 10.4.17 - CSS vendor prefixes
- ESLint 9.39.1 (`eslint.config.mjs`) - Linting, uses `eslint-config-next/core-web-vitals`
- Prettier 3.2.5 - Code formatting (no config file detected; uses defaults)

## Styling

**CSS Framework:**
- Tailwind CSS 3.4.1 - Utility-first CSS (`tailwind.config.ts`)
- `tailwindcss-animate` 1.0.7 - Animation utilities
- `@tailwindcss/typography` 0.5.10 - Prose styling plugin

**Component Library:**
- shadcn/ui primitives in `src/components/ui/` (uses Radix UI underneath)
- `@radix-ui/react-dialog` ^1.1.15
- `@radix-ui/react-dropdown-menu` ^2.1.16
- `@radix-ui/react-slider` ^1.3.6
- `@radix-ui/react-slot` ^1.2.4
- `@radix-ui/react-switch` ^1.2.6
- `@radix-ui/react-tabs` ^1.1.13

**Utility:**
- `class-variance-authority` 0.7.1 - Component variant styling
- `clsx` 2.1.0 - Conditional class merging
- `tailwind-merge` 2.2.1 - Tailwind class deduplication
- `cn()` helper at `src/lib/utils.ts` combines clsx + tailwind-merge

**Dark Mode:**
- Tailwind `darkMode: ["class"]` in `tailwind.config.ts`
- McGill brand palette defined under `theme.extend.colors.mcgill`

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.49.0 - Supabase client SDK (database, auth, storage)
- `@supabase/ssr` ^0.7.0 - SSR-compatible Supabase client (cookie-based auth)
- `swr` ^2.3.7 - Data fetching/caching for client components
- `zustand` ^5.0.9 - Client-side state management (no stores directory found; may be used inline)

**UI/UX:**
- `lucide-react` ^0.344.0 - Icon library
- `embla-carousel-react` ^8.6.0 - Carousel/slider component
- `react-easy-crop` ^5.5.6 - Image cropping for avatars/uploads

**Data/Utilities:**
- `date-fns` ^3.3.1 - Date formatting and parsing

**API Documentation:**
- `swagger-ui-react` ^5.30.2 - Swagger UI rendering
- `next-swagger-doc` ^0.4.1 - OpenAPI spec generation from JSDoc annotations
- `redoc` ^2.5.2 - Alternative API docs viewer
- `@swagger-api/apidom-ns-openapi-3-1` ^1.0.0-rc.3 - OpenAPI 3.1 types

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Target: ES2020
- Module: ESNext with bundler resolution
- Strict mode: enabled
- Path alias: `@/*` maps to `./src/*`
- JSX: react-jsx

**Tailwind:**
- Config: `tailwind.config.ts`
- Content paths: `./src/pages/**`, `./src/components/**`, `./src/app/**`, `./src/lib/**`
- Custom McGill brand colors defined in theme
- CSS variable-based design tokens for shadcn/ui

**ESLint:**
- Config: `eslint.config.mjs` (flat config format)
- Extends: `eslint-config-next/core-web-vitals`
- Ignores: `.claude/**`, `.next/**`, `AI/**`, `node_modules/**`, `demo-video/**`

**Next.js:**
- Config: `next.config.js`
- Remote image patterns: `**.supabase.co`, `**.supabase.in`, `images.unsplash.com`
- Security headers: X-Frame-Options DENY, HSTS, X-Content-Type-Options nosniff, X-XSS-Protection, strict Referrer-Policy

**Environment:**
- `.env.local` - Local secrets (not committed)
- `.env.local.example` - Template with required var names
- Required vars:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-only, secret)
  - `CRON_SECRET` - Cron job authentication token
- Optional vars:
  - `RECOMMENDATION_API_URL` - Two-Tower recommendation service URL (defaults to `http://localhost:8000`)
  - `ADMIN_EMAILS` - Comma-separated list of admin email addresses

## Platform Requirements

**Development:**
- Node.js 20+
- npm
- Supabase CLI (for local Supabase development and migrations)
- Optional: Deno (for edge function development)

**Production:**
- Vercel (see `vercel.json`)
- Region: `iad1` (US East)
- Framework: `nextjs`
- API cache headers: `s-maxage=60, stale-while-revalidate=300`

**CI/CD:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Runs on: push to `main`, PRs to `main`
- Steps: lint, TypeScript type-check (`tsc --noEmit`), build
- No test step in CI pipeline

---

*Stack analysis: 2026-03-05*
