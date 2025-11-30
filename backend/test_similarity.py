import pytest
from similarity import cosine_score, cosine_scores


def test_cosine_identical_vectors():
    assert cosine_score([1, 2, 3], [1, 2, 3]) == pytest.approx(1.0)


def test_cosine_orthogonal_vectors():
    assert cosine_score([1, 0], [0, 1]) == pytest.approx(0.0)


def test_cosine_opposite_vectors():
    assert cosine_score([-1, -1], [1, 1]) == pytest.approx(-1.0)


def test_cosine_zero_vector_returns_zero():
    assert cosine_score([0, 0, 0], [1, 2, 3]) == pytest.approx(0.0)


def test_cosine_length_mismatch_raises():
    with pytest.raises(ValueError):
        cosine_score([1, 2], [1, 2, 3])


def test_cosine_scores_batch_matches_individual():
    user_vec = [1, 0, 1]
    events = [[0.5, 0.5, 1], [1, 0, 0]]
    batch_scores = cosine_scores(user_vec, events)
    assert batch_scores == [
        pytest.approx(cosine_score(user_vec, events[0])),
        pytest.approx(cosine_score(user_vec, events[1])),
    ]
