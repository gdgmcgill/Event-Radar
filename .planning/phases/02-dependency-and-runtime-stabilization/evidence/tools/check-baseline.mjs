#!/usr/bin/env node
/**
 * .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs
 *
 * Phase 2 STAB-13 comparator: is this tree at or better than the AUDIT-13 baseline?
 *
 * Zero dependencies by design, and the reason is sharper here than it was for the
 * Phase 1 validator. Phase 2 measures and shrinks the dependency tree; a measuring
 * instrument that enlarges the thing it measures corrupts its own reading. Only the
 * node: namespace is imported, nothing from src/ is imported, and this file is never
 * registered in package.json. Invoke it by path.
 *
 * CLI contract
 *   node check-baseline.mjs                 run every check; exit 0 only if none FAILed
 *   node check-baseline.mjs --check <name>  run exactly one check; absent inputs are a FAIL
 *   node check-baseline.mjs --quick         run only checks whose inputs exist; rest are SKIP
 *   node check-baseline.mjs --list          print the check registry
 *   node check-baseline.mjs --help          print usage
 *
 * Output is one line per rule:
 *   PASS|FAIL|SKIP <check-name> :: <rule> :: <detail>
 * followed by a `--- N passed, N failed, N skipped` summary line.
 *
 * REFERENCE NUMBERS ARE PARSED, NEVER INLINED.
 * Every baseline count is read at run time out of the Phase 1 captures under
 * .planning/audit/baseline/ — jest.txt, lint.txt, versions.txt. No passing-test,
 * skipped-test, suite or warning count appears in this file as a numeric literal.
 * The Phase 1 rule applies unchanged: a missing input is a hard FAIL under --check
 * and a SKIP only under the explicit --quick mode. It is never a silent default,
 * because a comparator that invents its own reference proves nothing.
 *
 * DEPENDENCY SNAPSHOT.
 * The `no-unplanned-majors`, `react-untouched` and `lockfile-discipline` checks
 * compare against evidence/tools/majors.b0.json, written by this tool on its first
 * run and committed. That file records the batch-0 dependency majors, the react /
 * react-dom ranges, the lockfileVersion, and the commit the snapshot was taken at.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/* ------------------------------------------------------------------ paths -- */

const TOOL_DIR = import.meta.dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..', '..', '..', '..');

const SNAPSHOT_FILE = path.join(TOOL_DIR, 'majors.b0.json');

const BASELINE_JEST = 'baseline/jest.txt';
const BASELINE_LINT = 'baseline/lint.txt';
const PACKAGE_JSON = 'package.json';
const PACKAGE_LOCK = 'package-lock.json';
const NVMRC = '.nvmrc';
const CI_WORKFLOW = '.github/workflows/ci.yml';

const AUDIT_BASE = (rel) => path.join(REPO_ROOT, '.planning', 'audit', rel);
const R = (rel) => path.join(REPO_ROOT, rel);

const exists = (abs) => fs.existsSync(abs);
const readText = (abs) => fs.readFileSync(abs, 'utf8');
const readJson = (abs) => JSON.parse(readText(abs));

/** Anything the registry lists as an input is resolved through this. */
function resolveInput(rel) {
  return rel.startsWith('baseline/') ? AUDIT_BASE(rel) : R(rel);
}

/* --------------------------------------------------------------- scrubbing -- */

/**
 * Never print a caught error verbatim. This tool shells out to npx and npm, and a
 * child process stack can carry an environment fragment — a connection string, a
 * bearer token, a Supabase auth cookie. .planning/ is committed. Same pattern set
 * as .planning/audit/tools/validate.mjs.
 */
const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '<REDACTED-JWT>'],
  [/sb_secret_[A-Za-z0-9_-]+/g, '<REDACTED-SECRET-KEY>'],
  [/postgres(ql)?:\/\/[^\s]*:[^@\s]*@/gi, 'postgres://<REDACTED>@'],
  [/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1<REDACTED-TOKEN>'],
  [/(sb-[a-z0-9]+-auth-token=)[^;\s]+/gi, '$1<REDACTED-COOKIE>'],
];

