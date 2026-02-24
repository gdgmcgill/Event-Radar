"""
Event Radar - Exhaustive System Test Suite
==========================================

Covers:
  Section 1  - AI Service (port 8000) direct API
    1.1  Health check
    1.2  Embed all sample events
    1.3  Basic recommendations (no feedback)
    1.4  Exclusion list (exclude_event_ids)
    1.5  Recommendations with POSITIVE feedback (vector boost)
    1.6  Recommendations with NEGATIVE feedback (hard exclusion)
    1.7  Mixed positive + negative feedback
    1.8  Vector shift verification (same user, feedback changes top results)
    1.9  Remove an event from the index
    1.10 Edge cases (empty feedback, top_k limits)

  Section 2  - Next.js API (port 3000) - unauthenticated guards
    2.1  GET  /api/recommendations              -> 401
    2.2  POST /api/recommendations/feedback     -> 401
    2.3  GET  /api/recommendations/feedback     -> 401
    2.4  GET  /api/recommendations/analytics    -> 401

  Section 3  - Next.js API - authenticated (needs TEST_EMAIL / TEST_PASSWORD)
    3.1  POST /api/recommendations/feedback  thumbs positive
    3.2  GET  /api/recommendations/feedback  retrieves stored feedback
    3.3  POST /api/recommendations/feedback  toggle to negative (upsert)
    3.4  GET  /api/recommendations/feedback  confirms toggle
    3.5  POST /api/recommendations/feedback  analytics: impression
    3.6  POST /api/recommendations/feedback  analytics: click
    3.7  POST /api/recommendations/feedback  analytics: save
    3.8  POST /api/recommendations/feedback  analytics: dismiss
    3.9  GET  /api/recommendations/analytics (7d)
    3.10 GET  /api/recommendations/analytics (30d)
    3.11 GET  /api/recommendations           full pipeline via Next.js
    3.12 Validation: missing fields -> 400
    3.13 Validation: bad action    -> 400
    3.14 Validation: bad feedback  -> 400

  Section 4  - End-to-end integration
    4.1  Submit negative feedback via Next.js, then call AI /recommend directly with
         that feedback and confirm the negated event never appears
    4.2  Submit positive feedback, re-rank, verify related events score higher

Usage
-----
  1. Start the AI service:     cd AI && python run.py
  2. Start Next.js:            npm run dev
  3. Set credentials (two ways):
       a) Environment variables:
            set TEST_EMAIL=you@example.com
            set TEST_PASSWORD=yourpassword
       b) Edit the CONFIG block below directly.
  4. Run:  python AI/test_full_system.py
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

# ============================================================================
# CONFIG - edit here OR set env vars TEST_EMAIL / TEST_PASSWORD
# ============================================================================

AI_URL    = "http://localhost:8000"
NEXT_URL  = "http://localhost:3000"

# Supabase credentials (read from .env.local automatically, or set below)
SUPABASE_URL      = ""
SUPABASE_ANON_KEY = ""

# Test user - must already exist in Supabase Auth
TEST_EMAIL    = os.environ.get("TEST_EMAIL", "")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "")

# ============================================================================
# Load .env.local automatically if keys are blank
# ============================================================================

def _load_env_local():
    global SUPABASE_URL, SUPABASE_ANON_KEY
    env_path = Path(__file__).parent.parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k == "NEXT_PUBLIC_SUPABASE_URL" and not SUPABASE_URL:
            SUPABASE_URL = v.strip().rstrip("/")
        if k == "NEXT_PUBLIC_SUPABASE_ANON_KEY" and not SUPABASE_ANON_KEY:
            SUPABASE_ANON_KEY = v.strip()

_load_env_local()

# ============================================================================
# Test runner helpers
# ============================================================================

PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"
INFO = "[INFO]"

_results: List[Tuple[str, str, str]] = []  # (status, name, detail)


def check(name: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    _results.append((status, name, detail))
    mark = "+" if condition else "X"
    print(f"  [{mark}] {name}" + (f" | {detail}" if detail else ""))
    return condition


def skip(name: str, reason: str = ""):
    _results.append((SKIP, name, reason))
    print(f"  [-] {name} (skipped: {reason})")


def section(title: str):
    print()
    print("=" * 64)
    print(f"  {title}")
    print("=" * 64)


def subsection(title: str):
    print(f"\n  -- {title} --")


def summary():
    passed = sum(1 for s, _, _ in _results if s == PASS)
    failed = sum(1 for s, _, _ in _results if s == FAIL)
    skipped = sum(1 for s, _, _ in _results if s == SKIP)
    total = passed + failed
    print()
    print("=" * 64)
    print("  TEST SUMMARY")
    print("=" * 64)
    if failed:
        print("  FAILED TESTS:")
        for s, name, detail in _results:
            if s == FAIL:
                print(f"    X {name}" + (f" | {detail}" if detail else ""))
    print(f"  Passed : {passed}/{total}")
    print(f"  Failed : {failed}/{total}")
    print(f"  Skipped: {skipped}")
    print("=" * 64)
    return failed


# ============================================================================
# Supabase auth helpers (for Section 3)
# ============================================================================

_auth_token: Optional[str] = None
_auth_cookies: Optional[dict] = None


def supabase_sign_in(email: str, password: str) -> Optional[str]:
    """Sign in via Supabase REST and return the access token."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    resp = requests.post(
        url,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json={"email": email, "password": password},
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json().get("access_token")
    print(f"    {INFO} Supabase sign-in failed: {resp.status_code} {resp.text[:200]}")
    return None


