const { withSentryConfig } = require("@sentry/nextjs/config");

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
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.cdninstagram.com https://*.fbcdn.net",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
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
