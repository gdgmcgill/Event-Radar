import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


def cosine_score(vec_a: list[float] | np.ndarray, vec_b: list[float] | np.ndarray) -> float:
    a = np.asarray(vec_a, dtype=float).reshape(-1)
    b = np.asarray(vec_b, dtype=float).reshape(-1)

    if a.shape != b.shape:
        raise ValueError(f"Vector length mismatch: {a.shape} vs {b.shape}")

    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0

    score = cosine_similarity(a.reshape(1, -1), b.reshape(1, -1))[0][0]
    return float(score)
