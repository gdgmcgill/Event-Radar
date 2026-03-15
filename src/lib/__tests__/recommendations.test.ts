import {
  computeTagAffinity,
  computeSessionBoost,
  generateExplanation,
  expandTagsWithHierarchy,
} from "../recommendations";

describe("expandTagsWithHierarchy", () => {
  it("returns direct tags plus parent tags with reduced weight", () => {
    const result = expandTagsWithHierarchy(["hackathon", "academic"]);
    expect(result).toEqual([
      { tag: "hackathon", weight: 1.0 },
      { tag: "tech", weight: 0.5 },
      { tag: "academic", weight: 1.0 },
    ]);
  });

  it("deduplicates when a direct tag is also a parent", () => {
    const result = expandTagsWithHierarchy(["hackathon", "tech"]);
    expect(result).toEqual([
      { tag: "hackathon", weight: 1.0 },
      { tag: "tech", weight: 1.0 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(expandTagsWithHierarchy([])).toEqual([]);
  });
});

describe("computeTagAffinity", () => {
  it("returns 1.0 for perfect overlap", () => {
    const userTags = [{ tag: "tech", weight: 1.0 }, { tag: "academic", weight: 1.0 }];
    const eventTags = ["tech", "academic"];
    expect(computeTagAffinity(userTags, eventTags)).toBe(1.0);
  });

  it("returns 0.0 for no overlap", () => {
    const userTags = [{ tag: "tech", weight: 1.0 }];
    const eventTags = ["social", "sports"];
    expect(computeTagAffinity(userTags, eventTags)).toBe(0.0);
  });

  it("accounts for partial weight from hierarchy", () => {
    const userTags = [{ tag: "hackathon", weight: 1.0 }, { tag: "tech", weight: 0.5 }];
    const eventTags = ["tech"];
    const score = computeTagAffinity(userTags, eventTags);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1.0);
  });
});

describe("computeSessionBoost", () => {
  it("returns 0 when no session tags match", () => {
    const sessionTags = ["music", "arts"];
    const eventTags = ["tech", "career"];
    expect(computeSessionBoost(sessionTags, eventTags)).toBe(0);
  });

  it("returns 0.05 per matching tag", () => {
    const sessionTags = ["tech", "career", "music"];
    const eventTags = ["tech", "career"];
    expect(computeSessionBoost(sessionTags, eventTags)).toBe(0.10);
  });

  it("caps at 0.15", () => {
    const sessionTags = ["tech", "career", "music", "arts"];
    const eventTags = ["tech", "career", "music", "arts"];
    expect(computeSessionBoost(sessionTags, eventTags)).toBe(0.15);
  });
});

describe("generateExplanation", () => {
  it("explains tag affinity when it is the top signal", () => {
    const breakdown = { tag: 0.30, interaction: 0.10, popularity: 0.15, recency: 0.10, social: 0.02 };
    const matchingTags = ["tech", "hackathon"];
    expect(generateExplanation(breakdown, matchingTags)).toBe("Because you're interested in tech, hackathon");
  });

  it("explains interaction affinity when it is the top signal", () => {
    const breakdown = { tag: 0.05, interaction: 0.25, popularity: 0.15, recency: 0.10, social: 0.02 };
    expect(generateExplanation(breakdown, [])).toBe("Based on events you've engaged with");
  });

  it("explains social signal when it is the top signal", () => {
    const breakdown = { tag: 0.02, interaction: 0.02, popularity: 0.05, recency: 0.05, social: 0.05 };
    expect(generateExplanation(breakdown, [])).toBe("Friends are going to this");
  });

  it("falls back to trending for popularity-dominated scores", () => {
    const breakdown = { tag: 0.0, interaction: 0.0, popularity: 0.20, recency: 0.15, social: 0.0 };
    expect(generateExplanation(breakdown, [])).toBe("Trending on campus");
  });
});
