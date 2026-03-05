# API Routes Summary

Audited all 41 API route files. Applied subtraction-only cleanup:

- **Error shape**: Standardized 7 routes (`events/popular`, `recommendations`, `recommendations/analytics`, `recommendations/feedback` ×2, `recommendations/sync`) to `{ error: string }` — removed `detail`/`details`/`stack` fields.
- **Debug logs**: Removed 2 `console.log` calls in `auth/callback` (deleted non-McGill user, admin role auto-assign).
- **Auth guards**: All mutation routes already had auth checks — none added.
- **Input validation**: Existing checks already catch missing required fields.
- **Duplicate check**: `/api/organizer-requests` (user-facing: submit/view own) vs `/api/admin/organizer-requests` (admin-facing: list/review all) — distinct purposes, not duplicates.