function scrub(input) {
  let text = typeof input === 'string' ? input : String(input);
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

/* --------------------------------------------------------------- reporting -- */

const results = [];

function emit(status, check, rule, detail) {
  results.push({ status, check, rule });
  console.log(`${status} ${check} :: ${rule} :: ${scrub(detail)}`);
}

function makeCtx(check) {
  return {
    assert(condition, rule, detail) {
      emit(condition ? 'PASS' : 'FAIL', check, rule, detail);
      return Boolean(condition);
    },
    fail(rule, detail) {
      emit('FAIL', check, rule, detail);
      return false;
    },
    note(rule, detail) {
      emit('SKIP', check, rule, detail);
    },
  };
}

/* ----------------------------------------------------------- child process -- */

const CHILD_MAX_BUFFER = 64 * 1024 * 1024;

function run(command, args) {
  const child = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: CHILD_MAX_BUFFER,
    env: process.env,
  });
  if (child.error) throw child.error;
  return {
    code: child.status,
    stdout: child.stdout ?? '',
    stderr: child.stderr ?? '',
  };
}

/* ------------------------------------------------ baseline capture parsing -- */

/**
 * Pull the two Jest summary lines out of the AUDIT-13 capture. Throwing here is
 * correct: the caller turns it into a FAIL line, and a comparator that guessed a
 * reference number would be worse than one that refuses to run.
 */
function parseJestBaseline() {
  const file = AUDIT_BASE(BASELINE_JEST);
  if (!exists(file)) throw new Error(`missing baseline capture: ${BASELINE_JEST}`);
  const text = readText(file);

  const suitesLine = (text.match(/^Test Suites:.*$/m) || [])[0];
  const testsLine = (text.match(/^Tests:.*$/m) || [])[0];
  if (!suitesLine) throw new Error(`${BASELINE_JEST} has no "Test Suites:" summary line`);
  if (!testsLine) throw new Error(`${BASELINE_JEST} has no "Tests:" summary line`);

  const num = (line, pattern, label) => {
    const hit = line.match(pattern);
    if (!hit) throw new Error(`${BASELINE_JEST} summary does not expose ${label}: "${line.trim()}"`);
    return Number.parseInt(hit[1], 10);
  };

  const executing = suitesLine.match(/(\d+) of (\d+) total/);
  if (!executing) throw new Error(`${BASELINE_JEST} suite line has no "N of M total": "${suitesLine.trim()}"`);

  return {
    suitesSkipped: num(suitesLine, /(\d+) skipped/, 'skipped suites'),
    suitesExecuting: Number.parseInt(executing[1], 10),
    suitesTotal: Number.parseInt(executing[2], 10),
    testsSkipped: num(testsLine, /(\d+) skipped/, 'skipped tests'),
    testsPassed: num(testsLine, /(\d+) passed/, 'passing tests'),
    testsTotal: num(testsLine, /(\d+) total/, 'total tests'),
  };
}

/** Reference line in baseline/lint.txt reads: `✖ N problems (E errors, W warnings)`. */
function parseLintBaseline() {
  const file = AUDIT_BASE(BASELINE_LINT);
  if (!exists(file)) throw new Error(`missing baseline capture: ${BASELINE_LINT}`);
  const hit = readText(file).match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
  if (!hit) throw new Error(`${BASELINE_LINT} has no eslint problem-summary line`);
  return {
    errors: Number.parseInt(hit[2], 10),
    warnings: Number.parseInt(hit[3], 10),
  };
}

/** Same shape, read out of a live `npm run lint`. Absent line means a clean run. */
function parseLintOutput(text) {
  const hit = text.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
  if (!hit) return { errors: 0, warnings: 0, summaryFound: false };
  return {
    errors: Number.parseInt(hit[2], 10),
    warnings: Number.parseInt(hit[3], 10),
    summaryFound: true,
  };
}

/* ---------------------------------------------------- dependency snapshot -- */

/** "^18.3.0" / "~4.5.1" / "24.x" / "0.7.0" -> the leading major as a string. */
function majorOf(range) {
  const hit = String(range).match(/(\d+)/);
  return hit ? hit[1] : null;
}

