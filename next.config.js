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

module.exports = nextConfig;
