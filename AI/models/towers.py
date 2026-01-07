"""
Two-Tower Architecture Components

Event Tower: Projects event text embeddings to shared space
User Tower: Projects user metadata embeddings to shared space

Both towers output vectors of the same dimension for dot-product scoring.
"""

import torch
import torch.nn as nn
from typing import List, Optional
import numpy as np

import sys
sys.path.insert(0, str(__file__).rsplit("\\", 2)[0])
from config import EMBEDDING_DIM, PROJECTION_DIM, PROJECTION_HIDDEN_DIM


class ProjectionMLP(nn.Module):
    """
    Small projection MLP to map embeddings to shared representation space.
    
    Architecture: Linear -> ReLU -> Linear -> L2 Norm
    """
    
    def __init__(
        self, 
        input_dim: int = EMBEDDING_DIM,
        hidden_dim: int = PROJECTION_HIDDEN_DIM,
        output_dim: int = PROJECTION_DIM
    ):
        super().__init__()
        
        self.layers = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, output_dim)
        )
        
        # Initialize weights
        self._init_weights()
        
    def _init_weights(self):
        """Xavier initialization for better gradient flow."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
                    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Project embeddings and L2-normalize.
        
        Args:
            x: Input embeddings of shape (batch, input_dim)
            
        Returns:
            Projected embeddings of shape (batch, output_dim)
        """
        projected = self.layers(x)
        # L2 normalize for dot-product similarity
        normalized = nn.functional.normalize(projected, p=2, dim=-1)
        return normalized


class EventTower(nn.Module):
    """
    Event Tower: Converts event metadata into fixed-size embeddings.
    
    Processing:
    1. Concatenate all event text fields
    2. Get pretrained embedding (from Embedder)
    3. Project through MLP to shared space
    """
    
    def __init__(
        self,
        input_dim: int = EMBEDDING_DIM,
        hidden_dim: int = PROJECTION_HIDDEN_DIM,
        output_dim: int = PROJECTION_DIM
    ):
        super().__init__()
        self.projection = ProjectionMLP(input_dim, hidden_dim, output_dim)
        self.output_dim = output_dim
        
    def forward(self, embeddings: torch.Tensor) -> torch.Tensor:
        """
        Project pretrained embeddings to event representation.
        
        Args:
            embeddings: Pretrained text embeddings (batch, embedding_dim)
            
        Returns:
            Event embeddings (batch, output_dim)
        """
        return self.projection(embeddings)
    
    @staticmethod
    def build_event_text(
        title: str,
        description: str,
        tags: Optional[List[str]] = None,
        hosting_club: Optional[str] = None,
        category: Optional[str] = None
    ) -> str:
        """
        Concatenate event fields into a single text string for embedding.
        
        Args:
            title: Event title
            description: Event description
            tags: Optional list of tags
            hosting_club: Optional hosting organization
            category: Optional event category
            
        Returns:
            Concatenated text string
        """
        parts = [f"Title: {title}", f"Description: {description}"]
        
        if tags:
            parts.append(f"Tags: {', '.join(tags)}")
        if hosting_club:
            parts.append(f"Hosted by: {hosting_club}")
        if category:
            parts.append(f"Category: {category}")
            
        return " | ".join(parts)


class UserTower(nn.Module):
    """
    User Tower: Converts user metadata into fixed-size embeddings.
    
    Processing:
    1. Convert each user field to text
    2. Get pretrained embeddings for each field
    3. Mean-pool embeddings
    4. Project through MLP to shared space
    """
    
    def __init__(
        self,
        input_dim: int = EMBEDDING_DIM,
        hidden_dim: int = PROJECTION_HIDDEN_DIM,
        output_dim: int = PROJECTION_DIM
    ):
        super().__init__()
        self.projection = ProjectionMLP(input_dim, hidden_dim, output_dim)
        self.output_dim = output_dim
        
    def forward(self, pooled_embeddings: torch.Tensor) -> torch.Tensor:
        """
        Project pooled user embeddings to user representation.
        
        Args:
            pooled_embeddings: Mean-pooled embeddings (batch, embedding_dim)
            
        Returns:
            User embeddings (batch, output_dim)
        """
        return self.projection(pooled_embeddings)
    
    @staticmethod
    def build_user_texts(
        major: str,
        year_of_study: str,
        clubs_or_interests: List[str],
        attended_events: Optional[List[str]] = None
    ) -> List[str]:
        """
        Convert user metadata fields into text strings for embedding.
        
        Args:
            major: User's major/field of study
            year_of_study: Academic year (e.g., "Freshman", "Senior")
            clubs_or_interests: List of clubs or interest areas
            attended_events: Optional list of previously attended event descriptions
            
        Returns:
            List of text strings to embed
        """
        texts = [
            f"Major: {major}",
            f"Year: {year_of_study}",
            f"Interests: {', '.join(clubs_or_interests)}"
        ]
        
        if attended_events:
            for event_text in attended_events:
                texts.append(f"Attended: {event_text}")
                
        return texts
    
    @staticmethod
    def mean_pool_embeddings(embeddings: np.ndarray) -> np.ndarray:
        """
        Mean-pool multiple embeddings into a single vector.
        
        Args:
            embeddings: Array of shape (n_texts, embedding_dim)
            
        Returns:
            Pooled embedding of shape (embedding_dim,)
        """
        return np.mean(embeddings, axis=0)

