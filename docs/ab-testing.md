# A/B Testing Framework

## Overview

The A/B testing framework allows admins to run controlled experiments on the recommendation algorithm. Users are deterministically assigned to experiment variants, and per-variant metrics are tracked automatically.

## Architecture

- **Tables**: `experiments`, `experiment_variants`, `experiment_assignments` in Supabase
- **Assignment**: FNV-1a hash of `userId + experimentId` mapped to variant weights (deterministic, consistent)
- **Metrics**: Tracked via `recommendation_feedback` with `experiment_variant_id` column
- **Statistics**: Chi-squared test for significance (p < 0.05)

## Creating an Experiment

1. Navigate to `/admin/experiments`
2. Click "New Experiment"
3. Fill in:
   - **Name**: Unique slug (e.g., `diversity-lambda-test`)
   - **Description**: What you're testing
   - **Target Metric**: CTR, Save Rate, or Dismiss Rate
   - **Variants**: At least 2, each with:
     - Name (e.g., `control`, `high-diversity`)
     - Config JSON (e.g., `{"lambda": 0.3}`)
     - Weight (traffic allocation, e.g., 50/50)
4. Click "Create Experiment" (starts in `draft` status)
5. Click "Start" when ready to begin

## Available Config Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lambda` | number (0-1) | 0.7 | MMR diversity parameter. 1.0 = pure relevance, 0.0 = max diversity |

## Reading Results

On the experiment detail page:
- **Impressions**: How many times recommendations were shown to users in this variant
- **CTR%**: Clicks / Impressions
- **Save%**: Saves / Impressions
- **Dismiss%**: Dismisses / Impressions
- **Significance**: Chi-squared test result. "Significant" means p < 0.05.

## When to Stop

- **Minimum sample**: Wait for at least 100 impressions per variant
- **Significance**: Once the chi-squared test shows "Significant", the result is reliable
- **Duration**: Run for at least 7 days to account for day-of-week effects
- Click "Complete" to end the experiment. Assignment data is preserved for analysis.

## Experiment Lifecycle

```
draft -> running -> paused -> running -> completed
                \-> completed
```

- **Draft**: Not active. Can be deleted.
- **Running**: Users are assigned to variants. Metrics are tracked.
- **Paused**: No new assignments. Existing assignments preserved.
- **Completed**: Archived. No new assignments or tracking.
