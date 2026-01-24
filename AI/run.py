"""
Entry Point for Two-Tower Recommendation Service

Usage:
    python run.py              # Start the API server
    python run.py --reload     # Start with auto-reload (development)
"""

import argparse
import sys
from pathlib import Path

# Ensure we can import from the AI directory
AI_DIR = Path(__file__).parent.absolute()
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

import uvicorn
from config import API_HOST, API_PORT, API_RELOAD


def main():
    parser = argparse.ArgumentParser(
        description="Two-Tower Recommendation Service"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=API_HOST,
        help=f"Host to bind to (default: {API_HOST})"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=API_PORT,
        help=f"Port to bind to (default: {API_PORT})"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=API_RELOAD,
        help="Enable auto-reload for development"
    )
    
    args = parser.parse_args()
    
    # Use ASCII characters for Windows compatibility
    print("=" * 60)
    print("Event Radar - Two-Tower Recommendation API")
    print("=" * 60)
    print(f"Host:   {args.host}")
    print(f"Port:   {args.port}")
    print(f"Reload: {args.reload}")
    print()
    print(f"Docs:   http://{args.host}:{args.port}/docs")
    print("=" * 60)
    print()
    
    uvicorn.run(
        "api.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )


if __name__ == "__main__":
    main()

