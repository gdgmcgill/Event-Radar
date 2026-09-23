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
 * The six `EventTag` members that do not map to themselves (F-081): `tech`,
 * `food`, `volunteer` and `arts` are absent from `TAG_ALIASES` and render as
 * Social; `music` is aliased to Cultural and `networking` to Social.
 *
 * This is the one place their fix lands. Mapping them to themselves changes
 * seeded badges, so under orchestrator decision 1 it is gated behind the
 * 04-11 owner checkpoint (DEC-26), with deferral as the default. If it ships,
 * add the six identity entries to `TAG_ALIASES` and empty this list; the
 * completeness test in `eventTags.test.ts` fails until both are done.
 */
export const KNOWN_NON_ROUNDTRIP_TAGS: readonly EventTag[] = [
  EventTag.MUSIC,
  EventTag.TECH,
  EventTag.FOOD,
  EventTag.VOLUNTEER,
  EventTag.ARTS,
  EventTag.NETWORKING,
];

/** The result of mapping database tags, with the ones the table did not know. */
export interface PartitionedTags {
  /** Unique rendered tags, exactly as `mapTags` returns them. */
  mapped: EventTag[];
  /** Unique normalized (lower-cased, trimmed) tags that fell to Social. */
  unmapped: string[];
}

/**
 * Map database tags and report the ones that hit the Social default.
 * Unmapped tags still render as `EventTag.SOCIAL`, so the display does not
 * change; the caller decides how to surface `unmapped` (DEC-26).
 * @param dbTags - Array of tag strings from database
 * @returns The unique mapped tags and the unique unmapped normalized tags
 */
export function partitionTags(dbTags: string[]): PartitionedTags {
  const mapped = new Set<EventTag>();
  const unmapped = new Set<string>();

  for (const tag of dbTags || []) {
    const lowerTag = tag.toLowerCase().trim();
    // Own properties only. `TAG_ALIASES` is an object literal, so a bare
    // `TAG_ALIASES[lowerTag]` resolves `Object.prototype` keys: a tag named
    // `constructor` or `__proto__` would come back as a function or object,
    // both truthy, and be emitted inside `tags` (DI-37). Such a tag is unknown
    // and falls to Social like any other.
    const alias = Object.prototype.hasOwnProperty.call(TAG_ALIASES, lowerTag)
      ? TAG_ALIASES[lowerTag]
      : undefined;
    if (alias) {
      mapped.add(alias);
    } else {
      mapped.add(EventTag.SOCIAL); // Default to SOCIAL if no mapping
      unmapped.add(lowerTag);
    }
  }

  return { mapped: [...mapped], unmapped: [...unmapped] };
}

/**
 * Map an array of database tags to EventTag enum values. Silent by design:
 * unmapped tags are surfaced by `transformEventFromDB`, which knows the event.
 * @param dbTags - Array of tag strings from database
 * @returns Array of unique EventTag values
 */
export function mapTags(dbTags: string[]): EventTag[] {
  return partitionTags(dbTags).mapped;
}