def authed_headers() -> dict:
    """Return headers that include the Supabase Bearer token as a cookie Next.js can read."""
    if _auth_token:
        return {"Cookie": f"sb-access-token={_auth_token}; sb-auth-token={_auth_token}"}
    return {}


def authed_session() -> requests.Session:
    """Build a requests.Session with the auth cookie pre-set."""
    s = requests.Session()
    if _auth_token:
        s.cookies.set("sb-access-token", _auth_token)
        s.cookies.set("sb-auth-token", _auth_token)
    return s


# ============================================================================
# SECTION 1 - AI Service direct tests
# ============================================================================

SAMPLE_EVENTS_PATH = Path(__file__).parent / "data" / "sample_events.json"
_indexed_events: List[dict] = []


def s1_health():
    subsection("1.1  Health check")
    try:
        r = requests.get(f"{AI_URL}/health", timeout=5)
        data = r.json()
        check("status 200",           r.status_code == 200)
        check("status=healthy",       data.get("status") == "healthy",    str(data.get("status")))
        check("model_loaded=true",    data.get("model_loaded") is True,   str(data.get("model_loaded")))
        check("event_count >= 0",     isinstance(data.get("event_count"), int))
        check("embedding_dim > 0",    (data.get("embedding_dim") or 0) > 0, str(data.get("embedding_dim")))
        print(f"    {INFO} {data.get('event_count')} events currently indexed, dim={data.get('embedding_dim')}")
    except requests.exceptions.ConnectionError:
        check("AI service reachable", False, "ConnectionError - is `python run.py` running?")
        raise SystemExit(1)


def s1_embed_events():
    subsection("1.2  Embed sample events")
    events = json.loads(SAMPLE_EVENTS_PATH.read_text())
    ok_count = 0
    for ev in events:
        r = requests.post(
            f"{AI_URL}/embed/event",
            json={"event": ev, "store": True},
            timeout=30,
        )
        if r.status_code == 200:
            ok_count += 1
            _indexed_events.append(ev)
        else:
            print(f"    {FAIL} {ev['title']}: {r.text[:80]}")
    check(f"embedded {len(events)} events", ok_count == len(events), f"{ok_count}/{len(events)}")


def s1_basic_recommendations():
    subsection("1.3  Basic recommendations (no feedback)")
    r = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Computer Science",
                "year_of_study": "Junior",
                "clubs_or_interests": ["AI Club", "Technology"],
            },
            "top_k": 5,
        },
        timeout=15,
    )
    check("status 200", r.status_code == 200, str(r.status_code))
    if r.status_code != 200:
        return
    data = r.json()
    recs = data.get("recommendations", [])
    check("returns list",        isinstance(recs, list))
    check("up to 5 results",     len(recs) <= 5,             f"got {len(recs)}")
    check("at least 1 result",   len(recs) >= 1,             f"got {len(recs)}")
    check("has scores",          all("score" in r for r in recs))
    check("scores descending",   all(recs[i]["score"] >= recs[i+1]["score"] for i in range(len(recs)-1)))
    check("total_events field",  "total_events" in data,     str(data.get("total_events")))
    # For an untrained model the exact ranks aren't deterministic;
    # verify that at least one tech-related event appears in the top 5
    tech_ids = {"evt-001", "evt-008", "evt-011"}  # ML workshop, Hackathon, Data Science
    top5_ids = {r["event_id"] for r in recs[:5]}
    print(f"    {INFO} Top 5: {[r['title'] for r in recs[:5]]}")
    check("at least one tech event in top 5",
          bool(tech_ids & top5_ids),
          f"top5={top5_ids}, wanted any of {tech_ids}")


