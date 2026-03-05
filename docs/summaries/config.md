# Config Files

- **next.config.js** — Image remotePatterns (Supabase only) and security headers. Removed unused `images.unsplash.com` and `**.supabase.in` patterns.
- **tailwind.config.ts** — shadcn/ui tokens, McGill brand palette, typography and animate plugins. Removed dead `src/pages/**` content glob.
- **tsconfig.json** — Strict TS, bundler resolution, `@/` path alias. No changes.
- **vercel.json** — Build command, region, API cache headers. No changes.
- **vitest.config.ts** — jsdom environment, React plugin, `@/` alias. No changes.
- **vitest.setup.ts** — Loads jest-dom matchers. No changes.
- **postcss.config.js** — Tailwind + autoprefixer. Removed trailing blank lines.
- **package.json** — Standard Next.js scripts plus `check:feedback`. No changes.
