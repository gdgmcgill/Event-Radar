# Event Radar - Two-Tower Recommendation Service

A lightweight, CPU-only recommendation API for university events using a two-tower neural architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Recommendation Service                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐              ┌─────────────────┐           │
│  │   User Tower    │              │   Event Tower   │           │
│  │                 │              │                 │           │
│  │  User Metadata  │              │  Event Metadata │           │
│  │       ↓         │              │       ↓         │           │
│  │  Text Encoding  │              │  Text Encoding  │           │
│  │  (MiniLM-L6)    │              │  (MiniLM-L6)    │           │
│  │       ↓         │              │       ↓         │           │
│  │  Mean Pooling   │              │  Projection MLP │           │
│  │       ↓         │              │       ↓         │           │
│  │  Projection MLP │              │  Event Embedding│──→ FAISS  │
│  │       ↓         │              └─────────────────┘   Store   │
│  │  User Embedding │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           └──────────────→ Dot Product ←────────────────────────│
│                                ↓                                 │
│                         Ranked Events                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Lightweight**: CPU-only inference using `all-MiniLM-L6-v2` (384-dim embeddings)
- **Fast**: FAISS vector store for sub-millisecond similarity search
- **Cold-Start Friendly**: Works for new users and events using text metadata
- **Stateless**: User embeddings computed on-demand, no session storage
- **Simple API**: Clean REST endpoints for integration

## Quick Start

### 1. Install Dependencies

```bash
cd AI
pip install -r requirements.txt
```

> **Note**: For CPU-only PyTorch, use:
> ```bash
> pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```

### 2. Start the Server

```bash
python run.py
```

The API will be available at `http://localhost:8000`

### 3. View API Documentation

Open `http://localhost:8000/docs` for interactive Swagger documentation.

## API Endpoints

### `POST /recommend`

Get personalized event recommendations for a user.

**Request:**
```json
{
  "user": {
    "major": "Computer Science",
    "year_of_study": "Junior",
    "clubs_or_interests": ["AI Club", "Photography", "Hiking"],
    "attended_events": ["Machine Learning Workshop", "Startup Pitch Night"]
  },
  "top_k": 10,
  "exclude_event_ids": ["event-123"]
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "event_id": "evt-456",
      "score": 0.8542,
      "title": "Deep Learning Seminar",
      "description": "Advanced neural network techniques",
      "tags": ["academic", "technology"],
      "hosting_club": "AI Club",
      "category": "seminar"
    }
  ],
  "total_events": 150
}
```

### `POST /embed/event`

Embed and store an event in the vector index.

**Request:**
```json
{
  "event": {
    "event_id": "evt-12345",
    "title": "Introduction to Machine Learning",
    "description": "Learn the fundamentals of ML in this hands-on workshop.",
    "tags": ["academic", "technology", "workshop"],
    "hosting_club": "AI Club",
    "category": "workshop"
  },
  "store": true
}
```

**Response:**
```json
{
  "event_id": "evt-12345",
  "embedding": [0.1, 0.2, ...],
  "stored": true,
  "embedding_dim": 128
}
```

### `POST /events/remove`

Remove an event from the vector index.

**Request:**
```json
{
  "event_id": "evt-12345"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "event_count": 150,
  "embedding_dim": 128
}
```

## Integration with Next.js App

Update your Next.js API route to call the recommendation service:

```typescript
// src/app/api/recommendations/route.ts
import { NextResponse } from "next/server";

const RECOMMENDATION_API = process.env.RECOMMENDATION_API_URL || "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.json();
  
  const response = await fetch(`${RECOMMENDATION_API}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

## Configuration

Environment variables (can be set in `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL_NAME` | `sentence-transformers/all-MiniLM-L6-v2` | HuggingFace model name |
| `API_HOST` | `0.0.0.0` | Server host |
| `API_PORT` | `8000` | Server port |
| `API_RELOAD` | `false` | Enable auto-reload |
| `DEFAULT_TOP_K` | `10` | Default recommendations count |
| `MAX_TOP_K` | `100` | Maximum recommendations count |

## Project Structure

```
AI/
├── api/
│   ├── __init__.py
│   ├── main.py          # FastAPI application
│   └── schemas.py       # Pydantic models
├── models/
│   ├── __init__.py
│   ├── embedder.py      # Sentence transformer wrapper
│   └── towers.py        # Event and User towers
├── services/
│   ├── __init__.py
│   ├── recommender.py   # Main recommendation logic
│   └── vector_store.py  # FAISS vector store
├── data/                # Event embeddings (auto-created)
├── config.py            # Configuration settings
├── requirements.txt     # Python dependencies
├── run.py              # Entry point
└── README.md
```

## Model Details

### Embedding Model
- **Model**: `all-MiniLM-L6-v2`
- **Dimension**: 384
- **Size**: ~80MB
- **Inference**: ~5ms per text on CPU

### Projection MLP
- **Architecture**: Linear(384, 256) → ReLU → Dropout(0.1) → Linear(256, 128)
- **Output**: L2-normalized 128-dim vector
- **Purpose**: Map pretrained embeddings to task-specific space

### Scoring
- **Method**: Dot product (inner product)
- **Range**: [-1, 1] (for normalized vectors)
- **Interpretation**: Higher score = more relevant

## Cold Start Handling

**New Users** (no `attended_events`):
- Recommendations based on `major`, `year_of_study`, and `clubs_or_interests`
- The embedding model captures semantic meaning from these fields

**New Events** (just created):
- Call `/embed/event` when creating an event
- The event is immediately available for recommendations

## Future Improvements

1. **BPR Loss Training**: Fine-tune projection MLPs on click/save data
2. **Temporal Decay**: Weight recent events higher
3. **Popularity Blending**: Mix personalized scores with popularity
4. **A/B Testing**: Compare recommendation strategies
5. **Caching**: Cache user embeddings for repeat requests

## Development

### Run with Auto-Reload
```bash
python run.py --reload
```

### Run Tests
```bash
pytest tests/
```

### Batch Import Events
```python
from services.recommender import get_recommender_service

service = get_recommender_service()

events = [
    {"event_id": "1", "title": "...", "description": "..."},
    # ...
]

for event in events:
    service.embed_event(**event)

service.vector_store.save()
```

## License

MIT

