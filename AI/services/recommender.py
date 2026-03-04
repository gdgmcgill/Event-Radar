"""
Recommender Service

Orchestrates the two-tower model for event recommendations.
Handles embedding generation, scoring, and ranking.
"""

import torch
import numpy as np
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

import sys
sys.path.insert(0, str(__file__).rsplit("\\", 2)[0])
from config import (
    PROJECTION_DIM, DEFAULT_TOP_K, MAX_TOP_K,
    EVENT_TOWER_PATH, USER_TOWER_PATH
)
from models import Embedder, EventTower, UserTower
from services.vector_store import VectorStore, EventMetadata


@dataclass
class RecommendationResult:
    """A single recommendation result."""
    event_id: str
    score: float
    title: str
    description: str
    tags: List[str]
    hosting_club: Optional[str]
    category: Optional[str]
    
    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "score": round(self.score, 4),
            "title": self.title,
            "description": self.description,
            "tags": self.tags,
            "hosting_club": self.hosting_club,
            "category": self.category
        }


class RecommenderService:
    """
    Main recommendation service.
    
    Responsibilities:
    - Load pretrained embedding model
    - Load/initialize tower models
    - Build user embeddings on-demand
    - Build event embeddings for storage
    - Score and rank events for users
    """
    
    def __init__(self):
        """Initialize the recommender service."""
        self._embedder: Optional[Embedder] = None
        self._event_tower: Optional[EventTower] = None
        self._user_tower: Optional[UserTower] = None
        self._vector_store: Optional[VectorStore] = None
        self._initialized = False
        
    def initialize(self):
        """
        Load all models and initialize the service.
        
        This should be called once at startup.
        """
        if self._initialized:
            return
            
        print("Initializing recommender service...")
        
        # Load pretrained embedding model
        print("Loading embedding model...")
        self._embedder = Embedder()
        
        # Initialize tower models
        print("Initializing tower models...")
        self._event_tower = EventTower()
        self._user_tower = UserTower()
        
        # Load saved weights if available
        self._load_tower_weights()
        
        # Set to eval mode
        self._event_tower.eval()
        self._user_tower.eval()
        
        # Initialize vector store
        print("Loading vector store...")
        self._vector_store = VectorStore()
        print(f"Loaded {self._vector_store.count} events from vector store")
        
        self._initialized = True
        print("Recommender service initialized successfully!")
        
    def _load_tower_weights(self):
        """Load saved tower weights if available."""
        if EVENT_TOWER_PATH.exists():
            try:
                state_dict = torch.load(EVENT_TOWER_PATH, map_location="cpu")
                self._event_tower.load_state_dict(state_dict)
                print("Loaded event tower weights")
            except Exception as e:
                print(f"Could not load event tower weights: {e}")
                
        if USER_TOWER_PATH.exists():
            try:
                state_dict = torch.load(USER_TOWER_PATH, map_location="cpu")
                self._user_tower.load_state_dict(state_dict)
                print("Loaded user tower weights")
            except Exception as e:
                print(f"Could not load user tower weights: {e}")
                
    def save_tower_weights(self):
        """Save current tower weights to disk."""
        torch.save(self._event_tower.state_dict(), EVENT_TOWER_PATH)
        torch.save(self._user_tower.state_dict(), USER_TOWER_PATH)
        print("Tower weights saved")
        
    @property
    def embedder(self) -> Embedder:
        if not self._initialized:
            raise RuntimeError("Service not initialized. Call initialize() first.")
        return self._embedder
    
    @property
    def event_tower(self) -> EventTower:
        if not self._initialized:
            raise RuntimeError("Service not initialized. Call initialize() first.")
        return self._event_tower
    
    @property
    def user_tower(self) -> UserTower:
        if not self._initialized:
            raise RuntimeError("Service not initialized. Call initialize() first.")
        return self._user_tower
    
    @property
    def vector_store(self) -> VectorStore:
        if not self._initialized:
            raise RuntimeError("Service not initialized. Call initialize() first.")
        return self._vector_store
        
    def embed_event(
        self,
        event_id: str,
        title: str,
        description: str,
        tags: Optional[List[str]] = None,
        hosting_club: Optional[str] = None,
        category: Optional[str] = None,
        store: bool = True
    ) -> np.ndarray:
        """
        Generate and optionally store an event embedding.
        
        Args:
            event_id: Unique event identifier
            title: Event title
            description: Event description
            tags: Optional event tags
            hosting_club: Optional hosting organization
            category: Optional event category
            store: Whether to store in vector store
            
        Returns:
            Event embedding as numpy array
        """
        # Build text representation
        event_text = EventTower.build_event_text(
            title, description, tags, hosting_club, category
        )
        
        # Get pretrained embedding
        pretrained_emb = self.embedder.encode_tensor(event_text)
        
        # Project through event tower
        with torch.no_grad():
            event_embedding = self.event_tower(pretrained_emb)
            
        embedding_np = event_embedding.numpy().squeeze()
        
        # Store if requested
        if store:
            self.vector_store.add_event(
                event_id=event_id,
                embedding=embedding_np,
                title=title,
                description=description,
                tags=tags,
                hosting_club=hosting_club,
                category=category
            )
            self.vector_store.save()
            
        return embedding_np
    
    def embed_user(
        self,
        major: str,
        year_of_study: str,
        clubs_or_interests: List[str],
        attended_events: Optional[List[str]] = None,
    ) -> np.ndarray:
        """
        Generate a user embedding on-demand.

        Returns a L2-normalised vector in the shared projection space (PROJECTION_DIM).
        """
        user_texts = UserTower.build_user_texts(
            major, year_of_study, clubs_or_interests, attended_events
        )
        pretrained_embs = self.embedder.encode(user_texts)
        pooled = UserTower.mean_pool_embeddings(pretrained_embs)
        pooled_tensor = torch.from_numpy(pooled.astype(np.float32)).unsqueeze(0)
        with torch.no_grad():
            user_embedding = self.user_tower(pooled_tensor)
        return user_embedding.numpy().squeeze()

    def _apply_feedback_in_projection_space(
        self,
        base_embedding: np.ndarray,
        feedback: List[Dict[str, Any]],
        alpha: float = 0.6,
    ) -> np.ndarray:
        """
        Shift the user embedding in the shared 128-dim projection space.

        For each feedback item we look up the event's *stored* projection-space
        embedding from the vector store and add (positive) or subtract (negative)
        it from the base user embedding, then re-normalise.

        Working in projection space is critical because:
        - Both user and event embeddings are L2-normalised unit vectors here.
        - The dot-product similarity is computed in this space by FAISS.
        - A random (untrained) MLP would scramble a sentence-space delta, making
          it unpredictable; projection-space shifts are direct and guaranteed.

        Args:
            base_embedding: L2-normalised user embedding (shape: PROJECTION_DIM,).
            feedback: List of dicts {event_id, feedback_type, tags}.
            alpha: Strength of adjustment. 0.6 gives a clear ranking shift
                   while staying close to the original user direction.

        Returns:
            Adjusted, L2-normalised embedding (same shape as base_embedding).
        """
        pos_embs: List[np.ndarray] = []
        neg_embs: List[np.ndarray] = []

        for item in feedback:
            eid = item.get("event_id", "")
            ft  = item.get("feedback_type", "")
            if not eid or ft not in ("positive", "negative"):
                continue
            result = self.vector_store.get_event(eid)
            if result is None:
                continue  # event not yet indexed – skip gracefully
            event_emb = result[0].astype(np.float32)  # already L2-normalised
            if ft == "positive":
                pos_embs.append(event_emb)
            else:
                neg_embs.append(event_emb)

        adjusted = base_embedding.copy().astype(np.float32)

        if pos_embs:
            adjusted = adjusted + alpha * np.mean(pos_embs, axis=0)
        if neg_embs:
            adjusted = adjusted - alpha * np.mean(neg_embs, axis=0)

        norm = np.linalg.norm(adjusted)
        if norm > 0:
            adjusted /= norm
        return adjusted
    
    def recommend(
        self,
        major: str,
        year_of_study: str,
        clubs_or_interests: List[str],
        attended_events: Optional[List[str]] = None,
        top_k: int = DEFAULT_TOP_K,
        exclude_event_ids: Optional[List[str]] = None,
        feedback: Optional[List[Dict[str, Any]]] = None
    ) -> List[RecommendationResult]:
        """
        Get ranked event recommendations for a user.


        Args:
            major: User's major
            year_of_study: Academic year
            clubs_or_interests: User's interests
            attended_events: Optional past event descriptions
            top_k: Number of recommendations to return
            exclude_event_ids: Event IDs to always exclude (e.g. already saved)
            feedback: Optional list of dicts with keys:
                        { "event_id": str, "feedback_type": "positive"|"negative", "tags": [str] }
                      Negatively-rated events are automatically excluded.
                      Tags from rated events shift the user vector up/down.

        Returns:
            List of RecommendationResult objects, sorted by score descending.
        """
        # Validate top_k
        top_k = min(max(1, top_k), MAX_TOP_K)

        # Build the exclusion set: pre-saved events + negatively-rated events
        all_exclusions: set = set(exclude_event_ids or [])
        if feedback:
            for item in feedback:
                if item.get("feedback_type") == "negative" and item.get("event_id"):
                    all_exclusions.add(item["event_id"])

        # Step 1: compute the base user embedding (in projection space)
        user_embedding = self.embed_user(
            major, year_of_study, clubs_or_interests, attended_events
        )

        # Step 2: apply feedback shift directly in projection space
        if feedback:
            user_embedding = self._apply_feedback_in_projection_space(
                user_embedding, feedback
            )

        # Step 3: request ALL indexed events from FAISS so that no negatively-rated
        # event can slip past the exclusion filter due to an insufficient search_k
        search_k = self.vector_store.count

        # Search vector store
        results = self.vector_store.search(user_embedding, top_k=search_k)

        # Filter exclusions and collect top-K
        recommendations = []
        for event_id, score, metadata in results:
            if event_id in all_exclusions:
                continue


            recommendations.append(RecommendationResult(
                event_id=event_id,
                score=score,
                title=metadata.title,
                description=metadata.description,
                tags=metadata.tags,
                hosting_club=metadata.hosting_club,
                category=metadata.category
            ))

            if len(recommendations) >= top_k:
                break


        return recommendations
    
    def get_event_count(self) -> int:
        """Get the number of indexed events."""
        return self.vector_store.count
    
    def remove_event(self, event_id: str) -> bool:
        """
        Remove an event from the index.
        
        Args:
            event_id: Event to remove
            
        Returns:
            True if removed, False if not found
        """
        result = self.vector_store.remove_event(event_id)
        if result:
            self.vector_store.save()
        return result
    
    def get_event_embedding(self, event_id: str) -> Optional[np.ndarray]:
        """
        Get an event's embedding from the store.
        
        Args:
            event_id: Event identifier
            
        Returns:
            Embedding array or None if not found
        """
        result = self.vector_store.get_event(event_id)
        if result:
            return result[0]
        return None


# Global service instance
_recommender_service: Optional[RecommenderService] = None


def get_recommender_service() -> RecommenderService:
    """
    Get the global recommender service instance.
    
    Returns:
        Initialized RecommenderService
    """
    global _recommender_service
    
    if _recommender_service is None:
        _recommender_service = RecommenderService()
        _recommender_service.initialize()
        
    return _recommender_service


