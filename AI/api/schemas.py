"""
Pydantic Schemas for API Request/Response Validation

Defines the contract for the recommendation service API.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ============================================================================
# Request Schemas
# ============================================================================

class UserPayload(BaseModel):
    """User metadata for generating recommendations."""
    
    major: str = Field(
        ..., 
        description="User's major or field of study",
        examples=["Computer Science"]
    )
    year_of_study: str = Field(
        ..., 
        description="Academic year (e.g., Freshman, Sophomore, Junior, Senior)",
        examples=["Junior"]
    )
    clubs_or_interests: List[str] = Field(
        ..., 
        description="List of clubs the user belongs to or interest areas",
        examples=[["AI Club", "Photography", "Hiking"]]
    )
    attended_events: Optional[List[str]] = Field(
        default=None,
        description="Optional list of descriptions of previously attended events",
        examples=[["Machine Learning Workshop", "Startup Pitch Night"]]
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "major": "Computer Science",
                "year_of_study": "Junior",
                "clubs_or_interests": ["AI Club", "Photography", "Hiking"],
                "attended_events": ["Machine Learning Workshop", "Startup Pitch Night"]
            }
        }


class RecommendRequest(BaseModel):
    """Request body for /recommend endpoint."""
    
    user: UserPayload = Field(..., description="User metadata")
    top_k: int = Field(
        default=10, 
        ge=1, 
        le=100,
        description="Number of recommendations to return"
    )
    exclude_event_ids: Optional[List[str]] = Field(
        default=None,
        description="Event IDs to exclude from recommendations"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "user": {
                    "major": "Computer Science",
                    "year_of_study": "Junior",
                    "clubs_or_interests": ["AI Club", "Photography"],
                    "attended_events": ["ML Workshop"]
                },
                "top_k": 10,
                "exclude_event_ids": ["event-123"]
            }
        }


class EventPayload(BaseModel):
    """Event metadata for embedding generation."""
    
    event_id: str = Field(..., description="Unique event identifier")
    title: str = Field(..., description="Event title")
    description: str = Field(..., description="Event description")
    tags: Optional[List[str]] = Field(
        default=None, 
        description="Event tags/categories"
    )
    hosting_club: Optional[str] = Field(
        default=None, 
        description="Name of the hosting club or organization"
    )
    category: Optional[str] = Field(
        default=None, 
        description="Event category"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "event_id": "evt-12345",
                "title": "Introduction to Machine Learning",
                "description": "Learn the fundamentals of ML in this hands-on workshop.",
                "tags": ["academic", "technology", "workshop"],
                "hosting_club": "AI Club",
                "category": "workshop"
            }
        }


class EmbedEventRequest(BaseModel):
    """Request body for /embed/event endpoint."""
    
    event: EventPayload = Field(..., description="Event metadata")
    store: bool = Field(
        default=True, 
        description="Whether to store the embedding in the vector store"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "event": {
                    "event_id": "evt-12345",
                    "title": "Introduction to Machine Learning",
                    "description": "Learn the fundamentals of ML.",
                    "tags": ["academic", "technology"],
                    "hosting_club": "AI Club"
                },
                "store": True
            }
        }


class RemoveEventRequest(BaseModel):
    """Request body for removing an event."""
    
    event_id: str = Field(..., description="Event ID to remove")


# ============================================================================
# Response Schemas
# ============================================================================

class RecommendationItem(BaseModel):
    """A single recommendation in the response."""
    
    event_id: str = Field(..., description="Event identifier")
    score: float = Field(..., description="Relevance score (higher is better)")
    title: str = Field(..., description="Event title")
    description: str = Field(..., description="Event description")
    tags: List[str] = Field(default_factory=list, description="Event tags")
    hosting_club: Optional[str] = Field(default=None, description="Hosting club")
    category: Optional[str] = Field(default=None, description="Event category")


class RecommendResponse(BaseModel):
    """Response from /recommend endpoint."""
    
    recommendations: List[RecommendationItem] = Field(
        ..., 
        description="List of recommended events, sorted by relevance"
    )
    total_events: int = Field(
        ..., 
        description="Total number of events in the index"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "recommendations": [
                    {
                        "event_id": "evt-12345",
                        "score": 0.8542,
                        "title": "ML Workshop",
                        "description": "Learn machine learning basics",
                        "tags": ["academic", "technology"],
                        "hosting_club": "AI Club",
                        "category": "workshop"
                    }
                ],
                "total_events": 150
            }
        }


class EmbedEventResponse(BaseModel):
    """Response from /embed/event endpoint."""
    
    event_id: str = Field(..., description="Event identifier")
    embedding: List[float] = Field(..., description="Generated embedding vector")
    stored: bool = Field(..., description="Whether embedding was stored")
    embedding_dim: int = Field(..., description="Embedding dimension")
    
    class Config:
        json_schema_extra = {
            "example": {
                "event_id": "evt-12345",
                "embedding": [0.1, 0.2, 0.3],  # truncated
                "stored": True,
                "embedding_dim": 128
            }
        }


class RemoveEventResponse(BaseModel):
    """Response from event removal."""
    
    event_id: str
    removed: bool
    message: str


class HealthResponse(BaseModel):
    """Response from /health endpoint."""
    
    status: str = Field(..., description="Service status")
    model_loaded: bool = Field(..., description="Whether embedding model is loaded")
    event_count: int = Field(..., description="Number of indexed events")
    embedding_dim: int = Field(..., description="Embedding dimension")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "model_loaded": True,
                "event_count": 150,
                "embedding_dim": 128
            }
        }


class ErrorResponse(BaseModel):
    """Standard error response."""
    
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(default=None, description="Additional details")

