"""
Configuration settings for the Two-Tower Recommendation Service.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# Embedding model configuration
# Using all-MiniLM-L6-v2: lightweight, fast, 384-dim embeddings
EMBEDDING_MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL_NAME", 
    "sentence-transformers/all-MiniLM-L6-v2"
)
EMBEDDING_DIM = 384  # Dimension of all-MiniLM-L6-v2 embeddings

# Projection MLP configuration
PROJECTION_DIM = 128  # Final embedding dimension after projection
PROJECTION_HIDDEN_DIM = 256  # Hidden layer dimension

# API configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
API_RELOAD = os.getenv("API_RELOAD", "false").lower() == "true"

# Recommendation settings
DEFAULT_TOP_K = int(os.getenv("DEFAULT_TOP_K", 10))
MAX_TOP_K = int(os.getenv("MAX_TOP_K", 100))

# Vector store settings
VECTOR_STORE_PATH = DATA_DIR / "event_embeddings.faiss"
EVENT_METADATA_PATH = DATA_DIR / "event_metadata.json"

# Model checkpoint paths
EVENT_TOWER_PATH = MODELS_DIR / "event_tower.pt"
USER_TOWER_PATH = MODELS_DIR / "user_tower.pt"


