"""
Recommender Service

Orchestrates the two-tower model for event recommendations.
Handles embedding generation, scoring, and ranking.
"""

import torch
import numpy as np
from typing import Dict, List, Optional, Any
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
        attended_events: Optional[List[str]] = None
    ) -> np.ndarray:
        """
        Generate a user embedding on-demand.
        
        Args:
            major: User's major/field of study
            year_of_study: Academic year
            clubs_or_interests: List of clubs or interest areas
            attended_events: Optional list of attended event descriptions
            
        Returns:
            User embedding as numpy array
        """
        # Build text representations for each field
        user_texts = UserTower.build_user_texts(
            major, year_of_study, clubs_or_interests, attended_events
        )
        
        # Get pretrained embeddings for all texts
        pretrained_embs = self.embedder.encode(user_texts)
        
        # Mean pool
        pooled = UserTower.mean_pool_embeddings(pretrained_embs)
        pooled_tensor = torch.from_numpy(pooled).float().unsqueeze(0)
        
        # Project through user tower
        with torch.no_grad():
            user_embedding = self.user_tower(pooled_tensor)
            
        return user_embedding.numpy().squeeze()
    
    def recommend(
        self,
        major: str,
        year_of_study: str,
        clubs_or_interests: List[str],
        attended_events: Optional[List[str]] = None,
        top_k: int = DEFAULT_TOP_K,
        exclude_event_ids: Optional[List[str]] = None
    ) -> List[RecommendationResult]:
        """
        Get ranked event recommendations for a user.
        
        Args:
            major: User's major
            year_of_study: Academic year
            clubs_or_interests: User's interests
            attended_events: Optional past event descriptions
            top_k: Number of recommendations to return
            exclude_event_ids: Event IDs to exclude from results
            
        Returns:
            List of RecommendationResult objects, sorted by score descending
        """
        # Validate top_k
        top_k = min(max(1, top_k), MAX_TOP_K)
        
        # Generate user embedding
        user_embedding = self.embed_user(
            major, year_of_study, clubs_or_interests, attended_events
        )
        
        # Account for exclusions in search
        search_k = top_k
        if exclude_event_ids:
            search_k = top_k + len(exclude_event_ids)
            
        # Search vector store
        results = self.vector_store.search(user_embedding, top_k=search_k)
        
        # Filter exclusions and format results
        recommendations = []
        for event_id, score, metadata in results:
            if exclude_event_ids and event_id in exclude_event_ids:
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