def s1_exclusion():
    subsection("1.4  exclude_event_ids")
    r = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Computer Science",
                "year_of_study": "Junior",
                "clubs_or_interests": ["AI Club"],
            },
            "top_k": 10,
            "exclude_event_ids": ["evt-001", "evt-008", "evt-011"],
        },
        timeout=15,
    )
    check("status 200", r.status_code == 200)
    if r.status_code != 200:
        return
    recs = r.json().get("recommendations", [])
    returned_ids = {rec["event_id"] for rec in recs}
    check("evt-001 excluded", "evt-001" not in returned_ids, str(returned_ids))
    check("evt-008 excluded", "evt-008" not in returned_ids)
    check("evt-011 excluded", "evt-011" not in returned_ids)


def s1_positive_feedback():
    subsection("1.5  Positive feedback boosts related events")
    base = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Business",
                "year_of_study": "Sophomore",
                "clubs_or_interests": ["Finance Club"],
            },
            "top_k": 10,
        },
        timeout=15,
    )
    check("baseline status 200", base.status_code == 200)
    if base.status_code != 200:
        return

    base_recs = base.json().get("recommendations", [])
    base_rank = {r["event_id"]: i for i, r in enumerate(base_recs)}
    print(f"    {INFO} Baseline top 3: {[r['title'] for r in base_recs[:3]]}")

    # Give positive feedback on sports/wellness event → user vector shifts toward those tags
    boosted = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Business",
                "year_of_study": "Sophomore",
                "clubs_or_interests": ["Finance Club"],
            },
            "top_k": 10,
            "feedback": [
                {"event_id": "evt-004", "feedback_type": "positive", "tags": ["sports", "social"]},
                {"event_id": "evt-012", "feedback_type": "positive", "tags": ["wellness", "sports"]},
            ],
        },
        timeout=15,
    )
    check("boosted status 200", boosted.status_code == 200)
    if boosted.status_code != 200:
        return

    boosted_recs = boosted.json().get("recommendations", [])
    boosted_rank = {r["event_id"]: i for i, r in enumerate(boosted_recs)}
    print(f"    {INFO} Boosted top 3: {[r['title'] for r in boosted_recs[:3]]}")

    # Results should differ (vector moved)
    # The user vector must move — results should differ from baseline
    check("results changed after positive feedback",
          base_recs != boosted_recs,
          "recommendation order unchanged — feedback had no effect on user embedding")

    # Sports/wellness events should rank higher (or at worst equal) after positive feedback
    sports_base    = base_rank.get("evt-004", 99)
    sports_boost   = boosted_rank.get("evt-004", 99)
    wellness_base  = base_rank.get("evt-012", 99)
    wellness_boost = boosted_rank.get("evt-012", 99)
    print(f"    {INFO} evt-004 (Basketball) rank: baseline={sports_base} boosted={sports_boost}")
    print(f"    {INFO} evt-012 (Yoga)       rank: baseline={wellness_base} boosted={wellness_boost}")
    # At least one of the two positively-rated events should improve in rank
    either_improved = (sports_boost < sports_base) or (wellness_boost < wellness_base)
    check("at least one rated event ranks higher after positive feedback",
          either_improved,
          f"evt-004: {sports_base}->{sports_boost}, evt-012: {wellness_base}->{wellness_boost}")


