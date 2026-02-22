# Devil's Advocate Review: Uni-Verse System Design

**Date:** 2026-02-22
**Scope:** Event classification, recommendation engine, integration pipeline
**Severity scale:** BLOCKER (must fix before launch), MAJOR (should fix soon), MINOR (nice to have)

---

## 1. Event Classification Critique

### 1.1 LLM Classification Is Overkill for This Scale

**Problem:** The proposed pipeline involves using an LLM (e.g., GPT-4, Claude) to classify Instagram posts as events vs. non-events. The actual volume is ~20 club accounts posting 2-5 times per week, producing 40-100 posts per week.

**Severity:** MAJOR

**Analysis:**
- 40-100 posts/week is a trivially small volume. A human could manually review all of them in 15-20 minutes per day.
- LLM API cost estimate: At ~$0.01-0.03 per classification call (GPT-4o-mini with a system prompt + post caption), that is $0.40-$3.00/week, or $2-$12/month. The cost itself is low, but the operational complexity of managing API keys, handling rate limits, retries, prompt versioning, and monitoring accuracy far exceeds the value at this scale.
- An LLM adds a dependency on an external service. If OpenAI has an outage during orientation week, the entire pipeline stalls.

**Simpler alternative:** A two-pass approach:
1. **First pass: Regex/keyword heuristics.** McGill club event posts overwhelmingly follow predictable patterns: they contain dates (e.g., "Jan 15", "January 15th", "15/01"), times ("7pm", "19:00", "7 PM"), and location keywords ("Leacock", "SSMU", "McConnell", "Arts Building", "Trottier"). A regex-based classifier checking for the co-occurrence of date + time + location keywords would likely achieve 80-90% accuracy. This can run entirely within the Supabase Edge Function or a Next.js API route with zero external dependencies.
2. **Second pass: Admin review queue.** Everything goes to the admin pending queue regardless. The classifier's confidence score just determines the sort order: high-confidence items at the top for quick approval, low-confidence items at the bottom for closer review.

This eliminates the LLM dependency entirely and defers the "intelligence" to the human admin, who needs to review posts anyway for data quality.

### 1.2 The Bilingual Problem Is Simpler Than It Seems

**Problem:** McGill is bilingual (English/French). Some clubs post in French, some in English, some in both. How does classification handle this?

**Severity:** MINOR

**Analysis:**
- The keywords that matter for classification (dates, times, locations) are largely language-agnostic. "15 janvier" contains a date just like "January 15". Location names ("SSMU", "Leacock 132") are proper nouns in both languages.
- A regex approach naturally handles this: just include French month names and common French event words ("evenement", "atelier", "conference") alongside English ones.
- An LLM approach actually handles this well out of the box, but it is not worth the overhead just for bilingual support.

**Simpler alternative:** Extend the keyword dictionary with ~20 French terms. This is a one-time, 30-minute effort.

### 1.3 False Positive/Negative Trade-off Is Wrong

**Problem:** The discussion focuses on minimizing false negatives (missed events). But in a system with human review, false positives (non-events classified as events) are almost cost-free -- they just appear in the admin queue and get rejected. False negatives are more costly because they silently disappear.

**Severity:** MAJOR

**Simpler alternative:** Bias the classifier heavily toward recall over precision. In practice, this means: **if in doubt, classify as event.** A simple heuristic: if a post from a club account contains any date-like pattern, send it to the pending queue. This maximizes recall at the cost of more admin review, but with only 40-100 posts/week the admin burden is negligible.

### 1.4 What About Posts That Are Both Events and Announcements?

**Problem:** Many Instagram posts are hybrid -- they announce both an event and general club news. A binary event/not-event classifier loses this nuance.

**Severity:** MINOR

**Simpler alternative:** Do not try to classify intent at all. Instead, extract structured data (date, time, location, title) from every post. If extraction succeeds, treat it as an event. If extraction fails, skip it. This sidesteps the classification problem entirely by reframing it as an extraction problem.

---

## 2. Recommendation Engine Critique

### 2.1 k-Means with k=3 on 6 Dimensions Is Statistically Questionable

**Problem:** The current active recommendation system (`src/app/api/recommendations/route.ts` + `src/lib/kmeans.ts`) clusters all users into k=3 groups using 6-dimensional binary vectors (one dimension per tag category: academic, social, sports, career, cultural, wellness).

**Severity:** MAJOR

