/**
 * DEFECT characterization — F-081
 *
 * Subject: `src/lib/tagMapping.ts:10-50` — the 22-entry `tagMapping` alias
 * table and `mapTags`, whose line 45 is
 *
 *     return tagMapping[lowerTag] || EventTag.SOCIAL; // Default to SOCIAL if no mapping
 *
 * The defect: six of the twelve `EventTag` members do not round-trip through
 * the read path. `tech`, `food`, `volunteer` and `arts` are absent from the
 * table and fall to the Social default; `music` is aliased to `cultural` and
 * `networking` to `social`. Any tag the table does not know — `quidditch` —
 * is silently coerced to Social too: no warning, no error, nothing logged.
 * The write path disagrees by construction: `EVENT_TAGS` offers all twelve as
 * filter chips and `src/lib/classifier.ts:553-584` assigns all twelve.
 *
 * VISIBLE ON SEEDED DATA. The seed stores `["academic","tech"]` on the
 * approved event and `["music","social"]` on the music night. They render
 * today as academic + social and cultural + social: the approved event's card
 * shows a Social badge and no Tech badge. The persona harness measures that
 * card in `e2e/specs/event-read-path.spec.ts`.
 *
 * What this file is and is not:
 *
 *   - It is a DEFECT test. It pins `mapTags` exactly as it behaves TODAY: the
 *     six non-identity members and where each lands, the silent Social
 *     default for an unknown tag, the collapsing of two coerced tags into one
 *     badge, and the two seeded pairs. It passes today.
 *   - It is NOT a failing test and NOT a fix. Its fix is split (DEC-26):
 *       · 04-07 centralizes the mapping in a module keyed on `EventTag` and
 *         adds a server-side warning in `transformEventFromDB`, where the
 *         event id is known — with `mapTags` output byte-identical. This file
 *         must pass UNMODIFIED through 04-07; that is the proof the move
 *         changed no mapped output. It imports `mapTags` from
 *         "@/lib/tagMapping" deliberately, so 04-07 must keep that export.
 *       · The six identity mappings (tech → tech, and so on) change seeded
 *         badges, so they are gated behind the 04-11 checkpoint under
 *         orchestrator decision 1, with deferral as the default. Only if the
 *         owner ships them do the six-member assertions below move — and the
 *         two seeded-pair assertions with them.
 *   - The unknown-tag assertions (quidditch → social, and the silence of
 *     `mapTags` itself) are not expected to move in Phase 4: DEC-26 surfaces
 *     unknown tags with a warning in the transform, not in `mapTags`.
 *
 * The assertions call `mapTags` directly — it is a pure function, so there is
 * no seam to mock and nothing but its output to observe. "Silently" is
 * asserted by spying on every console method and on nothing else.
 *
 * Registered as F-081 in .planning/audit/findings.json. Closes in Phase 4
 * (non-visual half) or at the 04-11 decision (identity mappings). Observed
 * red under a mutation that changes the default from Social to Academic; see
 * `evidence/slice-2-mutation-check.txt`.
 */

import { mapTags } from "@/lib/tagMapping";
import { EventTag } from "@/types";

let consoleSpies: jest.SpyInstance[] = [];

beforeEach(() => {
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
    jest.spyOn(console, method).mockImplementation(() => undefined)
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("F-081 — six of the twelve EventTag members do not round-trip (move only if the 04-11 decision ships the identity mappings)", () => {
  it("exactly six members map to something other than themselves: music, tech, food, volunteer, arts, networking", () => {
    const nonIdentity = Object.values(EventTag).filter((tag) => {
      const mapped = mapTags([tag]);
      return !(mapped.length === 1 && mapped[0] === tag);
    });
    expect(nonIdentity).toEqual(["music", "tech", "food", "volunteer", "arts", "networking"]);
  });

  it.each(["tech", "food", "volunteer", "arts"])("%s, absent from the alias table, is coerced to [social]", (tag) => {
    expect(mapTags([tag])).toEqual([EventTag.SOCIAL]);
  });

  it("music is aliased to [cultural]", () => {
    expect(mapTags(["music"])).toEqual([EventTag.CULTURAL]);
  });

  it("networking is aliased to [social]", () => {
    expect(mapTags(["networking"])).toEqual([EventTag.SOCIAL]);
  });

  it("two coerced tags collapse into a single social badge", () => {
    expect(mapTags(["tech", "food"])).toEqual([EventTag.SOCIAL]);
  });

  it("the seeded pairs: [academic, tech] reads as [academic, social]; [music, social] as [cultural, social]", () => {
    expect(mapTags(["academic", "tech"])).toEqual([EventTag.ACADEMIC, EventTag.SOCIAL]);
    expect(mapTags(["music", "social"])).toEqual([EventTag.CULTURAL, EventTag.SOCIAL]);
  });
});

describe("F-081 — an unknown tag is coerced to Social with no signal of any kind", () => {
  it("quidditch maps to [social]", () => {
    expect(mapTags(["quidditch"])).toEqual([EventTag.SOCIAL]);
  });

  it("mapping unknown and coerced tags neither throws nor writes to any console method", () => {
    expect(() => mapTags(["quidditch", "tech", "Music ", "NETWORKING"])).not.toThrow();
    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