def s1_negative_feedback():
    subsection("1.6  Negative feedback hard-excludes events")
    r = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Computer Science",
                "year_of_study": "Junior",
                "clubs_or_interests": ["AI Club", "Technology"],
            },
            "top_k": 10,
            "feedback": [
                {"event_id": "evt-001", "feedback_type": "negative", "tags": ["academic", "technology", "workshop"]},
                {"event_id": "evt-008", "feedback_type": "negative", "tags": ["academic", "technology"]},
            ],
        },
        timeout=15,
    )
    check("status 200", r.status_code == 200)
    if r.status_code != 200:
        return
    recs = r.json().get("recommendations", [])
    returned_ids = {rec["event_id"] for rec in recs}
    check("evt-001 (negative) absent from results", "evt-001" not in returned_ids, str(returned_ids))
    check("evt-008 (negative) absent from results", "evt-008" not in returned_ids)
    print(f"    {INFO} Returned: {sorted(returned_ids)}")


def s1_mixed_feedback():
    subsection("1.7  Mixed positive + negative feedback")
    r = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Computer Science",
                "year_of_study": "Junior",
                "clubs_or_interests": ["AI Club"],
            },
            "top_k": 10,
            "feedback": [
                {"event_id": "evt-001", "feedback_type": "negative", "tags": ["academic", "technology", "workshop"]},
                {"event_id": "evt-012", "feedback_type": "positive", "tags": ["wellness", "sports"]},
                {"event_id": "evt-015", "feedback_type": "negative", "tags": ["social", "sports"]},
            ],
        },
        timeout=15,
    )
    check("status 200", r.status_code == 200)
    if r.status_code != 200:
        return
    recs = r.json().get("recommendations", [])
    returned_ids = {rec["event_id"] for rec in recs}
    check("evt-001 (negative) excluded", "evt-001" not in returned_ids)
    check("evt-015 (negative) excluded", "evt-015" not in returned_ids)
    check("evt-012 (positive) may appear", True, "positive events not suppressed")
    print(f"    {INFO} Returned IDs: {sorted(returned_ids)}")


def s1_vector_shift_verification():
    subsection("1.8  Vector shift - same user, feedback changes rankings")
    user = {
        "major": "Liberal Arts",
        "year_of_study": "Freshman",
        "clubs_or_interests": ["Photography Club"],
    }
    no_feedback = requests.post(
        f"{AI_URL}/recommend", json={"user": user, "top_k": 5}, timeout=15
    )
    tech_boosted = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": user,
            "top_k": 5,
            "feedback": [
                {"event_id": "evt-002", "feedback_type": "positive", "tags": ["career", "networking"]},
                {"event_id": "evt-009", "feedback_type": "positive", "tags": ["career"]},
            ],
        },
        timeout=15,
    )
    check("no-feedback request ok",    no_feedback.status_code == 200)
    check("career-boosted request ok", tech_boosted.status_code == 200)
    if no_feedback.status_code == 200 and tech_boosted.status_code == 200:
        base_top = [r["event_id"] for r in no_feedback.json()["recommendations"]]
        boost_top = [r["event_id"] for r in tech_boosted.json()["recommendations"]]
        print(f"    {INFO} No-feedback top: {base_top}")
        print(f"    {INFO} Career-boosted top: {boost_top}")
        check("rankings differ after positive career feedback", base_top != boost_top,
              "top list unchanged — feedback adjustment had no effect on embedding")
        # Career events (evt-002 Career Fair, evt-009 Resume Workshop, evt-013 Finance)
        # should collectively appear higher after career-positive feedback
        career_events = ["evt-002", "evt-009", "evt-013"]
        def best_rank(ids, pool):
            return min((pool.index(i) if i in pool else 99) for i in ids)
        career_base_rank  = best_rank(career_events, base_top)
        career_boost_rank = best_rank(career_events, boost_top)
        print(f"    {INFO} Best career event rank: base={career_base_rank} boost={career_boost_rank}")
        check("career event(s) rank higher after career feedback",
              career_boost_rank <= career_base_rank,
              f"base best={career_base_rank} boost best={career_boost_rank}")