**Analysis:**
- With 6 binary dimensions, there are only 2^6 = 64 possible distinct user vectors (in practice, most users select 2-3 tags, reducing this further). Clustering 64 or fewer distinct points into 3 clusters is not statistically meaningful -- you are just drawing arbitrary boundaries.
- The PRD targets 100 beta users at MVP. With 100 users and 3 clusters, each cluster averages ~33 users. The collaborative filtering signal ("users in your cluster saved this event") is extremely noisy at this size. A single outlier user who saves many events will dominate the recommendations for their entire cluster.
- The k-means initialization is deterministic (first k points), which means recommendations are sensitive to the order of user IDs in the database. This is a subtle but real source of non-reproducible behavior.
- The algorithm fetches ALL users and ALL saved events on every recommendation request (`route.ts` lines 108-131). With 100 users this is fine, but with 1000+ users this becomes an O(n) database scan per request.

**Simpler alternative:** Skip clustering entirely. The fallback path (lines 253-286 in `route.ts`) already implements the simpler and more effective approach: match events to the user's interest tags, sorted by date. This is what the PRD's own "Algorithm (MVP)" section describes (PRD line ~462). The k-means clustering adds complexity without proportional value at this user base size.

If you want collaborative filtering, a much simpler version: "users who saved event X also saved event Y" -- a simple co-occurrence count, computable with a single SQL query. No clustering needed.

### 2.2 The Two-Tower Neural Net Has No Training Data

**Problem:** The `AI/` directory contains a complete two-tower recommendation architecture with PyTorch, sentence-transformers (MiniLM-L6-v2), FAISS, and FastAPI. But it has no training pipeline, no training data, and no way to collect training data.

**Severity:** BLOCKER (for the two-tower system, not for the overall app)

**Analysis:**
- The two-tower architecture requires contrastive training: you need (user, positive_event, negative_event) triplets to train the projection MLPs. Without training, the projection layers are randomly initialized, meaning the recommendations are essentially random.
- The `AI/requirements.txt` pulls in `sentence-transformers>=2.3.0`, `torch`, `faiss-cpu>=1.9.0`, and `numpy`. This is ~500MB+ of dependencies for a service that, without trained weights, produces random dot-product scores.
- The `src/app/api/recommendations/sync/route.ts` file is marked with `TODO(AS-6): Wire up recommendation sync to external AI service or remove this route`. The two-tower system is not integrated with the main app.
- The system assumes user metadata (major, year_of_study) that does not exist in the database schema. The `users` table has only `id`, `email`, `full_name`, and `interest_tags`. There is no `major` or `year_of_study` field.

**Simpler alternative:** Delete the `AI/` directory (or archive it as a future experiment). The tag-based recommendation in the main Next.js app is simpler, requires no additional infrastructure, and produces comparable results at this scale. If you later want semantic understanding, use the Supabase `pg_vector` extension with a serverless embedding API -- no separate Python service needed.

### 2.3 FAISS for <1000 Vectors Is Absurd

**Problem:** The two-tower system uses FAISS (Facebook AI Similarity Search) for vector similarity search. FAISS is designed for billion-scale vector search with approximate nearest neighbors.

**Severity:** MAJOR

**Analysis:**
- With <1000 events (PRD says 500 events at MVP), a brute-force linear scan of 128-dimensional vectors takes <0.1ms. FAISS's `IndexFlatIP` (which is what the code uses) is literally just a brute-force scan anyway -- there is no index structure being used. You are paying the complexity cost of FAISS (C++ bindings, platform-specific builds, installation issues) for exactly the same performance as `numpy.dot()`.
- FAISS `IndexFlatIP` does not support deletion. The current `remove_event` method (vector_store.py lines 216-263) rebuilds the entire index on every deletion. This is O(n) and fragile.

**Simpler alternative:** `numpy.dot(user_vector, event_matrix.T).argsort()[::-1][:k]` -- a single line of NumPy that does the same thing. Or better yet, store embeddings in Supabase with `pgvector` and do the search in SQL.

### 2.4 Hosting Cost of Python ML Service

**Problem:** The two-tower system requires a separate Python process running FastAPI + PyTorch + sentence-transformers. This needs to be deployed somewhere.

**Severity:** MAJOR

**Analysis:**
- The MiniLM-L6-v2 model is ~80MB. PyTorch CPU is ~200MB. The total container would be 500MB+.
- Vercel does not run Python services. You need a separate host: Railway, Render, Fly.io, or a VPS. The cheapest options run $5-7/month, which is more than Supabase and Vercel combined for this project.
- This service must be always-on to respond to recommendation requests. Cold starts with PyTorch model loading take 5-10 seconds.
- You now have two services to monitor, deploy, and debug instead of one.