function buildSnapshot(pkg, lock, commit) {
  const majors = {};
  for (const group of ['dependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(pkg[group] || {})) {
      majors[name] = { group, range, major: majorOf(range) };
    }
  }
  return {
    note:
      'Batch-0 dependency snapshot for check-baseline.mjs. Written once on the ' +
      'first run and committed. no-unplanned-majors, react-untouched and ' +
      'lockfile-discipline compare the working tree against this.',
    b0_commit: commit,
    written_at: new Date().toISOString(),
    lockfileVersion: lock.lockfileVersion,
    react: pkg.dependencies?.react ?? null,
    'react-dom': pkg.dependencies?.['react-dom'] ?? null,
    majors,
  };
}

function loadOrCreateSnapshot(ctx, pkg, lock) {
  if (exists(SNAPSHOT_FILE)) return readJson(SNAPSHOT_FILE);
  const head = run('git', ['rev-parse', 'HEAD']);
  const commit = head.code === 0 ? head.stdout.trim() : 'unknown';
  const snapshot = buildSnapshot(pkg, lock, commit);
  fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  ctx.note('snapshot-seeded', `wrote majors.b0.json at ${commit.slice(0, 7)} — commit it`);
  return snapshot;
}

/**
 * The one dependency whose major is allowed to move in Phase 2: @types/node was
 * forced from the Node runtime pin in plan 02-01 and is recorded as the phase's
 * only planned major bump.
 */
const PLANNED_MAJOR_BUMPS = new Set(['@types/node']);

/**
 * Built from fragments on purpose. This tool detects a reference to the forced
 * audit-remediation command in commit messages; spelling it out as one literal
 * would make the detector its own first false positive.
 */
const FORCED_REMEDIATION = new RegExp(['npm', 'audit', 'fix'].join('\\s+'), 'i');

/* -------------------------------------------------------------- registry -- */

const CHECK_NAMES = [
  'jest',
  'tsc',
  'lint',
  'node-pin',
  'no-unplanned-majors',
  'react-untouched',
  'lockfile-discipline',
];

