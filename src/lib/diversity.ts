/**
 * MMR (Maximal Marginal Relevance) diversity re-ranking module.
 *
 * Prevents filter bubbles by balancing relevance with tag diversity
 * when presenting event recommendations.
 */

export interface RecommendationItem {
  event_id: string;
  score: number;
  tags: string[];
  title: string;
  description: string;
  hosting_club: string | null;
  category: string | null;
}

export interface DiversityMetadata {
  lambda: number;
  avg_pairwise_distance: number;
  tag_distribution: Record<string, number>;
}

/**
 * Jaccard similarity between two tag sets.
 * Returns a value in [0, 1] where 1 means identical and 0 means disjoint.
 * Returns 0 if both sets are empty.
 */
export function jaccardSimilarity(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 && tagsB.length === 0) return 0;

  const setA = new Set(tagsA.map((t) => t.toLowerCase()));
  const setB = new Set(tagsB.map((t) => t.toLowerCase()));

  let intersectionSize = 0;
  for (const tag of setA) {
    if (setB.has(tag)) intersectionSize++;
  }

  const unionSize = new Set([...setA, ...setB]).size;
  return intersectionSize / unionSize;
}

/**
 * Re-rank a list of recommendation items using Maximal Marginal Relevance.
 *
 * MMR(item) = lambda * relevance(item) - (1 - lambda) * max_similarity(item, selected)
 *
 * @param recommendations - Items to re-rank, ordered by relevance score
 * @param lambda - Trade-off parameter: 1 = pure relevance, 0 = pure diversity (default 0.7)
 */
export function rerankWithMMR(
  recommendations: RecommendationItem[],
  lambda: number = 0.7
): { items: RecommendationItem[]; metadata: DiversityMetadata } {
  if (recommendations.length === 0) {
    return {
      items: [],
      metadata: { lambda, avg_pairwise_distance: 0, tag_distribution: {} },
    };
  }

  // Normalize scores to [0, 1]
  const scores = recommendations.map((r) => r.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  const normalizedScores = new Map<string, number>();
  for (const item of recommendations) {
    const norm = range === 0 ? 1 : (item.score - minScore) / range;
    normalizedScores.set(item.event_id, norm);
  }

  // MMR greedy selection
  const selected: RecommendationItem[] = [];
  const remaining = new Set(recommendations.map((_, i) => i));

  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestMMR = -Infinity;

    for (const idx of remaining) {
      const item = recommendations[idx];
      const relevance = normalizedScores.get(item.event_id)!;

      // Max similarity to any already-selected item
      let maxSim = 0;
      for (const sel of selected) {
        const sim = jaccardSimilarity(item.tags, sel.tags);
        if (sim > maxSim) maxSim = sim;
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (mmrScore > bestMMR) {
        bestMMR = mmrScore;
        bestIdx = idx;
      }
    }

    selected.push(recommendations[bestIdx]);
    remaining.delete(bestIdx);
  }

  // Compute metadata
  const tagDistribution: Record<string, number> = {};
  for (const item of selected) {
    for (const tag of item.tags) {
      const key = tag.toLowerCase();
      tagDistribution[key] = (tagDistribution[key] || 0) + 1;
    }
  }

  let avgPairwiseDistance = 0;
  if (selected.length > 1) {
    let totalSim = 0;
    let pairs = 0;
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        totalSim += jaccardSimilarity(selected[i].tags, selected[j].tags);
        pairs++;
      }
    }
    avgPairwiseDistance = 1 - totalSim / pairs;
  }

  return {
    items: selected,
    metadata: {
      lambda,
      avg_pairwise_distance: avgPairwiseDistance,
      tag_distribution: tagDistribution,
    },
  };
}
