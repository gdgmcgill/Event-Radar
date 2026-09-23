/**
 * The single definition of the database-tag to `EventTag` mapping.
 *
 * Every read path reaches this module through `transformEventFromDB` in
 * `src/lib/tagMapping.ts`, which re-exports `mapTags` so its existing
 * importers keep working. Centralized here under REFAC-10; the mapping's
 * known defects are registered as F-081.
 *
 * Known disagreement, deliberately not unified: `TAG_HIERARCHY` in
 * `src/lib/constants.ts` maps `hackathon` and `workshop` to tech, `fitness` to
 * sports and `competition` to career, where this table maps them to academic,
 * academic, wellness and sports. `TAG_HIERARCHY` serves the recommendation
 * engine's partial-affinity scoring, a different purpose from choosing the
 * badge a user sees, and the scoring formula is out of scope here (F-081).
 */

import { EventTag } from "@/types";

/**
 * Database tag (lower-cased, trimmed) to the `EventTag` it renders as.
 * A tag absent from this table renders as `EventTag.SOCIAL`.
 */
export const TAG_ALIASES: Record<string, EventTag> = {
  // Direct mappings
  academic: EventTag.ACADEMIC,
  social: EventTag.SOCIAL,
  sports: EventTag.SPORTS,
  career: EventTag.CAREER,
  cultural: EventTag.CULTURAL,
  wellness: EventTag.WELLNESS,
  // Alias mappings
  coding: EventTag.ACADEMIC,
  technology: EventTag.ACADEMIC,
  hackathon: EventTag.ACADEMIC,
  workshop: EventTag.ACADEMIC,
  networking: EventTag.SOCIAL,
  party: EventTag.SOCIAL,
  fitness: EventTag.WELLNESS,
  health: EventTag.WELLNESS,
  art: EventTag.CULTURAL,
  music: EventTag.CULTURAL,
  dance: EventTag.CULTURAL,
  professional: EventTag.CAREER,
  internship: EventTag.CAREER,
  job: EventTag.CAREER,
  game: EventTag.SPORTS,
  competition: EventTag.SPORTS,
};

/**
 * Map an array of database tags to EventTag enum values
 * @param dbTags - Array of tag strings from database
 * @returns Array of unique EventTag values
 */
export function mapTags(dbTags: string[]): EventTag[] {
  const mappedTags = (dbTags || []).map((tag: string) => {
    const lowerTag = tag.toLowerCase().trim();
    return TAG_ALIASES[lowerTag] || EventTag.SOCIAL; // Default to SOCIAL if no mapping
  });

  // Remove duplicates
  return [...new Set(mappedTags)];
}
