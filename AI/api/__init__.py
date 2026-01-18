"""
FastAPI REST API for Event Recommendations

Endpoints:
- POST /recommend - Get ranked event recommendations
- POST /embed/event - Embed and store an event
- GET /health - Health check
"""

from .main import app

__all__ = ["app"]