const CHECKS = {
  /* ---------------------------------------------------------------- STAB-13 */
  jest: {
    requirement: 'STAB-13',
    inputs: [BASELINE_JEST],
    run(ctx) {
      const base = parseJestBaseline();
      const out = run('npx', ['jest', '--ci', '--json']);
      const start = out.stdout.indexOf('{');
      const end = out.stdout.lastIndexOf('}');
      if (start === -1 || end <= start) {
        ctx.fail('jest-json-parsed', `no JSON object on stdout (exit ${out.code})`);
        return;
      }
      let report;
      try {
        report = JSON.parse(out.stdout.slice(start, end + 1));
      } catch (err) {
        ctx.fail('jest-json-parsed', scrub(err.message));
        return;
      }
      ctx.assert(true, 'jest-json-parsed', `exit ${out.code}`);

      const executing = report.numTotalTestSuites - report.numPendingTestSuites;
      ctx.assert(
        report.numFailedTests === 0,
        'no-failing-tests',
        `${report.numFailedTests} failing`
      );
      ctx.assert(
        report.numPassedTests >= base.testsPassed,
        'passing-count-not-below-baseline',
        `${report.numPassedTests} passing vs baseline ${base.testsPassed}`
      );
      ctx.assert(
        report.numPendingTests <= base.testsSkipped,
        'skipped-count-not-above-baseline',
        `${report.numPendingTests} skipped vs baseline ${base.testsSkipped}`
      );
      ctx.assert(
        executing >= base.suitesExecuting,
        'executing-suites-not-below-baseline',
        `${executing} of ${report.numTotalTestSuites} executing vs baseline ` +
          `${base.suitesExecuting} of ${base.suitesTotal}`
      );
    },
  },

  /* ---------------------------------------------------------------- STAB-13 */
  tsc: {
    requirement: 'STAB-13',
    inputs: ['tsconfig.json'],
    run(ctx) {
      const out = run('npx', ['tsc', '--noEmit']);
      ctx.assert(out.code === 0, 'tsc-exit-zero', `exit ${out.code}`);
      ctx.assert(
        out.stdout.trim() === '' && out.stderr.trim() === '',
        'tsc-emits-no-diagnostics',
        out.stdout.trim() === '' && out.stderr.trim() === ''
          ? 'zero bytes on stdout and stderr'
          : scrub(`${out.stdout}${out.stderr}`).split('\n').slice(0, 5).join(' | ')
      );
    },
  },

  /* ---------------------------------------------------------------- STAB-13 */
  lint: {
    requirement: 'STAB-13',
    inputs: [BASELINE_LINT],
    run(ctx) {
      const base = parseLintBaseline();
      const out = run('npm', ['run', 'lint']);
      const live = parseLintOutput(`${out.stdout}${out.stderr}`);
      ctx.assert(out.code === 0, 'lint-exit-zero', `exit ${out.code}`);
      ctx.assert(live.errors === 0, 'zero-eslint-errors', `${live.errors} errors`);
      ctx.assert(
        live.warnings <= base.warnings,
        'warnings-not-above-baseline',
        `${live.warnings} warnings vs baseline ${base.warnings}`
      );
    },
  },

  /* ---------------------------------------------------------------- STAB-01 */
  'node-pin': {
    requirement: 'STAB-01',
    inputs: [PACKAGE_JSON, NVMRC, CI_WORKFLOW],
    run(ctx) {
      const pkg = readJson(R(PACKAGE_JSON));
      const enginesRange = pkg.engines?.node;
      const enginesMajor = enginesRange ? majorOf(enginesRange) : null;
      const nvmrcRaw = readText(R(NVMRC)).trim();
      const nvmrcMajor = majorOf(nvmrcRaw);
      const ci = readText(R(CI_WORKFLOW));

      ctx.assert(Boolean(enginesMajor), 'engines-node-declared', `engines.node = ${enginesRange}`);
      ctx.assert(Boolean(nvmrcMajor), 'nvmrc-declared', `.nvmrc = ${nvmrcRaw}`);

      const fileInput = ci.match(/node-version-file:\s*['"]?([^'"\s]+)['"]?/);
      const literalInput = ci.match(/node-version:\s*['"]?([^'"\s]+)['"]?/);

      ctx.assert(
        Boolean(fileInput),
        'ci-reads-a-version-file',
        fileInput ? `node-version-file: ${fileInput[1]}` : 'ci.yml declares no node-version-file'
      );
      ctx.assert(
        !literalInput,
        'ci-declares-no-competing-literal',
        literalInput ? `node-version: ${literalInput[1]} would override the file` : 'none'
      );

      let ciMajor = null;
      if (fileInput) {
        const referenced = R(fileInput[1]);
        ciMajor = exists(referenced) ? majorOf(readText(referenced).trim()) : null;
        ctx.assert(
          ciMajor !== null,
          'ci-version-file-resolves',
          ciMajor !== null ? `${fileInput[1]} -> ${ciMajor}` : `${fileInput[1]} is unreadable`
        );
      } else if (literalInput) {
        ciMajor = majorOf(literalInput[1]);
      }

      const agreed = new Set([enginesMajor, nvmrcMajor, ciMajor].filter(Boolean));
      ctx.assert(
        agreed.size === 1 && enginesMajor === nvmrcMajor && nvmrcMajor === ciMajor,
        'one-declared-node-major',
        `engines=${enginesMajor} nvmrc=${nvmrcMajor} ci=${ciMajor}`
      );
    },
  },

  /* ---------------------------------------------------------------- STAB-10 */
  'no-unplanned-majors': {
    requirement: 'STAB-10',
    inputs: [PACKAGE_JSON, PACKAGE_LOCK],
    run(ctx) {
      const pkg = readJson(R(PACKAGE_JSON));
      const lock = readJson(R(PACKAGE_LOCK));
      const snapshot = loadOrCreateSnapshot(ctx, pkg, lock);

      const drifted = [];
      for (const group of ['dependencies', 'devDependencies']) {
        for (const [name, range] of Object.entries(pkg[group] || {})) {
          const before = snapshot.majors[name];
          if (!before) continue; // an addition is a STAB-14 concern, not a major bump
          if (before.major !== majorOf(range)) {
            drifted.push(`${name} ${before.range} -> ${range}`);
          }
        }
      }
      const unplanned = drifted.filter((row) => !PLANNED_MAJOR_BUMPS.has(row.split(' ')[0]));

      ctx.assert(
        unplanned.length === 0,
        'no-unplanned-major-changes',
        unplanned.length === 0
          ? `${Object.keys(snapshot.majors).length} declared ranges compared, ${drifted.length} planned major(s) moved`
          : unplanned.join(' | ')
      );
    },
  },

  /* ---------------------------------------------------------------- STAB-05 */
  'react-untouched': {
    requirement: 'STAB-05',
    inputs: [PACKAGE_JSON, PACKAGE_LOCK],
    run(ctx) {
      const pkg = readJson(R(PACKAGE_JSON));
      const lock = readJson(R(PACKAGE_LOCK));
      const snapshot = loadOrCreateSnapshot(ctx, pkg, lock);

      for (const name of ['react', 'react-dom']) {
        const now = pkg.dependencies?.[name] ?? null;
        const then = snapshot[name] ?? null;
        ctx.assert(
          now !== null && now === then,
          `${name}-range-byte-identical`,
          `${then} -> ${now}`
        );
      }
    },
  },

  /* ---------------------------------------------------------------- STAB-11 */
  'lockfile-discipline': {
    requirement: 'STAB-11',
    inputs: [PACKAGE_JSON, PACKAGE_LOCK],
    run(ctx) {
      const pkg = readJson(R(PACKAGE_JSON));
      const lock = readJson(R(PACKAGE_LOCK));
      const snapshot = loadOrCreateSnapshot(ctx, pkg, lock);

      ctx.assert(
        lock.lockfileVersion === snapshot.lockfileVersion,
        'lockfile-version-unchanged',
        `${snapshot.lockfileVersion} -> ${lock.lockfileVersion}`
      );

      const range = snapshot.b0_commit && snapshot.b0_commit !== 'unknown'
        ? `${snapshot.b0_commit}..HEAD`
        : 'HEAD';
      const log = run('git', ['log', '--format=%s%n%b', range]);
      if (log.code !== 0) {
        ctx.fail('phase-commit-range-readable', `git log ${range} exited ${log.code}`);
        return;
      }
      const offending = log.stdout
        .split('\n')
        .filter((line) => FORCED_REMEDIATION.test(line) && !/never|forbidden|not run|detect/i.test(line));
      ctx.assert(
        offending.length === 0,
        'no-forced-remediation-in-commit-range',
        offending.length === 0
          ? `${range} clean`
          : offending.slice(0, 3).join(' | ')
      );
    },
  },
};

