#!/usr/bin/env python3
"""Local-only competing-session regression for DI-62/68.

Uses the existing Docker Postgres container and unique synthetic fixtures.
No reset, seed, linked project, credentials, or external APIs. Fixtures are
removed in finally, including after a failed assertion. Apply migrations first.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import threading
from uuid import uuid4

parser = argparse.ArgumentParser()
parser.add_argument("--container", default="supabase_db_Event-Radar")
args = parser.parse_args()
if not args.container.startswith("supabase_db_"):
    raise SystemExit("Use a local Supabase Docker database container")


def sql(statement):
    result = subprocess.run(
        ["docker", "exec", "-i", args.container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
        input=statement, text=True, capture_output=True, check=True, timeout=30,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def race(first, second):
    barrier = threading.Barrier(2)

    def run(statement):
        barrier.wait(timeout=5)
        # The winner deliberately holds its row lock so the second transaction
        # must use the post-wait row state rather than its earlier snapshot.
        return sql(f"BEGIN; SET LOCAL ROLE service_role; {statement}; SELECT pg_sleep(0.3); COMMIT;")[0]

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(run, statement) for statement in (first, second)]
        outcomes = [future.result(timeout=35) for future in futures]
    assert sorted(outcomes) == ["conflict", "ok"], outcomes
    return outcomes


admin, owner, target1, target2, applicant, club, request, event = [str(uuid4()) for _ in range(8)]
users = [admin, owner, target1, target2, applicant]
ids = ",".join(f"'{uid}'" for uid in users)
try:
    sql("BEGIN;" + "".join(
        f"INSERT INTO auth.users(id,email) VALUES('{uid}','m0-{uid}@example.invalid');"
        f"INSERT INTO public.users(id,email,name,roles) VALUES('{uid}','m0-{uid}@example.invalid','M0 concurrency','{{user{',admin' if uid == admin else ''}}}');"
        for uid in users
    ) + f"""
      INSERT INTO public.clubs(id,name,status) VALUES('{club}','M0 concurrency','approved');
      INSERT INTO public.club_members(club_id,user_id,role) VALUES
        ('{club}','{owner}','owner'),('{club}','{target1}','organizer'),('{club}','{target2}','organizer');
      INSERT INTO public.organizer_requests(id,user_id,club_id) VALUES('{request}','{applicant}','{club}');
      INSERT INTO public.events(id,title,start_date,end_date,status,created_by,pending_edits)
        VALUES('{event}','Original','2031-01-01T18:00:00Z','2031-01-01T20:00:00Z','approved','{owner}','{{"title":"Reviewed","submitted_at":"v1"}}');
      COMMIT;
    """)

    transfer = race(
        f"SELECT public.transfer_club_ownership_atomic('{club}','{owner}','{target1}')",
        f"SELECT public.transfer_club_ownership_atomic('{club}','{owner}','{target2}')",
    )
    expected_owner = target1 if transfer[0] == "ok" else target2
    assert sql(f"SELECT user_id FROM public.club_members WHERE club_id='{club}' AND role='owner'") == [expected_owner]
    assert sql(f"SELECT count(*) FROM public.admin_audit_log WHERE target_id='{club}'") == ["1"]

    review = race(
        f"SELECT public.review_organizer_request_atomic('{request}','{admin}','approved')",
        f"SELECT public.review_organizer_request_atomic('{request}','{admin}','rejected')",
    )
    expected_status = "approved" if review[0] == "ok" else "rejected"
    assert sql(f"SELECT status FROM public.organizer_requests WHERE id='{request}'") == [expected_status]
    assert sql(f"SELECT count(*) FROM public.admin_audit_log WHERE target_id='{request}'") == ["1"]
    assert sql(f"SELECT count(*) FROM public.notifications WHERE user_id='{applicant}'") == ["1"]
    assert sql(f"SELECT count(*) FROM public.club_members WHERE club_id='{club}' AND user_id='{applicant}'") == ["1" if expected_status == "approved" else "0"]

    snapshot = '{"title":"Reviewed","submitted_at":"v1"}'
    edits = race(
        f"SELECT public.review_event_edits_atomic('{event}','{admin}','approve','{snapshot}')",
        f"SELECT public.review_event_edits_atomic('{event}','{admin}','reject','{snapshot}','Needs revision')",
    )
    assert sql(f"SELECT title || ':' || (pending_edits IS NULL)::text FROM public.events WHERE id='{event}'") == [f"{'Reviewed' if edits[0] == 'ok' else 'Original'}:true"]
    assert sql(f"SELECT count(*) FROM public.admin_audit_log WHERE target_id='{event}'") == ["1"]
    assert sql(f"SELECT count(*) FROM public.notifications WHERE event_id='{event}'") == ["1"]
    print(json.dumps({"transfer": transfer, "organizer_review": review, "edit_review": edits, "invariants": "passed"}))
finally:
    sql(f"""BEGIN;
      DELETE FROM public.admin_audit_log WHERE target_id IN ('{club}','{request}','{event}');
      DELETE FROM public.notifications WHERE user_id IN ({ids});
      DELETE FROM public.events WHERE id='{event}';
      DELETE FROM public.organizer_requests WHERE id='{request}';
      DELETE FROM public.club_members WHERE club_id='{club}';
      DELETE FROM public.clubs WHERE id='{club}';
      DELETE FROM public.users WHERE id IN ({ids});
      DELETE FROM auth.users WHERE id IN ({ids});
      COMMIT;
    """)
