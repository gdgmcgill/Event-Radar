# Instagram Scrape Pipeline — Design Spec

## Overview

A two-part pipeline orchestrated by Claude Code to populate the Uni-Verse database with real club and event data from Instagram.

## Architecture

```
Instagram Handles (user input)
        │
        ▼
Claude Code (Apify MCP) ──► Scrape profiles + posts
        │
        ▼
scripts/upload-images.ts ──► Download images → Upload to Supabase Storage
        │
        ▼
Claude Code (Supabase MCP) ──► Parse captions → Insert clubs + events
```

## Components

### 1. Apify Scraping (Claude Code via MCP)

- Uses `apify/instagram-profile-scraper` Actor
- Max 3 handles per Apify call
- Extracts: profile info (name, bio, profile pic URL) + `latestPosts`

### 2. Image Upload Script (`scripts/upload-images.ts`)

**Purpose**: Download ephemeral Instagram CDN images and upload to permanent Supabase Storage.

**Input** (JSON via stdin):
```json
{
  "club_logos": [
    { "handle": "bolt.mcgill", "url": "https://scontent-..." }
  ],
  "event_images": [
    { "slug": "bolt-mcgill-event-name", "url": "https://scontent-..." }
  ]
}
```

**Process**:
1. Read JSON from stdin
2. Download each image via `fetch` (10s timeout, 2 retries)
3. Upload to Supabase Storage:
   - Club logos → `club-logos/{handle}.jpg`
   - Event images → `event-images/{slug}.jpg`
4. Use `upsert: true` so re-runs overwrite existing images

**Output** (JSON to stdout):
```json
{
  "club_logos": {
    "bolt.mcgill": "https://xgfetrzyjroiqpwhksjw.supabase.co/storage/v1/object/public/club-logos/bolt.mcgill.jpg"
  },
  "event_images": {
    "bolt-mcgill-event-name": "https://xgfetrzyjroiqpwhksjw.supabase.co/storage/v1/object/public/event-images/bolt-mcgill-event-name.jpg"
  }
}
```

**Dependencies**: `@supabase/supabase-js` (already installed), native `fetch`. Run with `npx tsx`.

**Env vars required**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (loaded from `.env.local` via dotenv).

### 3. Caption Parsing & DB Insert (Claude Code via Supabase MCP)

Claude Code performs:
- **Post filtering**: Skip `type === "Video"` (reels), only posts from last 14 days
- **Event detection**: Identify posts that are event announcements (have date/time/location)
- **Data extraction**: Parse title, date/time, location, description, tags from caption
- **Club insert**: Insert/upsert club rows with permanent Storage URLs
- **Event insert**: Insert event rows linked to `club_id` with permanent Storage URLs

## Filtering Rules

| Rule | Detail |
|------|--------|
| No reels | Skip posts where `type === "Video"` |
| 14-day window | Only posts with `timestamp >= (today - 14 days)` |
| Events only | Skip memes, team intros, merch, elections, recaps |
| Batch size | Max 3 Instagram handles per Apify call |

## Database Mapping

### Clubs

| Instagram Field | DB Column |
|----------------|-----------|
| `fullName` | `name` |
| `biography` | `description` |
| `profilePicUrl` (→ Storage) | `logo_url` |
| `username` | `instagram_handle` |
| `externalUrl` | `website_url` |
| (inferred) | `category` |
| `"approved"` | `status` |

### Events

| Source | DB Column |
|--------|-----------|
| Parsed from caption | `title` |
| Parsed from caption | `description` (cleaned, no hashtags) |
| Parsed from caption | `start_date`, `end_date` |
| Parsed from caption / `locationName` | `location` |
| `displayUrl` (→ Storage) | `image_url` |
| Club name | `organizer` |
| Club UUID | `club_id` |
| Inferred from content | `tags` (EventTag enum values) |
| `"instagram"` | `source` |
| Post URL | `source_url` |
| Parsed from caption | `is_free`, `price` |
| `"approved"` | `status` |

## Valid EventTag Values

`academic`, `social`, `sports`, `career`, `cultural`, `wellness`, `music`, `tech`, `food`, `volunteer`, `arts`, `networking`

## Idempotency

- Club logos uploaded with `upsert: true` — re-runs overwrite
- Clubs should be upserted on `instagram_handle` to avoid duplicates
- Events use `source_url` (Instagram post URL) as a natural dedup key
