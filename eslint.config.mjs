import coreWebVitals from "eslint-config-next/core-web-vitals";
import { LEGACY_ELEVATED_CALLSITES } from "./eslint.elevated-allowlist.mjs";

// The credential's two sanctioned homes: src/lib/supabase/ DEFINES the
// service-role factory, src/server/db/elevated/ is the one door to it. Neither
// is a reach into the credential, so neither is under the boundary.
// scripts/check-elevated-ratchet.mjs exempts exactly the same two prefixes.
const ELEVATED_HOMES = ["src/lib/supabase/**", "src/server/db/elevated/**"];

const ELEVATED_MESSAGE =
  "Service-role access must go through src/server/db/elevated/ and be recorded in its REGISTRY.md.";

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
    rules: { "@typescript-eslint/no-restricted-imports": "off" },
  },
];

export default eslintConfig;
