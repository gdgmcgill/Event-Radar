#!/usr/bin/env bash
# =============================================================================
# pgtap-mutation-check.sh — proves the RLS suite can fail
# Phase 03-refactor-foundations-schema-truth-and-the-seam-kit, plan 03-05
#
# WHAT THIS DOES
#   For every policy created by supabase/migrations/*_fk_indexes_and_policy_gaps.sql
#   it comments that policy's CREATE statement out, rebuilds the local database,
#   runs the pgTAP suite and REQUIRES A FAILURE; then restores the file from git,
#   rebuilds again and requires a pass. It prints one block per policy and exits
#   with the number of policies whose round-trip did not behave that way.
#
#   It exists because 02-REVIEW.md finding WR-04 caught a Phase 2 suite whose
#   assertions could not fail when the behaviour they preserved was removed. The
#   pgTAP equivalent is worse: RLS denial has two shapes — a raised error and a
#   silent zero-row filter — and the obvious assertion only notices one of them,
#   so a suite can be green against a policy that does nothing. The only way to
#   know an assertion bites is to remove what it checks and watch it bite.
#
#   03-RESEARCH.md classified this as a manual step where a human observes the
#   red. A script is strictly stronger: it turns a one-time observation into a
#   rerunnable control, and it checks the SHAPE of the red, which an eye does
#   not reliably do.
#
# METHOD CONTRACT — this is not smoke.sh's contract; do not read it as one
#   * LOCAL ONLY. Every command targets the local stack with --local explicit.
#     The project is linked, and --linked on `db reset` resets PRODUCTION. No
#     production credential is read. The only Supabase subcommands this script
#     invokes are `db reset` and `test db`, both with --local — the subcommands
#     that push local migrations to the linked project or repair its remote
#     history are not among them, and are deliberately not named here so that a
#     grep for them over this repository cannot match its own disclaimer.
#   * DESTRUCTIVE TO LOCAL DATA BY DESIGN. It runs `supabase db reset --local`
#     up to 2N+1 times. Anything in the local database is gone. That is the
#     point: each round must observe a database built from the mutated folder
#     and nothing else.
#   * RESTORES FROM GIT, NEVER BY RE-EDITING. `git checkout --` is the restore
#     path. A hand-restoration across several rounds is how a stray character
#     survives into a committed migration, and an explicit clean check at the
#     end refuses to exit 0 with a mutation still on disk.
#   * NEVER `git clean`, `git stash`, `git reset --hard`, or any other blanket
#     working-tree operation. Exactly one file is touched and it is named.
#   * ACCUMULATES, DOES NOT ABORT. A first failing policy must not hide the
#     second. Failures are counted in $fail and the exit code is that count —
#     the convention scripts/smoke.sh established.
#   * TWO FAILURE MODES ARE CHECKED EXPLICITLY, not one:
#       1. a policy whose removal leaves the suite GREEN. That test is
#          decorative and must be strengthened before the plan closes.
#       2. a policy whose removal makes the suite fail to PARSE or to RUN
#          rather than fail to ASSERT. A red that is a syntax error or a broken
#          fixture proves nothing about the assertion, so the run is required to
#          have produced real test results with a real failure count.
#
# DELIBERATE SHELL OPTIONS
#   set -u    : catch unset variables.
#   NO set -e : an early abort would skip the restore and leave a mutated
#               migration on disk. Every step checks its own status instead.
#   NO trace  : the `-x` option is absent by contract, as in scripts/smoke.sh.
#
# CLI contract
#   bash scripts/pgtap-mutation-check.sh
#
# Exit codes: 0 every policy went red when removed and green when restored
#             N the number of policies that did not, or a restore left the tree
#               dirty (reported as an extra failure)
# =============================================================================

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# The Supabase CLI is not a project dependency; `npx supabase` is how every
# other capture in this phase invoked it, so the harness measures the same
# binary the evidence files were produced with. Overridable for CI images that
# carry the CLI on PATH.
SUPABASE_CMD=${SUPABASE_CMD:-"npx supabase"}

MIGRATION="$(ls supabase/migrations/*_fk_indexes_and_policy_gaps.sql 2>/dev/null | head -1)"
if [ -z "$MIGRATION" ]; then
  echo "FATAL: no *_fk_indexes_and_policy_gaps.sql migration found" >&2
  exit 1
fi

if [ -n "$(git status --porcelain "$MIGRATION")" ]; then
  echo "FATAL: $MIGRATION has uncommitted changes." >&2
  echo "       The restore path is 'git checkout --', so it would discard them." >&2
  exit 1
fi

fail=0

# ---------------------------------------------------------------------------
# reset_and_test — rebuild the local database from the folder and run the suite.
# Echoes the captured transcript; returns the pgTAP exit status.
# ---------------------------------------------------------------------------
reset_and_test() {
  local out status
  out="$($SUPABASE_CMD db reset --local 2>&1)"
  status=$?
  if [ "$status" -ne 0 ]; then
    printf '%s\n' "$out"
    echo "__RESET_FAILED__"
    return 99
  fi
  out="$($SUPABASE_CMD test db --local 2>&1)"
  status=$?
  printf '%s\n' "$out"
  return $status
}

