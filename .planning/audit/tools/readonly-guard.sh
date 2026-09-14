#!/usr/bin/env bash
# .planning/audit/tools/readonly-guard.sh
#
# Phase 1 exit criterion: nothing outside .planning/ changed since the audit began.
#
# Contract: exit 0 = clean, exit 1 = violation. No functions, exit-code contract only.
# Source: 01-RESEARCH.md Code Examples 9 (verified against this working tree 2026-09-14).
#
# Deliberate shell-option choices:
#   set -u  : catch unset variables.
#   NO set -e : an early abort would suppress the diagnostic output that makes
#               a violation actionable. Failures are accumulated in $fail instead.
#   NO set -x : this script runs in the same phase as credentialed tasks; tracing
#               would echo any password present in the environment (Pitfall 4).
#
# Usage:
#   bash .planning/audit/tools/readonly-guard.sh      # capture on first run, verify after
#
# The baseline is NOT asserted to be empty. docs/product-master-plan.md is already
# untracked in this repo, so an emptiness assertion fails on a clean checkout
# (Pitfall 2). The guard diffs against a captured baseline instead.

set -u

BASE=.planning/audit/baseline
mkdir -p "$BASE"

if [ ! -f "$BASE/git-status.before.txt" ]; then          # Wave 0 only
  git status --porcelain -- . ':(exclude).planning' > "$BASE/git-status.before.txt"
  shasum -a 256 package-lock.json package.json          > "$BASE/lock.sha256"
  echo "baseline captured"
  exit 0
fi

fail=0

# Check 1 — working tree outside .planning/ is byte-identical to the baseline.
if ! git status --porcelain -- . ':(exclude).planning' | diff -q "$BASE/git-status.before.txt" - >/dev/null; then
  echo "READ-ONLY VIOLATION — files changed outside .planning/:"
  git status --porcelain -- . ':(exclude).planning' | diff "$BASE/git-status.before.txt" -
  fail=1
fi

# Check 2 — npm may silently repair lockfile metadata on read commands (Pitfall 1).
if ! shasum -a 256 -c "$BASE/lock.sha256" --status; then
  echo "LOCKFILE/MANIFEST MUTATED — restore with: git checkout -- package-lock.json package.json"
  fail=1
fi

# Check 3 — no tracked file outside .planning/ has unstaged modifications.
git diff --exit-code --quiet -- . ':(exclude).planning' || { echo "TRACKED FILE MODIFIED"; fail=1; }

exit $fail
