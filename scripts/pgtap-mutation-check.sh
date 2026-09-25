#!/usr/bin/env bash
# =============================================================================
# pgtap-mutation-check.sh — proves the RLS suite can fail
# Phase 03-refactor-foundations-schema-truth-and-the-seam-kit, plan 03-05
#
# WHAT THIS DOES
#   For every policy created by any POLICY-BEARING MIGRATION (the list is in
#   POLICY_MIGRATION_GLOBS below) it comments that policy's CREATE statement out
#   — in EVERY file that creates it — rebuilds the local database, runs the
#   pgTAP suite and REQUIRES A FAILURE; then restores the files from git,
#   rebuilds again and requires a pass. It prints one block per policy and exits
#   with the number of policies whose round-trip did not behave that way.
#
# BY POLICY NAME, ACROSS FILES — AND THAT IS NOT AN OPTIMISATION
#   This script used to walk ONE file. That silently stopped working the moment
#   a fix-forward migration re-created a policy an earlier migration had already
#   created, which is the correct way to change a policy (never edit an applied
#   migration in place). Commenting out the EARLIER file's CREATE leaves the
#   LATER file's CREATE standing, the policy exists anyway, the suite stays
#   GREEN — and the harness reports "this assertion is decorative" about an
#   assertion that is fine. A false red on the control that exists to prevent
#   false greens is the worst failure this script could have.
#
#   So the unit of mutation is the POLICY NAME, not the line. Every occurrence
#   across every listed migration is commented out together, which is what
#   "remove this policy" actually means in a folder that is replayed in order.
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
#     working-tree operation. Only the files matched by POLICY_MIGRATION_GLOBS
#     are touched, and each one is named in the output before it is written.
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

# EVERY migration that creates a policy this suite asserts on. Add a glob here
# when a new one lands — a policy created by a file that is not listed cannot be
# mutated, and the harness would report nothing at all about it rather than
# reporting a problem, which is the quiet kind of gap this whole script exists
# to refuse.
# 05-11 adds the F-008 events INSERT policy (asserted by 060). The baseline also
# creates that policy name but is not listed: the new file DROPs it first, so
# commenting out the new CREATE removes the policy entirely.
# 05-16 adds the F-006 own-row users UPDATE policy, re-created TO authenticated
# with a WITH CHECK (asserted by 050). The same reasoning applies: the baseline
# also creates "Users can update own profile" and is not listed, and the new
# file DROPs it first. That file's grants and REVOKEs are not policies, so this
# harness cannot mutate them; 05-16 proved those by hand
# (evidence/schema-push-slice-5.txt).
POLICY_MIGRATION_GLOBS="supabase/migrations/*_fk_indexes_and_policy_gaps.sql
supabase/migrations/*_invitation_policy_fixes.sql
supabase/migrations/*_events_insert_club_scope.sql
supabase/migrations/*_users_grants_audit_log_insert.sql"

MIGRATIONS=()
while IFS= read -r glob; do
  [ -z "$glob" ] && continue
  matched=0
  for f in $glob; do
    [ -f "$f" ] || continue
    MIGRATIONS+=("$f")
    matched=1
  done
  if [ "$matched" -eq 0 ]; then
    echo "FATAL: no migration matched '$glob'" >&2
    echo "       Either the file was renamed or the glob is stale. Both are" >&2
    echo "       failures: an unmatched glob means a policy nobody is mutating." >&2
    exit 1
  fi
done <<EOF
$POLICY_MIGRATION_GLOBS
EOF

for m in "${MIGRATIONS[@]}"; do
  if [ -n "$(git status --porcelain "$m")" ]; then
    echo "FATAL: $m has uncommitted changes." >&2
    echo "       The restore path is 'git checkout --', so it would discard them." >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Restore on ANY exit (REVIEW-05 WR-06). The loop below restores each mutation
# in its own body, but a Ctrl-C, a closed terminal or a CI timeout during one
# of the ~2N+1 resets would otherwise leave a migration on disk with a
# security policy commented out, and the end-of-run clean check would never
# run. The check above guarantees these files were clean at start, so
# `git checkout --` discards only the harness's own mutation. Installed before
# the first mutation. The local database may still hold the mutated schema
# after an interrupt; the message says to reset it.
# ---------------------------------------------------------------------------
restore_migrations() {
  git checkout -- "${MIGRATIONS[@]}"
}
on_interrupt() {
  restore_migrations
  echo "INTERRUPTED — migrations restored from git. The local database may hold a" >&2
  echo "              mutated schema: run 'supabase db reset --local' before use." >&2
  exit 130
}
trap on_interrupt INT TERM HUP
trap restore_migrations EXIT

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

# `mapfile` is bash 4; macOS ships bash 3.2 and this script must run there, and
# an associative array for the de-duplication would be bash 4 as well — hence
# the newline-delimited string and the fixed-string grep.
POLICIES=()
seen=""
while IFS= read -r policy_name; do
  [ -z "$policy_name" ] && continue
  # De-duplicate: a policy re-created by a later fix-forward migration appears
  # once here and is mutated in every file that creates it.
  if printf '%s' "$seen" | grep -qxF "$policy_name"; then continue; fi
  seen="$seen$policy_name
"
  POLICIES+=("$policy_name")
done < <(grep -hoE '^CREATE POLICY "[^"]+"' "${MIGRATIONS[@]}" \
           | sed -E 's/^CREATE POLICY "//; s/"$//')

if [ "${#POLICIES[@]}" -eq 0 ]; then
  echo "FATAL: no CREATE POLICY statements found in ${MIGRATIONS[*]}" >&2
  exit 1
fi

echo "============================================================================="
echo "pgTAP mutation check"
echo "migrations: ${#MIGRATIONS[@]}"
for m in "${MIGRATIONS[@]}"; do echo "          : $m"; done
echo "policies  : ${#POLICIES[@]} distinct (de-duplicated across the files above)"
echo "started   : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================================="
echo

for policy in "${POLICIES[@]}"; do
  echo "-----------------------------------------------------------------------------"
  echo "POLICY: $policy"
  echo "-----------------------------------------------------------------------------"

  # --- round 1: removed, the suite must go red for the right reason -----------
  #
  # EVERY file that creates this policy is mutated, not just the first. A policy
  # re-created by a fix-forward migration survives the removal of its earlier
  # definition, and a half-applied mutation would report a decorative assertion
  # where there is none.
  mutated_lines=0
  mutated_files=0
  for m in "${MIGRATIONS[@]}"; do
    if grep -qF "CREATE POLICY \"${policy}\"" "$m"; then
      comment_out_policy "$m" "$policy"
      mutated_files=$((mutated_files + 1))
      mutated_lines=$((mutated_lines + $(grep -c '^-- MUTATION: ' "$m")))
    fi
  done
  echo "mutation_applied=true"
  echo "mutation_files=$mutated_files"
  echo "mutation_lines_commented=$mutated_lines"

  if [ "$mutated_files" -eq 0 ]; then
    echo "RESULT: FAIL — the policy name was collected but no file could be mutated."
    fail=$((fail + 1))
  fi

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
  git checkout -- "${MIGRATIONS[@]}"
  restore_dirty=0
  for m in "${MIGRATIONS[@]}"; do
    if [ -n "$(git status --porcelain "$m")" ]; then
      echo "restore_clean=false ($m)"
      restore_dirty=$((restore_dirty + 1))
    fi
  done
  if [ "$restore_dirty" -ne 0 ]; then
    echo "RESULT: FAIL — restore left $restore_dirty migration(s) dirty."
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
