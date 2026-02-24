import test from "node:test";
import assert from "node:assert/strict";
import { kMeans, type UserPoint } from "@/lib/kmeans";

// Fixed tag order used to build numeric vectors for tests
const TAGS = ["academic", "social", "sports", "career", "cultural", "wellness"] as const;
type Tag = (typeof TAGS)[number];

// Convert a tag list into a 0/1 vector in TAGS order
function vectorFromTags(selected: Tag[]): number[] {
  return TAGS.map((tag) => (selected.includes(tag) ? 1 : 0));
}

// Compute mean vector for a set of vectors
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

// Euclidean distance used for SSE (quality metric)
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Within-cluster SSE: lower = tighter clusters
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
  // Two clear groups: social/cultural vs career/academic
  const points: UserPoint[] = [
    { userId: "u-social-1", vector: vectorFromTags(["social", "cultural"]) },
    { userId: "u-career-1", vector: vectorFromTags(["career", "academic"]) },
    { userId: "u-social-2", vector: vectorFromTags(["social"]) },
    { userId: "u-career-2", vector: vectorFromTags(["career"]) },
  ];

  const assignments = kMeans(points, 2);
  const clusterByUser = new Map(assignments.map((a) => [a.userId, a.cluster]));

  assert.equal(clusterByUser.get("u-social-1"), clusterByUser.get("u-social-2"));
  assert.equal(clusterByUser.get("u-career-1"), clusterByUser.get("u-career-2"));
  assert.notEqual(clusterByUser.get("u-social-1"), clusterByUser.get("u-career-1"));
});

test("clustering quality improves with higher k on separated groups", () => {
  // On cleanly separated groups, k=2 should reduce SSE vs k=1
  const points: UserPoint[] = [
    { userId: "u-social-1", vector: vectorFromTags(["social", "cultural"]) },
    { userId: "u-social-2", vector: vectorFromTags(["social"]) },
    { userId: "u-career-1", vector: vectorFromTags(["career", "academic"]) },
    { userId: "u-career-2", vector: vectorFromTags(["career"]) },
  ];

  const sseK1 = withinClusterSSE(points, 1);
  const sseK2 = withinClusterSSE(points, 2);

  assert.ok(sseK2 < sseK1);
});

test("kmeans returns one assignment per user", () => {
  // Output should include exactly one cluster assignment per input user
  const points: UserPoint[] = [
    { userId: "u1", vector: vectorFromTags(["academic"]) },
    { userId: "u2", vector: vectorFromTags(["social"]) },
    { userId: "u3", vector: vectorFromTags(["sports"]) },
  ];

  const assignments = kMeans(points, 2);

  assert.equal(assignments.length, points.length);
  assert.deepEqual(
    assignments.map((a) => a.userId).sort(),
    points.map((p) => p.userId).sort()
  );
});

test("kmeans handles k larger than number of users", () => {
  // k is capped by number of points, so this should still work
  const points: UserPoint[] = [
    { userId: "u1", vector: vectorFromTags(["wellness"]) },
    { userId: "u2", vector: vectorFromTags(["cultural"]) },
  ];

  const assignments = kMeans(points, 5);

  assert.equal(assignments.length, 2);
});