**Simpler alternative:** Keep everything in TypeScript/Next.js. The current k-means system (or the even simpler tag-matching fallback) runs in the same Vercel deployment with zero additional infrastructure cost.

### 2.5 The Recommendation Endpoint Fetches Everything

**Problem:** The current `/api/recommendations` endpoint makes 4 sequential database queries: user profile, all users, all saved events, and all events. It then processes everything in-memory.

**Severity:** MAJOR

**Analysis:**
- `supabase.from("users").select("id, interest_tags")` -- fetches ALL users
- `supabase.from("saved_events").select("user_id, event_id")` -- fetches ALL saved events
- `supabase.from("events").select("*")` -- fetches ALL events
- With 1000 users and 500 events, this is 3 full-table scans per recommendation request. On a free Supabase tier with connection pooling limits, this will cause issues under load.

**Simpler alternative:** Use a SQL-based approach:
```sql
-- Events matching user's interest tags, ordered by popularity
SELECT e.* FROM events e
WHERE e.tags && ARRAY['academic', 'social']  -- user's interest tags
AND e.start_date > NOW()
AND e.status = 'approved'
ORDER BY (SELECT COUNT(*) FROM saved_events se WHERE se.event_id = e.id) DESC
LIMIT 20;
```
This is a single query that replaces all the in-memory processing.

---

## 3. Integration Pipeline Critique

### 3.1 Instagram Scraping ToS Risk

**Problem:** Instagram explicitly prohibits automated data collection in its Terms of Service. Apify scraping Instagram accounts is a ToS violation.

**Severity:** MAJOR

**Analysis:**
- Meta has sued scraping companies (hiQ Labs v. LinkedIn notwithstanding, Instagram is more aggressive). While enforcement against a small university project is unlikely, it creates risk for a Google Developer Group-affiliated project.
- Instagram rate-limits and blocks scrapers. Apify handles this, but scraping reliability is never 100%.
- The PRD estimates $49/month for Apify. For 20 accounts scraped daily, this seems reasonable, but pricing can change.

**Simpler alternative for MVP:** Instead of scraping, provide a simple Google Form or web form where club representatives submit their events directly. The admin dashboard already exists for review. This approach:
- Has zero ToS risk
- Costs nothing
- Gives clubs agency over their event listings
- Produces higher-quality structured data than scraping
- Is the PRD's own stated assumption: "Clubs will manually submit events if the process takes <2 minutes"

Instagram scraping can be a Phase 2 enhancement to supplement manual submissions, not a Phase 1 dependency.

### 3.2 Cron Job Reliability

**Problem:** The pipeline depends on a daily cron job at 6 AM to trigger the Apify scraper. If it fails, no new events are ingested.

**Severity:** MAJOR

**Analysis:**
- Vercel Cron has a 10-second execution timeout on the free/hobby tier. Triggering an Apify scraper, waiting for it to complete, and processing results cannot happen in 10 seconds.
- The actual pattern would be: Vercel Cron triggers Apify -> Apify webhook calls back to the events-webhook Edge Function. This is a two-step async process with no built-in retry or monitoring.
- If Apify is down, rate-limited, or returns partial results, there is no alerting mechanism. Events silently fail to appear.

**Simpler alternative:** With the manual submission approach, there is no cron job needed. If scraping is added later, use Apify's built-in scheduling (they have their own cron) with the webhook callback to the existing Edge Function. This removes Vercel Cron as a dependency.

### 3.3 Admin Approval Bottleneck

**Problem:** Every scraped event goes to a pending queue that requires admin approval. The PRD says events must be approved within 24 hours.

**Severity:** MAJOR

**Analysis:**
- During orientation week (early September), McGill has 250+ clubs running events simultaneously. Even if only 50 clubs post daily, that is 50-100 pending events per day.
- The "admin team" for a GDG campus project is likely 2-3 people. If they are also students, admin review will compete with classes, exams, and their own campus activities.
- The 24-hour approval SLA means events posted at 6 PM for the next morning could be missed.

**Simpler alternative:**
1. For club-submitted events (via form): auto-approve events from verified club accounts, no admin review needed. Trust the source.
2. For scraped events: apply the regex confidence score. Auto-approve events with confidence > 0.8. Only send ambiguous events to the admin queue.
3. Set up email/Slack notifications when new events hit the pending queue so admins can review on mobile.

### 3.4 The Webhook Is Overbuilt

