import coreWebVitals from "eslint-config-next/core-web-vitals";
import { LEGACY_ELEVATED_CALLSITES } from "./eslint.elevated-allowlist.mjs";

const eslintConfig = [
  { ignores: [".claude/**", ".next/**", "AI/**", "node_modules/**", "demo-video/**"] },
  ...coreWebVitals,
  {
    // REFAC-05: src/server/db/elevated/ is the only door to the service-role
    // client. A new file under src/app/** that reaches the RLS-bypassing
    // credential fails the build.
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      // `patterns` ONLY. Supplying `paths` as well double-reports every import,
      // which makes the error count meaningless and breaks the zero-error
      // baseline check this rule has to keep green.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/supabase/service", "@/lib/supabase/service"],
              message:
                "Service-role access must go through src/server/db/elevated/ and be recorded in its REGISTRY.md.",
            },
            {
              group: ["@supabase/supabase-js"],
              message:
                "Import the typed factories; do not construct a raw SDK client in src/app/**.",
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
    rules: { "no-restricted-imports": "off" },
  },
];

export default eslintConfig;
