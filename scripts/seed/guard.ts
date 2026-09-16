/**
 * guard.ts — the seed loader's target assertion. This is the security control.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * WHAT IT DOES
 *   `assertSeedTargetAllowed()` answers one question — may the loader WRITE to
 *   this Supabase URL? — and answers it before any client is constructed. It
 *   returns the URL unchanged when the answer is yes, and throws otherwise.
 *
 * IT FAILS CLOSED, DELIBERATELY
 *   A local loopback URL on a local Supabase port is allowed outright; that path
 *   never reads a file and never consults an environment variable, so it works
 *   on a clean CI runner with no `.env.local`.
 *
 *   Every other target must clear three independent checks: it must be a
 *   recognisable hosted project URL, it must not match the production project
 *   ref, and it must be a named staging project WITH a separate acknowledgement
 *   variable set. Two signals, because one is a stray `export` away from being
 *   set by accident.
 *
 *   And per research § Assumptions Log A10: if the deny key cannot be
 *   established — no env file, or an env file whose URL is a custom domain the
 *   pattern cannot parse — the guard REFUSES rather than proceeding with a dead
 *   deny rule. A guard that cannot name production must not be trusted to avoid
 *   it. The refusal outranks the staging acknowledgement.
 *
 * WHAT IT READS, AND WHAT IT REFUSES TO READ
 *   `.env.local` is opened for exactly one substring: the project ref inside
 *   `NEXT_PUBLIC_SUPABASE_URL`. That value is a DENY KEY, not a credential. No
 *   key, secret or token is read from that file, none is returned, none is
 *   logged. The file is never modified — this module contains no write call of
 *   any kind, and an acceptance criterion greps for that.
 *
 *   The ref is read at run time rather than hard-coded because the Phase 1
 *   redaction ledger substitutes `<PROD-PROJECT-REF>` in every committed
 *   artifact: the production ref may not be committed. Reading it from the
 *   ignored file gives a self-configuring guard with nothing sensitive in git.
 *
 * THE STAGING BRANCH IS IMPLEMENTED AND UNTESTED IN ANGER
 *   There is no staging project on this program (Phase 1 environment capture).
 *   The branch below is written, guarded and unit-tested including its refusals,
 *   but nothing has ever been loaded through it. REFAC-07's "and staging" is
 *   recorded as a PARTIAL for that reason — see `evidence/harness-note.md`.
 */

import fs from "node:fs";
import path from "node:path";

/** Loopback hosts. Anything else is, by definition, somebody else's machine. */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "host.docker.internal"]);

/**
 * The Supabase CLI allocates its local services out of the 54xxx block
 * (`supabase/config.toml`: api 54321, db 54322, studio 54323, ...). Requiring an
 * explicit port in that block keeps `http://localhost` — which is the dev
 * server, not a database — from reading as a seed target.
 */
const LOCAL_PORT_MIN = 54000;
const LOCAL_PORT_MAX = 54999;

/** `https://<ref>.supabase.co` — the shape of every hosted project URL. */
const HOSTED_REF = /^https:\/\/([a-z0-9]+)\.supabase\.(?:co|in)\/?$/i;

export interface SeedGuardEnv {
  SEED_STAGING_PROJECT_REF?: string;
  SEED_I_UNDERSTAND_TARGET?: string;
}

export interface SeedGuardOptions {
  /** Defaults to `process.env`. Injected by the refusal tests. */
  env?: SeedGuardEnv;
  /** Defaults to the repository's ignored `.env.local`. Injected by the tests. */
  envFilePath?: string;
}

/** The deny key, or the reason it could not be established. */
export type DenyKey =
  | { readonly kind: "ref"; readonly ref: string }
  | { readonly kind: "unavailable"; readonly why: string };

const DEFAULT_ENV_FILE = path.resolve(__dirname, "..", "..", ".env.local");

/**
 * Extracts the production project ref from the ignored env file.
 *
 * Reads ONLY the ref out of `NEXT_PUBLIC_SUPABASE_URL`. Never a key. The return
 * type has no "null means fine" case on purpose: the caller must decide what to
 * do about `unavailable`, and the only safe decision is to refuse.
 */
