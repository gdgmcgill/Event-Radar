/**
 * Unit tests for `src/lib/searchFilter.ts` (F-082, REFAC-10, plan 04-08).
 *
 * One `it` per special character, per export, so a regression names the
 * character that broke. String literals below are JavaScript source: `"\\"`
 * is ONE backslash at runtime, so `"100\\%"` is the five characters `100\%`.
 *
 * The live half of this contract (what the real PostgREST and Postgres do
 * with these strings) is measured by `scripts/probes/search-escape-probe.ts`.
 */

import {
  escapeLikeLiteral,
  ilikeContainsFilter,
  postgrestQuotedValue,
} from "./searchFilter";

// ─── escapeLikeLiteral ──────────────────────────────────────────────────────

describe("escapeLikeLiteral — the SQL LIKE layer", () => {
  it("escapes a percent so LIKE matches it literally", () => {
    expect(escapeLikeLiteral("100%")).toBe("100\\%");
  });

  it("escapes an underscore so LIKE matches it literally", () => {
    expect(escapeLikeLiteral("a_b")).toBe("a\\_b");
  });

  it("doubles a backslash so LIKE matches it literally", () => {
    expect(escapeLikeLiteral("a\\b")).toBe("a\\\\b");
  });

  it("leaves a comma alone (not a LIKE metacharacter)", () => {
    expect(escapeLikeLiteral("a,b")).toBe("a,b");
  });

  it("leaves an open parenthesis alone (not a LIKE metacharacter)", () => {
    expect(escapeLikeLiteral("(x")).toBe("(x");
  });

  it("leaves a close parenthesis alone (not a LIKE metacharacter)", () => {
    expect(escapeLikeLiteral("x)")).toBe("x)");
  });

  it("leaves a double quote alone (the quoted-value layer handles it)", () => {
    expect(escapeLikeLiteral('say "hi"')).toBe('say "hi"');
  });

  it("leaves an asterisk unchanged — knowingly out of scope", () => {
    // PostgREST rewrites every `*` in a like/ilike value to `%` AFTER
    // unquoting and ignores backslashes (PostgREST
    // src/library/PostgREST/Query/SqlFragment.hs: `T.map star val` for
    // OpLike/OpILike, `star c = if c == '*' then '%' else c`). No ilike
    // pattern can therefore match a literal `*`. Escaping it would make LIKE
    // see `\%`, a literal percent, so a `*` search would return rows that
    // contain `%` — a new wrong result instead of today's wildcard. Leaving
    // it untouched keeps today's behaviour exactly (DEC-32, T-04-08-06).
    // Changing this assertion is a deliberate decision, not a cleanup.
    expect(escapeLikeLiteral("a*b")).toBe("a*b");
    expect(escapeLikeLiteral("*")).toBe("*");
  });

  it("returns plain text unchanged", () => {
    expect(escapeLikeLiteral("Music Night")).toBe("Music Night");
    expect(escapeLikeLiteral("")).toBe("");
  });

  it("escapes every occurrence, in order, when characters are mixed", () => {
    expect(escapeLikeLiteral("50%_off\\now%")).toBe("50\\%\\_off\\\\now\\%");
  });
});

// ─── postgrestQuotedValue ───────────────────────────────────────────────────

describe("postgrestQuotedValue — the PostgREST quoted-value layer", () => {
  it("wraps plain text in double quotes", () => {
    expect(postgrestQuotedValue("x")).toBe('"x"');
  });

  it("escapes a double quote with a backslash inside the quotes", () => {
    expect(postgrestQuotedValue('a"b')).toBe('"a\\"b"');
  });

  it("escapes a backslash with a backslash inside the quotes", () => {
    expect(postgrestQuotedValue("a\\b")).toBe('"a\\\\b"');
  });

  it("leaves a comma as-is inside the quotes", () => {
    expect(postgrestQuotedValue("a,b")).toBe('"a,b"');
  });

  it("leaves an open parenthesis as-is inside the quotes", () => {
    expect(postgrestQuotedValue("(x")).toBe('"(x"');
  });

  it("leaves a close parenthesis as-is inside the quotes", () => {
    expect(postgrestQuotedValue("x)")).toBe('"x)"');
  });

  it("leaves a dot as-is inside the quotes", () => {
    expect(postgrestQuotedValue("a.b")).toBe('"a.b"');
  });

  it("leaves a percent and an underscore as-is (the LIKE layer handles them)", () => {
    expect(postgrestQuotedValue("%_")).toBe('"%_"');
  });

  it("leaves an asterisk as-is (PostgREST's star rewrite cannot be escaped)", () => {
    expect(postgrestQuotedValue("*")).toBe('"*"');
  });
});

// ─── ilikeContainsFilter ────────────────────────────────────────────────────

describe("ilikeContainsFilter — both layers composed into one or() condition", () => {
  it("plain text: wraps the term in % wildcards inside quotes", () => {
    expect(ilikeContainsFilter("title", "Music Night")).toBe(
      'title.ilike."%Music Night%"'
    );
  });

  it("percent: two backslashes, one for LIKE and one consumed by the quoted-value layer", () => {
    expect(ilikeContainsFilter("title", "100%")).toBe(
      'title.ilike."%100\\\\%%"'
    );
  });

  it("underscore: two backslashes, one for LIKE and one consumed by the quoted-value layer", () => {
    expect(ilikeContainsFilter("title", "a_b")).toBe('title.ilike."%a\\\\_b%"');
  });

  it("backslash: four backslashes, doubled by LIKE and then by the quoted-value layer", () => {
    expect(ilikeContainsFilter("title", "a\\b")).toBe(
      'title.ilike."%a\\\\\\\\b%"'
    );
  });

  it("comma: stays inside the quotes, so it cannot split the or() group", () => {
    expect(ilikeContainsFilter("title", "a,b")).toBe('title.ilike."%a,b%"');
  });

  it("open parenthesis: stays inside the quotes", () => {
    expect(ilikeContainsFilter("title", "(x")).toBe('title.ilike."%(x%"');
  });

  it("close parenthesis: stays inside the quotes", () => {
    expect(ilikeContainsFilter("title", "x)")).toBe('title.ilike."%x)%"');
  });

  it("double quote: escaped once by the quoted-value layer", () => {
    expect(ilikeContainsFilter("title", 'a"b')).toBe('title.ilike."%a\\"b%"');
  });

  it("asterisk: passed through unchanged (knowingly out of scope, DEC-32)", () => {
    expect(ilikeContainsFilter("title", "*")).toBe('title.ilike."%*%"');
  });

  it("composes with the column name, and two columns join into the route's or() argument", () => {
    const joined = [
      ilikeContainsFilter("title", "a,b"),
      ilikeContainsFilter("description", "a,b"),
    ].join(",");
    expect(joined).toBe('title.ilike."%a,b%",description.ilike."%a,b%"');
  });
});