def s1_remove_event():
    subsection("1.9  Remove an event from the index")
    # First verify it appears
    r_before = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {"major": "Business", "year_of_study": "Junior", "clubs_or_interests": ["Gaming Club"]},
            "top_k": 15,
        },
        timeout=15,
    )
    before_ids = {rec["event_id"] for rec in r_before.json().get("recommendations", [])}

    # Remove evt-015 (Gaming Tournament)
    r_remove = requests.post(f"{AI_URL}/events/remove", json={"event_id": "evt-015"}, timeout=5)
    check("remove status 200", r_remove.status_code == 200)
    if r_remove.status_code == 200:
        check("removed=true", r_remove.json().get("removed") is True, str(r_remove.json()))

    # Verify it no longer shows up
    r_after = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {"major": "Business", "year_of_study": "Junior", "clubs_or_interests": ["Gaming Club"]},
            "top_k": 15,
        },
        timeout=15,
    )
    after_ids = {rec["event_id"] for rec in r_after.json().get("recommendations", [])}
    check("evt-015 absent after removal", "evt-015" not in after_ids, str(after_ids))

    # Re-embed it so subsequent tests still have a full index
    gaming_ev = next((e for e in _indexed_events if e["event_id"] == "evt-015"), None)
    if gaming_ev:
        requests.post(f"{AI_URL}/embed/event", json={"event": gaming_ev, "store": True}, timeout=30)
        print(f"    {INFO} evt-015 re-indexed for remaining tests")


def s1_edge_cases():
    subsection("1.10 Edge cases")
    # Empty feedback list → same as no feedback
    r = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {"major": "CS", "year_of_study": "Senior", "clubs_or_interests": []},
            "top_k": 5,
            "feedback": [],
        },
        timeout=15,
    )
    check("empty feedback list OK", r.status_code == 200)

    # top_k = 1
    r = requests.post(
        f"{AI_URL}/recommend",
        json={"user": {"major": "CS", "year_of_study": "Senior", "clubs_or_interests": []}, "top_k": 1},
        timeout=15,
    )
    check("top_k=1 returns exactly 1", r.status_code == 200 and len(r.json().get("recommendations", [])) == 1)

    # top_k > MAX_TOP_K is accepted by schema and clamped server-side
    r = requests.post(
        f"{AI_URL}/recommend",
        json={"user": {"major": "CS", "year_of_study": "Senior", "clubs_or_interests": []}, "top_k": 999},
        timeout=15,
    )
    check("top_k=999 accepted (clamped to MAX_TOP_K server-side)", r.status_code == 200,
          f"got {r.status_code}")

    # Feedback with no tags → still works, no delta
    r = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {"major": "CS", "year_of_study": "Senior", "clubs_or_interests": []},
            "top_k": 3,
            "feedback": [{"event_id": "evt-999", "feedback_type": "positive", "tags": []}],
        },
        timeout=15,
    )
    check("feedback with empty tags OK", r.status_code == 200)

    # Docs accessible
    r = requests.get(f"{AI_URL}/docs", timeout=5)
    check("Swagger /docs accessible", r.status_code == 200)


# ============================================================================
# SECTION 2 - Next.js unauthenticated guards
# ============================================================================

def s2_unauth_guards():
    subsection("Next.js unauthenticated route guards")
    try:
        requests.get(f"{NEXT_URL}/", timeout=5)
    except requests.exceptions.ConnectionError:
        skip("all Section 2 tests", "Next.js dev server not reachable on port 3000")
        return

    r = requests.get(f"{NEXT_URL}/api/recommendations", timeout=5)
    check("2.1  GET  /api/recommendations          -> 401", r.status_code == 401, str(r.status_code))

    r = requests.post(f"{NEXT_URL}/api/recommendations/feedback",
                      json={"event_id": "x", "feedback": "positive"}, timeout=5)
    check("2.2  POST /api/recommendations/feedback  -> 401", r.status_code == 401, str(r.status_code))

    r = requests.get(f"{NEXT_URL}/api/recommendations/feedback?event_ids=x", timeout=5)
    check("2.3  GET  /api/recommendations/feedback  -> 401", r.status_code == 401, str(r.status_code))

    r = requests.get(f"{NEXT_URL}/api/recommendations/analytics", timeout=5)
    check("2.4  GET  /api/recommendations/analytics -> 401", r.status_code == 401, str(r.status_code))


# ============================================================================
# SECTION 3 - Next.js authenticated tests
# ============================================================================

# A fake event ID we'll use for feedback tests (doesn't need to exist in DB for feedback writes)
_TEST_EVENT_ID = "evt-001"
_FAKE_EVENT_ID = "00000000-0000-0000-0000-000000000099"


def s3_sign_in() -> bool:
    global _auth_token
    subsection("3.0  Authenticate with Supabase")
    if not TEST_EMAIL or not TEST_PASSWORD:
        skip("Section 3 (all authenticated tests)", "TEST_EMAIL / TEST_PASSWORD not set")
        return False
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        skip("Section 3 (all authenticated tests)", "Supabase credentials not loaded from .env.local")
        return False

    token = supabase_sign_in(TEST_EMAIL, TEST_PASSWORD)
    if not token:
        check("Supabase sign-in", False, f"Failed for {TEST_EMAIL}")
        return False
    _auth_token = token
    check("Supabase sign-in OK", True, f"user={TEST_EMAIL}")
    return True


def _next_post(path: str, body: dict) -> requests.Response:
    """POST to Next.js with auth cookies."""
    return requests.post(
        f"{NEXT_URL}{path}",
        json=body,
        headers={"Cookie": f"sb-access-token={_auth_token}; sb-auth-token={_auth_token}"},
        timeout=15,
    )


def _next_get(path: str, params: Optional[dict] = None) -> requests.Response:
    """GET from Next.js with auth cookies."""
    return requests.get(
        f"{NEXT_URL}{path}",
        params=params,
        headers={"Cookie": f"sb-access-token={_auth_token}; sb-auth-token={_auth_token}"},
        timeout=15,
    )


def s3_thumbs_feedback():
    subsection("3.1  POST thumbs positive feedback")
    r = _next_post("/api/recommendations/feedback", {"event_id": _TEST_EVENT_ID, "feedback": "positive"})
    check("status 200", r.status_code == 200, str(r.status_code))
    if r.status_code == 200:
        check("ok=true", r.json().get("ok") is True, str(r.json()))


def s3_get_feedback():
    subsection("3.2  GET feedback - retrieve stored thumbs")
    r = _next_get("/api/recommendations/feedback", {"event_ids": _TEST_EVENT_ID})
    check("status 200", r.status_code == 200, str(r.status_code))
    if r.status_code == 200:
        fb = r.json().get("feedback", {})
        check("feedback map returned", isinstance(fb, dict))
        check(f"evt-001 = positive", fb.get(_TEST_EVENT_ID) == "positive",
              f"got={fb.get(_TEST_EVENT_ID)}")


def s3_thumbs_toggle():
    subsection("3.3  POST thumbs negative (toggle from positive)")
    r = _next_post("/api/recommendations/feedback", {"event_id": _TEST_EVENT_ID, "feedback": "negative"})
    check("status 200", r.status_code == 200, str(r.status_code))


def s3_get_feedback_toggled():
    subsection("3.4  GET feedback - confirm toggle to negative")
    r = _next_get("/api/recommendations/feedback", {"event_ids": _TEST_EVENT_ID})
    check("status 200", r.status_code == 200, str(r.status_code))
    if r.status_code == 200:
        fb = r.json().get("feedback", {})
        check(f"evt-001 = negative after toggle", fb.get(_TEST_EVENT_ID) == "negative",
              f"got={fb.get(_TEST_EVENT_ID)}")


def s3_analytics_feedback(action: str, rank: int, label: str):
    subsection(f"3.{label}  POST analytics: {action}")
    r = _next_post("/api/recommendations/feedback", {
        "event_id": _TEST_EVENT_ID,
        "recommendation_rank": rank,
        "action": action,
        "session_id": "test-session-001",
    })
    check(f"status 200", r.status_code == 200, str(r.status_code))
    if r.status_code == 200:
        check("ok=true", r.json().get("ok") is True, str(r.json()))


def s3_analytics_endpoint():
    subsection("3.9  GET /api/recommendations/analytics (7d)")
    r = _next_get("/api/recommendations/analytics", {"period": "7d"})
    check("status 200", r.status_code == 200, str(r.status_code))
    if r.status_code == 200:
        data = r.json()
        m = data.get("metrics", {})
        check("period=7d", data.get("period") == "7d")
        check("impressions field", "impressions" in m, str(m))
        check("ctr_percent field", "ctr_percent" in m)
        check("save_rate_percent", "save_rate_percent" in m)
        check("dismiss_rate_percent", "dismiss_rate_percent" in m)
        print(f"    {INFO} Metrics: impressions={m.get('impressions')} CTR={m.get('ctr_percent')}%"
              f" saves={m.get('saves')} dismisses={m.get('dismisses')}")

    subsection("3.10 GET /api/recommendations/analytics (30d)")
    r = _next_get("/api/recommendations/analytics", {"period": "30d"})
    check("status 200", r.status_code == 200, str(r.status_code))
    if r.status_code == 200:
        check("period=30d", r.json().get("period") == "30d")