export function productionDenyKey(envFilePath: string = DEFAULT_ENV_FILE): DenyKey {
  let contents: string;
  try {
    contents = fs.readFileSync(envFilePath, "utf8");
  } catch {
    return {
      kind: "unavailable",
      why: `no readable env file at ${envFilePath}`,
    };
  }

  const line = contents
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));

  if (!line) {
    return {
      kind: "unavailable",
      why: `${envFilePath} declares no NEXT_PUBLIC_SUPABASE_URL`,
    };
  }

  const ref = line.match(/https:\/\/([a-z0-9]+)\.supabase\.(?:co|in)/i)?.[1];
  if (!ref) {
    return {
      kind: "unavailable",
      why:
        `NEXT_PUBLIC_SUPABASE_URL in ${envFilePath} is not a ` +
        "https://<ref>.supabase.co URL (a custom domain would do this)",
    };
  }

  return { kind: "ref", ref: ref.toLowerCase() };
}

/** True for a loopback host on a Supabase local port. */
export function isLocalSeedTarget(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!LOCAL_HOSTS.has(url.hostname)) return false;

  const port = Number(url.port);
  return Number.isInteger(port) && port >= LOCAL_PORT_MIN && port <= LOCAL_PORT_MAX;
}

/**
 * Returns `raw` when the loader may write to it. Throws otherwise.
 *
 * This is the loader's first statement. No Supabase client exists when it runs.
 */
export function assertSeedTargetAllowed(
  raw: string | undefined,
  options: SeedGuardOptions = {}
): string {
  const env = options.env ?? (process.env as SeedGuardEnv);
  const envFilePath = options.envFilePath ?? DEFAULT_ENV_FILE;

  if (!raw) {
    throw new Error(
      "REFUSED: SUPABASE_URL is not set. The seed writes to the LOCAL stack only — " +
        "start it and run `supabase status -o env` to see the URL."
    );
  }

  // 1. The allowed case, decided without reading anything.
  if (isLocalSeedTarget(raw)) return raw;

  // 2. Anything else must at least look like a hosted Supabase project.
  const ref = raw.match(HOSTED_REF)?.[1]?.toLowerCase();
  if (!ref) {
    throw new Error(
      `REFUSED: ${raw} is neither a local Supabase stack ` +
        `(loopback host on a port in ${LOCAL_PORT_MIN}-${LOCAL_PORT_MAX}) ` +
        "nor a recognisable https://<ref>.supabase.co project."
    );
  }

  // 3. Fail closed when the deny key is unavailable. This OUTRANKS the staging
  //    acknowledgement below: a guard that cannot name production has no
  //    business writing to any hosted project.
  const deny = productionDenyKey(envFilePath);
  if (deny.kind === "unavailable") {
    throw new Error(
      "REFUSED (fail-closed): the production deny key could not be extracted — " +
        `${deny.why}. The seed refuses every non-local target it cannot check ` +
        "against production. This is deliberate; see scripts/seed/guard.ts."
    );
  }

  // 4. Production, by name.
  if (ref === deny.ref) {
    throw new Error(
      `REFUSED: ${raw} matches the production project ref declared in ` +
        `${envFilePath}. The seed never writes to production.`
    );
  }

  // 5. Staging needs two independent signals.
  const staging = env.SEED_STAGING_PROJECT_REF?.toLowerCase();
  if (!staging || staging !== ref) {
    throw new Error(
      `REFUSED: ${raw} is not the staging project. Set SEED_STAGING_PROJECT_REF ` +
        "to this project's ref, and SEED_I_UNDERSTAND_TARGET=staging, to load it."
    );
  }
  if (env.SEED_I_UNDERSTAND_TARGET !== "staging") {
    throw new Error(
      `REFUSED: ${raw} is the named staging project but the acknowledgement is ` +
        "absent. Set SEED_I_UNDERSTAND_TARGET=staging. Two independent signals " +
        "are required precisely so one stray export cannot arm a remote write."
    );
  }

  return raw;
}
