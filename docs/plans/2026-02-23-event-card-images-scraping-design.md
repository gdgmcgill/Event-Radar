# Event Card Images & Scraping Robustness Design

**Date:** 2026-02-23
**Status:** Approved

## Problem

1. Event card images all show placeholders — Instagram CDN URLs expire in 1-3 hours, so stored `displayUrl` links break
2. Clicking an event card navigates to the detail page but lands on the wrong section instead of the top
3. Scraping pipeline hasn't been tested end-to-end with real data

## Solution

### 1. Image Pipeline — Supabase Storage

Instagram CDN URLs are temporary. During the scrape pipeline, images must be downloaded immediately and re-hosted in Supabase Storage (already integrated, free tier covers our volume).

**Flow:**
```
Apify scrape → displayUrl (expires 1-3 hrs)
  → Download image as buffer immediately
  → Upload to Supabase Storage bucket "event-images"
  → Store permanent Supabase URL in events.image_url
  → Next.js <Image> serves optimized/cached via Vercel edge
```

**Bucket:** `event-images` (public)
**Naming:** `{timestamp}-{hash}.{ext}`
**Failure mode:** If image download/upload fails, event still created with `image_url: null` (placeholder shown)

**Why Supabase Storage:**
- Already on Supabase — zero new dependencies
- `next.config.js` already whitelists `**.supabase.co`
- Free tier: 1 GB storage, 2 GB egress (Vercel cache reduces egress)
- ~600 MB for 2000 events/year at ~300KB avg

### 2. Event Detail Page Scroll Fix

Add `window.scrollTo(0, 0)` on mount in `EventDetailClient.tsx` to ensure the page starts at the top when navigating from an event card.

### 3. Scraping Tests

**Unit/integration tests:**
- Verify `normalizeApifyOutput()` maps `displayUrl` → `image_url`
- Test `downloadAndUploadImage()` with mocked Supabase Storage
- Verify image_url flows through classifier → webhook → database

**Live end-to-end test:**
- Run Apify against real McGill club Instagram accounts
- Feed through full pipeline: classify → upload images → webhook → DB
- Verify images render on event cards in the frontend

## Files Changed

| Area | Change | Files |
|------|--------|-------|
| Image pipeline | `downloadAndUploadImage()` function | `classifier-pipeline.ts` |
| Image pipeline | Integrate upload into pipeline run | `classifier-pipeline.ts` |
| Supabase | Create `event-images` storage bucket | Migration or manual |
| Scroll fix | Reset scroll on mount | `EventDetailClient.tsx` |
| Tests | Image extraction + pipeline tests | `classifier-pipeline.test.ts` |
| Tests | E2E scrape test script | New test script |
