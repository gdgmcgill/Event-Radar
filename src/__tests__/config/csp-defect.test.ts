/**
 * DEFECT characterization — F-055: the production Content-Security-Policy
 * allowed 'unsafe-eval' and 'unsafe-inline' (plan 06-07 pinned it; plan 06-16
 * removed 'unsafe-eval' outside development and admits the build's own
 * Supabase origin, research § H and C13, DEC-77). 'unsafe-inline' is the OPEN
 * half of F-055 and stays pinned here until the nonce policy (DI-80).
 *
 * Measured by calling `next.config.js`'s own `headers()` with `NODE_ENV`,
 * `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SENTRY_DSN` set for the call and
 * restored after. The policy is built from the environment the build sees.
 *
 * What is pinned (after the 06-16 move; defect-ledger rows cite F-055):
 *   - P1 exactly one rule, source `/(.*)`, carries a Content-Security-Policy;
 *   - P2 MOVED: production script-src is exactly `'self' 'unsafe-inline'`:
 *     no 'unsafe-eval', and 'unsafe-inline' remains (the open half, DI-80);
 *   - P3 a production build (its Supabase URL under `*.supabase.co`) keeps
 *     connect-src exactly
 *     `'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com`
 *     and does not admit the local stack;
 *   - P3b MOVED: a build whose NEXT_PUBLIC_SUPABASE_URL is the local stack
 *     admits `http://127.0.0.1:54321` in img-src and connect-src and
 *     `ws://127.0.0.1:54321` in connect-src, which is what lets the Playwright
 *     harness run with `bypassCSP: false` (C13);
 *   - P4 MOVED: the development policy is the production policy with
 *     'unsafe-eval' added to script-src, and nothing else different;
 *   - P5 an https Sentry DSN adds its ingest origin (never the key) to
 *     connect-src; an unusable one adds nothing.
 */

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

interface NextConfigShape {
  headers(): Promise<HeaderRule[]>;
}

const ENV = process.env as Record<string, string | undefined>;
const PRODUCTION_SUPABASE = "https://abcdefghijklmnop.supabase.co";
const LOCAL_SUPABASE = "http://127.0.0.1:54321";
const BASE_CONNECT =
  "'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com";

type BuildEnv = {
  NODE_ENV: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
};

const CSP_ENV_KEYS = ["NODE_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SENTRY_DSN"] as const;

async function cspUnder(build: BuildEnv): Promise<{ rules: HeaderRule[]; csp: string }> {
  const saved: Record<string, string | undefined> = {};
  for (const key of CSP_ENV_KEYS) {
    saved[key] = ENV[key];
    const value = build[key];
    if (value === undefined) delete ENV[key];
    else ENV[key] = value;
  }
  try {
    let config: NextConfigShape | undefined;
    jest.isolateModules(() => {
      config = require("../../../next.config.js") as NextConfigShape;
    });
    const rules = await (config as NextConfigShape).headers();
    const csp = rules
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;
    return { rules, csp: csp ?? "" };
  } finally {
    for (const key of CSP_ENV_KEYS) {
      if (saved[key] === undefined) delete ENV[key];
      else ENV[key] = saved[key];
    }
  }
}

function directive(csp: string, name: string): string | undefined {
  return csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);
}

const PRODUCTION: BuildEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_SUPABASE,
};

describe("next.config.js: the production CSP", () => {
  it("P1 one rule, source /(.*), carries the Content-Security-Policy", async () => {
    const { rules } = await cspUnder(PRODUCTION);
    const withCsp = rules.filter((rule) =>
      rule.headers.some((header) => header.key === "Content-Security-Policy")
    );
    expect(withCsp.map((rule) => rule.source)).toEqual(["/(.*)"]);
  });

  it("P2 production script-src has no 'unsafe-eval' and still has 'unsafe-inline' (DI-80)", async () => {
    const { csp } = await cspUnder(PRODUCTION);
    expect(directive(csp, "script-src")).toBe("'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("P3 a production build keeps connect-src and does not admit the local stack", async () => {
    const { csp } = await cspUnder(PRODUCTION);
    const connect = directive(csp, "connect-src");
    expect(connect).toBe(BASE_CONNECT);
    expect(connect).not.toContain(LOCAL_SUPABASE);
  });

  it("P3b a build whose Supabase URL is the local stack admits it (and its ws twin)", async () => {
    const { csp } = await cspUnder({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE });
    expect(directive(csp, "connect-src")).toBe(
      `${BASE_CONNECT} ${LOCAL_SUPABASE} ws://127.0.0.1:54321`
    );
    expect(directive(csp, "img-src")?.split(" ")).toContain(LOCAL_SUPABASE);
    expect(directive(csp, "script-src")).toBe("'self' 'unsafe-inline'");
  });

  it("P4 the development policy is the production policy plus 'unsafe-eval' in script-src", async () => {
    const production = await cspUnder(PRODUCTION);
    const development = await cspUnder({ ...PRODUCTION, NODE_ENV: "development" });
    expect(directive(development.csp, "script-src")).toBe("'self' 'unsafe-inline' 'unsafe-eval'");
    expect(development.csp.replace(" 'unsafe-eval'", "")).toBe(production.csp);
  });

  it("P5 an https Sentry DSN adds its ingest origin to connect-src, never the key", async () => {
    const { csp } = await cspUnder({
      ...PRODUCTION,
      NEXT_PUBLIC_SENTRY_DSN: "https://0123abcd@o42.ingest.us.sentry.io/4507",
    });
    expect(directive(csp, "connect-src")).toBe(`${BASE_CONNECT} https://o42.ingest.us.sentry.io`);
    expect(csp).not.toContain("0123abcd");
    const unusable = await cspUnder({ ...PRODUCTION, NEXT_PUBLIC_SENTRY_DSN: "http://k@o42.ingest.us.sentry.io/1" });
    expect(directive(unusable.csp, "connect-src")).toBe(BASE_CONNECT);
  });
});
