"""
FastAPI Application for Two-Tower Recommendation Service

A lightweight, CPU-only recommendation API for university events.
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import traceback

import sys
sys.path.insert(0, str(__file__).rsplit("\\", 2)[0])

from api.schemas import (
    RecommendRequest, RecommendResponse, RecommendationItem,
    EmbedEventRequest, EmbedEventResponse,
    RemoveEventRequest, RemoveEventResponse,
    HealthResponse, ErrorResponse
)
from services.recommender import get_recommender_service, RecommenderService
from config import PROJECTION_DIM


# ============================================================================
# Application Lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    
    Initializes the recommender service on startup.
    """
    print("=" * 60)
    print("Starting Two-Tower Recommendation Service")
    print("=" * 60)
    
    try:
        # Initialize the recommender service
        service = get_recommender_service()
        print(f"Service ready with {service.get_event_count()} indexed events")
    except Exception as e:
        print(f"ERROR: Failed to initialize service: {e}")
        traceback.print_exc()
        raise
        
    yield
    
    # Cleanup on shutdown
    print("Shutting down recommendation service...")


# ============================================================================
# FastAPI App Configuration
# ============================================================================

app = FastAPI(
    title="Event Radar Recommendation API",
    description="""
## Two-Tower Recommendation Service

A lightweight, CPU-only recommendation API for university events.

### Architecture
- **Event Tower**: Converts event metadata to embeddings
- **User Tower**: Converts user metadata to embeddings
- **Scoring**: Dot product similarity between user and event embeddings

### Features
- Pretrained sentence embeddings (all-MiniLM-L6-v2)
- FAISS vector store for fast similarity search
- Cold-start support for new users and events
- Stateless request handling
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# API Endpoints
# ============================================================================

@app.post(
    "/recommend",
    response_model=RecommendResponse,
    responses={
        200: {"description": "Successful recommendations"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    tags=["Recommendations"],
    summary="Get personalized event recommendations"
)
async def recommend(request: RecommendRequest) -> RecommendResponse:
    """
    Get ranked event recommendations for a user.
    
    The recommendation pipeline:
    1. Convert user metadata to text embeddings
    2. Mean-pool and project through User Tower
    3. Compute dot-product scores against all event embeddings
    4. Return top-K ranked events
    
    **Cold-start handling**: New users with no attended_events 
    will still receive recommendations based on their major, 
    year, and interests.
    """
    try:
        service = get_recommender_service()
        
        # Get recommendations
        results = service.recommend(
            major=request.user.major,
            year_of_study=request.user.year_of_study,
            clubs_or_interests=request.user.clubs_or_interests,
            attended_events=request.user.attended_events,
            top_k=request.top_k,
            exclude_event_ids=request.exclude_event_ids
        )
        
        # Format response
        recommendations = [
            RecommendationItem(
                event_id=r.event_id,
                score=r.score,
                title=r.title,
                description=r.description,
                tags=r.tags,
                hosting_club=r.hosting_club,
                category=r.category
            )
            for r in results
        ]
        
        return RecommendResponse(
            recommendations=recommendations,
            total_events=service.get_event_count()
        )
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post(
    "/embed/event",
    response_model=EmbedEventResponse,
    responses={
        200: {"description": "Event embedded successfully"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    tags=["Events"],
    summary="Embed and optionally store an event"
)
async def embed_event(request: EmbedEventRequest) -> EmbedEventResponse:
    """
    Generate an embedding for an event.
    
    The embedding pipeline:
    1. Concatenate event text fields (title, description, tags, etc.)
    2. Encode with pretrained sentence transformer
    3. Project through Event Tower MLP
    4. Optionally store in vector index
    
    Use this endpoint when:
    - Creating a new event
    - Updating event metadata
    - Pre-computing embeddings for batch import
    """
    try:
        service = get_recommender_service()
        
        event = request.event
        embedding = service.embed_event(
            event_id=event.event_id,
            title=event.title,
            description=event.description,
            tags=event.tags,
            hosting_club=event.hosting_club,
            category=event.category,
            store=request.store
        )
        
        return EmbedEventResponse(
            event_id=event.event_id,
            embedding=embedding.tolist(),
            stored=request.store,
            embedding_dim=len(embedding)
        )
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post(
    "/events/remove",
    response_model=RemoveEventResponse,
    responses={
        200: {"description": "Event removed or not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    tags=["Events"],
    summary="Remove an event from the index"
)
async def remove_event(request: RemoveEventRequest) -> RemoveEventResponse:
    """
    Remove an event's embedding from the vector store.
    
    Use this when an event is deleted from the main database.
    """
    try:
        service = get_recommender_service()
        removed = service.remove_event(request.event_id)
        
        return RemoveEventResponse(
            event_id=request.event_id,
            removed=removed,
            message="Event removed" if removed else "Event not found"
        )
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Health check endpoint"
)
async def health_check() -> HealthResponse:
    """
    Check the health of the recommendation service.
    
    Returns:
    - Service status
    - Whether the embedding model is loaded
    - Number of indexed events
    - Embedding dimension
    """
    try:
        service = get_recommender_service()
        
        return HealthResponse(
            status="healthy",
            model_loaded=service._initialized,
            event_count=service.get_event_count(),
            embedding_dim=PROJECTION_DIM
        )
        
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            model_loaded=False,
            event_count=0,
            embedding_dim=PROJECTION_DIM
        )


@app.get(
    "/",
    tags=["System"],
    summary="API root"
)
async def root():
    """API root with basic info."""
    return {
        "service": "Event Radar Recommendation API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


# ============================================================================
# Error Handlers
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )

