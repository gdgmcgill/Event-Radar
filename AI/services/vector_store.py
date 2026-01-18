"""
Vector Store for Event Embeddings

Uses FAISS for efficient similarity search on CPU.
Supports add, remove, and search operations.
"""

import json
import faiss
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

import sys
sys.path.insert(0, str(__file__).rsplit("\\", 2)[0])
from config import VECTOR_STORE_PATH, EVENT_METADATA_PATH, PROJECTION_DIM


@dataclass
class EventMetadata:
    """Metadata stored alongside event embeddings."""
    event_id: str
    title: str
    description: str
    tags: List[str]
    hosting_club: Optional[str]
    category: Optional[str]
    created_at: str
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> "EventMetadata":
        return cls(**data)


class VectorStore:
    """
    FAISS-based vector store for event embeddings.
    
    Features:
    - Inner product (dot product) similarity
    - Persistent storage to disk
    - Event metadata management
    """
    
    def __init__(
        self,
        dimension: int = PROJECTION_DIM,
        index_path: Optional[Path] = None,
        metadata_path: Optional[Path] = None
    ):
        """
        Initialize the vector store.
        
        Args:
            dimension: Embedding dimension
            index_path: Path to FAISS index file
            metadata_path: Path to metadata JSON file
        """
        self.dimension = dimension
        self.index_path = index_path or VECTOR_STORE_PATH
        self.metadata_path = metadata_path or EVENT_METADATA_PATH
        
        # Event ID to index mapping
        self.id_to_idx: Dict[str, int] = {}
        self.idx_to_id: Dict[int, str] = {}
        
        # Event metadata storage
        self.metadata: Dict[str, EventMetadata] = {}
        
        # Initialize or load FAISS index
        self._init_index()
        
    def _init_index(self):
        """Initialize or load the FAISS index."""
        if self.index_path.exists() and self.metadata_path.exists():
            self._load()
        else:
            # Create new index using inner product (for dot-product similarity)
            self.index = faiss.IndexFlatIP(self.dimension)
            
    def _load(self):
        """Load index and metadata from disk."""
        try:
            self.index = faiss.read_index(str(self.index_path))
            
            with open(self.metadata_path, "r") as f:
                data = json.load(f)
                
            self.id_to_idx = data.get("id_to_idx", {})
            self.idx_to_id = {int(k): v for k, v in data.get("idx_to_id", {}).items()}
            self.metadata = {
                k: EventMetadata.from_dict(v) 
                for k, v in data.get("metadata", {}).items()
            }
        except Exception as e:
            print(f"Error loading vector store: {e}")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_to_idx = {}
            self.idx_to_id = {}
            self.metadata = {}
            
    def save(self):
        """Save index and metadata to disk."""
        # Ensure parent directories exist
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        
        faiss.write_index(self.index, str(self.index_path))
        
        data = {
            "id_to_idx": self.id_to_idx,
            "idx_to_id": {str(k): v for k, v in self.idx_to_id.items()},
            "metadata": {k: v.to_dict() for k, v in self.metadata.items()}
        }
        
        with open(self.metadata_path, "w") as f:
            json.dump(data, f, indent=2)
            
    def add_event(
        self,
        event_id: str,
        embedding: np.ndarray,
        title: str,
        description: str,
        tags: Optional[List[str]] = None,
        hosting_club: Optional[str] = None,
        category: Optional[str] = None
    ) -> bool:
        """
        Add an event embedding to the store.
        
        Args:
            event_id: Unique event identifier
            embedding: Event embedding vector
            title: Event title
            description: Event description
            tags: Optional event tags
            hosting_club: Optional hosting organization
            category: Optional event category
            
        Returns:
            True if added, False if event already exists
        """
        if event_id in self.id_to_idx:
            # Update existing event
            return self.update_event(
                event_id, embedding, title, description, 
                tags, hosting_club, category
            )
        
        # Ensure embedding is 2D and float32
        if embedding.ndim == 1:
            embedding = embedding.reshape(1, -1)
        embedding = embedding.astype(np.float32)
        
        # Add to FAISS index
        idx = self.index.ntotal
        self.index.add(embedding)
        
        # Update mappings
        self.id_to_idx[event_id] = idx
        self.idx_to_id[idx] = event_id
        
        # Store metadata
        self.metadata[event_id] = EventMetadata(
            event_id=event_id,
            title=title,
            description=description,
            tags=tags or [],
            hosting_club=hosting_club,
            category=category,
            created_at=datetime.utcnow().isoformat()
        )
        
        return True
    
    def update_event(
        self,
        event_id: str,
        embedding: np.ndarray,
        title: str,
        description: str,
        tags: Optional[List[str]] = None,
        hosting_club: Optional[str] = None,
        category: Optional[str] = None
    ) -> bool:
        """
        Update an existing event's embedding and metadata.
        
        Note: FAISS IndexFlatIP doesn't support in-place updates,
        so we rebuild the index with the updated embedding.
        
        Args:
            event_id: Event identifier to update
            Other args: Same as add_event
            
        Returns:
            True if updated, False if event not found
        """
        if event_id not in self.id_to_idx:
            return False
            
        # For simplicity in initial version, we remove and re-add
        # A production system might use IndexIVF with remove support
        self.remove_event(event_id)
        return self.add_event(
            event_id, embedding, title, description, 
            tags, hosting_club, category
        )
    
    def remove_event(self, event_id: str) -> bool:
        """
        Remove an event from the store.
        
        Note: Requires rebuilding the index since IndexFlatIP 
        doesn't support removal.
        
        Args:
            event_id: Event identifier to remove
            
        Returns:
            True if removed, False if not found
        """
        if event_id not in self.id_to_idx:
            return False
            
        # Get all embeddings except the one to remove
        all_ids = [eid for eid in self.id_to_idx.keys() if eid != event_id]
        
        if not all_ids:
            # Reset to empty index
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_to_idx = {}
            self.idx_to_id = {}
            del self.metadata[event_id]
            return True
            
        # Reconstruct embeddings for remaining events
        embeddings = []
        for eid in all_ids:
            idx = self.id_to_idx[eid]
            emb = self.index.reconstruct(idx)
            embeddings.append(emb)
            
        embeddings = np.array(embeddings, dtype=np.float32)
        
        # Create new index
        self.index = faiss.IndexFlatIP(self.dimension)
        self.index.add(embeddings)
        
        # Rebuild mappings
        self.id_to_idx = {eid: i for i, eid in enumerate(all_ids)}
        self.idx_to_id = {i: eid for i, eid in enumerate(all_ids)}
        
        # Remove metadata
        del self.metadata[event_id]
        
        return True
    
    def search(
        self, 
        query_embedding: np.ndarray, 
        top_k: int = 10
    ) -> List[Tuple[str, float, EventMetadata]]:
        """
        Search for similar events.
        
        Args:
            query_embedding: Query vector (user embedding)
            top_k: Number of results to return
            
        Returns:
            List of (event_id, score, metadata) tuples, sorted by score descending
        """
        if self.index.ntotal == 0:
            return []
            
        # Ensure query is 2D and float32
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        query_embedding = query_embedding.astype(np.float32)
        
        # Limit k to available events
        k = min(top_k, self.index.ntotal)
        
        # Search
        scores, indices = self.index.search(query_embedding, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:  # FAISS returns -1 for invalid indices
                continue
            event_id = self.idx_to_id.get(idx)
            if event_id and event_id in self.metadata:
                results.append((event_id, float(score), self.metadata[event_id]))
                
        return results
    
    def get_all_embeddings(self) -> Tuple[List[str], np.ndarray]:
        """
        Get all stored embeddings.
        
        Returns:
            Tuple of (event_ids, embeddings array)
        """
        if self.index.ntotal == 0:
            return [], np.array([])
            
        event_ids = []
        embeddings = []
        
        for idx in range(self.index.ntotal):
            event_id = self.idx_to_id.get(idx)
            if event_id:
                event_ids.append(event_id)
                embeddings.append(self.index.reconstruct(idx))
                
        return event_ids, np.array(embeddings, dtype=np.float32)
    
    def get_event(self, event_id: str) -> Optional[Tuple[np.ndarray, EventMetadata]]:
        """
        Get a specific event's embedding and metadata.
        
        Args:
            event_id: Event identifier
            
        Returns:
            Tuple of (embedding, metadata) or None if not found
        """
        if event_id not in self.id_to_idx:
            return None
            
        idx = self.id_to_idx[event_id]
        embedding = self.index.reconstruct(idx)
        metadata = self.metadata[event_id]
        
        return embedding, metadata
    
    @property
    def count(self) -> int:
        """Number of events in the store."""
        return self.index.ntotal


