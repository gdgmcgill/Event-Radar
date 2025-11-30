import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

CATEGORY_ORDER = ["academic", "social", "sports", "career", "cultural", "wellness"]


def cosine_score(vec_a: list[float] | np.ndarray, vec_b: list[float] | np.ndarray) -> float:
    """Compute cosine similarity between two equal-length vectors, returning 0 if either is all zeros."""
    a = np.asarray(vec_a, dtype=float).reshape(-1)
    b = np.asarray(vec_b, dtype=float).reshape(-1)

    if a.shape != b.shape:
        raise ValueError(f"Vector length mismatch: {a.shape} vs {b.shape}")

    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0

    score = cosine_similarity(a.reshape(1, -1), b.reshape(1, -1))[0][0]
    return float(score)


def cosine_scores(user_vec: list[float] | np.ndarray, event_vecs: list[list[float]] | np.ndarray) -> list[float]:
    """Compute cosine similarity between one user vector and a list of event vectors."""
    scores: list[float] = []
    for event_vec in event_vecs:
        scores.append(cosine_score(user_vec, event_vec))
    return scores


def tags_to_vector(tags: list[str]) -> list[int]:
    """Map a list of tag strings to a binary vector following CATEGORY_ORDER."""
    tag_set = {t.lower() for t in tags}
    return [1 if cat in tag_set else 0 for cat in CATEGORY_ORDER]
