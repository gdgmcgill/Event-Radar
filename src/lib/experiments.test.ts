import { fnv1aHash, pickVariant, chiSquaredTest } from "./experiments";

describe("fnv1aHash", () => {
  it("returns consistent hash for same input", () => {
    expect(fnv1aHash("user1-exp1")).toBe(fnv1aHash("user1-exp1"));
  });

  it("returns different hashes for different inputs", () => {
    expect(fnv1aHash("user1-exp1")).not.toBe(fnv1aHash("user2-exp1"));
  });

  it("returns a non-negative number", () => {
    expect(fnv1aHash("anything")).toBeGreaterThanOrEqual(0);
  });
});

describe("pickVariant", () => {
  const variants = [
    { id: "v1", experiment_id: "e1", name: "control", config: {}, weight: 50 },
    { id: "v2", experiment_id: "e1", name: "treatment", config: { lambda: 0.3 }, weight: 50 },
  ];

  it("returns a variant from the list", () => {
    const result = pickVariant("user123", "e1", variants);
    expect(["v1", "v2"]).toContain(result.id);
  });

  it("is deterministic for same user+experiment", () => {
    const r1 = pickVariant("user123", "e1", variants);
    const r2 = pickVariant("user123", "e1", variants);
    expect(r1.id).toBe(r2.id);
  });

  it("distributes roughly evenly with 50/50 weights", () => {
    const counts: Record<string, number> = { v1: 0, v2: 0 };
    for (let i = 0; i < 1000; i++) {
      const v = pickVariant(`user-${i}`, "e1", variants);
      counts[v.id]++;
    }
    expect(counts.v1).toBeGreaterThan(300);
    expect(counts.v2).toBeGreaterThan(300);
  });

  it("handles unequal weights", () => {
    const unequalVariants = [
      { id: "v1", experiment_id: "e1", name: "control", config: {}, weight: 90 },
      { id: "v2", experiment_id: "e1", name: "treatment", config: {}, weight: 10 },
    ];
    const counts: Record<string, number> = { v1: 0, v2: 0 };
    for (let i = 0; i < 1000; i++) {
      const v = pickVariant(`user-${i}`, "e1", unequalVariants);
      counts[v.id]++;
    }
    expect(counts.v1).toBeGreaterThan(counts.v2);
  });
});

describe("chiSquaredTest", () => {
  it("returns null for fewer than 2 variants", () => {
    expect(chiSquaredTest([{ conversions: 10, total: 100 }])).toBeNull();
  });

  it("returns not significant for similar rates", () => {
    const result = chiSquaredTest([
      { conversions: 50, total: 100 },
      { conversions: 48, total: 100 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.significant).toBe(false);
  });

  it("returns significant for very different rates", () => {
    const result = chiSquaredTest([
      { conversions: 80, total: 100 },
      { conversions: 20, total: 100 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.significant).toBe(true);
  });

  it("returns null when total is 0", () => {
    expect(chiSquaredTest([
      { conversions: 0, total: 0 },
      { conversions: 0, total: 0 },
    ])).toBeNull();
  });
});
