# K-Means Clustering for User Grouping

## Purpose
Group users with similar event interests so recommendations can be based on what
similar users saved.

## Features Used
User vectors are built from two sources:
1) **Interest tags** selected by the user.
2) **Tags of events the user saved**.

Tags are normalized into these 6 categories:
- Academic
- Social
- Sports
- Career
- Cultural
- Wellness

Each user becomes a fixed-length vector like such:
`[academic, social, sports, career, cultural, wellness]`

## Where It Runs
Recommendations are computed in:
- `src/app/api/recommendations/route.ts`
- clustering logic in `src/lib/kmeans.ts`

## How It Works
1) Build a vector for each user from tags.
2) Run k-means to group similar users.
3) For the current user, recommend events saved by other users in the same cluster.
4) If no cluster-based candidates exist, fall back to events matching the user’s interest tags.

## Parameters
- `k` is set to `min(3, numberOfUsers)`.
    - means we cap the number of clusters at 3 (and never exceed the number of users)
- Max iterations: 50.
    - safety limit so that k-means doesn't loop forever

## Quality / Validation
Validate clustering quality with a simple Server Security Edge check:
For clearly separated groups, **within-cluster SSE decreases** when moving from
`k=1` to `k=2`.

Test code in:
- `src/lib/kmeans.test.ts`

## How to Run Tests
Run the test file with Node’s test runner (via tsx):

```bash
npx tsx --test src/lib/kmeans.test.ts
```
Expected result: 4 tests passed

## Notes for Future Improvements
- Consider a data-driven choice of `k` (ex: elbow method)
- Weight saved-event tags higher than interest tags
- Add time decay for older saved events
