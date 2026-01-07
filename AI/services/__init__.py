"""
Recommendation Services

This module contains:
- VectorStore: FAISS-based event embedding storage and retrieval
- RecommenderService: Main recommendation logic
"""

from .vector_store import VectorStore
from .recommender import RecommenderService

__all__ = ["VectorStore", "RecommenderService"]

