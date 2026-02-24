// Numeric vector used by the clustering algorithm
export type Vector = number[];

export interface UserPoint {
    // Unique user identifier
    userId: string; // ex: u1234
    // Feature vector representing user interests
    vector: Vector; // [social, academic, sports, career, cultural, wellness]
}

export interface ClusterAssignment {
    // Which user is assigned to a cluster
    userId: string;
    // Which cluster index they belong to (0, 1, 2, ... , k-1)
    cluster: number;
}

// Euclidean distance: how far apart two vectors are
function euclideanDistance(a: Vector, b: Vector): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

// Compute the centroid (mean vector) of a list of vectors
function meanOfVectors(vectors: Vector[]): Vector {
    const n = vectors.length;
    if (n===0) {
        throw new Error("Cannot compute mean of empty vector list")
    }

    const dim = vectors[0].length;
    // Accumulate sums for each dimension
    const sums = new Array(dim).fill(0);

    for (const v of vectors) {
        for (let i = 0; i < dim; i++) {
            sums[i] += v[i];
        }
    }
    // Divide sums by count to get the mean vector
    return sums.map((s) => s/n);
}

export function kMeans(
    // All user points to cluster
    points: UserPoint[],
    // Number of clusters to create
    k: number
): ClusterAssignment[] {
    // For invalid inputs
    if (k <= 0) {
        throw new Error("k must be greater than 0");
    }
    if (points.length === 0) {
        return [];
    }

    // Hard cap on iterations to avoid infinite loops
    const maxIterations = 50;
    // Can't have more clusters than points
    const safeK = Math.min(k, points.length);
    // Dimension (number of features) of each vector
    const dim = points[0].vector.length;

    // Initialize centroids from the first k points for deterministic results
    let centroids: Vector[] = points
        .slice(0, safeK)
        .map((p) => p.vector.slice());

    // Track which cluster each user is assigned to
    let assignments = new Map<string, number>();

    for (let iter = 0; iter < maxIterations; iter++) {
        let changed = false;
        // Each cluster collects the vectors assigned to it
        const clusters: Vector[][] = Array.from({ length: safeK }, () => []);

        for (const point of points) {
            let bestCluster = 0;
            let bestDistance = Infinity;

            // Find the closest centroid
            for (let c = 0; c < safeK; c++) {
                const distance = euclideanDistance(point.vector, centroids[c]);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestCluster = c;
                }
            }

            // Record assignment changes to detect convergence
            if (assignments.get(point.userId) !== bestCluster) {
                changed = true;
                assignments.set(point.userId, bestCluster);
            }

            clusters[bestCluster].push(point.vector);
        }

        // Update centroids based on cluster contents
        for (let c = 0; c < safeK; c++) {
            if (clusters[c].length === 0) {
                // If a cluster got no points, re-seed its centroid deterministically
                const fallbackIndex = (c + iter) % points.length;
                centroids[c] = points[fallbackIndex].vector.slice();
                continue;
            }
            const mean = meanOfVectors(clusters[c]);
            if (mean.length !== dim) {
                throw new Error("Vector dimension mismatch while updating centroids");
            }
            centroids[c] = mean;
        }

        // If no assignments changed, it's done
        if (!changed) {
            break;
        }
    }

    // Convert assignment map into a stable array output
    return points.map((point) => ({
        userId: point.userId,
        cluster: assignments.get(point.userId) ?? 0,
    }));
}