/* ------------------------------------------------------------------ runner -- */

function runCheck(name, quick) {
  const check = CHECKS[name];
  const ctx = makeCtx(name);
  const missing = (check.inputs || []).filter((rel) => !exists(resolveInput(rel)));

  if (missing.length > 0) {
    if (quick) {
      ctx.note('inputs-absent', missing.join(' '));
    } else {
      ctx.fail('inputs-absent', `${missing.join(' ')} — an absent input is a FAIL, never a default`);
    }
    return;
  }

  try {
    check.run(ctx);
  } catch (err) {
    ctx.fail('check-threw', scrub(err && err.stack ? err.stack : err));
  }
}

/* --------------------------------------------------------------------- cli -- */

function usage() {
  const rel = '.planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs';
  console.log(`usage: node ${rel} [--check <name> | --quick | --list | --help]`);
  console.log(`checks: ${CHECK_NAMES.join(', ')}`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }

  if (args.includes('--list')) {
    for (const name of CHECK_NAMES) {
      console.log(`${name}\t${CHECKS[name].requirement}\t${CHECKS[name].inputs.join(' ')}`);
    }
    return 0;
  }

  const checkIndex = args.indexOf('--check');
  if (checkIndex !== -1) {
    const name = args[checkIndex + 1];
    if (!name || !CHECKS[name]) {
      console.error(`FAIL cli :: unknown-check :: ${name === undefined ? '(none given)' : name}`);
      usage();
      return 1;
    }
    runCheck(name, false);
  } else {
    const quick = args.includes('--quick');
    for (const name of CHECK_NAMES) runCheck(name, quick);
  }

  const failed = results.filter((r) => r.status === 'FAIL').length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  console.log(`--- ${passed} passed, ${failed} failed, ${skipped} skipped`);
  return failed === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`FAIL comparator :: terminal-error :: ${scrub(err && err.stack ? err.stack : err)}`);
  process.exit(1);
}
