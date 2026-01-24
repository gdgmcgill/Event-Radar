"""
Utility script to import events from external sources.

This module provides functions to batch import events into the
recommendation system's vector store.
"""

import json
import requests
from typing import List, Dict, Any, Optional
from pathlib import Path

import sys
sys.path.insert(0, str(__file__).rsplit("\\", 2)[0])


def import_events_from_json(
    json_path: str,
    api_url: str = "http://localhost:8000"
) -> Dict[str, Any]:
    """
    Import events from a JSON file.
    
    Expected JSON format:
    [
        {
            "event_id": "...",
            "title": "...",
            "description": "...",
            "tags": ["..."],
            "hosting_club": "...",
            "category": "..."
        },
        ...
    ]
    
    Args:
        json_path: Path to JSON file
        api_url: Recommendation API URL
        
    Returns:
        Summary of import results
    """
    with open(json_path, "r") as f:
        events = json.load(f)
        
    return import_events(events, api_url)


def import_events(
    events: List[Dict[str, Any]],
    api_url: str = "http://localhost:8000"
) -> Dict[str, Any]:
    """
    Import a list of events into the recommendation system.
    
    Args:
        events: List of event dictionaries
        api_url: Recommendation API URL
        
    Returns:
        Summary of import results
    """
    results = {
        "total": len(events),
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    for event in events:
        try:
            # Validate required fields
            if "event_id" not in event:
                raise ValueError("Missing event_id")
            if "title" not in event:
                raise ValueError("Missing title")
            if "description" not in event:
                raise ValueError("Missing description")
                
            # Call the embed endpoint
            response = requests.post(
                f"{api_url}/embed/event",
                json={
                    "event": {
                        "event_id": event["event_id"],
                        "title": event["title"],
                        "description": event["description"],
                        "tags": event.get("tags"),
                        "hosting_club": event.get("hosting_club") or event.get("club_name"),
                        "category": event.get("category")
                    },
                    "store": True
                },
                timeout=30
            )
            
            if response.status_code == 200:
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "event_id": event["event_id"],
                    "error": response.text
                })
                
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "event_id": event.get("event_id", "unknown"),
                "error": str(e)
            })
            
    return results


def import_events_from_supabase(
    supabase_url: str,
    supabase_key: str,
    api_url: str = "http://localhost:8000"
) -> Dict[str, Any]:
    """
    Import events directly from Supabase.
    
    Args:
        supabase_url: Supabase project URL
        supabase_key: Supabase anon or service key
        api_url: Recommendation API URL
        
    Returns:
        Summary of import results
    """
    # Fetch events from Supabase
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    response = requests.get(
        f"{supabase_url}/rest/v1/events",
        headers=headers,
        params={
            "select": "id,title,description,tags,club:clubs(name)",
            "status": "eq.approved"
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to fetch events: {response.text}")
        
    supabase_events = response.json()
    
    # Transform to our format
    events = []
    for event in supabase_events:
        events.append({
            "event_id": event["id"],
            "title": event["title"],
            "description": event["description"],
            "tags": event.get("tags", []),
            "hosting_club": event.get("club", {}).get("name") if event.get("club") else None
        })
        
    return import_events(events, api_url)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Import events into recommendation system")
    parser.add_argument("--json", type=str, help="Path to JSON file with events")
    parser.add_argument("--api-url", type=str, default="http://localhost:8000", help="API URL")
    
    args = parser.parse_args()
    
    if args.json:
        results = import_events_from_json(args.json, args.api_url)
        print(f"Imported {results['success']}/{results['total']} events")
        if results["errors"]:
            print(f"Errors: {results['errors']}")
    else:
        print("No input specified. Use --json to import from a JSON file.")


