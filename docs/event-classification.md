# Event Classification System

Design document for classifying Instagram posts from McGill club accounts as EVENT vs NON-EVENT before they enter the `pending_events` pipeline.

## 1. Approach: Hybrid Heuristic + Regex

### Why heuristic over LLM?

We chose a **regex/heuristic classifier** over an LLM-based approach for these reasons:

| Factor | Heuristic | LLM (e.g. Claude) |
|--------|-----------|-------------------|
| Cost per post | ~0 | ~$0.01-0.05 |
| Latency | <1ms | 500ms-2s |
| Monthly cost (600 posts) | $0 | $6-30 |
| Deterministic | Yes | No |
| Debuggable | Regex patterns are inspectable | Black box |
| Bilingual support | Explicit French patterns | Native but costly |

For an MVP scraping ~20-30 club accounts daily with 7-day lookback (roughly 20-30 posts/day), the heuristic approach is more than sufficient. LLM classification can be added later for the manual_review tier (ambiguous posts with confidence 0.4-0.7).

### How it works

The classifier scores each post against 7 weighted signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| `date_detected` | +0.30 | A date was found in the caption |
| `time_detected` | +0.20 | A time was found in the caption |
| `location_detected` | +0.20 | A location was found (@ prefix, known building, or "Location:" label) |
| `event_keywords` | +0.15 | Contains phrases like "join us", "RSVP", "workshop", etc. |
| `non_event_keywords` | -0.20 | Contains phrases like "throwback", "recap", "congrats" |
| `substantial_caption` | +0.05 | Caption is >80 characters |
| `call_to_action` | +0.10 | Contains "link in bio", "register", "sign up", etc. |

**Maximum possible score:** 1.0 (all positive signals, no negative signals)

A post with date + time + location + event keywords + CTA = 0.95 confidence.

## 2. Code Implementation

### File Locations

| File | Purpose |
|------|---------|
| `src/lib/classifier.ts` | Core classification logic, regex patterns, confidence scoring |
| `src/lib/classifier-pipeline.ts` | Pipeline integration: normalizes Apify output, builds webhook payloads, sends to webhook |
| `src/lib/classifier.test.ts` | 31 unit tests covering all extraction and classification scenarios |

### Key Types

```typescript
// Input: raw Instagram post from Apify
interface InstagramPost {
  id: string;
  caption: string;
  timestamp: string;
  image_url: string;
  account: string;
}

// Output: classification decision with confidence
interface ClassificationResult {
  post_id: string;
  is_event: boolean;
  confidence: number;          // 0.0 to 1.0
  extracted_fields: ExtractedEvent | null;
  signals: ClassificationSignal[];
  raw_post: InstagramPost;
}
```

### Key Functions

- **`classifyPost(post)`** - Classify a single post. Returns `ClassificationResult`.
- **`classifyBatch(posts)`** - Classify multiple posts, sorted by confidence (highest first).
- **`partitionByAction(results)`** - Split results into `auto_pending`, `manual_review`, `auto_discard`.
- **`extractDate(caption, refTimestamp)`** - Parse dates from captions (English + French).
- **`extractTime(caption)`** - Parse times (12h, 24h, French "18h30").
- **`extractLocation(caption)`** - Find locations via @, pin emoji, "Location:" prefix, or known McGill buildings.

### Pipeline Integration

The pipeline sits between Apify and the existing `events-webhook`:

```
Apify Instagram Scraper
  |
  v
normalizeApifyOutput()     -- Transform Apify format to InstagramPost[]
  |
  v
classifyBatch()            -- Score each post
  |
  v
partitionByAction()        -- Split into 3 tiers
  |
  +--> auto_pending -----> sendToWebhook() --> events-webhook --> DB (status: pending)
  |
  +--> manual_review ----> (flagged for admin review in a future UI)
  |
  +--> auto_discard -----> (logged and skipped)
```

The `sendToWebhook()` function in `classifier-pipeline.ts` handles HMAC signing and HTTP POST to the existing `events-webhook` Edge Function. No changes to the webhook are needed.

## 3. Confidence Scoring Methodology

### Thresholds

| Tier | Confidence Range | Action |
|------|-----------------|--------|
| `auto_pending` | >= 0.70 | Automatically sent to pending_events via webhook |
| `manual_review` | 0.40 - 0.69 | Flagged for admin review |
| `auto_discard` | < 0.40 | Discarded (logged for debugging) |

### Score Examples

| Caption Snippet | Date | Time | Loc | Keywords | Non-event | Caption | CTA | Score |
|----------------|------|------|-----|----------|-----------|---------|-----|-------|
| "Join us March 15 at 7 PM @ SSMU! RSVP" | +0.30 | +0.20 | +0.20 | +0.15 | 0 | +0.05 | +0.10 | **1.00** |
| "Workshop Feb 28, 4:30 PM, Leacock 232" | +0.30 | +0.20 | +0.20 | +0.15 | 0 | +0.05 | 0 | **0.90** |
| "Save the date! More details coming soon" | 0 | 0 | 0 | +0.15 | 0 | +0.05 | 0 | **0.20** |
| "Throwback to our gala last week!" | 0 | 0 | 0 | 0 | -0.20 | +0.05 | 0 | **0.05** |
| "POV: exam season" | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.00** |

