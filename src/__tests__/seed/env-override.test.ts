/**
 * env-override.test.ts — the SUPABASE_* override is all-or-nothing, asserted by
 * its refusals.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · 03-REVIEW.md WR-04
 *
 * WHY THIS SUITE IS SHAPED LIKE `guard.test.ts`
 *   Same reasoning, one layer earlier: a guard nobody ever watched refuse is a
 *   comment. `guard.test.ts` proves the seed loader refuses the wrong TARGET;
 *   this one proves it refuses a half-finished set of CREDENTIALS before a
 *   target is ever resolved. Six of the seven cases below are refusals.
 *
 *   The environment is injected, never mutated: `readSupabaseOverride` takes the
 *   env object as a parameter precisely so this suite cannot leak a
 *   `process.env` change into the 33 other suites in the run.
 *
 * NOTHING HERE IS A REAL KEY. The values are the literal strings "u", "a" and
 * "s". The module under test must never put a value in its message, so the last
 * case asserts that too — an error message that echoed the key would put a
 * credential in a CI log.
 */

import {
  readSupabaseOverride,
  SUPABASE_OVERRIDE_KEYS,
} from "../../../scripts/seed/envOverride";

const FULL = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "anon-not-a-real-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-not-a-real-key",
};

describe("readSupabaseOverride", () => {
  it("returns null when none of the three names is set — there is no override", () => {
    expect(readSupabaseOverride({})).toBeNull();
  });

  it("returns null when the names exist but are empty — `export FOO=` is not an override", () => {
    expect(
      readSupabaseOverride({
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      })
    ).toBeNull();
  });

  it("returns the trio when all three are set", () => {
    expect(readSupabaseOverride({ ...FULL })).toEqual({
      url: FULL.SUPABASE_URL,
      anonKey: FULL.SUPABASE_ANON_KEY,
      serviceRoleKey: FULL.SUPABASE_SERVICE_ROLE_KEY,
    });
  });

  // The three single-name cases, one per name. THE URL CASE IS THE DEFECT WR-04
  // NAMED: `export SUPABASE_URL=https://<remote>.supabase.co` alone used to
  // produce a remote URL carrying local-stack keys.
  for (const key of SUPABASE_OVERRIDE_KEYS) {
    it(`REFUSES a partial override consisting of ${key} alone`, () => {
      expect(() => readSupabaseOverride({ [key]: "x" })).toThrow(/REFUSED/);
    });
  }

  it("REFUSES two of three, and names the one that is missing", () => {
    expect(() =>
      readSupabaseOverride({
        SUPABASE_URL: FULL.SUPABASE_URL,
        SUPABASE_ANON_KEY: FULL.SUPABASE_ANON_KEY,
      })
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("never echoes a value in the refusal — the names are safe to print, the values are not", () => {
    let message = "";
    try {
      readSupabaseOverride({
        SUPABASE_URL: "https://someremoteproject.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "sensitive-value-that-must-not-be-logged",
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    expect(message).toMatch(/REFUSED/);
    expect(message).not.toContain("sensitive-value-that-must-not-be-logged");
    expect(message).not.toContain("someremoteproject");
  });
});
