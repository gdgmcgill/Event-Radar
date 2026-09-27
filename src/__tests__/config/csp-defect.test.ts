/**
 * DEFECT characterization — F-055: the production Content-Security-Policy
 * allows 'unsafe-eval' and 'unsafe-inline' (plan 06-07 pins it; plan 06-16
 * removes 'unsafe-eval' outside development and derives the Supabase origin
 * for connect-src, research § H and C13)
 *
 * Measured at f550de9 by calling `next.config.js`'s own `headers()` with
 * `NODE_ENV` set to "production" for the call and restored after. The CSP is
 * one static string today: it does not depend on NODE_ENV at all, so the
 * development build and the production build send the same policy.
 *
 * What is pinned:
 *   - P1 exactly one rule, source `/(.*)`, carries a Content-Security-Policy;
 *   - P2 script-src is exactly `'self' 'unsafe-inline' 'unsafe-eval'`;
 *   - P3 connect-src is exactly
 *     `'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com`,
 *     so it does not admit the local stack `http://127.0.0.1:54321`, which is
 *     why the Playwright harness runs with `bypassCSP: true` (C13);
 *   - P4 the development policy equals the production policy.
 *
 * When 06-16 lands, P2 MOVES ('unsafe-eval' gone in production; 'unsafe-inline'
 * stays and the nonce is a Phase 8 DI, a partial close of F-055), P3 MOVES for
 * a build whose NEXT_PUBLIC_SUPABASE_URL is the local stack, and P4 MOVES.
 * Each move takes a defect-ledger row citing F-055.
 */

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

interface NextConfigShape {
  headers(): Promise<HeaderRule[]>;
}

const ENV = process.env as Record<string, string | undefined>;

async function cspUnder(nodeEnv: string): Promise<{ rules: HeaderRule[]; csp: string }> {
  const saved = ENV.NODE_ENV;
  ENV.NODE_ENV = nodeEnv;
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
    if (saved === undefined) delete ENV.NODE_ENV;
    else ENV.NODE_ENV = saved;
  }
}

function directive(csp: string, name: string): string | undefined {
  return csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);
}

describe("next.config.js: the production CSP", () => {
  it("P1 one rule, source /(.*), carries the Content-Security-Policy", async () => {
    const { rules } = await cspUnder("production");
    const withCsp = rules.filter((rule) =>
      rule.headers.some((header) => header.key === "Content-Security-Policy")
    );
    expect(withCsp.map((rule) => rule.source)).toEqual(["/(.*)"]);
  });

  it("P2 script-src allows 'unsafe-inline' and 'unsafe-eval'", async () => {
    const { csp } = await cspUnder("production");
    expect(directive(csp, "script-src")).toBe("'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("P3 connect-src does not admit the local stack http://127.0.0.1:54321", async () => {
    const { csp } = await cspUnder("production");
    const connect = directive(csp, "connect-src");
    expect(connect).toBe(
      "'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com"
    );
    expect(connect).not.toContain("http://127.0.0.1:54321");
  });

  it("P4 the development policy is the production policy", async () => {
    const production = await cspUnder("production");
    const development = await cspUnder("development");
    expect(development.csp).toBe(production.csp);
  });
});
