/**
 * .planning/audit/quality/depcruise.config.cjs
 *
 * Ad-hoc dependency-cruiser config for the Phase 1 read-only foundation audit.
 *
 * WHY IT LIVES HERE AND NOT AT THE REPO ROOT
 * ------------------------------------------
 * The repo's config precedent (jest.config.js, eslint.config.mjs) is repo-root,
 * but this phase's exit criterion is that nothing outside .planning/ changes.
 * Creating `.dependency-cruiser.cjs` at the root would itself be the violation
 * the audit exists to avoid. The config is passed explicitly with `-c <path>`
 * instead (01-PATTERNS.md § No Analog Found, config-location row).
 *
 * THE @/ ALIAS IS RESOLVED, NOT RE-DECLARED
 * -----------------------------------------
 * `tsconfig.json` maps `@/*` -> `./src/*`. dependency-cruiser is pointed at that
 * file via `options.tsConfig` so the mapping has exactly one source of truth.
 * Re-declaring the mapping here would let the two drift silently and would make
 * every `@/...` import look like an unresolvable module (i.e. a fake orphan).
 *
 * Invoked (pinned, one-shot, never installed):
 *   # full module graph (orphan cross-check)
 *   npx --yes dependency-cruiser@18.3.0 -c .planning/audit/quality/depcruise.config.cjs \
 *     -T json "src/**\/*.{ts,tsx}"
 *   # reachability of the API-doc packages
 *   AUDIT_DC_REACHES=1 npx --yes dependency-cruiser@18.3.0 -c .planning/audit/quality/depcruise.config.cjs \
 *     -T json -R 'node_modules/(swagger-ui-react|redoc|next-swagger-doc)' "src/**\/*.{ts,tsx}"
 *
 * TWO EXECUTION FACTS VERIFIED AGAINST 18.3.0 ON THIS TREE (2026-09-14)
 * --------------------------------------------------------------------
 * 1. A bare directory argument (`... -T json src`) cruises NOTHING here:
 *    `summary.totalCruised` is 0 and `modules` is empty. The same invocation
 *    with a glob (`"src/**\/*.{ts,tsx}"`) cruises 308 modules with 0
 *    unresolved dependencies. An empty graph reported as a clean graph is the
 *    worst failure mode this audit can have, so the glob form is mandatory.
 * 2. `--reaches` cannot reach a module that is not in the graph. With
 *    node_modules excluded, a filter naming `redoc`/`swagger-ui-react` matches
 *    zero modules and the run yields a FALSE "nothing reaches it". The
 *    reachability run therefore keeps node_modules as *unfollowed leaf nodes*
 *    (AUDIT_DC_REACHES=1): `doNotFollow` still prevents descending into them,
 *    so the cost is one node per package, not the whole registry.
 *
 * No `forbidden` rules are declared: this phase reports, it does not enforce.
 * Rule enforcement is a Stage 2+ decision that needs the findings this run produces.
 */

// Reachability mode keeps node_modules in the graph as leaves — see fact 2 above.
const REACHES_MODE = process.env.AUDIT_DC_REACHES === '1';

module.exports = {
  forbidden: [],
  options: {
    // Never descend into third-party code; the module graph is about src/.
    doNotFollow: { path: '(^|/)node_modules/' },
    ...(REACHES_MODE ? {} : { exclude: { path: '(^|/)node_modules/' } }),

    // Resolve the `@/*` -> `./src/*` alias from tsconfig rather than restating it.
    tsConfig: { fileName: 'tsconfig.json' },

    // Follow type-only imports too; an export used solely as a type is still a
    // reference, and treating it as dead is how a working file gets deleted.
    tsPreCompilationDeps: true,

    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.d.ts'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },

    reporterOptions: {
      // Keep the JSON reporter's graph payload small enough to diff by hand.
      text: { highlightFocused: true },
    },
  },
};
