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
 *
 * The later describes cover what DEC-26 adds without changing any output:
 * `partitionTags` (the mapped output plus the tags that hit the Social
 * default), the completeness test over `Object.values(EventTag)` guarded by
 * `KNOWN_NON_ROUNDTRIP_TAGS`, and the one `[tags]` warning that
 * `transformEventFromDB` logs per event with unmapped tags. `mapTags` itself
 * stays silent (tag-coercion-defect.test.ts asserts that).
 *
 * The DI-37 describe pins that a tag named after an `Object.prototype` key
 * (`constructor`, `__proto__`, `hasOwnProperty`) is an unknown tag: it maps to
 * Social and is reported as unmapped, never to the function or object the
 * prototype holds under that name.
 */

import {
  KNOWN_NON_ROUNDTRIP_TAGS,
  mapTags,
  partitionTags,
} from "@/lib/eventTags";
import {
  mapTags as mapTagsViaTagMapping,
  transformEventFromDB,
} from "@/lib/tagMapping";
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

// ─── partitionTags ───

describe("partitionTags", () => {
  it("returns today's mapped output and the normalized tags that hit the Social default", () => {
    expect(partitionTags(["academic", "tech", "quidditch"])).toEqual({
      mapped: [EventTag.ACADEMIC, EventTag.SOCIAL],
      unmapped: ["tech", "quidditch"],
    });
  });

  it("normalizes and de-duplicates the unmapped tags", () => {
    expect(partitionTags([" Tech ", "tech", "QUIDDITCH", "coding"])).toEqual({
      mapped: [EventTag.SOCIAL, EventTag.ACADEMIC],
      unmapped: ["tech", "quidditch"],
    });
  });

  it("reports nothing unmapped when every tag is in the table", () => {
    expect(partitionTags(["Music", "social"]).unmapped).toEqual([]);
  });

  const inputs: Array<[string[] | null]> = [
    ...GOLDEN_ALIASES.map(([key]): [string[]] => [[key]]),
    ...GOLDEN_MEMBERS.map(([member]): [string[]] => [[member]]),
    ...GOLDEN_EDGES.map(([, input]): [string[] | null] => [input]),
    [["academic", "tech", "quidditch"]],
  ];

  it.each(inputs)("mapTags(%j) equals partitionTags(...).mapped", (input) => {
    expect(mapTags(input as string[])).toEqual(
      partitionTags(input as string[]).mapped
    );
  });
});

// ─── Object.prototype keys are not aliases (DI-37) ───

const PROTOTYPE_KEYS = ["constructor", "__proto__", "hasOwnProperty"] as const;

describe("partitionTags — a tag named after an Object.prototype key is unknown (DI-37)", () => {
  it.each(PROTOTYPE_KEYS)("%s maps to [social] and is reported as unmapped", (key) => {
    expect(mapTags([key])).toEqual([EventTag.SOCIAL]);
    expect(partitionTags([key])).toEqual({
      mapped: [EventTag.SOCIAL],
      unmapped: [key.toLowerCase()],
    });
  });

  it("never emits a value outside the EventTag enum", () => {
    const { mapped, unmapped } = partitionTags([
      "academic",
      "Constructor",
      " __proto__ ",
      "hasOwnProperty",
    ]);

    expect(mapped).toEqual([EventTag.ACADEMIC, EventTag.SOCIAL]);
    expect(unmapped).toEqual(["constructor", "__proto__", "hasownproperty"]);
    for (const tag of mapped) {
      expect(typeof tag).toBe("string");
      expect(Object.values(EventTag)).toContain(tag);
    }
  });

  it("the [tags] warning names a prototype-key tag like any other unmapped tag", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const event = transformEventFromDB(dbRow("evt-proto", ["__proto__"]));
      expect(event.tags).toEqual([EventTag.SOCIAL]);
      expect(JSON.parse(JSON.stringify(event.tags))).toEqual(["social"]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\[tags\] /),
        { eventId: "evt-proto", unmapped: ["__proto__"] }
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// ─── Completeness over every EventTag member ───

/**
 * Members that break the rule "round-trips to itself, or is listed as a known
 * non-round-tripper that does not": an unlisted member that falls to another
 * tag, or a listed member that has started to round-trip.
 */
function unaccountedMembers(members: readonly string[]): string[] {
  const known: readonly string[] = KNOWN_NON_ROUNDTRIP_TAGS;
  return members.filter((member) => {
    const mapped = mapTags([member]);
    const roundTrips = mapped.length === 1 && mapped[0] === member;
    return roundTrips === known.includes(member);
  });
}

describe("KNOWN_NON_ROUNDTRIP_TAGS and completeness", () => {
  it("lists exactly the six F-081 members", () => {
    expect([...KNOWN_NON_ROUNDTRIP_TAGS].sort()).toEqual(
      [
        EventTag.ARTS,
        EventTag.FOOD,
        EventTag.MUSIC,
        EventTag.NETWORKING,
        EventTag.TECH,
        EventTag.VOLUNTEER,
      ].sort()
    );
  });

  it("every member of Object.values(EventTag) round-trips or is listed as known not to", () => {
    expect(unaccountedMembers(Object.values(EventTag))).toEqual([]);
  });

  it("a thirteenth member added with neither a mapping nor a listing is caught", () => {
    expect(
      unaccountedMembers([...Object.values(EventTag), "quidditch"])
    ).toEqual(["quidditch"]);
  });
});

// ─── The unmapped-tag warning in transformEventFromDB ───

type DBRow = Parameters<typeof transformEventFromDB>[0];

function dbRow(id: string, tags: string[]): DBRow {
  return {
    id,
    title: "Tagged Event",
    description: null,
    start_date: "2026-10-05T18:00:00+00:00",
    location: null,
    tags,
    created_at: "2026-09-01T00:00:00+00:00",
    updated_at: null,
  };
}

describe("transformEventFromDB — unmapped tags are surfaced by one [tags] warning", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("keeps the rendered tags and warns once naming the event id and the unmapped tags", () => {
    const event = transformEventFromDB(dbRow("evt-tech", ["academic", "tech"]));

    expect(event.tags).toEqual([EventTag.ACADEMIC, EventTag.SOCIAL]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[tags\] /),
      { eventId: "evt-tech", unmapped: ["tech"] }
    );
  });

  it("logs nothing when every tag maps", () => {
    const event = transformEventFromDB(
      dbRow("evt-stable", ["academic", "Music", "coding"])
    );

    expect(event.tags).toEqual([EventTag.ACADEMIC, EventTag.CULTURAL]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
