# AI Migration History

This document records the architectural decision to migrate from an external Python-based recommendation service to a Postgres-native scoring engine, including the rationale, what was preserved, and what changed.

**Migration completed: March 2026**

---

## Previous System (Deprecated)

The original recommendation system was a prototype built as a separate Python/FastAPI service:

- **Model architecture**: Two-Tower neural network with separate user and event embedding towers
- **Embeddings**: Generated using `sentence-transformers` from event descriptions and user profiles
- **Similarity search**: FAISS index for approximate nearest-neighbor lookup
- **Hosting**: Ran as a standalone service at `localhost:8000`, requiring a separate process/deployment alongside the Next.js app
- **Integration**: The Next.js API routes called the Python service over HTTP to retrieve recommendations

This system was never production-hardened. It was a proof-of-concept to validate the idea of personalized recommendations on campus events, but it had significant operational shortcomings and was not ready to ship to real users.

---

## Why We Migrated

### Cost

We are already on a paid Supabase plan. Running a separate Python service — even a small one — means additional hosting costs (a VPS, a container service, or a managed ML platform). With no investors and no revenue yet, we could not justify that overhead.

### No investors yet

Infrastructure costs need to stay as low as possible while we validate whether the product has traction. Postgres-native scoring eliminates an entire category of monthly spend.

### The prototype was never production-quality

The Two-Tower service lacked proper error handling, authentication, monitoring, rate limiting, and graceful degradation. Hardening it would have taken as much effort as a rebuild — and a rebuild in Postgres is simpler to operate.

### Operational complexity

An external service introduces:
- Cold starts on the recommendation endpoint
- A separate deployment pipeline (the Python service had to be deployed and kept in sync with the Next.js app)
- A new failure domain (what happens when the Python service is down?)
- Additional monitoring and alerting requirements

Moving scoring into Postgres eliminates all of these. The recommendations endpoint now has the same availability guarantee as the database itself.

### Unclear value proposition

It is not yet clear whether the recommendation algorithm or the event discovery hub is the core value for users. Investing heavily in a sophisticated ML pipeline before validating user behavior would be premature. The Postgres-native approach delivers good-enough recommendations at near-zero marginal cost, which is the right tradeoff at this stage.

---

## What We Kept

The migration was not a full rewrite. Several components from the original system were preserved:

- **A/B testing framework** — The experiments, variants, and assignments tables were retained. The variant assignment logic (now using FNV-1a hashing) and the chi-squared significance testing were carried over.
- **MMR diversity re-ranking** — The Maximal Marginal Relevance re-ranking step was kept and re-implemented in `src/lib/diversity.ts` with Jaccard tag similarity.
- **Interaction tracking pipeline** — All raw interaction data (views, clicks, saves, shares) continued to be recorded in `user_interactions` without interruption.
- **Explicit feedback** — The thumbs up/down feedback mechanism was preserved in `recommendation_explicit_feedback`.
- **All historical interaction data** — No data was lost during migration. The `user_interactions` table is the foundation of the new `tag_interaction_counts` precomputed signal.

---

## What Changed

| Aspect | Before (Python Two-Tower) | After (Postgres-native) |
|---|---|---|
| Scoring location | Python FastAPI service at localhost:8000 | Postgres function `compute_user_scores()` |
| Scoring trigger | Real-time inference per request | Batch job every 6 hours (pg_cron) |
| Within-session reactivity | Each request hit the ML model | Session boost layer applied at request time on top of batch scores |
| Interest modeling | User embedding tower (learned) | Explicit `interest_tags` + `inferred_tags` with weighted formula |
| Tag relationships | Implicit (learned from embeddings) | Explicit `TAG_HIERARCHY` map for partial affinity |
| Implicit interest evolution | Not present | New: `inferred_tags` auto-populated when behavior exceeds threshold |
| External dependencies | `sentence-transformers`, FAISS, FastAPI | None (all Postgres + Supabase) |
| Hosting requirements | Next.js app + Python service | Next.js app + Supabase only |
