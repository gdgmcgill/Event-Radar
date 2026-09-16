/**
 * guard.test.ts — the seed loader's target guard, asserted by its refusals.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * WHY THIS SUITE IS THE REQUIREMENT AND NOT AN EXTRA
 *   REFAC-07 ends "...loadable into local and staging only with a hard guard
 *   refusing any other Supabase URL". A guard nobody ever watched refuse is a
 *   comment. Four of the five cases below are refusals; the fifth is the single
 *   target the loader is allowed to write to.
 *
 * NO REAL `.env.local` IS EVER OPENED BY THIS SUITE. The guard reads that file
 *   at run time to learn the production project ref — a deny key, never a
 *   credential. Here every case hands it a throwaway fixture file in a temp
 *   directory, so the suite is deterministic, runs in CI where no `.env.local`
 *   exists, and never touches the developer's real one.
 *
 * FAIL-CLOSED IS A CASE, NOT A FOOTNOTE (research § Assumptions Log A10). If
 *   the deny key cannot be extracted — a custom domain in the env file, or no
 *   env file at all — the guard must REFUSE a non-local target rather than
 *   proceed with a dead deny rule. Case 5 sets *every* staging acknowledgement
 *   and still expects a throw, so it cannot pass for the wrong reason.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertSeedTargetAllowed } from "../../../scripts/seed/guard";

const LOCAL_URL = "http://127.0.0.1:54321";
const PROD_REF = "prodref00000000000000";
const PROD_URL = `https://${PROD_REF}.supabase.co`;
const STAGING_REF = "stagingref0000000000";
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;

let tmpDir: string;

/** Writes a throwaway env fixture and returns its path. Never the real file. */
function envFixture(contents: string): string {
  const p = path.join(tmpDir, `env-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(p, contents, "utf8");
  return p;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-guard-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("assertSeedTargetAllowed", () => {
  it("allows the local stack — the only target the loader may write to", () => {
    const envPath = envFixture(`NEXT_PUBLIC_SUPABASE_URL=${PROD_URL}\n`);

    expect(assertSeedTargetAllowed(LOCAL_URL, { envFilePath: envPath, env: {} })).toBe(
      LOCAL_URL
    );
  });

  it("REFUSES the production project named in the env file, by ref", () => {
    const envPath = envFixture(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=irrelevant\nNEXT_PUBLIC_SUPABASE_URL=${PROD_URL}\n`
    );

    expect(() =>
      assertSeedTargetAllowed(PROD_URL, {
        envFilePath: envPath,
        // Even fully acknowledged as "staging", production is refused by name.
        env: {
          SEED_STAGING_PROJECT_REF: PROD_REF,
          SEED_I_UNDERSTAND_TARGET: "staging",
        },
      })
    ).toThrow(/production/i);
  });

  it("REFUSES an arbitrary hosted project that is neither local nor acknowledged staging", () => {
    const envPath = envFixture(`NEXT_PUBLIC_SUPABASE_URL=${PROD_URL}\n`);

    expect(() =>
      assertSeedTargetAllowed("https://someoneelsesproject.supabase.co", {
        envFilePath: envPath,
        env: {},
      })
    ).toThrow(/REFUSED/);
  });

  it("REFUSES a staging target that has not been explicitly acknowledged", () => {
    const envPath = envFixture(`NEXT_PUBLIC_SUPABASE_URL=${PROD_URL}\n`);

    expect(() =>
      assertSeedTargetAllowed(STAGING_URL, {
        envFilePath: envPath,
        // The ref is named but the second, independent signal is absent.
        env: { SEED_STAGING_PROJECT_REF: STAGING_REF },
      })
    ).toThrow(/SEED_I_UNDERSTAND_TARGET/);
  });

  it("FAILS CLOSED when the deny key cannot be extracted, even with staging fully acknowledged", () => {
    // A custom domain in the env file: the file exists, the pattern misses.
    const envPath = envFixture(
      "NEXT_PUBLIC_SUPABASE_URL=https://db.uni-verse.example.com\n"
    );

    expect(() =>
      assertSeedTargetAllowed(STAGING_URL, {
        envFilePath: envPath,
        env: {
          SEED_STAGING_PROJECT_REF: STAGING_REF,
          SEED_I_UNDERSTAND_TARGET: "staging",
        },
      })
    ).toThrow(/deny key/i);
  });
});
