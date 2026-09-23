/**
 * PRESERVE — the database-tag to EventTag mapping (REFAC-10, F-081)
 *
 * The golden table below pins every output of `mapTags` as it is TODAY: all
 * 22 alias keys, all 12 `EventTag` members, an unknown tag, a padded
 * mixed-case tag, de-duplication, and the empty inputs. The expected values
 * are written out literally, never read back from the alias table, so a
 * change to the table cannot also change the expectation.
 *
 * It was written and run green against the pre-move function in
 * `src/lib/tagMapping.ts`, before `src/lib/eventTags.ts` existed, and must
 * pass unchanged after the move (evidence/tag-centralization.txt).
 *
 * Six rows record F-081 exactly as it behaves today: `tech`, `food`,
 * `volunteer` and `arts` fall to Social, `music` maps to Cultural, and
 * `networking` to Social. Those rows move only if the 04-11 checkpoint ships
 * the identity mappings (DEC-26).
 */

import { mapTags } from "@/lib/eventTags";
import { mapTags as mapTagsViaTagMapping } from "@/lib/tagMapping";
import { EventTag } from "@/types";

// ─── Golden table ───

const GOLDEN_ALIASES: ReadonlyArray<readonly [string, EventTag]> = [
  ["academic", EventTag.ACADEMIC],
  ["social", EventTag.SOCIAL],
  ["sports", EventTag.SPORTS],
  ["career", EventTag.CAREER],
  ["cultural", EventTag.CULTURAL],
  ["wellness", EventTag.WELLNESS],
  ["coding", EventTag.ACADEMIC],
  ["technology", EventTag.ACADEMIC],
  ["hackathon", EventTag.ACADEMIC],
  ["workshop", EventTag.ACADEMIC],
  ["networking", EventTag.SOCIAL],
  ["party", EventTag.SOCIAL],
  ["fitness", EventTag.WELLNESS],
  ["health", EventTag.WELLNESS],
  ["art", EventTag.CULTURAL],
  ["music", EventTag.CULTURAL],
  ["dance", EventTag.CULTURAL],
  ["professional", EventTag.CAREER],
  ["internship", EventTag.CAREER],
  ["job", EventTag.CAREER],
  ["game", EventTag.SPORTS],
  ["competition", EventTag.SPORTS],
];

const GOLDEN_MEMBERS: ReadonlyArray<readonly [EventTag, EventTag]> = [
  [EventTag.ACADEMIC, EventTag.ACADEMIC],
  [EventTag.SOCIAL, EventTag.SOCIAL],
  [EventTag.SPORTS, EventTag.SPORTS],
  [EventTag.CAREER, EventTag.CAREER],
  [EventTag.CULTURAL, EventTag.CULTURAL],
  [EventTag.WELLNESS, EventTag.WELLNESS],
  [EventTag.MUSIC, EventTag.CULTURAL],
  [EventTag.TECH, EventTag.SOCIAL],
  [EventTag.FOOD, EventTag.SOCIAL],
  [EventTag.VOLUNTEER, EventTag.SOCIAL],
  [EventTag.ARTS, EventTag.SOCIAL],
  [EventTag.NETWORKING, EventTag.SOCIAL],
];

const GOLDEN_EDGES: ReadonlyArray<readonly [string, string[] | null, EventTag[]]> = [
  ["an unknown tag", ["quidditch"], [EventTag.SOCIAL]],
  ["a padded mixed-case tag", [" Music "], [EventTag.CULTURAL]],
  ["duplicates after mapping", ["academic", "Academic", "coding"], [EventTag.ACADEMIC]],
  ["null", null, []],
  ["an empty array", [], []],
];

describe("mapTags — golden table", () => {
  it("covers all 22 alias keys and all 12 EventTag members", () => {
    expect(GOLDEN_ALIASES).toHaveLength(22);
    expect(GOLDEN_MEMBERS.map(([member]) => member)).toEqual(Object.values(EventTag));
  });

  it.each(GOLDEN_ALIASES)("alias key %s maps to [%s]", (key, expected) => {
    expect(mapTags([key])).toEqual([expected]);
  });

  it.each(GOLDEN_MEMBERS)("enum member %s maps to [%s]", (member, expected) => {
    expect(mapTags([member])).toEqual([expected]);
  });

  it.each(GOLDEN_EDGES)("%s", (_label, input, expected) => {
    expect(mapTags(input as string[])).toEqual(expected);
  });
});

describe("mapTags — the @/lib/tagMapping re-export", () => {
  it("is the same function as @/lib/eventTags's mapTags", () => {
    expect(mapTagsViaTagMapping).toBe(mapTags);
  });

  it.each([...GOLDEN_ALIASES, ...GOLDEN_MEMBERS])(
    "gives the golden output through the re-export: %s maps to [%s]",
    (key, expected) => {
      expect(mapTagsViaTagMapping([key])).toEqual([expected]);
    }
  );
});
