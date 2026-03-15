import { TAG_HIERARCHY } from "@/lib/constants";

export type WeightedTag = { tag: string; weight: number };

export type ScoreBreakdown = {
  tag: number;
  interaction: number;
  popularity: number;
  recency: number;
  social: number;
};

/**
 * Expand user interest tags using the tag hierarchy.
 * Direct tags get weight 1.0, inferred parent/child tags get 0.5.
 * Deduplicates, keeping the higher weight.
 */
export function expandTagsWithHierarchy(tags: string[]): WeightedTag[] {
  const tagMap = new Map<string, number>();

  for (const tag of tags) {
    tagMap.set(tag, Math.max(tagMap.get(tag) ?? 0, 1.0));

    const parent = TAG_HIERARCHY[tag];
    if (parent) {
      tagMap.set(parent, Math.max(tagMap.get(parent) ?? 0, 0.5));
    }

  }

  return Array.from(tagMap.entries()).map(([tag, weight]) => ({ tag, weight }));
}

/**
 * Compute tag affinity between a user's weighted tags and an event's tags.
 * Returns 0.0-1.0 normalized score.
 */
export function computeTagAffinity(userTags: WeightedTag[], eventTags: string[]): number {
  if (userTags.length === 0 || eventTags.length === 0) return 0;

  const eventTagSet = new Set(eventTags);
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const { tag, weight } of userTags) {
    totalWeight += weight;
    if (eventTagSet.has(tag)) {
      matchedWeight += weight;
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

/**
 * Compute session boost based on recent interaction tags.
 * +0.05 per matching tag, capped at +0.15.
 */
export function computeSessionBoost(sessionTags: string[], eventTags: string[]): number {
  const sessionSet = new Set(sessionTags);
  let matchCount = 0;

  for (const tag of eventTags) {
    if (sessionSet.has(tag)) matchCount++;
  }

  return Math.min(matchCount * 0.05, 0.15);
}

/**
 * Generate a human-readable explanation from the score breakdown.
 */
export function generateExplanation(
  breakdown: ScoreBreakdown,
  matchingTags: string[]
): string {
  const { tag, interaction, popularity, social } = breakdown;

  const signals = [
    { key: "tag", value: tag },
    { key: "interaction", value: interaction },
    { key: "social", value: social },
    { key: "popularity", value: popularity },
  ];

  const top = signals.reduce((a, b) => (b.value > a.value ? b : a));

  switch (top.key) {
    case "tag":
      return matchingTags.length > 0
        ? `Because you're interested in ${matchingTags.join(", ")}`
        : "Based on your interests";
    case "interaction":
      return "Based on events you've engaged with";
    case "social":
      return "Friends are going to this";
    case "popularity":
    default:
      return "Trending on campus";
  }
}