**Problem:** The `supabase/functions/events-webhook/index.ts` Edge Function validates HMAC signatures, parses structured event payloads, and handles multi-status responses. This is well-built infrastructure for a webhook that currently has zero callers.

**Severity:** MINOR

**Analysis:**
- The webhook expects a specific JSON structure (`WebhookPayload` with `event_count` and `events` array). But the scraper output from Apify would be Instagram post data (captions, image URLs, timestamps), not structured events. Something needs to transform Apify output into the webhook format, and that transformation is where all the classification and extraction logic lives -- which does not exist yet.
- The HMAC verification is good security practice but adds friction to development and testing.

**Simpler alternative:** Instead of a webhook, use a simpler pattern: a Next.js API route that accepts Apify's raw output format, does the transformation and classification inline, and inserts directly into the database. This keeps the logic in one place instead of splitting it between a scraper script, a transformation layer, and a webhook.

### 3.5 End-to-End Latency

**Problem:** The pipeline as designed has significant latency: Instagram post -> daily cron (up to 24h delay) -> scraping (minutes) -> classification (seconds) -> admin review (up to 24h) -> visible on site. Total: up to 48 hours from post to visibility.

**Severity:** MAJOR

**Analysis:**
- Students posting about events tonight will not see them on Uni-Verse until tomorrow at the earliest, possibly the day after.
- This defeats the value proposition of "never miss an event." If the event is already on Instagram and appears on Uni-Verse 48 hours later, students already discovered it on Instagram.

**Simpler alternative:** Manual event submission is instant -- clubs submit, admin reviews (or auto-approved), event is live within minutes. For a scraping approach, reduce the cron frequency to every 4-6 hours and auto-approve high-confidence events to cut latency to 4-6 hours.

---

## 4. General System Critique

### 4.1 Over-Engineering for a Campus App

**Problem:** The system architecture includes: Next.js + Supabase + Python/PyTorch/FAISS + Apify + HMAC webhooks + k-means clustering + two-tower neural nets + 7 database migrations + 6 tracking tables + popularity scoring with time decay. This is designed for Netflix-scale, not campus-scale.

**Severity:** BLOCKER

**Analysis:**
- The PRD targets 100 beta users, 500 events, 20 clubs. This is a small CRUD application with a recommendation feature.
- The current codebase has ~50 source files across TypeScript, Python, and SQL. Each additional system adds maintenance burden, deployment complexity, and potential failure points.
- The team appears to be a GDG campus group, meaning student volunteers with limited time and likely high turnover. Complex systems with many moving parts are hostile to new contributors.

### 4.2 Three Recommendation Systems, Zero Shipped

**Problem:** The codebase contains three different recommendation approaches:
1. **Flask cosine similarity** (`backend/app.py` + `backend/similarity.py`) -- legacy, appears unused
2. **k-means clustering** (`src/lib/kmeans.ts` + `src/app/api/recommendations/route.ts`) -- active but questionable
3. **Two-tower neural net** (`AI/` directory) -- complete code, zero integration, zero training data

**Severity:** MAJOR

**Analysis:**
- Having three competing approaches is a sign of indecision, not sophistication.
- The Flask backend uses scikit-learn's `cosine_similarity` on the same 6-dimensional tag vectors. It does the same thing as the k-means system but simpler.
- Developer time spent building and maintaining three systems could have been spent on one good system or on other features that directly impact users.

### 4.3 User Interaction Tracking Before Users

**Problem:** The database has extensive tracking infrastructure: `user_interactions` table with 6 interaction types, `event_popularity_scores` table with pre-computed metrics, trending score calculations with 72-hour half-life exponential decay. There is also a `user_engagement_summary` migration.

**Severity:** MINOR

**Analysis:**
- This infrastructure is valuable if you have thousands of interactions to analyze. With 100 users, you will have perhaps 500-1000 interactions in the first month. A simple `COUNT(*)` query gives you all the analytics you need.
- The trending score function (`calculate_trending_score`) iterates over all interactions for an event in the last 7 days and computes per-interaction exponential decay. With >1000 interactions per event this would be slow; with <50 interactions it is unnecessary precision.
- Pre-computed popularity scores add a maintenance burden (must be recalculated) and can become stale.

**Simpler alternative:** Compute popularity on-the-fly with a SQL aggregate:
```sql
SELECT event_id, COUNT(*) as save_count
FROM saved_events
GROUP BY event_id
ORDER BY save_count DESC;
```
Add the trending calculation only when you have enough data to make it meaningful (500+ daily interactions).

---