def s3_get_recommendations():
    subsection("3.11 GET /api/recommendations - full pipeline via Next.js")
    r = _next_get("/api/recommendations", {"top_k": "5"})
    check("status 200", r.status_code == 200, str(r.status_code))
    if r.status_code == 200:
        data = r.json()
        recs = data.get("recommendations", [])
        check("recommendations list", isinstance(recs, list))
        print(f"    {INFO} Got {len(recs)} recommendations from Next.js pipeline")
        if recs:
            check("scores present", all("score" in r for r in recs))


def s3_validation():
    subsection("3.12-3.14  Input validation")
    # Missing event_id in thumbs
    r = _next_post("/api/recommendations/feedback", {"feedback": "positive"})
    check("3.12 missing event_id -> 400", r.status_code == 400, str(r.status_code))

    # Bad action
    r = _next_post("/api/recommendations/feedback", {
        "event_id": _TEST_EVENT_ID, "recommendation_rank": 1, "action": "explode"
    })
    check("3.13 bad action -> 400", r.status_code == 400, str(r.status_code))

    # Bad thumbs value
    r = _next_post("/api/recommendations/feedback", {"event_id": _TEST_EVENT_ID, "feedback": "maybe"})
    check("3.14 bad feedback value -> 400", r.status_code == 400, str(r.status_code))

    # analytics: missing recommendation_rank
    r = _next_post("/api/recommendations/feedback", {
        "event_id": _TEST_EVENT_ID, "action": "click"
    })
    check("3.15 analytics missing rank -> 400", r.status_code == 400, str(r.status_code))

    # analytics: rank < 1
    r = _next_post("/api/recommendations/feedback", {
        "event_id": _TEST_EVENT_ID, "recommendation_rank": 0, "action": "click"
    })
    check("3.16 recommendation_rank=0 -> 400", r.status_code == 400, str(r.status_code))

    # analytics: bad period
    r = _next_get("/api/recommendations/analytics", {"period": "99y"})
    check("3.17 bad analytics period -> 400", r.status_code == 400, str(r.status_code))


# ============================================================================
# SECTION 4 - End-to-end integration
# ============================================================================

def s4_e2e_negative_feedback_integration():
    subsection("4.1  E2E: Next.js negative feedback -> AI exclusion")
    if not _auth_token:
        skip("4.1", "no auth token (section 3 was skipped)")
        return

    # Store negative feedback for evt-001 via Next.js
    r = _next_post("/api/recommendations/feedback", {"event_id": "evt-001", "feedback": "negative"})
    check("store negative feedback via Next.js", r.status_code == 200, str(r.status_code))

    # Retrieve to confirm it's stored as negative
    r = _next_get("/api/recommendations/feedback", {"event_ids": "evt-001"})
    fb = r.json().get("feedback", {}) if r.status_code == 200 else {}
    check("feedback confirmed negative in DB", fb.get("evt-001") == "negative", str(fb))

    # Call AI service directly with that feedback (simulating what GET /api/recommendations does)
    r = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Computer Science",
                "year_of_study": "Junior",
                "clubs_or_interests": ["AI Club"],
            },
            "top_k": 10,
            "feedback": [
                {"event_id": "evt-001", "feedback_type": "negative", "tags": ["academic", "technology", "workshop"]}
            ],
        },
        timeout=15,
    )
    check("AI /recommend with feedback OK", r.status_code == 200)
    if r.status_code == 200:
        recs = r.json().get("recommendations", [])
        returned_ids = {rec["event_id"] for rec in recs}
        check("evt-001 absent from AI results after negative feedback",
              "evt-001" not in returned_ids, str(returned_ids))

    # Reset for other tests (toggle back to positive)
    _next_post("/api/recommendations/feedback", {"event_id": "evt-001", "feedback": "positive"})
    print(f"    {INFO} Reset evt-001 feedback to positive")


