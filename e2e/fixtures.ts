/**
 * fixtures.ts — the harness's shared vocabulary.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * Every spec imports its persona's storage-state path and the seed's fixed ids
 * from here, and from here only. Two things follow from that:
 *
 *   1. Persona identity is a property of the SPEC, declared at the top of the
 *      file via `test.use({ storageState })`, not a property of the run order.
 *      A spec cannot accidentally inherit whoever was signed in last.
 *   2. No spec navigates by searching for text that another row could match. It
 *      navigates to `/events/<fixed id>`, so a passing assertion is an assertion
 *      about the row the seed created and not about whatever sorted first.
 *
 * The ids and persona keys are re-exported from `scripts/seed/personas.ts`
 * rather than restated. One definition, two consumers.
 */

import fs from "node:fs";
import path from "node:path";

import { IDS, PERSONA_CREDENTIALS, type PersonaKey } from "../scripts/seed/personas";

export { IDS, PERSONA_CREDENTIALS };
export type { PersonaKey };

/** Where `auth.setup.ts` writes each persona's state. Gitignored, never committed. */
export const STORAGE_STATE_DIR = "playwright/.auth";

export const storageStateFor = (persona: PersonaKey): string =>
  `${STORAGE_STATE_DIR}/${persona}.json`;

/**
 * The protected paths, RE-DERIVED at module load from `src/proxy.ts`.
 *
 * The project instructions name that file as the ONLY authority for this list
 * and warn against trusting a copy — `src/proxy.test.ts` holds a transcription
 * of it that could drift. So this reads the source and parses the array rather
 * than restating it, which means a spec asserting "this path redirects" cannot
 * be asserting about a path the ring no longer guards.
 */
export function protectedRoutes(): string[] {
  // Resolved from this file so it works whatever the process cwd is.
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "src", "proxy.ts"),
    "utf8"
  );
  const body = source.match(/PROTECTED_ROUTES\s*=\s*\[([^\]]*)\]/)?.[1];
  if (!body) {
    throw new Error(
      "Could not re-derive PROTECTED_ROUTES from src/proxy.ts. The ring moved; " +
        "fix this parser rather than hard-coding the list."
    );
  }
  return body
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** The proxy sends unauthenticated callers here, carrying the intended path. */
export const signInRedirectFor = (path: string): string =>
  `/?signin=required&next=${encodeURIComponent(path)}`;

/** The proxy sends banned callers here. */
export const BANNED_PATH = "/banned";

/**
 * The signed-out affordance, by its accessible name.
 *
 * At the Desktop Chrome viewport the shell renders `<SignInButton variant=
 * "default" />` in the top right for guests only (`AppShell.tsx`), and its label
 * is "Sign In with McGill Email". Its ABSENCE is how a spec knows the injected
 * cookies produced a session the application itself accepted — a client-side
 * `getUser()` would only prove the client was happy.
 */
export const SIGN_IN_AFFORDANCE = /sign in with mcgill email/i;
