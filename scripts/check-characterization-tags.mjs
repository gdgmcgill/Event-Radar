#!/usr/bin/env node
/**
 * check-characterization-tags.mjs
 *
 * PURPOSE
 *   Make the PRESERVE/DEFECT tagging discipline mechanical rather than
 *   aspirational. A characterization suite states in its leading docblock
 *   whether it pins behaviour that must survive a refactor (PRESERVE) or
 *   behaviour that is known to be wrong and is expected to change when its
 *   fixing commit lands (DEFECT). A DEFECT suite names the finding it pins by
 *   id, and that id must exist in the register.
 *
 *   For each suite it reads ONLY the leading `/** … *\/` docblock and FAILS
 *   when:
 *     1. the docblock contains neither the word PRESERVE nor the word DEFECT
 *        (or there is no leading docblock at all) — an untagged suite;
 *     2. the docblock contains DEFECT but cites no F-nnn id (three digits) —
 *        a "known defect" nobody can trace;
 *     3. the docblock cites an F-nnn id (under either tag) that is not an `id`
 *        in .planning/audit/findings.json — a citation to nothing.
 *
 *   Words are matched case-sensitively and whole: the tags are written in
 *   capitals by convention, so prose such as "a defect in the fixture" is not
 *   a tag. A PRESERVE suite may cite ids too (the auth callback suite cites
 *   F-004 and F-040, the findings whose fixes it must survive); those are
 *   checked against the register exactly as a DEFECT's are.
 *
 * REQUIREMENT
 *   REFAC-09 / REFAC-10, via ROADMAP Phase 4 success criterion 1:
 *   characterization tests "tagged PRESERVE or DEFECT (referencing their
 *   F-nnn)". Threat T-04-01-02 in plan 04-01.
 *
 * INVOCATION
 *   node scripts/check-characterization-tags.mjs --all
 *   node scripts/check-characterization-tags.mjs <file> [<file> …]
 *
 *   --all discovers every src/**\/*.test.ts and src/**\/*.test.tsx that is a
 *   characterization suite by NAME (the file name ends in
 *   `-characterization.test.ts(x)` or `-defect.test.ts(x)`) or by CONTENT
 *   (its leading docblock contains the word "characterization", any case).
 *   A file discovered by name with no tag fails — naming a file a
 *   characterization suite is itself the claim that it is one.
 *
 *   Explicit paths are checked whether or not discovery would have found
 *   them, and may lie outside the repository (that is how the red fixture is
 *   proved). A path that does not exist fails.
 *
 *   Output: one line per file, then `ok <n> files` and exit 0, or each
 *   failure and `FAIL <k> of <n> files` and exit 1. `--all` that discovers
 *   zero suites exits 1: a gate that matches nothing must not report green
 *   (the reasoning behind Phase 2's `npm test` without --passWithNoTests).
 *   Bad usage exits 2.
 *
 *   Invoked BY PATH. Plan 04-01 creates it; plan 04-03 wires it into CI.
 *
 * DEPENDENCIES
 *   None. Node built-ins only — no package, nothing added to the lockfile.
 *   findings.json is read and parsed, never written.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const SRC_DIR = join(REPO_ROOT, "src");
const FINDINGS = join(REPO_ROOT, ".planning", "audit", "findings.json");

const TEST_FILE = /\.test\.tsx?$/;
const NAMED_SUITE = /-(characterization|defect)\.test\.tsx?$/;
const FINDING_ID = /\bF-(\d{3})\b/g;
const PRESERVE = /\bPRESERVE\b/;
const DEFECT = /\bDEFECT\b/;
const MENTIONS_CHARACTERIZATION = /characteri[sz]ation/i;

/**
 * The leading docblock: after optional whitespace, the file must open with
 * `/**`. Anything later in the file — a docblock above a describe(), a comment
 * after the imports — is not the suite's header and is not read, so a tag
 * cannot be satisfied by a word buried in a test body.
 */
