/**
 * Search-input escaping for PostgREST `ilike` filters.
 *
 * F-082 / REFAC-10 (plan 04-08, shipped under DEC-32). The events list's
 * search fallback used to interpolate the raw term into an `or()` logic tree:
 *
 *     `title.ilike.%${search}%,description.ilike.%${search}%`
 *
 * `.or()` escapes nothing (postgrest-js appends the string verbatim), so a
 * comma split the group into a PostgREST 400 PGRST100 (which the handler
 * turned into a 500 echoing the filter, F-059), and `%` / `_` were live LIKE
 * wildcards, so a search for `%` matched every event.
 *
 * ─── The two-layer model ────────────────────────────────────────────────────
 *
 * A search term passes through two parsers, so it is escaped twice, inside
 * out:
 *
 *   1. SQL LIKE (`escapeLikeLiteral`). Backslash, `%` and `_` are made literal
 *      by prefixing a backslash. PostgREST exposes no `ESCAPE` clause, so this
 *      relies on Postgres's DEFAULT LIKE escape character, which is backslash.
 *   2. PostgREST's quoted value (`postgrestQuotedValue`). Wrapping the pattern
 *      in double quotes is what keeps a comma, a parenthesis or a dot inside
 *      the value instead of in the logic-tree grammar. Inside the quotes,
 *      backslash and double quote are escaped with a backslash; PostgREST
 *      consumes that backslash when it unquotes.
 *
 * Because layer 2 consumes one backslash, a LIKE escape must arrive doubled.
 * The measured rows of 04-RESEARCH.md § Q(f) that show it:
 *
 *   - a literal `%` is sent as `"%100\\%%"`: two backslashes, one eaten by the
 *     quoted-value layer, one left for LIKE;
 *   - a literal `_` is sent as `"%a\\_b%"`: the same two-backslash shape.
 *
 * The double-quote and backslash rows were research assumption A2; they are
 * measured against the local PostgREST by
 * `scripts/probes/search-escape-probe.ts`.
 *
 * ─── Asterisk — knowingly out of scope ──────────────────────────────────────
 *
 * PostgREST rewrites every `*` in a like/ilike value to `%`, after unquoting
 * and ignoring backslashes (PostgREST
 * `src/library/PostgREST/Query/SqlFragment.hs`: `T.map star val` for
 * OpLike/OpILike, `star c = if c == '*' then '%' else c`). No ilike pattern
 * can therefore express a literal `*`. Measured on local PostgREST v16.1
 * (2026-09-23): a quoted `"%*%"` returned both seeded approved events. If
 * `escapeLikeLiteral` escaped `*`, LIKE would receive `\%`, a literal
 * percent, and a `*` search would return rows containing `%`: a new wrong
 * result. So `*` is left untouched and behaves exactly as before 04-08 (a
 * wildcard). ROADMAP criterion 3 names only `%` and `_`. The unit test and the
 * probe's KNOWN row pin this (threat T-04-08-06). The fuzzy RPC path
 * (`search_events_fuzzy`, broken by F-078 and fixed in Phase 5) takes the term
 * as an RPC argument and never goes through the star rewrite, so it is the
 * natural owner of a literal-`*` search.
 */

/**
 * Make a term literal for SQL LIKE / ILIKE: prefix backslash, `%` and `_`
 * with a backslash. `*` is deliberately left alone (see the file header).
 *
 * @param term - Raw user input
 * @returns The term with LIKE metacharacters escaped
 */
export function escapeLikeLiteral(term: string): string {
  return term.replace(/[\\%_]/g, (c) => "\\" + c);
}

/**
 * Render a value as a PostgREST double-quoted value: escape backslash and
 * double quote with a backslash, then wrap in double quotes. Comma,
 * parentheses and dot are safe inside the quotes and are left as-is.
 *
 * @param value - The value to quote (already LIKE-escaped, if it is a pattern)
 * @returns The quoted value, e.g. `"a,b"`
 */
export function postgrestQuotedValue(value: string): string {
  return '"' + value.replace(/[\\"]/g, (c) => "\\" + c) + '"';
}

/**
 * Build one `or()` condition matching rows whose `column` contains `term`
 * literally, case-insensitively.
 *
 * @param column - Column name (trusted, never user input)
 * @param term - Raw user input
 * @returns e.g. `title.ilike."%100\\%%"` for the term `100%`
 */
export function ilikeContainsFilter(column: string, term: string): string {
  return `${column}.ilike.${postgrestQuotedValue(
    "%" + escapeLikeLiteral(term) + "%"
  )}`;
}