# ---------------------------------------------------------------------------
# is_assertion_failure — was the red an ASSERTION failing, or the suite failing
# to run at all? pg_prove's summary reports "Tests: N Failed: M". A parse error,
# a broken fixture or a SQL syntax error yields "Tests: 0" and a "Parse errors:"
# line instead, and proves nothing about the assertion under examination.
# ---------------------------------------------------------------------------
is_assertion_failure() {
  local transcript="$1"
  if printf '%s' "$transcript" | grep -q '__RESET_FAILED__'; then return 1; fi
  if printf '%s' "$transcript" | grep -q 'Parse errors:'; then return 1; fi
  printf '%s' "$transcript" \
    | grep -qE 'Tests:[[:space:]]+[1-9][0-9]*[[:space:]]+Failed:[[:space:]]+[1-9][0-9]*'
}

# ---------------------------------------------------------------------------
# comment_out_policy — rewrite the migration with one CREATE POLICY statement
# commented out, from its opening line through the line that terminates it.
# ---------------------------------------------------------------------------
comment_out_policy() {
  local file="$1" name="$2" tmp
  tmp="$(mktemp)"
  awk -v target="CREATE POLICY \"${name}\"" '
    BEGIN { inside = 0 }
    {
      if (inside == 0 && index($0, target) == 1) { inside = 1 }
      if (inside == 1) {
        print "-- MUTATION: " $0
        line = $0
        sub(/[[:space:]]+$/, "", line)
        if (line ~ /;$/) { inside = 0 }
        next
      }
      print
    }
  ' "$file" > "$tmp" && mv "$tmp" "$file"
}

# `mapfile` is bash 4; macOS ships bash 3.2 and this script must run there.
POLICIES=()
while IFS= read -r policy_name; do
  POLICIES+=("$policy_name")
done < <(grep -oE '^CREATE POLICY "[^"]+"' "$MIGRATION" \
           | sed -E 's/^CREATE POLICY "//; s/"$//')

if [ "${#POLICIES[@]}" -eq 0 ]; then
  echo "FATAL: no CREATE POLICY statements found in $MIGRATION" >&2
  exit 1
fi

echo "============================================================================="
echo "pgTAP mutation check"
echo "migration : $MIGRATION"
echo "policies  : ${#POLICIES[@]}"
echo "started   : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================================="
echo

for policy in "${POLICIES[@]}"; do
  echo "-----------------------------------------------------------------------------"
  echo "POLICY: $policy"
  echo "-----------------------------------------------------------------------------"

  # --- round 1: removed, the suite must go red for the right reason -----------
  comment_out_policy "$MIGRATION" "$policy"
  mutated_lines="$(grep -c '^-- MUTATION: ' "$MIGRATION")"
  echo "mutation_applied=true"
  echo "mutation_lines_commented=$mutated_lines"

  red_out="$(reset_and_test)"
  red_status=$?
  echo "removed_exit_code=$red_status"

  if [ "$red_status" -eq 0 ]; then
    echo "removed_verdict=GREEN"
    echo "RESULT: FAIL — the suite passed with this policy removed."
    echo "        That assertion is decorative; strengthen it before closing the plan."
    fail=$((fail + 1))
  elif is_assertion_failure "$red_out"; then
    echo "removed_verdict=RED_ASSERTION"
    echo "removed_summary=$(printf '%s' "$red_out" | grep -E 'Tests:[[:space:]]+[0-9]+[[:space:]]+Failed:' | head -1 | tr -s ' ')"
    printf '%s\n' "$red_out" | grep -E '^#[[:space:]]+(Failed test|have|want|Looks like)' | head -12
  else
    echo "removed_verdict=RED_NOT_AN_ASSERTION"
    echo "RESULT: FAIL — the suite failed, but not by asserting."
    echo "        A parse error, a failed reset or a broken fixture proves nothing"
    echo "        about the policy under examination."
    printf '%s\n' "$red_out" | tail -12
    fail=$((fail + 1))
  fi

  # --- restore from git, never by re-editing ----------------------------------
  git checkout -- "$MIGRATION"
  if [ -n "$(git status --porcelain "$MIGRATION")" ]; then
    echo "restore_clean=false"
    echo "RESULT: FAIL — restore left the migration dirty."
    fail=$((fail + 1))
  else
    echo "restore_clean=true"
  fi

  # --- round 2: restored, the suite must go green -----------------------------
  green_out="$(reset_and_test)"
  green_status=$?
  echo "restored_exit_code=$green_status"
  if [ "$green_status" -eq 0 ]; then
    echo "restored_verdict=GREEN"
    printf '%s\n' "$green_out" | grep -E '^(Result:|Files=)' | tr -s ' '
  else
    echo "restored_verdict=RED"
    echo "RESULT: FAIL — the suite did not recover after the policy was restored."
    printf '%s\n' "$green_out" | tail -12
    fail=$((fail + 1))
  fi
  echo
done

echo "============================================================================="
if [ -n "$(git status --porcelain supabase/migrations/)" ]; then
  echo "migrations_dir_clean=false"
  echo "FAIL — supabase/migrations/ is dirty after the harness ran."
  fail=$((fail + 1))
else
  echo "migrations_dir_clean=true"
fi
echo "policies_checked=${#POLICIES[@]}"
echo "failures=$fail"
echo "finished=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================================="

exit "$fail"
