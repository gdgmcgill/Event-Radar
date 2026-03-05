import { kMeans, type UserPoint } from "@/lib/kmeans";

const TAGS = ["academic", "social", "sports", "career", "cultural", "wellness"] as const;
type Tag = (typeof TAGS)[number];

function vectorFromTags(selected: Tag[]): number[] {
  return TAGS.map((tag) => (selected.includes(tag) ? 1 : 0));
}

function meanVector(vectors: number[][]): number[] {
  const dim = vectors[0]?.length ?? 0;
  const sums = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      sums[i] += v[i];
    }
  }
  return sums.map((s) => s / vectors.length);
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function withinClusterSSE(points: UserPoint[], k: number): number {
  const assignments = kMeans(points, k);
  const clusters = new Map<number, number[][]>();
  for (const assignment of assignments) {
    const point = points.find((p) => p.userId === assignment.userId);
    if (!point) continue;
    if (!clusters.has(assignment.cluster)) {
      clusters.set(assignment.cluster, []);
    }
    clusters.get(assignment.cluster)?.push(point.vector);
  }

  let sse = 0;
  for (const vectors of clusters.values()) {
    if (vectors.length === 0) continue;
    const centroid = meanVector(vectors);
    for (const v of vectors) {
      const dist = euclideanDistance(v, centroid);
      sse += dist * dist;
    }
  }
  return sse;
}

test("kmeans groups similar tag profiles together", () => {
  const points: UserPoint[] = [
    { userId: "u-social-1", vector: vectorFromTags(["social", "cultural"]) },
    { userId: "u-career-1", vector: vectorFromTags(["career", "academic"]) },
    { userId: "u-social-2", vector: vectorFromTags(["social"]) },
    { userId: "u-career-2", vector: vectorFromTags(["career"]) },
  ];

  const assignments = kMeans(points, 2);
  const clusterByUser = new Map(assignments.map((a) => [a.userId, a.cluster]));

  expect(clusterByUser.get("u-social-1")).toBe(clusterByUser.get("u-social-2"));
  expect(clusterByUser.get("u-career-1")).toBe(clusterByUser.get("u-career-2"));
  expect(clusterByUser.get("u-social-1")).not.toBe(clusterByUser.get("u-career-1"));
});

test("clustering quality improves with higher k on separated groups", () => {
  const points: UserPoint[] = [
    { userId: "u-social-1", vector: vectorFromTags(["social", "cultural"]) },
    { userId: "u-social-2", vector: vectorFromTags(["social"]) },
    { userId: "u-career-1", vector: vectorFromTags(["career", "academic"]) },
    { userId: "u-career-2", vector: vectorFromTags(["career"]) },
  ];

  const sseK1 = withinClusterSSE(points, 1);
  const sseK2 = withinClusterSSE(points, 2);

  expect(sseK2).toBeLessThan(sseK1);
});

test("kmeans returns one assignment per user", () => {
  const points: UserPoint[] = [
    { userId: "u1", vector: vectorFromTags(["academic"]) },
    { userId: "u2", vector: vectorFromTags(["social"]) },
    { userId: "u3", vector: vectorFromTags(["sports"]) },
  ];

  const assignments = kMeans(points, 2);

  expect(assignments.length).toBe(points.length);
  expect(assignments.map((a) => a.userId).sort()).toEqual(
    points.map((p) => p.userId).sort()
  );
});

test("kmeans handles k larger than number of users", () => {
  const points: UserPoint[] = [
    { userId: "u1", vector: vectorFromTags(["wellness"]) },
    { userId: "u2", vector: vectorFromTags(["cultural"]) },
  ];

  const assignments = kMeans(points, 5);

  expect(assignments.length).toBe(2);
});
