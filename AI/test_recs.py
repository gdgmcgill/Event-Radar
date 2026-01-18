"""
Test script for the Recommendation Service
"""
import requests
import json
from pathlib import Path

API_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("1. Testing health endpoint...")
    response = requests.get(f"{API_URL}/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    print()

def add_sample_events():
    """Add sample events from sample_events.json"""
    print("2. Adding sample events...")
    
    # Load sample events
    sample_file = Path(__file__).parent / "data" / "sample_events.json"
    with open(sample_file, "r") as f:
        events = json.load(f)
    
    # Add first 5 events
    for event in events[:5]:
        response = requests.post(
            f"{API_URL}/embed/event",
            json={
                "event": event,
                "store": True
            }
        )
        if response.status_code == 200:
            print(f"   [OK] Added: {event['title']}")
        else:
            print(f"   [FAIL] Failed: {event['title']} - {response.text}")
    print()

def test_recommendations():
    """Test recommendation endpoint"""
    print("3. Testing recommendations...")
    
    test_users = [
        {
            "major": "Computer Science",
            "year_of_study": "Junior",
            "clubs_or_interests": ["AI Club", "Photography"],
            "attended_events": ["Machine Learning Workshop"]
        },
        {
            "major": "Business",
            "year_of_study": "Senior",
            "clubs_or_interests": ["Entrepreneurship Club", "Finance Club"],
            "attended_events": []
        }
    ]
    
    for i, user in enumerate(test_users, 1):
        print(f"   Test User {i}: {user['major']} - {user['year_of_study']}")
        response = requests.post(
            f"{API_URL}/recommend",
            json={
                "user": user,
                "top_k": 3
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Recommendations ({data['total_events']} events indexed):")
            for rec in data['recommendations']:
                print(f"     - {rec['title']} (score: {rec['score']:.4f})")
        else:
            print(f"   [ERROR] Error: {response.text}")
        print()

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Recommendation Service")
    print("=" * 60)
    print()
    
    try:
        test_health()
        add_sample_events()
        test_recommendations()
        
        print("=" * 60)
        print("Testing complete!")
        print("=" * 60)
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to the API.")
        print("Make sure the service is running: python run.py")
    except Exception as e:
        print(f"ERROR: {e}")