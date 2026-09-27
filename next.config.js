const { withSentryConfig } = require("@sentry/nextjs/config");

// ─── Content-Security-Policy (F-055, DI-21, C13, DEC-77; plan 06-16) ────────
//
// Built when Next evaluates the config (`next build` for production, `next dev`
// for development), from the environment that build sees:
//   - 'unsafe-eval' is in script-src ONLY under `next dev` (NODE_ENV
//     "development"): React uses eval there for its debugging stacks; neither
//     React nor Next uses it in production (Next's CSP guide). INTENTIONAL
//     BEHAVIOUR CHANGE: production pages no longer permit eval.
//   - 'unsafe-inline' stays: the inline theme script in src/app/layout.tsx and
//     Next's own bootstrap need it. A nonce policy is DI-80 (it would force
//     every page to render dynamically).
//   - NEXT_PUBLIC_SUPABASE_URL: when its origin is not already admitted by the
//     `*.supabase.co` wildcards, that origin joins img-src and connect-src and
//     its ws/wss twin joins connect-src. Production (`https://<ref>.supabase.co`)
//     is unchanged; the Playwright harness build (`http://127.0.0.1:54321`)
//     admits the local stack, so the harness runs with the CSP enforced
//     (`bypassCSP: false` in playwright.config.ts).
//   - NEXT_PUBLIC_SENTRY_DSN: when it is an https DSN, its ingest origin joins
//     connect-src (the browser posts events there directly; no tunnel).
// Every other directive is byte-identical to the policy before plan 06-16.

/** The origin of an http(s) URL, or null when the value is absent or does not parse. */
function httpOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** True when `https://*.supabase.co` (and its wss twin) already admits the origin. */
function supabaseWildcardCovers(origin) {
  const url = new URL(origin);
  return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
}

/**
 * The ingest origin of a usable Sentry DSN (https, a public key, a project
 * id; the rule of `usableSentryDsn` in src/lib/env.ts), else null. The origin
 * never carries the key.
 */
function sentryIngestOrigin(dsn) {
  if (typeof dsn !== "string" || dsn.trim() === "") return null;
  try {
    const url = new URL(dsn.trim());
    if (url.protocol !== "https:" || url.username === "") return null;
    if (url.pathname.replace(/\//g, "") === "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** The Content-Security-Policy header value for the environment `env`. */
function contentSecurityPolicy(env, { docs = false } = {}) {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (env.NODE_ENV === "development") scriptSrc.push("'unsafe-eval'");

  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://images.unsplash.com",
    "https://*.cdninstagram.com",
    "https://*.fbcdn.net",
  ];
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://raw.githubusercontent.com",
  ];

  const supabase = httpOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabase !== null && !supabaseWildcardCovers(supabase)) {
    imgSrc.push(supabase);
    connectSrc.push(supabase, supabase.replace(/^http/, "ws"));
  }
  const sentry = sentryIngestOrigin(env.NEXT_PUBLIC_SENTRY_DSN);
  if (sentry !== null) connectSrc.push(sentry);
  if (docs) imgSrc.push("https://cdn.redoc.ly/redoc/logo-mini.svg");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    ...(docs ? ["worker-src 'self' blob:"] : []),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // SECURITY CONTROL, NOT A PERFORMANCE SETTING. This disables the Next.js Image
    // Optimization endpoint (/_next/image) — the endpoint that carried GHSA-2xp9-vwfh-vxw4,
    // the unauthenticated remote-code-execution via AVIF patched upstream in next 16.3.3 and
    // closed on this project by the 16.3.5 upgrade (see .planning/phases/
    // 02-dependency-and-runtime-stabilization/evidence/next-upgrade-note.md).
    // Flipping this to false re-arms a request-reachable attack surface, so it requires a
    // security review and not just a performance conversation.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(process.env),
          },
        ],
      },
      // Last matching same-key header wins in Next; this replaces the base
      // CSP on /docs, rather than sending two intersecting CSP policies.
      // Redoc's installed search worker uses a same-origin blob, and its
      // attribution logo uses this exact URL. Other pages retain the base CSP.
      {
        source: "/docs",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy(process.env, { docs: true }) }],
      },
    ];
  },
};

// Sentry's build integration (plan 06-16, DEC-61, DEC-76). The build never
// needs a Sentry credential: with no SENTRY_AUTH_TOKEN, source maps are
// disabled and nothing is uploaded. There is deliberately no tunnel option
// (it would add an unauthenticated same-origin endpoint, T-06-16-04), and the
// plugin's own telemetry is off, so a build sends nothing to Sentry.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