### Signal Transparency

Every `ClassificationResult` includes the full `signals[]` array so admins/developers can see exactly why a post was classified the way it was. This makes debugging and threshold tuning straightforward.

## 4. Field Extraction Details

### Date Extraction

Supports these formats (English and French):

- `Monday, January 15` / `January 15th` / `Jan 15`
- `15 January` / `15th of January`
- `MM/DD/YYYY` / `MM-DD-YYYY`
- `YYYY-MM-DD`
- `le 15 janvier` / `15 fevrier` (French months)

When no year is specified, the classifier uses the post's timestamp year as reference.

### Time Extraction

Uses named capture groups for reliable parsing:

- `5:30 PM` / `5:30PM` / `5:30 pm` (12-hour with minutes)
- `5 PM` / `5PM` (12-hour without minutes)
- `17:30` (24-hour)
- `18h30` (French format)
- `5-7 PM` / `5:30-7:00 PM` (time ranges, extracts start time)

### Location Extraction

Checked in priority order:

1. `@` prefix or pin emoji: `@ Shatner Building`, `📍Thomson House`
2. Label prefix: `Location: SSMU`, `Lieu: Arts Building`, `Where: McConnell`
3. Known McGill buildings: 25+ building names including Leacock, Burnside, McConnell, Redpath, SSMU, Shatner, Thomson House, Trottier, Schulich, Bronfman, etc.

### Tag Classification

Maps caption keywords to the 6 canonical `EventTag` values: `academic`, `social`, `sports`, `career`, `cultural`, `wellness`. Falls back to `social` if no keywords match. This is consistent with the existing `tagMapping.ts` in the codebase.

## 5. Edge Cases and Limitations

### Handled Edge Cases

| Edge Case | How It's Handled |
|-----------|-----------------|
| **Empty/image-only posts** | Returns `is_event: false`, confidence 0, null fields |
| **Bilingual captions (French)** | French date patterns, French event keywords, French location labels |
| **Non-event keywords in event posts** | Negative weight partially cancels positive signals; a strong event post still passes |
| **Multiple dates in caption** | Takes the first matched date (which is typically the event date) |
| **Time ranges (5-7 PM)** | Extracts start time |
| **Ordinal dates (15th, 2nd)** | Stripped by regex before parsing |
| **Known McGill buildings** | 25+ building names hard-coded for reliable location detection |

### Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| **Image-only event flyers** | Posts where event details are in the image, not caption | Cannot classify; falls to auto_discard. Future: OCR on images or LLM vision |
| **Multi-event posts** | One post advertising 3 different events | Only one event extracted. Future: split by date anchors |
| **Relative dates** ("this Friday", "next week") | Not parsed | Could be added with day-of-week resolution relative to post timestamp |
| **Non-standard locations** ("on Zoom", "online") | Not detected by building patterns | Could add virtual event patterns |
| **Very short captions** | "Gala tmrw 7pm" loses context | Low caption weight mitigates false confidence |

## 6. Open Questions

1. **Where should the pipeline run?** Options:
   - A) **Supabase Edge Function** triggered by a cron job (matches existing architecture)
   - B) **Next.js API route** called by an external cron (Vercel cron)
   - C) **Standalone script** run by GitHub Actions on a schedule

   Recommendation: Option A (Supabase Edge Function) for consistency with the existing webhook.

2. **Manual review UI**: Posts in the `manual_review` tier (0.4-0.7 confidence) need a UI for admins to approve/reject. The existing admin dashboard could be extended with a "Review Scraped Posts" section showing the raw Instagram post alongside extracted fields.

3. **Deduplication**: If the scraper runs daily with a 7-day lookback, the same post will be scraped multiple times. Deduplication by Instagram post ID is needed before classification. This could be a simple check against a `scraped_post_ids` table or column.

4. **LLM fallback for manual_review tier**: Should ambiguous posts (0.4-0.7 confidence) be sent to an LLM for a second opinion before admin review? This would cost ~$0.01-0.05 per post and only apply to ~5-10 posts/day.

5. **Confidence threshold tuning**: The current thresholds (0.7/0.4) are initial estimates. After collecting real data from McGill club accounts, these should be tuned based on precision/recall metrics.

## 7. Test Coverage

31 unit tests covering:

- **Classification scenarios**: clear events, recaps, memes, empty captions, bilingual posts
- **Date extraction**: 7 format variants including French
- **Time extraction**: 7 format variants (12h, 24h, French, ranges, edge cases like noon/midnight)
- **Location extraction**: @-prefix, label prefix, known buildings, pin emoji
- **Batch processing**: sorting by confidence
- **Partitioning**: correct bucketing into auto_pending/manual_review/auto_discard

Run with: `npx vitest run src/lib/classifier.test.ts`
