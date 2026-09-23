import coreWebVitals from "eslint-config-next/core-web-vitals";
import { LEGACY_ELEVATED_CALLSITES } from "./eslint.elevated-allowlist.mjs";

// The credential's two sanctioned homes: src/lib/supabase/ DEFINES the
// service-role factory, src/server/db/elevated/ is the one door to it. Neither
// is a reach into the credential, so neither is under the boundary.
// scripts/check-elevated-ratchet.mjs exempts exactly the same two prefixes.
const ELEVATED_HOMES = ["src/lib/supabase/**", "src/server/db/elevated/**"];

const ELEVATED_MESSAGE =
  "Service-role access must go through src/server/db/elevated/ and be recorded in its REGISTRY.md.";

const ELEVATED_KEY_MESSAGE =
  "Do not read SUPABASE_SERVICE_ROLE_KEY outside src/lib/supabase/. Service-role access must go through src/server/db/elevated/ and be recorded in its REGISTRY.md.";

const eslintConfig = [
  { ignores: [".claude/**", ".next/**", "AI/**", "node_modules/**", "demo-video/**"] },
  ...coreWebVitals,
  {
    // REFAC-05: src/server/db/elevated/ is the only door to the service-role
    // client. A new file anywhere under src/** that reaches the RLS-bypassing
    // credential fails the build.
    //
    // Widened from src/app/** to src/** by plan 04-03 (DI-34): the app-only
    // glob could not see a src/lib/ module that constructs the client and is
    // imported by a route — src/lib/audit.ts was exactly that. The file that
    // REACHES is the one that fails; a route importing it does not.
    //
    // This is @typescript-eslint/no-restricted-imports, not the core rule,
    // because the widened scope takes in two TYPE-ONLY importers of the SDK
    // (src/server/context.ts, src/server/authz/requireUser.ts), and a type
    // import is erased at compile time — it cannot construct a client.
    // eslint-config-next already registers the plugin (8.47.0), so nothing is
    // installed. `allowTypeImports` is per pattern group.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ELEVATED_HOMES,
    rules: {
      // `patterns` ONLY. Supplying `paths` as well double-reports every import,
      // which makes the error count meaningless and breaks the zero-error
      // baseline check this rule has to keep green.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/supabase/service", "@/lib/supabase/service"],
              allowTypeImports: true,
              message: ELEVATED_MESSAGE,
            },
            {
              group: ["@supabase/supabase-js"],
              allowTypeImports: true,
              message:
                "Import the typed factories; do not construct a raw SDK client outside src/lib/supabase/.",
            },
          ],
        },
      ],
    },
  },
  {
    // DI-31's two evasions of the import boundary above, closed by plan 04-03.
    // The boundary sees static import and export declarations only, so it
    // cannot see:
    //   1. a bare read of the service-role key — build the client inline from
    //      process.env.SUPABASE_SERVICE_ROLE_KEY with no restricted import;
    //   2. a dynamic `await import("@/lib/supabase/service")` — an expression,
    //      not a declaration. src/app/api/clubs/[id]/route.ts:202 does exactly
    //      this today and is held only by the allow-list below.
    //
    // The key is NAMED. The broad form — ban process.env outright — is what
    // DI-31 recorded as unshippable: it turns every legitimate NEXT_PUBLIC_*
    // configuration read into an error. Only the service-role key is banned.
    //
    // Same files and homes as the boundary. Test files are exempt from THIS
    // rule only: they set the variable for their own process (seed guard and
    // callback tests), which reaches nothing in production.
    //
    // No existing no-restricted-syntax configuration is overwritten:
    // `npx eslint --print-config` reports the rule unconfigured on route, lib
    // and test files before this block (evidence/boundary-widening.txt § 7).
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [...ELEVATED_HOMES, "src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // process.env.SUPABASE_SERVICE_ROLE_KEY, process.env["SUPABASE_SERVICE_ROLE_KEY"]
          // (and process["env"] for either)
          selector:
            "MemberExpression[object.object.name='process']:matches([object.property.name='env'], [object.property.value='env']):matches([property.name='SUPABASE_SERVICE_ROLE_KEY'], [property.value='SUPABASE_SERVICE_ROLE_KEY'])",
          message: ELEVATED_KEY_MESSAGE,
        },
        {
          // const { SUPABASE_SERVICE_ROLE_KEY } = process.env — the same read,
          // spelled as a destructuring pattern instead of a member access.
          selector:
            "VariableDeclarator[init.object.name='process']:matches([init.property.name='env'], [init.property.value='env']) > ObjectPattern > Property:matches([key.name='SUPABASE_SERVICE_ROLE_KEY'], [key.value='SUPABASE_SERVICE_ROLE_KEY'])",
          message: ELEVATED_KEY_MESSAGE,
        },
        {
          // import("@/lib/supabase/service"), import("../../lib/supabase/service")
          selector: "ImportExpression[source.value=/lib.supabase.service(\\.\\w+)?$/]",
          message: ELEVATED_MESSAGE,
        },
      ],
    },
  },
  {
    // THE RATCHET — the sanctioned relaxation, in one reviewable generated file.
    // It holds the legacy callsites that pre-date the boundary. It may only
    // SHRINK: Phases 4-6 delete rows as each route moves to the seam, and
    // scripts/check-elevated-ratchet.mjs fails if the live census ever contains
    // an entry this list does not.
    //
    // The rule is NOT downgraded to "warn" and no legacy callsite carries an
    // inline disable comment. Both would zero the error count while removing
    // the control; this list is the one relaxation, and it is auditable.
    files: LEGACY_ELEVATED_CALLSITES,
    // It turns off every boundary rule, including the no-restricted-syntax
    // companion: two legacy entries (calculate-popularity, auth/callback) read
    // the service-role key inline and one (clubs/[id]) imports the service
    // module dynamically. They leave this list the same way as the rest.
    rules: {
      "@typescript-eslint/no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;