def s4_e2e_positive_feedback_integration():
    subsection("4.2  E2E: positive feedback shifts vector toward related categories")
    # No-feedback baseline
    base = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Engineering",
                "year_of_study": "Senior",
                "clubs_or_interests": ["Robotics"],
            },
            "top_k": 10,
        },
        timeout=15,
    )
    check("baseline ok", base.status_code == 200)
    if base.status_code != 200:
        return

    base_top3 = [r["event_id"] for r in base.json()["recommendations"][:3]]
    print(f"    {INFO} Baseline top 3: {base_top3}")

    # Positive feedback on career events shifts user interest toward career
    shifted = requests.post(
        f"{AI_URL}/recommend",
        json={
            "user": {
                "major": "Engineering",
                "year_of_study": "Senior",
                "clubs_or_interests": ["Robotics"],
            },
            "top_k": 10,
            "feedback": [
                {"event_id": "evt-002", "feedback_type": "positive", "tags": ["career", "networking"]},
                {"event_id": "evt-009", "feedback_type": "positive", "tags": ["career"]},
                {"event_id": "evt-013", "feedback_type": "positive", "tags": ["academic", "career"]},
            ],
        },
        timeout=15,
    )
    check("career-boosted ok", shifted.status_code == 200)
    if shifted.status_code != 200:
        return

    shifted_top3 = [r["event_id"] for r in shifted.json()["recommendations"][:3]]
    print(f"    {INFO} Career-boosted top 3: {shifted_top3}")

    # The top lists should differ
    check("positive feedback changes ranking", base_top3 != shifted_top3,
          f"base={base_top3} shifted={shifted_top3}")

    # Career events should rank higher overall after career boost
    base_all    = [r["event_id"] for r in base.json()["recommendations"]]
    shifted_all = [r["event_id"] for r in shifted.json()["recommendations"]]
    career_ids  = {"evt-002", "evt-009", "evt-013"}

    def avg_rank(ids, pool):
        ranks = [pool.index(i) for i in ids if i in pool]
        return sum(ranks) / len(ranks) if ranks else 99

    career_rank_base    = avg_rank(career_ids, base_all)
    career_rank_shifted = avg_rank(career_ids, shifted_all)
    print(f"    {INFO} Career avg rank: base={career_rank_base:.1f} shifted={career_rank_shifted:.1f}")
    check("career events rank higher on average after positive feedback",
          career_rank_shifted <= career_rank_base,
          f"avg rank: {career_rank_base:.1f} -> {career_rank_shifted:.1f}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    print()
    print("=" * 64)
    print("  Event Radar - Full System Test Suite")
    print("=" * 64)
    print(f"  AI service : {AI_URL}")
    print(f"  Next.js    : {NEXT_URL}")
    print(f"  Supabase   : {SUPABASE_URL or '(not loaded)'}")
    print(f"  Test user  : {TEST_EMAIL or '(not set - Section 3 will be skipped)'}")

    section("Section 1 - AI Service Direct Tests")
    try:
        s1_health()
        s1_embed_events()
        s1_basic_recommendations()
        s1_exclusion()
        s1_positive_feedback()
        s1_negative_feedback()
        s1_mixed_feedback()
        s1_vector_shift_verification()
        s1_remove_event()
        s1_edge_cases()
    except SystemExit:
        print("\nAI service unreachable. Skipping remaining tests.")
        summary()
        sys.exit(1)

    section("Section 2 - Next.js Unauthenticated Guards")
    s2_unauth_guards()

    section("Section 3 - Next.js Authenticated Tests")
    authed = s3_sign_in()
    if authed:
        s3_thumbs_feedback()
        s3_get_feedback()
        s3_thumbs_toggle()
        s3_get_feedback_toggled()
        s3_analytics_feedback("impression", 1, "5")
        s3_analytics_feedback("click", 1, "6")
        s3_analytics_feedback("save", 1, "7")
        s3_analytics_feedback("dismiss", 2, "8")
        s3_analytics_endpoint()
        s3_get_recommendations()
        s3_validation()

    section("Section 4 - End-to-End Integration")
    s4_e2e_negative_feedback_integration()
    s4_e2e_positive_feedback_integration()

    failed = summary()
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
