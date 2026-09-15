/**
 * GENERATED — do not hand-edit.
 *
 * The shrink-only ratchet of legacy service-role callsites under src/app/**.
 *
 * Regenerate:
 *
 *     node scripts/check-elevated-ratchet.mjs --write
 *
 * which is exactly this primitive, in committed form:
 *
 *     grep -rl "supabase/service\\|@supabase/supabase-js" src/app/ \\
 *       | sed 's|\\[|\\\\[|g; s|\\]|\\\\]|g' | sort
 *
 * THIS LIST MAY ONLY SHRINK. Every entry is a file that reaches the
 * RLS-bypassing service-role credential without going through
 * src/server/db/elevated/. Phases 4-6 delete rows from it as each route is
 * migrated to the seam; nothing may ever add one.
 * scripts/check-elevated-ratchet.mjs asserts that direction on every run.
 *
 * BRACKETS MUST BE ESCAPED. ESLint `files` entries are globs, and a Next.js
 * dynamic segment like [id] is read as a CHARACTER CLASS matching one of 'i'
 * or 'd' — so an unescaped entry matches NOTHING and the file silently stays
 * under the rule. Measured on this tree: unescaped -> 12 errors leak through;
 * escaped -> 0. 13 of the 24 entries below are dynamic routes, so
 * this is the majority case, not an edge case.
 *
 * Generated: 2026-09-15T21:07:41Z
 * Count at generation: 24
 */
export const LEGACY_ELEVATED_CALLSITES = [
  "src/app/api/admin/calculate-popularity/route.ts",
  "src/app/api/admin/clubs/\\[id\\]/route.ts",
  "src/app/api/admin/events/\\[id\\]/edits/route.ts",
  "src/app/api/admin/events/\\[id\\]/status/route.ts",
  "src/app/api/admin/organizer-requests/\\[id\\]/route.ts",
  "src/app/api/admin/organizers/route.ts",
  "src/app/api/admin/reports/\\[id\\]/route.ts",
  "src/app/api/admin/reports/route.ts",
  "src/app/api/admin/users/\\[id\\]/ban/route.ts",
  "src/app/api/clubs/\\[id\\]/appeal/route.ts",
  "src/app/api/clubs/\\[id\\]/route.ts",
  "src/app/api/clubs/\\[id\\]/transfer/route.ts",
  "src/app/api/clubs/route.ts",
  "src/app/api/cron/send-feedback-requests/route.ts",
  "src/app/api/cron/send-reminders/route.ts",
  "src/app/api/events/\\[id\\]/appeal/route.ts",
  "src/app/api/moderation/reviews/\\[targetType\\]/\\[targetId\\]/route.ts",
  "src/app/api/profile/avatar/route.ts",
  "src/app/api/profile/banner/route.ts",
  "src/app/api/recommendations/batch/route.ts",
  "src/app/api/users/\\[id\\]/route.ts",
  "src/app/api/users/me/suggestions/route.ts",
  "src/app/auth/callback/route.ts",
  "src/app/users/\\[id\\]/page.tsx",
];