function leadingDocblock(source) {
  const text = source.replace(/^﻿/, "").trimStart();
  if (!text.startsWith("/**")) return null;
  const end = text.indexOf("*/");
  return end === -1 ? null : text.slice(0, end + 2);
}

function registeredIds() {
  let rows;
  try {
    rows = JSON.parse(readFileSync(FINDINGS, "utf8"));
  } catch (error) {
    console.error(`FAIL cannot read the finding register ${relative(REPO_ROOT, FINDINGS)}: ${error.message}`);
    process.exit(1);
  }
  if (!Array.isArray(rows)) {
    console.error(`FAIL ${relative(REPO_ROOT, FINDINGS)} is not an array of findings`);
    process.exit(1);
  }
  return new Set(rows.map((row) => row && row.id).filter(Boolean));
}

function discover() {
  const found = [];
  for (const entry of readdirSync(SRC_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !TEST_FILE.test(entry.name)) continue;
    const file = join(entry.parentPath ?? entry.path, entry.name);
    if (file.split(sep).includes("node_modules")) continue;
    if (NAMED_SUITE.test(entry.name)) {
      found.push(file);
      continue;
    }
    const block = leadingDocblock(readFileSync(file, "utf8"));
    if (block && MENTIONS_CHARACTERIZATION.test(block)) found.push(file);
  }
  return found.sort();
}

function display(file) {
  const rel = relative(REPO_ROOT, file);
  return rel.startsWith("..") ? file : rel.split(sep).join("/");
}

/** Returns { ok, tag, ids, reason }. */
function check(file, ids) {
  if (!existsSync(file)) return { ok: false, reason: "file does not exist" };
  const block = leadingDocblock(readFileSync(file, "utf8"));
  if (!block) return { ok: false, reason: "no leading /** … */ docblock, so no PRESERVE or DEFECT tag" };

  const isPreserve = PRESERVE.test(block);
  const isDefect = DEFECT.test(block);
  if (!isPreserve && !isDefect) {
    return { ok: false, reason: "leading docblock contains neither PRESERVE nor DEFECT — untagged suite" };
  }
  const tag = isDefect && isPreserve ? "PRESERVE+DEFECT" : isDefect ? "DEFECT" : "PRESERVE";

  const cited = [...new Set([...block.matchAll(FINDING_ID)].map((m) => `F-${m[1]}`))];
  if (isDefect && cited.length === 0) {
    return { ok: false, tag, reason: "DEFECT suite cites no F-nnn finding id" };
  }
  const unknown = cited.filter((id) => !ids.has(id));
  if (unknown.length > 0) {
    return {
      ok: false,
      tag,
      ids: cited,
      reason: `cites ${unknown.join(", ")}, not an id in .planning/audit/findings.json`,
    };
  }
  return { ok: true, tag, ids: cited };
}

function main(argv) {
  const all = argv.includes("--all");
  const paths = argv.filter((arg) => arg !== "--all");
  if ((!all && paths.length === 0) || paths.some((p) => p.startsWith("--"))) {
    console.error("usage: node scripts/check-characterization-tags.mjs --all | <file> [<file> …]");
    return 2;
  }

  const ids = registeredIds();
  const files = [...(all ? discover() : []), ...paths.map((p) => resolve(p))];
  const unique = [...new Set(files)];

  if (unique.length === 0) {
    console.error("FAIL --all discovered no characterization suites under src/ — discovery is broken or the suites were removed");
    return 1;
  }

  let failures = 0;
  for (const file of unique) {
    const result = check(file, ids);
    const cites = result.ids && result.ids.length ? ` (${result.ids.join(", ")})` : "";
    if (result.ok) {
      console.log(`ok   ${result.tag.padEnd(8)} ${display(file)}${cites}`);
    } else {
      failures += 1;
      console.log(`FAIL ${(result.tag ?? "-").padEnd(8)} ${display(file)}: ${result.reason}`);
    }
  }

  if (failures > 0) {
    console.log(`FAIL ${failures} of ${unique.length} files`);
    return 1;
  }
  console.log(`ok ${unique.length} files`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