## 5. Radical Simplification: The 2-Week MVP

If the goal is to launch Uni-Verse as a usable product in 2 weeks, here is what that looks like:

### Keep
1. **Next.js + Supabase + Vercel** -- the core stack is solid and already deployed
2. **Event browsing, filtering, and search** -- already working
3. **Save events** -- already working
4. **Admin dashboard** -- already working for manual event creation and approval
5. **McGill authentication** -- already working
6. **Onboarding with interest tags** -- already working

### Add
1. **Club event submission form** -- a simple public form (or protected form for verified clubs) that submits directly to the pending events table. 1-2 days of work.
2. **Simple tag-based recommendations** -- the fallback path in the current recommendations route, cleaned up as the primary path. Already exists, just needs to be promoted. Zero new code.
3. **Email reminders for saved events** -- the cron route already exists at `src/app/api/cron/send-reminders/route.ts`. Wire it up to Supabase SMTP. 1 day of work.

### Cut
1. **Instagram scraping** -- defer to Phase 2. Manual submission covers the MVP.
2. **Event classification (regex or LLM)** -- unnecessary if clubs submit structured data directly.
3. **k-means clustering** -- the fallback tag-matching is simpler and equally effective at this scale.
4. **Two-tower neural net** -- archive `AI/` directory. Revisit when you have 1000+ users and training data.
5. **Flask backend** -- archive `backend/` directory. It duplicates functionality that exists in Next.js.
6. **FAISS vector store** -- unnecessary at any scale this project will reach in the next year.
7. **Trending scores with exponential decay** -- replace with simple save counts until you have meaningful volume.
8. **Apify integration and webhook** -- defer to Phase 2.

### The result
- **One deployment target** (Vercel) instead of three (Vercel + Python service + Flask)
- **One language** (TypeScript) instead of two (TypeScript + Python)
- **One recommendation approach** (tag matching) instead of three
- **Zero external dependencies** beyond Supabase and Vercel
- **Zero cron jobs** that can silently fail
- **Launches in 2 weeks** instead of 2 months

---

## 6. Prioritized Action Items

### Must Do (Before Launch)
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Remove k-means clustering; promote tag-matching as primary recommendation | 2 hours | Simplifies codebase, same quality |
| 2 | Build club event submission form | 1-2 days | Enables content ingestion without scraping |
| 3 | Decide on one recommendation approach and delete the other two | 1 hour | Reduces confusion and maintenance |
| 4 | Wire up email reminders | 1 day | Core user value |

### Should Do (Within 30 Days)
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 5 | Archive `AI/` and `backend/` directories | 30 min | Cleaner repo |
| 6 | Replace full-table-scan recommendations with SQL query | 2 hours | Better performance |
| 7 | Add auto-approve for events from verified clubs | 2 hours | Reduces admin burden |
| 8 | Add basic monitoring (error alerts) | 1 day | Catch failures |

### Defer (Phase 2, After 500+ Users)
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 9 | Instagram scraping via Apify | 1 week | Supplements manual submission |
| 10 | Regex-based event classification | 3 days | Required only if scraping |
| 11 | Collaborative filtering ("users who saved X also saved Y") | 2 days | Only meaningful with data volume |
| 12 | Semantic search with pgvector | 3 days | Better than tag matching, needs embeddings |
| 13 | Two-tower model training | 2 weeks | Only with sufficient interaction data |

---

## 7. Open Questions for the Team

1. **How many events are currently in the database?** If the answer is <50, the recommendation engine literally cannot recommend anything useful -- focus on content acquisition first.

2. **Who are the admins?** How many people will review the pending queue? What is their realistic availability during orientation week?

3. **Has anyone talked to club representatives about submitting events?** The PRD assumes clubs will submit if it takes <2 minutes. Has this been validated?

4. **What is the actual user count right now?** If it is <20, k-means with k=3 is clustering users into groups of ~7 people. The statistical validity of recommendations from a group of 7 is near zero.

5. **Is the Flask backend (`backend/`) used by anything?** If not, it should be deleted to avoid confusion.

6. **What is the deployment plan for the Python ML service?** Is there budget for a separate hosting provider? Who will maintain it?

7. **What happens during exam periods (Dec, Apr) when clubs post zero events?** The recommendation engine will have nothing to recommend. The trending scores will all decay to zero. The platform will look dead. How do you handle this?

8. **Is the `user_interactions` tracking data being used anywhere?** The table exists, the API route exists, but is the frontend actually sending interaction events? If not, the tracking infrastructure is dead code.
