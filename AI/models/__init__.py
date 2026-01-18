"""
Two-Tower Recommendation Models

This module contains:
- Embedder: Pretrained sentence embedding wrapper
- EventTower: Event text to embedding projection
- UserTower: User metadata to embedding projection
"""

from .embedder import Embedder
from .towers import EventTower, UserTower

__all__ = ["Embedder", "EventTower", "UserTower"]


